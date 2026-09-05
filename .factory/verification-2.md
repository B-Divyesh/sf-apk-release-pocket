# Verify signed APK releases — independent QA

Verification date: 2026-09-05<br>
Live URL: <https://apk-release-pocket.sociobot.in/><br>
Implementation reviewed: `e013eb0c87658b9d69aea1ee708d2557240d71bd`<br>
Documentation baseline: `8f64e770caf6ae0e81dadd20f5e61689f21aa1fb`

## Verdict

**FAIL — 5 findings and 3 untested public claims.**

The repaired live site now passes the earlier offline, mobile performance, cache, and HTTP 404 checks. The shared billing verifier still lacks the required burst limit. Independent testing also found defects in the generated release page, documented package-manager installs, invalid-license recovery text, and claim coverage.

## Findings

### F1 — Critical — Billing verification has no required burst limit

Thirty concurrent invalid requests to:

`https://api.sociobot.in/api/v1/products/apk-release-pocket/verify`

returned 30 HTTP 200 responses. None returned HTTP 429 or a `Retry-After` header. Every response was the expected `{ valid: false, reason: "invalid" }` result, so the correct endpoint was exercised.

This is the remaining finding from verification 1. The endpoint belongs to the shared Sociobot billing service and is outside this repository's authorised scope, but it still fails the stated acceptance requirement.

### F2 — High — The generated release page fails the accessibility baseline

The installed `arp 0.1.1` generated a real Imagepipe release page. Axe reported one serious `aria-prohibited-attr` violation:

```html
<div class="qr" aria-label="QR code for the APK download">
```

An `aria-label` is not permitted on a `div` without a suitable role. The prior-release link also measured 358 × 24.8 CSS px on a 390 px phone, below the required 44 px touch height.

The marketing site has zero axe violations, but the generated page is the CLI's main product output. Its accessibility was not covered by the existing browser suite.

### F3 — High — Documented Homebrew, Scoop, and winget files are not ready to use

The README documents:

```sh
brew install B-Divyesh/apk-release-pocket/apk-release-pocket
```

The required public tap repository, `B-Divyesh/homebrew-apk-release-pocket`, returns 404. The documented Scoop bucket URL exposes no manifest at either `apk-release-pocket.json` or `bucket/apk-release-pocket.json`. Its only checked-in manifest is at `scoop-bucket/apk-release-pocket.json`, still says version 0.1.0, and has an all-zero hash. The checked-in Homebrew formula and winget installer manifest are also version 0.1.0 templates with all-zero hashes.

The v0.1.1 GitHub Release does contain correct generated formula, Scoop, and winget files. The one-line Linux installer also works. Those facts do not make the documented tap, bucket, or checked-in winget submission ready.

### F4 — Medium — Invalid-license recovery points to an unavailable action

A live invalid license correctly keeps the audit feature locked, but the page says:

> This license is not active (invalid). You can buy a new license above.

There is no buy link above; the pricing section says sales are not open. The user cannot follow the recovery instruction. The unavailable checkout is presented honestly elsewhere, but this error text was not updated with it.

### F5 — Medium — Three public CLI promises lack complete claim tests

All ten declared claim commands pass. The public copy still has three promises that are absent from `.factory/claims.json` or not asserted by its named test:

1. Prior releases remain available for rollback. `@claim:pocket-files` creates only one release and checks file presence; it never publishes a second release or proves that the first remains available.
2. Changed publishers and unexpected version decreases are rejected without writing a release. This README promise has no claim entry or sandbox test.
3. All six documented exit-code meanings are stable. Existing tests exercise only a subset and the promise has no claim entry.

These count as three untested public claims under the claims contract.

## First screen and demo

Fresh desktop and 390 px phone contexts opened at scroll position zero. Before scrolling, both showed:

- Job: “Ship a verified APK release.”
- Audience: indie Android developers who need repeatable checks and clear install steps.
- First action: “Try it with sample data,” with “See a finished release in one click.”

The one-click action opened `/demo/`. It showed the Imagepipe 0.72 package, version code 51, publisher fingerprint, temporary output path, and seeded approval note. The “Demo — sample data, nothing is saved to your releases” label remained visible after scrolling. Adding a sample approval changed only `demo:arp_team_audit`. Reset restored the seeded sample. “Start for real” removed every `demo:` key and left a pre-seeded real-data sentinel unchanged.

## Declared claims

A fresh checkout at documentation SHA `8f64e77` used Node 22.23.2, npm 10.9.8, and Rust 1.98.0. `npm ci` completed with zero reported vulnerabilities. Every exact command in `.factory/claims.json` passed:

| Claim | Result |
| --- | --- |
| `apk-verification` | PASS |
| `demo-sandbox` | PASS |
| `pocket-files` | PASS, but incomplete for retained prior releases; see F5 |
| `cli-local` | PASS |
| `mit-license` | PASS |
| `checksum-install` | PASS |
| `demo-isolation` | PASS |
| `team-audit` | PASS |
| `license-cache` | PASS |
| `site-privacy` | PASS |

