# Independent verification — FAIL

Tested candidate: `ed75d42c6ea14158478d8dc554a37d60c24a4427`  
Live URL: <https://apk-release-pocket.sociobot.in/>  
Verification date: 2026-08-28

## Decision

**FAIL — do not release this candidate.** The local product and installer work, but the deployed PWA does not reload offline, the product-unlock API did not rate-limit the required burst, and the mobile performance gate missed its threshold.

## First-read result

Cold desktop and 390 px mobile loads returned HTTP 200 with no console or page errors. The first screen says **“Ship a verified APK release.”**, names **“indie Android developers”**, and presents the visible one-click **“Try it with sample data”** action with the result “See a finished release in one click.” This gate passes.

## Mandatory claims

Clean checkout: `/tmp/apk-release-pocket-qa.QgArE1`, detached at the tested commit. `npm ci` completed with zero reported vulnerabilities. Every exact command in `.factory/claims.json` passed independently:

| Claim ID | Command | Result |
| --- | --- | --- |
| apk-verification | `npm test -- --grep @claim:apk-verification` | PASS |
| demo-sandbox | `npm test -- --grep @claim:demo-sandbox` | PASS |
| pocket-files | `npm test -- --grep @claim:pocket-files` | PASS |
| cli-local | `npm test -- --grep @claim:cli-local` | PASS |
| mit-license | `npm test -- --grep @claim:mit-license` | PASS |
| checksum-install | `npm test -- --grep @claim:checksum-install` | PASS |
| demo-isolation | `npm test -- --grep @claim:demo-isolation` | PASS |
| team-audit | `npm test -- --grep @claim:team-audit` | PASS |
| license-cache | `npm test -- --grep @claim:license-cache` | PASS |
| site-privacy | `npm test -- --grep @claim:site-privacy` | PASS |

The complete `npm test` suite also passed: **36 Playwright tests, 0 failures**. This suite does not catch the deployed service-worker path error below because Vite preview handles the missing asset differently from the live host.

## Local verification

- `cargo fmt --check`, `cargo test --locked` (6 tests), `cargo clippy --locked --all-targets -- -D warnings`, `cargo build --locked --release`, and `cargo package --locked --allow-dirty`: PASS.
- Exact production build: `npm run build:site`: PASS; `dist/site/` produced.
- Built sizes: JS 9.64 kB raw / 3.75 kB gzip; CSS 12.24 kB raw / 3.72 kB gzip; hero 98.57 kB; no fonts. These meet the static bundle-size limits.
- CLI normal path: the bundled Imagepipe APK reported package `de.kaffeemitkoffein.imagepipe`, version code 51, a verified v2 signature, publisher fingerprint, and SHA-256 `e6f270…da4f9`; `arp release` wrote `index.html`, `release.json`, `releases.json`, and `SHA256SUMS`.
- CLI invalid-input recovery: a non-APK exited 3 with a clear extension error; malformed fingerprint exited 5 with a clear 64-hex-digit error.
- Clean consumer: extracted `target/package/apk-release-pocket-0.1.1.crate`, installed it with `cargo install --path … --root … --locked`, and used the installed `arp` for `--help` and `inspect --json`; both passed.

## Live verification

- Candidate/deployment content match: every served file in locally generated `dist/site/` matched the live SHA-256 byte-for-byte. `staticwebapp.config.json` is not served (404), which is normal if consumed by hosting, but the live unknown-route behavior below shows its 404 override is not effective.
- Release/install path: GitHub v0.1.1 Linux archive SHA-256 `5605f88768094ca32e4683d97790e08336e5b2d56efac8a7ebf3b64d73ed8287` matched `SHA256SUMS` and `latest.json`; its `arp demo --json --ci` passed. The live `install.sh`, with a temporary install directory, reported “Installed verified arp”; the installed binary was `arp 0.1.1` and verified the bundled APK.
- Desktop and 390 px demo: one h1, main landmark, zero horizontal overflow, no interactive target below 44 px, demo-only `demo:arp_team_audit` storage, no real audit key, reset and exit data handling, and no console/page errors.
- Keyboard: Tab reached the skip link and all checked controls with a visible 3 px cyan focus ring. Reduced-motion context reported no running animations and a 0 s transition.
- Accessibility: live axe WCAG 2 A/AA scan found **0 serious/critical** findings; Lighthouse accessibility was 100.
- Privacy/browser policies: fresh demo set no cookie. The application made only same-origin requests until navigating back to the non-demo landing page, which then queried the documented GitHub release API. Live CSP, HSTS, `nosniff`, referrer policy, and permissions policy were present. An invalid license produced the quiet “This license is not active (invalid)” recovery state and kept the audit desk hidden.

## Release-blocking defects

### Critical — offline PWA flow fails in production

`/sw.js` precaches `/assets/hero.webp`, but the candidate build and live host provide `/assets/hero-Bsn3dMdh.webp`. Live checks returned 404 for the former and 200 for the latter. In a fresh live browser context after eight seconds, `navigator.serviceWorker.getRegistration()` was false and `navigator.serviceWorker.controller` was false. After `context.setOffline(true)`, `/demo/` reload failed with `net::ERR_INTERNET_DISCONNECTED`.

This fails the required service-worker/offline-reload check and the product’s PWA requirement. The local Playwright test is a false pass against Vite preview.

### Critical — required API rate limit absent

Thirty rapid concurrent GET requests to `https://api.sociobot.in/api/v1/products/apk-release-pocket/verify?license=verification-invalid-token` returned **30 × HTTP 200**, with no `Retry-After` header. The response was the expected invalid-license JSON, so this exercised the product-unlock endpoint. No 429 threshold was observed in the required burst.

The acceptance contract requires a 429 plus `Retry-After` for this server-side endpoint; this is release-blocking.

### High — mobile performance/CLS misses the required gate

Fresh mobile Lighthouse on live `/demo/`: Performance **83** (required ≥90), Accessibility **100** (required ≥95), FCP 1.1 s, LCP 1.5 s, TBT 170 ms, and CLS **0.304** (required <0.1). The PWA is also served with `Cache-Control: public, must-revalidate, max-age=30` for the hashed JS/CSS/image assets rather than immutable long-lived caching.

### Medium — live unknown routes return 200 rather than 404

`https://apk-release-pocket.sociobot.in/missing-page` rendered the styled product 404 but returned HTTP 200. The configured response override is not effective in the live deployment. A real unknown route should return 404.

## Required next verification

Repair the production service-worker manifest to use build-stable asset names or generate it from the Vite manifest, deploy it, and verify a fresh live offline reload. Configure rate limiting on the Sociobot verification endpoint and demonstrate the observed 429 threshold and `Retry-After`. Resolve the mobile CLS/performance and immutable-cache headers, then rerun this report from a clean checkout and fresh live browser contexts.
