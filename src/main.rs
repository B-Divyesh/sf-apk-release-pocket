use apk_info::{Apk as ApkInfo, Signature as ParsedSignature};
use apksig::{Algorithms, Apk as SignedApk, ValueSigningBlock};
use clap::{Args, Parser, Subcommand};
use qrcode::{QrCode, render::svg};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    process::ExitCode,
};
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Parser, Debug)]
#[command(
    name = "arp",
    version,
    about = "Verify Android APK identity and build a self-hosted release pocket",
    long_about = "APK Release Pocket verifies an APK Signature Scheme v2 signature, reads install compatibility facts, and creates a static download page with immutable rollback history. It never signs or uploads your APK."
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Verify a signed APK and print its release facts without writing files
    Inspect(InspectArgs),
    /// Verify an APK, enforce release identity, and update a static pocket
    Release(ReleaseArgs),
}

#[derive(Args, Debug)]
struct InspectArgs {
    /// Path to a signed .apk file
    apk: PathBuf,
    /// Emit one JSON object for scripts and CI
    #[arg(long)]
    json: bool,
    /// Refuse a signer other than this SHA-256 certificate fingerprint
    #[arg(long, value_name = "SHA256")]
    expected_fingerprint: Option<String>,
    /// Disable decorative terminal output (all commands are non-interactive)
    #[arg(long)]
    ci: bool,
}

#[derive(Args, Debug)]
struct ReleaseArgs {
    /// Path to a signed .apk file
    apk: PathBuf,
    /// Directory to create or update
    #[arg(long, value_name = "DIR")]
    out: PathBuf,
    /// Public URL where the pocket will be hosted
    #[arg(long, value_name = "URL")]
    base_url: String,
    /// Human-readable app title (defaults to application label or package name)
    #[arg(long)]
    title: Option<String>,
    /// Short release notes shown beside this build
    #[arg(long, default_value = "No release notes supplied.")]
    notes: String,
    /// Refuse a signer other than this SHA-256 certificate fingerprint
    #[arg(long, value_name = "SHA256")]
    expected_fingerprint: Option<String>,
    /// Permit recording a lower or equal version code
    #[arg(long)]
    allow_downgrade: bool,
    /// Emit one JSON object for scripts and CI
    #[arg(long)]
    json: bool,
    /// Disable decorative terminal output (all commands are non-interactive)
    #[arg(long)]
    ci: bool,
}

#[derive(Debug)]
struct AppError {
    code: u8,
    message: String,
}

