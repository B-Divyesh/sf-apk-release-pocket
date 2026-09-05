# APK Release Pocket — repair handoff

## Status

Implementation commit: `e013eb0c87658b9d69aea1ee708d2557240d71bd`<br>
Verification documentation commit: `37d319ee87cbf2307212a2a12fd683753a4de1d9`<br>
Production deployment: `88c2b3c0-2bfe-49f2-a835-93e702ab8290`<br>
Live URL: <https://apk-release-pocket.sociobot.in/>

The repaired static product is deployed. The prior offline reload, mobile CLS/performance, caching, and HTTP 404 findings are fixed and verified live. One external dependency remains: the Sociobot billing verification endpoint does not yet enforce the required burst rate limit. This product cannot configure that shared endpoint.

## What changed

- `/demo/` is now a real pre-rendered static document. Its final demo banner, sample terminal, headline, and layout arrive before first paint. It does not preload the decorative hero image.
- The service worker discovers Vite-hashed same-origin assets from the generated landing document while it installs. It no longer precaches the unstable `/assets/hero.webp` path.
- Static deployment now has no SPA fallback. `/demo/` is a physical route and unknown URLs use the styled `/404/` response with HTTP 404.
- Hashed `/assets/*` use `Cache-Control: public, max-age=31536000, immutable`; `/sw.js` uses `Cache-Control: no-cache` so updates arrive promptly.
- Browser tests run against a small production-like static server rather than Vite’s SPA preview fallback. New outcome checks cover offline reload, 404 response status, cache headers, and demo layout shift.
- Added `.factory/catalog-description.txt` and copied it to `/work/.evidence/catalog-description.txt`: “Check a signed Android APK and publish clear install steps.”
- Wrote `/work/.evidence/billing-offer.json` for the unregistered $39 one-time Team lantern offer. It contains only public offer metadata.

## Verification

### Local and clean checkout

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --locked --release
cargo package --locked --allow-dirty
npm ci
npm audit --omit=dev
npm test
npm run build
```

All commands passed. Rust ran 6 tests. `npm test` ran 42 Playwright tests against the static output. The build produced `dist/site/` with 9.64 kB raw JavaScript, 12.24 kB raw CSS, and a 98.57 kB landing hero; the demo transfer measured 14,085 bytes because it does not load the decorative hero.

From a fresh clone at the implementation commit, `npm ci` succeeded and every exact command in `.factory/claims.json` passed separately: `apk-verification`, `demo-sandbox`, `pocket-files`, `cli-local`, `mit-license`, `checksum-install`, `demo-isolation`, `team-audit`, `license-cache`, and `site-privacy`.

The packaged crate installed into a clean consumer root with `cargo install --path target/package/apk-release-pocket-0.1.1 --root <temporary-root> --locked`. Its installed `arp` binary showed help and verified the bundled Imagepipe APK, including its package and v2 signature.

The public v0.1.1 Linux archive matched `SHA256SUMS`; its `arp demo --json --ci` verified the sample. The live installer installed the checksum-verified v0.1.1 binary into a temporary directory and that binary reported `arp 0.1.1`.

### HTTPS production

- `/opt/fleet/lib/verify-url.sh` passed: HTTP 200, title, `lang`, one h1, main landmark, image alt text, labelled buttons, and no console errors.
- Fresh desktop and 390 px phone contexts loaded `/` at scroll position zero. Both displayed “Ship a verified APK release,” named indie Android developers, and showed “Try it with sample data” in the viewport. There were no console errors and observed CLS was 0.
- The one-click sample opened `/demo/`, displayed the persistent sample banner, Imagepipe output, and seeded approval. **Reset demo** restored that sample; **Start for real** removed every `demo:` key.
- In a fresh live service-worker context, `/demo/` became controlled by `arp-site-v3`; an offline reload showed the demo headline and banner with no errors.
- `GET /missing-page` now returns HTTP 404 and the styled 404 page. The deployed hashed hero returns HTTP 200 with immutable cache control. `/sw.js` returns HTTP 200 with `Cache-Control: no-cache`.
- Live axe WCAG 2 A/AA scans of `/`, `/demo/`, `/privacy/`, `/terms/`, and `/missing-page` found zero serious or critical violations.
- Mobile Lighthouse on live `/demo/`: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 932 ms, CLS 0, TBT 12 ms, 14,085 bytes.

## Current limits and operator action

- **External billing rate limit remains required.** On 2026-09-05, 30 concurrent invalid-license requests to `https://api.sociobot.in/api/v1/products/apk-release-pocket/verify` returned 30 HTTP 200 responses, with no `429` and no `Retry-After`. This endpoint belongs to the shared Sociobot billing API and is outside this product’s authorised scope. Configure a per-client burst limit that returns HTTP 429 and `Retry-After`, then rerun that live allowance check. Until then, this external acceptance item remains open.
- Register the public Team lantern offer at $39 one time with return URL `https://apk-release-pocket.sociobot.in/?license={token}`. The page still says sales are not open, while the free CLI and the license restore/verification path remain available.
- The CLI accepts RSA-backed APK Signature Scheme v2 signatures and rejects v1-only, v3-only, and ECDSA/DSA-only signatures. APKs carrying v2 alongside v3 work.
- macOS `.pkg` and Windows portable release files are unsigned. Manual installers should compare the published checksum.
- Linux release downloads are x86_64. Linux arm64 visitors are sent to the full GitHub Releases page rather than a wrong binary.

## Earlier findings

`verification-1.md` remains the historical failed report. Its offline path, CLS/performance, immutable cache, and HTTP 404 findings are addressed above. Its billing-rate-limit finding remains an external dependency and is not represented as a product-code fix.
