# APK Release Pocket

Turn a signed Android APK into a small, self-hosted release page that users can verify before installing. It is for indie Android developers shipping legitimate test or direct-install builds who are tired of rewriting install instructions and diagnosing the wrong APK over chat.

APK Release Pocket is local-first and has no telemetry. It never signs an app, collects credentials, weakens Android protections, or bypasses device policy.

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

The command cryptographically verifies an APK Signature Scheme v2 signature, extracts package/version/SDK/ABI facts, checks that a new version code increases, copies the immutable APK into `releases/`, and atomically regenerates `index.html`, `release.json`, `releases.json`, and `SHA256SUMS`. Existing signed releases remain available for deterministic rollback.

Important: v1-only, v3-only, and ECDSA/DSA-only APKs are rejected by v0.1.0 because the embedded verifier currently supports RSA-backed v2 signatures. Modern APKs may contain v2 alongside v3. Nothing is published unless verification succeeds.

Useful options:

```text
--expected-fingerprint <SHA256>  Refuse an unexpected publisher identity
--allow-downgrade               Record a lower/equal version code intentionally
--json                          Emit machine-readable output
--ci                            Disable decoration and require non-interactive behavior
```

Exit codes are `0` success, `2` invalid arguments, `3` unreadable/invalid APK, `4` signature failure, `5` publisher mismatch, and `6` release policy or write failure.

## Develop and verify

Requires Rust 1.85+ and Node 22+.

```sh
cargo test
npm install
npm test
npm run build       # exact deploy build; outputs dist/site/index.html
cargo package
```

For local site work, run `npm run dev` and open the printed URL. The static deploy root is `dist/site`.

## Release

Tags matching `v*` run the GitHub Actions matrix for Linux, macOS arm64/x64, and Windows, create native packages, publish `SHA256SUMS` plus `latest.json`, and attach everything to a GitHub Release. See [.github/workflows/release.yml](.github/workflows/release.yml).

## Privacy and license

All APK inspection and release generation happens on your machine. The marketing site stores a paid license token only when you provide one. See [Privacy](https://apk-release-pocket.sociobot.in/privacy/) and [Terms](https://apk-release-pocket.sociobot.in/terms/).

MIT licensed. See [LICENSE](LICENSE).