impl AppError {
    fn apk(message: impl Into<String>) -> Self {
        Self {
            code: 3,
            message: message.into(),
        }
    }
    fn signature(message: impl Into<String>) -> Self {
        Self {
            code: 4,
            message: message.into(),
        }
    }
    fn fingerprint(message: impl Into<String>) -> Self {
        Self {
            code: 5,
            message: message.into(),
        }
    }
    fn release(message: impl Into<String>) -> Self {
        Self {
            code: 6,
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct Inspection {
    package: String,
    app_label: String,
    version_name: String,
    version_code: u64,
    min_sdk: Option<u32>,
    target_sdk: u32,
    abis: Vec<String>,
    publisher: String,
    publisher_fingerprint_sha256: String,
    signer_fingerprints_sha256: Vec<String>,
    signature_scheme: String,
    signature_verified: bool,
    sha256: String,
    bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct ReleaseRecord {
    title: String,
    #[serde(flatten)]
    inspection: Inspection,
    filename: String,
    url: String,
    published_at: String,
    notes: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
struct ReleaseIndex {
    schema_version: u8,
    generated_by: String,
    latest_sha256: String,
    releases: Vec<ReleaseRecord>,
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("error: {}", error.message);
            ExitCode::from(error.code)
        }
    }
}

fn run(cli: Cli) -> Result<(), AppError> {
    match cli.command {
        Command::Inspect(args) => {
            let inspection = inspect_apk(&args.apk, args.expected_fingerprint.as_deref())?;
            print_inspection(&inspection, args.json, args.ci)
        }
        Command::Release(args) => {
            validate_base_url(&args.base_url)?;
            let inspection = inspect_apk(&args.apk, args.expected_fingerprint.as_deref())?;
            let record = publish(&args, inspection)?;
            if args.json {
                println!("{}", serde_json::to_string(&record).map_err(json_error)?);
            } else {
                let mark = if args.ci { "verified" } else { "✓ verified" };
                println!(
                    "{mark} {} {} ({})",
                    record.title, record.inspection.version_name, record.inspection.version_code
                );
                println!(
                    "  publisher  {}",
                    record.inspection.publisher_fingerprint_sha256
                );
                println!("  pocket     {}", args.out.join("index.html").display());
                println!("  download   {}", record.url);
            }
            Ok(())
        }
    }
}

fn inspect_apk(path: &Path, expected: Option<&str>) -> Result<Inspection, AppError> {
    if path
        .extension()
        .and_then(|v| v.to_str())
        .map(|v| v.eq_ignore_ascii_case("apk"))
        != Some(true)
    {
        return Err(AppError::apk(format!(
            "{} is not an .apk file",
            path.display()
        )));
    }
    let metadata = fs::metadata(path)
        .map_err(|e| AppError::apk(format!("cannot read {}: {e}", path.display())))?;
    if !metadata.is_file() {
        return Err(AppError::apk(format!("{} is not a file", path.display())));
    }

    let (fingerprints, scheme) = verify_v2(path)?;
    let fingerprint = fingerprints
        .first()
        .cloned()
        .ok_or_else(|| AppError::signature("the v2 signer has no certificate"))?;
    if let Some(wanted) = expected {
        let wanted = normalize_fingerprint(wanted)?;
        if wanted != fingerprint {
            return Err(AppError::fingerprint(format!(
                "publisher mismatch: expected {wanted}, found {fingerprint}"
            )));
        }
    }

    let parsed = ApkInfo::new(path)
        .map_err(|e| AppError::apk(format!("cannot parse AndroidManifest.xml: {e}")))?;
    let package = parsed
        .get_package_name()
        .ok_or_else(|| AppError::apk("APK manifest has no package name"))?;
    let version_code = parsed
        .get_version_code()
        .ok_or_else(|| AppError::apk("APK manifest has no versionCode"))?
        .parse::<u64>()
        .map_err(|_| AppError::apk("APK versionCode is not an unsigned integer"))?;
    let publisher = publisher_subject(&parsed, &fingerprint)
        .unwrap_or_else(|| "Certificate subject unavailable".into());
    let mut abis = parsed.get_supported_abis();
    abis.sort();
    if abis.is_empty() {
        abis.push("universal / no native code".into());
    }

    Ok(Inspection {
        package: package.clone(),
        app_label: parsed
            .get_application_label()
            .unwrap_or_else(|| package.clone()),
        version_name: parsed
            .get_version_name()
            .unwrap_or_else(|| "unnamed".into()),
        version_code,
        min_sdk: parsed.get_min_sdk_version().and_then(|v| v.parse().ok()),
        target_sdk: parsed.get_target_sdk_version(),
        abis,
        publisher,
        publisher_fingerprint_sha256: fingerprint,
        signer_fingerprints_sha256: fingerprints,
        signature_scheme: scheme,
        signature_verified: true,
        sha256: sha256_file(path).map_err(|e| AppError::apk(format!("cannot hash APK: {e}")))?,
        bytes: metadata.len(),
    })
}

fn verify_v2(path: &Path) -> Result<(Vec<String>, String), AppError> {
    let apk = SignedApk::new(path.to_path_buf())
        .map_err(|e| AppError::signature(format!("cannot open signing block: {e}")))?;
    let block = apk.get_signing_block().map_err(|_| {
        AppError::signature(
            "no APK Signing Block found; v1-only and unsigned APKs are not accepted",
        )
    })?;
    let mut fingerprints = Vec::new();
    let mut found_v2 = false;

    for value in block.content {
        if let ValueSigningBlock::SignatureSchemeV2Block(v2) = value {
            found_v2 = true;
            if v2.signers.signers_data.is_empty() {
                return Err(AppError::signature("APK v2 block contains no signer"));
            }
            for signer in &v2.signers.signers_data {
                let certificate = signer
                    .signed_data
                    .certificates
                    .certificates_data
                    .first()
                    .ok_or_else(|| AppError::signature("APK signer contains no certificate"))?;
                if !contains_bytes(&certificate.certificate, &signer.pub_key.data) {
                    return Err(AppError::signature(
                        "signer public key does not match its certificate",
                    ));
                }
                let signed = signer.signed_data.to_u8();
                let signed = signed
                    .get(4..)
                    .ok_or_else(|| AppError::signature("invalid signed-data framing"))?;
                let mut verified_algorithm = None;
                for signature in &signer.signatures.signatures_data {
                    if !is_supported_rsa(&signature.signature_algorithm_id) {
                        continue;
                    }
                    let digest = signer
                        .signed_data
                        .digests
                        .digests_data
                        .iter()
                        .find(|d| d.signature_algorithm_id == signature.signature_algorithm_id)
                        .ok_or_else(|| {
                            AppError::signature("signature has no matching content digest")
                        })?;
                    signature
                        .signature_algorithm_id
                        .verify(&signer.pub_key.data, signed, &signature.signature)
                        .map_err(|e| {
                            AppError::signature(format!("signed metadata verification failed: {e}"))
                        })?;
                    let actual = apk.digest(&signature.signature_algorithm_id).map_err(|e| {
                        AppError::signature(format!("cannot calculate APK content digest: {e}"))
                    })?;
                    if actual != digest.digest {
                        return Err(AppError::signature(
                            "APK content digest does not match the signed digest",
                        ));
                    }
                    verified_algorithm = Some(short_algorithm(&signature.signature_algorithm_id));
                    break;
                }
                verified_algorithm.ok_or_else(|| {
                    AppError::signature("v2 signer uses an unsupported algorithm; v0.1.0 accepts RSA SHA-256/512 signatures")
                })?;
                let cert_hash = Sha256::digest(&certificate.certificate);
                fingerprints.push(colon_hex(&cert_hash));
            }
        }
    }
    if !found_v2 {
        return Err(AppError::signature(
            "no v2 signature found; v1-only and v3-only APKs are not accepted",
        ));
    }
    fingerprints.sort();
    fingerprints.dedup();
    Ok((
        fingerprints,
        "APK Signature Scheme v2 (content and signer verified)".into(),
    ))
}

fn is_supported_rsa(algorithm: &Algorithms) -> bool {
    matches!(
        algorithm,
        Algorithms::RSASSA_PSS_256
            | Algorithms::RSASSA_PSS_512
            | Algorithms::RSASSA_PKCS1_v1_5_256
            | Algorithms::RSASSA_PKCS1_v1_5_512
    )
}

fn short_algorithm(algorithm: &Algorithms) -> &'static str {
    match algorithm {
        Algorithms::RSASSA_PSS_256 => "RSA-PSS-SHA256",
        Algorithms::RSASSA_PSS_512 => "RSA-PSS-SHA512",
        Algorithms::RSASSA_PKCS1_v1_5_256 => "RSA-PKCS1-SHA256",
        Algorithms::RSASSA_PKCS1_v1_5_512 => "RSA-PKCS1-SHA512",
        _ => "unsupported",
    }
}

fn contains_bytes(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty() && haystack.windows(needle.len()).any(|part| part == needle)
}

fn publisher_subject(apk: &ApkInfo, fingerprint: &str) -> Option<String> {
    apk.get_signatures()
        .ok()?
        .into_iter()
        .find_map(|signature| {
            let certs = match signature {
                ParsedSignature::V2(certs) => certs,
                _ => return None,
            };
            certs.into_iter().find_map(|cert| {
                (normalize_fingerprint_unchecked(&cert.sha256_fingerprint) == fingerprint)
                    .then_some(cert.subject)
            })
        })
}

fn normalize_fingerprint(value: &str) -> Result<String, AppError> {
    let compact: String = value
        .chars()
        .filter(|c| *c != ':' && !c.is_whitespace())
        .collect();
    if compact.len() != 64 || !compact.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::fingerprint(
            "expected fingerprint must contain exactly 64 hexadecimal digits",
        ));
    }
    Ok(colon_hex(
        &hex::decode(compact).expect("validated hexadecimal"),
    ))
}

