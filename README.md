# APK Release Pocket

Turn a signed Android APK into a small release page that users can check before installing. It is for indie developers who ship test or direct-install Android builds.

APK Release Pocket is local-first and has no telemetry. It never signs an app, collects credentials, weakens Android protections, or bypasses device policy.

## Try the bundled sample

Run the full release flow without supplying an APK:

```sh
arp demo
```

The command checks the bundled Imagepipe sample. It writes a release pocket to a new temporary folder. The sample never reads or changes your release files. The matching browser demo is at <https://apk-release-pocket.sociobot.in/demo/>.

## Install

macOS and Linux:

```sh
curl -fsSL https://apk-release-pocket.sociobot.in/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://apk-release-pocket.sociobot.in/install.ps1 | iex
```

Homebrew and Scoop packages are produced by each GitHub Release. Native `.pkg`, `.deb`, `.rpm`, Windows zip, and standalone archives are also attached. The macOS and Windows packages are unsigned; inspect the published SHA-256 sums and use the documented OS override if prompted.

```sh
brew install B-Divyesh/apk-release-pocket/apk-release-pocket
```

```powershell
scoop bucket add apk-release-pocket https://github.com/B-Divyesh/sf-apk-release-pocket
scoop install apk-release-pocket/apk-release-pocket
```

On macOS, if Gatekeeper blocks the unsigned `.pkg`, Control-click it, choose **Open**, and confirm only after comparing its checksum. On Windows, SmartScreen may require **More info → Run anyway** for the portable zip; again, verify `SHA256SUMS` first. A ready-to-submit winget manifest lives in `winget/` and is finalized with release hashes by the workflow.

## Usage

Inspect an APK without writing anything:

```sh
arp inspect app-release.apk
arp inspect app-release.apk --json
```

Build or update a static release pocket:

```sh
arp release app-release.apk \
  --out ./release-pocket \
  --base-url https://downloads.example.com/my-app \
  --title "My App" \
  --notes "Fixes offline sync"
```

The command checks an APK Signature Scheme v2 signature and the signed content digest. It reads the package, version, Android range, processor support, publisher, and file checksum. It rejects changed publishers and unexpected version decreases. It then writes `index.html`, release JSON, `SHA256SUMS`, and an immutable APK copy. Existing signed releases remain available for rollback.

Important: version 0.1.1 accepts RSA-backed v2 signatures. It rejects v1-only, v3-only, and ECDSA/DSA-only APKs. Modern APKs may contain v2 beside v3. A failed check writes no release.

Useful options:

```text
--expected-fingerprint <SHA256>  Refuse an unexpected publisher identity
--allow-downgrade               Record a lower/equal version code intentionally
--json                          Emit machine-readable output
--ci                            Disable decoration and require non-interactive behavior
```

Exit codes have stable meanings. They are `0` success, `2` arguments, `3` APK, `4` signature, `5` publisher, and `6` release writing.

## Develop and verify

Requires Rust 1.85+ and Node 22+.

```sh
cargo test --locked
npm ci
npm test
npm run build:site  # exact deploy build; outputs dist/site/index.html
cargo package --locked
```

For local site work, run `npm run dev` and open the printed URL. The static deploy root is `dist/site`.

## Release

Tags matching `v*` start the GitHub Actions release matrix. It builds Linux, macOS arm64/x64, and Windows packages. It also publishes checksums, release metadata, and package-manager files. See [.github/workflows/release.yml](.github/workflows/release.yml).

## Privacy and license

All APK inspection and release generation happens on your machine. The marketing site stores a paid license token only when you provide one. See [Privacy](https://apk-release-pocket.sociobot.in/privacy/) and [Terms](https://apk-release-pocket.sociobot.in/terms/).

MIT licensed. See [LICENSE](LICENSE).