The complete `npm test` run passed 42/42 tests.

## Build and installed CLI

The following clean-checkout commands passed:

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --locked --release
cargo package --locked --allow-dirty
npm audit --omit=dev
npm test
npm run build
```

Rust ran six tests. The site build produced 9.64 kB raw JavaScript, 12.24 kB raw CSS, and a 98.57 kB hero image.

The packaged crate installed into a new temporary consumer root with `cargo install --path ... --root ... --locked`. The installed binary:

- reported `arp 0.1.1` and complete help;
- inspected the bundled APK and reported the expected package, version, SDK range, publisher fingerprint, v2 signature, and APK SHA-256;
- ran `arp demo --json --ci` in a new temporary folder;
- produced `index.html`, `release.json`, `releases.json`, `SHA256SUMS`, a QR code, and a checksum-valid APK copy;
- exited 3 for a non-APK, 5 for malformed or mismatched fingerprints, and 6 for an invalid base URL without creating that output directory;
- accepted an intentional repeat with `--allow-downgrade`.

## Public release and installer

GitHub Release v0.1.1 contains Linux, two macOS architectures, Windows, `.deb`, `.rpm`, two `.pkg` files, `SHA256SUMS`, and `latest.json`. The Linux archive hash matched `5605f88768094ca32e4683d97790e08336e5b2d56efac8a7ebf3b64d73ed8287`. Its binary passed `arp demo --json --ci`.

The live `install.sh`, run with an isolated install directory, downloaded the release, verified its checksum, installed `arp`, and produced `arp 0.1.1`. Package-manager publication defects are recorded in F3.

## Live site, routes, and accessibility

- `/opt/fleet/lib/verify-url.sh` passed for the home page: HTTP 200, title, `lang`, one h1, main landmark, image alt attributes, labelled buttons, and no console errors.
- Axe WCAG 2 A/AA scans of `/`, `/demo/`, `/privacy/`, `/terms/`, and an unknown route found zero violations. The generated CLI page exception is F2.
- Keyboard Tab reached the skip link and checked controls with a 3 px cyan focus ring. Enter opened the demo. There was no keyboard trap.
- At 390 px, no live-site interactive target was below 44 px. At 200% text size, there was no horizontal overflow.
- Under reduced motion, checked transitions and animations were 0 seconds and scroll behavior was `auto`.
- All crawled site links and fragments resolved. The unknown route returned the designed page with HTTP 404, one h1, legal links, and a return-home action. The browser's expected failed-document log for that deliberate 404 is not a defect.
- Home, demo, privacy, terms, and 404 routes had distinct titles and one h1 each. Heading order was valid.
- Fresh demo requests were same-origin only and set no cookie. The home page additionally called only the documented GitHub release API. License verification called only `api.sociobot.in` after a token was entered.

## Offline, caching, and performance

A fresh service-worker context registered `/sw.js`, became controlled by cache `arp-site-v3`, and reloaded `/demo/` offline with the correct heading and demo label. `/sw.js` returned `Cache-Control: no-cache`. Hashed JS, CSS, image, and SVG assets returned one-year immutable caching.

Mobile Lighthouse on live `/demo/`:

| Measure | Result |
| --- | ---: |
| Performance | 100 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| LCP | 907 ms |
| CLS | 0 |
| TBT | 29 ms |
| Transfer | 14,115 bytes |

## Candidate and deployment match

Every served product file checked against the clean build matched byte-for-byte, including the five HTML documents, hashed JS/CSS/hero files, social image, icons, installers, robots file, sitemap, and service worker. `staticwebapp.config.json` returns 404 because the host consumes it during deployment; this is expected.

Commits `37d319e` and `8f64e77` change only verification/provenance documentation after implementation `e013eb0`. No later product image is required.

## Earlier finding disposition

| Verification 1 finding | Current result |
| --- | --- |
| Offline reload failed | FIXED — fresh controlled context reloads `/demo/` offline |
| Billing burst limit absent | OPEN — F1 |
| Mobile performance 83 and CLS 0.304 | FIXED — performance 100 and CLS 0 |
| Hashed assets not immutable | FIXED — one-year immutable caching |
| Unknown route returned HTTP 200 | FIXED — styled HTTP 404 |

## Scope notes

This is a static site and local CLI. It has no product backend, tenants, server-side product state, health endpoint, or restart-persistence requirement. The shared billing endpoint was tested only through its public product-specific verification route. No product code, infrastructure, billing registration, or shared service was changed.

## Evidence

- `.factory/evidence/verification-2/live-home-desktop.jpg`
- `.factory/evidence/verification-2/live-home-mobile.jpg`
- `.factory/evidence/verification-2/live-demo-mobile-200pct.jpg`
- `.factory/evidence/verification-2/live-404.png`
- `.factory/evidence/verification-2/verify.json`
- `.factory/evidence/verification-2/lighthouse-mobile.json`