fn normalize_fingerprint_unchecked(value: &str) -> String {
    normalize_fingerprint(value).unwrap_or_else(|_| value.to_ascii_uppercase())
}

fn colon_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn print_inspection(value: &Inspection, json: bool, ci: bool) -> Result<(), AppError> {
    if json {
        println!("{}", serde_json::to_string(value).map_err(json_error)?);
        return Ok(());
    }
    let mark = if ci { "verified" } else { "✓ VERIFIED" };
    println!("{mark}  {}", value.app_label);
    println!("package     {}", value.package);
    println!(
        "version     {} ({})",
        value.version_name, value.version_code
    );
    println!(
        "SDK         min {} / target {}",
        value
            .min_sdk
            .map_or_else(|| "unspecified".into(), |v| v.to_string()),
        value.target_sdk
    );
    println!("ABI         {}", value.abis.join(", "));
    println!("publisher   {}", value.publisher);
    println!("fingerprint {}", value.publisher_fingerprint_sha256);
    println!("APK SHA-256 {}", value.sha256);
    Ok(())
}

fn validate_base_url(value: &str) -> Result<(), AppError> {
    if !(value.starts_with("https://")
        || value.starts_with("http://localhost")
        || value.starts_with("http://127.0.0.1"))
    {
        return Err(AppError::release(
            "--base-url must use HTTPS (HTTP is allowed only for localhost)",
        ));
    }
    Ok(())
}

fn publish(args: &ReleaseArgs, inspection: Inspection) -> Result<ReleaseRecord, AppError> {
    fs::create_dir_all(args.out.join("releases")).map_err(write_error)?;
    let history_path = args.out.join("releases.json");
    let mut index = if history_path.exists() {
        serde_json::from_slice::<ReleaseIndex>(&fs::read(&history_path).map_err(write_error)?)
            .map_err(|e| AppError::release(format!("cannot read existing releases.json: {e}")))?
    } else {
        ReleaseIndex {
            schema_version: 1,
            generated_by: format!("arp {VERSION}"),
            latest_sha256: String::new(),
            releases: vec![],
        }
    };
    if let Some(previous) = index.releases.first() {
        if previous.inspection.package != inspection.package {
            return Err(AppError::release(format!(
                "package changed from {} to {}; use a new output directory",
                previous.inspection.package, inspection.package
            )));
        }
        if previous.inspection.publisher_fingerprint_sha256
            != inspection.publisher_fingerprint_sha256
        {
            return Err(AppError::fingerprint(format!(
                "publisher changed from {} to {}",
                previous.inspection.publisher_fingerprint_sha256,
                inspection.publisher_fingerprint_sha256
            )));
        }
        if !args.allow_downgrade
            && inspection.version_code <= previous.inspection.version_code
            && inspection.sha256 != previous.inspection.sha256
        {
            return Err(AppError::release(format!(
                "versionCode {} must be greater than current {}; pass --allow-downgrade to record an intentional rollback",
                inspection.version_code, previous.inspection.version_code
            )));
        }
    }

    let title = args
        .title
        .clone()
        .unwrap_or_else(|| inspection.app_label.clone());
    let safe_package = filename_part(&inspection.package);
    let filename = format!(
        "{}-{}-{}.apk",
        safe_package,
        inspection.version_code,
        &inspection.sha256[..12]
    );
    let destination = args.out.join("releases").join(&filename);
    if destination.exists() {
        let existing = sha256_file(&destination).map_err(write_error)?;
        if existing != inspection.sha256 {
            return Err(AppError::release(format!(
                "refusing to overwrite immutable release {}",
                destination.display()
            )));
        }
    } else {
        fs::copy(&args.apk, &destination).map_err(write_error)?;
    }
    let base = args.base_url.trim_end_matches('/');
    let url = format!("{base}/releases/{filename}");
    let published_at = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|e| AppError::release(e.to_string()))?;
    let record = ReleaseRecord {
        title,
        inspection,
        filename,
        url,
        published_at,
        notes: args.notes.clone(),
    };
    index
        .releases
        .retain(|item| item.inspection.sha256 != record.inspection.sha256);
    index.releases.insert(0, record.clone());
    index.latest_sha256 = record.inspection.sha256.clone();
    index.generated_by = format!("arp {VERSION}");

    write_json_atomic(&history_path, &index)?;
    write_json_atomic(&args.out.join("release.json"), &record)?;
    write_atomic(
        &args.out.join("index.html"),
        render_release_page(&index)?.as_bytes(),
    )?;
    write_atomic(
        &args.out.join("SHA256SUMS"),
        checksum_manifest(&index).as_bytes(),
    )?;
    Ok(record)
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> Result<(), AppError> {
    let mut bytes = serde_json::to_vec_pretty(value).map_err(json_error)?;
    bytes.push(b'\n');
    write_atomic(path, &bytes)
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    let tmp = path.with_extension(format!(
        "{}.tmp",
        path.extension().and_then(|v| v.to_str()).unwrap_or("file")
    ));
    fs::write(&tmp, bytes).map_err(write_error)?;
    fs::rename(&tmp, path).map_err(write_error)
}

fn checksum_manifest(index: &ReleaseIndex) -> String {
    let mut seen = BTreeSet::new();
    index
        .releases
        .iter()
        .filter(|item| seen.insert(item.filename.clone()))
        .map(|item| format!("{}  releases/{}", item.inspection.sha256, item.filename))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

fn render_release_page(index: &ReleaseIndex) -> Result<String, AppError> {
    let latest = index
        .releases
        .first()
        .ok_or_else(|| AppError::release("cannot render an empty release index"))?;
    let qr = QrCode::new(latest.url.as_bytes())
        .map_err(|e| AppError::release(format!("cannot create QR: {e}")))?
        .render::<svg::Color>()
        .min_dimensions(220, 220)
        .dark_color(svg::Color("#090d12"))
        .light_color(svg::Color("#f4eddf"))
        .build();
    let history = index
        .releases
        .iter()
        .map(|release| {
            format!(
                "<li><a href=\"{}\">{} <span>code {}</span></a><small>{} · {}</small></li>",
                html(&release.url),
                html(&release.inspection.version_name),
                release.inspection.version_code,
                html(&release.published_at),
                html(&release.inspection.sha256[..12])
            )
        })
        .collect::<String>();
    Ok(format!(
        r##"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} {version} — verified APK</title><meta name="description" content="Verified direct-install Android release for {title}">
<style>:root{{--ink:#090d12;--stall:#101821;--paper:#f4eddf;--smoke:#b9c2c9;--coral:#ff6b57;--cyan:#66e4dd;--amber:#ffc857}}*{{box-sizing:border-box}}body{{margin:0;background:var(--ink);color:var(--paper);font:16px/1.55 system-ui,sans-serif}}a{{color:inherit}}.skip{{position:absolute;left:-999px}}.skip:focus{{left:12px;top:12px;background:var(--cyan);color:#031313;padding:12px;z-index:2}}main,footer{{width:min(920px,calc(100% - 32px));margin:auto}}header{{border-bottom:1px solid #34424d;padding:20px max(16px,calc((100vw - 920px)/2))}}header b{{font:700 20px ui-monospace,monospace;color:var(--coral)}}main{{padding:56px 0}}.verified{{color:var(--cyan);font:700 14px ui-monospace,monospace;letter-spacing:.1em}}h1{{font:800 clamp(40px,8vw,72px)/.95 Arial Narrow,system-ui,sans-serif;max-width:12ch;margin:12px 0 20px}}.lede{{color:var(--smoke);font-size:20px;max-width:58ch}}.ticket{{display:grid;grid-template-columns:1fr 260px;gap:32px;margin:44px 0;background:var(--paper);color:var(--ink);padding:clamp(20px,5vw,44px);clip-path:polygon(0 10px,10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%)}}.button{{display:inline-flex;min-height:48px;align-items:center;background:var(--coral);color:#240704;padding:0 20px;font-weight:800;text-decoration:none;box-shadow:4px 4px 0 #7f2c23}}.button:focus-visible,a:focus-visible{{outline:3px solid var(--cyan);outline-offset:4px}}dl{{display:grid;grid-template-columns:max-content 1fr;gap:10px 18px}}dt{{font:700 13px ui-monospace,monospace;text-transform:uppercase}}dd{{margin:0;overflow-wrap:anywhere}}code{{font-family:ui-monospace,monospace}}.qr svg{{width:100%;height:auto}}h2{{font:800 30px Arial Narrow,system-ui,sans-serif;margin-top:48px}}ol{{padding-left:22px}}li{{margin:12px 0}}.history{{list-style:none;padding:0}}.history li{{border-top:1px dotted #52616d;padding:14px 0;margin:0}}.history a{{display:flex;justify-content:space-between;color:var(--cyan);font-weight:700}}small{{display:block;color:var(--smoke)}}footer{{border-top:1px solid #34424d;padding:28px 0 48px;color:var(--smoke)}}@media(max-width:640px){{.ticket{{grid-template-columns:1fr}}.qr{{max-width:220px}}dl{{grid-template-columns:1fr;gap:2px}}dd{{margin-bottom:12px}}}}@media(prefers-reduced-motion:no-preference){{.button{{transition:transform .12s,box-shadow .12s}}.button:active{{transform:translate(2px,2px);box-shadow:2px 2px 0 #7f2c23}}}}</style></head>
<body><a class="skip" href="#main">Skip to release</a><header><b>ARP // RELEASE RECEIPT</b></header><main id="main">
<p class="verified">✓ SIGNATURE VERIFIED</p><h1>{title} {version}</h1><p class="lede">Publisher identity and every APK byte were checked before this page was written.</p>
<section class="ticket" aria-labelledby="release-facts"><div><h2 id="release-facts">Release facts</h2><dl>
<dt>Package</dt><dd><code>{package}</code></dd><dt>Version code</dt><dd>{version_code}</dd><dt>Android</dt><dd>Minimum {min_sdk}; target {target_sdk}</dd><dt>ABI</dt><dd>{abis}</dd><dt>Publisher</dt><dd>{publisher}</dd><dt>Fingerprint</dt><dd><code>{fingerprint}</code></dd><dt>APK SHA-256</dt><dd><code>{sha}</code></dd></dl>
<p>{notes}</p><a class="button" href="{url}" download>Download verified APK</a></div><div class="qr" aria-label="QR code for the APK download">{qr}</div></section>
<section aria-labelledby="install"><h2 id="install">Install without guesswork</h2><ol><li>Download this APK. Compare its SHA-256 above if it arrived through another channel.</li><li>On Android, allow installs from the browser or file manager you used—never enable it globally.</li><li>Open the APK and review Android’s prompts. Do not continue if the package or publisher is unexpected.</li><li>After installation, turn off “install unknown apps” for that source.</li></ol></section>
<section aria-labelledby="prior"><h2 id="prior">Signed prior releases</h2><p>Use an older build only for a deliberate rollback. Android may require uninstalling first, which can remove app data.</p><ul class="history">{history}</ul></section>
</main><footer>Generated locally by APK Release Pocket {arp_version}. No tracking, uploads, or credential collection.</footer></body></html>"##,
        title = html(&latest.title),
        version = html(&latest.inspection.version_name),
        package = html(&latest.inspection.package),
        version_code = latest.inspection.version_code,
        min_sdk = latest
            .inspection
            .min_sdk
            .map_or_else(|| "unspecified".into(), |v| v.to_string()),
        target_sdk = latest.inspection.target_sdk,
        abis = html(&latest.inspection.abis.join(", ")),
        publisher = html(&latest.inspection.publisher),
        fingerprint = html(&latest.inspection.publisher_fingerprint_sha256),
        sha = html(&latest.inspection.sha256),
        notes = html(&latest.notes),
        url = html(&latest.url),
        qr = qr,
        history = history,
        arp_version = VERSION
    ))
}

fn filename_part(value: &str) -> String {
    value
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect()
}

fn html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn json_error(error: serde_json::Error) -> AppError {
    AppError::release(format!("cannot encode JSON: {error}"))
}

fn write_error(error: io::Error) -> AppError {
    AppError::release(format!("cannot update release pocket: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Inspection {
        Inspection {
            package: "in.example.notes".into(),
            app_label: "Pocket Notes".into(),
            version_name: "1.2.0".into(),
            version_code: 12,
            min_sdk: Some(26),
            target_sdk: 35,
            abis: vec!["arm64-v8a".into()],
            publisher: "CN=Example".into(),
            publisher_fingerprint_sha256: "AA:".repeat(31) + "AA",
            signer_fingerprints_sha256: vec!["AA:".repeat(31) + "AA"],
            signature_scheme: "APK Signature Scheme v2".into(),
            signature_verified: true,
            sha256: "b".repeat(64),
            bytes: 42,
        }
    }

    #[test]
    fn fingerprint_normalization_is_strict() {
        assert_eq!(
            normalize_fingerprint(&"aa".repeat(32)).unwrap(),
            "AA:".repeat(31) + "AA"
        );
        assert!(normalize_fingerprint("nope").is_err());
    }

    #[test]
    fn release_page_has_one_h1_and_security_facts() {
        let inspection = fixture();
        let record = ReleaseRecord {
            title: "Pocket Notes".into(),
            filename: "app.apk".into(),
            url: "https://example.com/app.apk".into(),
            published_at: "2026-08-28T00:00:00Z".into(),
            notes: "Safer sync".into(),
            inspection,
        };
        let page = render_release_page(&ReleaseIndex {
            schema_version: 1,
            generated_by: "test".into(),
            latest_sha256: "b".repeat(64),
            releases: vec![record],
        })
        .unwrap();
        assert_eq!(page.matches("<h1>").count(), 1);
        assert!(page.contains("SIGNATURE VERIFIED"));
        assert!(page.contains("Install without guesswork"));
        assert!(page.contains("<svg"));
    }

    #[test]
    fn output_escapes_release_notes() {
        assert_eq!(html("<script>&\"'"), "&lt;script&gt;&amp;&quot;&#39;");
    }

    #[test]
    fn checksum_manifest_deduplicates_files() {
        let inspection = fixture();
        let record = ReleaseRecord {
            title: "App".into(),
            filename: "app.apk".into(),
            url: "https://example.com/app.apk".into(),
            published_at: "now".into(),
            notes: "ok".into(),
            inspection,
        };
        let index = ReleaseIndex {
            schema_version: 1,
            generated_by: "test".into(),
            latest_sha256: "b".repeat(64),
            releases: vec![record.clone(), record],
        };
        assert_eq!(checksum_manifest(&index).lines().count(), 1);
    }
}
