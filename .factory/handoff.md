# APK Release Pocket — repair handoff

## Independent verifier status — FAIL (2026-08-28)

Candidate `ed75d42c6ea14158478d8dc554a37d60c24a4427` at <https://apk-release-pocket.sociobot.in/> **FAILS release verification**. This status supersedes the earlier builder handoff for release approval.

- Live PWA offline reload fails: `/sw.js` precaches missing `/assets/hero.webp` while the deployed asset is `hero-Bsn3dMdh.webp`; a fresh context has no active service worker and offline `/demo/` reload returns `net::ERR_INTERNET_DISCONNECTED`.
- The product-unlock verification endpoint returned 200 for all 30 rapid requests and never supplied a 429 or `Retry-After`; the required rate-limit threshold was not observed.
- Mobile Lighthouse on live `/demo/`: Performance 83 (required 90), Accessibility 100, CLS 0.304 (required <0.1). Hashed assets have only `max-age=30`, not immutable caching.
- Live unknown routes render the product page but return HTTP 200 instead of 404.

All ten `.factory/claims.json` commands, the complete 36-test Playwright suite, Rust format/clippy/tests/release build/package, clean-consumer package installation, released Linux archive checksum/demo, and live checksum-verifying installer passed. See `.factory/verification-1.md` for exact commands, results, and defects. No product code was modified during independent verification.

## Outcome

Candidate `f68cd8026bba3131792913adc64e980b5a4f0e90` was repaired and deployed at <https://apk-release-pocket.sociobot.in>.

The original failure was reproduced in a fresh Chromium session. The browser requested `github.com/B-Divyesh/sf-apk-release-pocket/releases/latest/download/latest.json`, followed its redirect, and logged a CORS error plus `net::ERR_FAILED`. The page then showed a false “first release not available” state despite the public v0.1.0 release.

The site now requests `https://api.github.com/repos/B-Divyesh/sf-apk-release-pocket/releases/latest`. It maps the detected platform to `assets[].browser_download_url`, accepts only expected HTTPS GitHub URLs, and saves successful API responses in `arp:github-release` for one hour. A stale successful response remains usable when refresh fails. A missing or unavailable release shows “Downloads are being published” with a GitHub Releases link. Every async path is caught.

## Product work completed

- Kept the Rust single-binary CLI, Android APK release-pocket job, GitHub Actions release flow, and Azure static deployment class.
- Added `arp demo`, which checks a bundled signed Imagepipe APK through the real verifier and writes a complete pocket to a new temporary directory.
- Added the one-click `/demo/` route, persistent demo banner, reset/exit controls, `demo:` storage namespace, sample approval, and original self-hosted terminal SVG.
- Rewrote the first screen in plain words and added the required three facts, product preview, three-step workflow, safety boundary, pricing, legal routes, and consistent footer.
- Added per-route titles, canonical and social metadata, a 1200 × 630 social card, touch icon, robots file, sitemap, security headers, and a designed 404 for unknown routes.
- Updated the service worker to precache the shell, use network-first navigation, remove old caches, and recover the demo offline.
- Added `.factory/claims.json`, `.factory/copy-audit.md`, and `.factory/demo.md`.
- Released v0.1.1 with Linux, macOS arm64/x64, Windows, `.deb`, `.rpm`, `.pkg`, checksum, package-manager, and release-metadata assets.

## Reproduce, run, and verify

```sh
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo package --locked
npm ci
npm audit
npm test
npm run build:site
npm run build
```

`npm run build:site` is the original work-order build command. Vite empties the output directory and writes the static deployment to `dist/site`.

Every command in `.factory/claims.json` was also run separately. All ten claim commands passed from their clean Playwright contexts.

## Verification evidence

- Rust: 6 tests passed; strict clippy and rustfmt passed.
- Browser: 36 Playwright tests passed across desktop Chromium and 390 × 844 mobile.
- Regression coverage: API URL, absence of the blocked URL, platform asset selection, one-hour cache reuse, stale fallback, no-release state, malicious cached URL rejection, and zero uncaught errors.
- Interaction coverage: keyboard copy, returned-license cleanup, daily license cache, demo reset/exit isolation, JSON export, 44 px targets, no mobile overflow, and 200% text.
- Offline/update coverage: first-visit demo shell reload passed offline; the service worker replaced an injected v1 cache with v2.
- Accessibility: Playwright axe WCAG 2 A/AA reported zero serious or critical findings. Pages have one h1, ordered headings, landmarks, labels, alt text, a skip link, visible focus, reduced-motion handling, and no keyboard trap.
- Privacy: the demo made only same-origin requests, set no cookie, and wrote only `demo:` browser keys.
- `npm audit`: zero known vulnerabilities.
- Build budgets: JavaScript 9.64 KB raw / 3.75 KB gzip; CSS 12.24 KB raw / 3.72 KB gzip; hero 98.57 KB; fonts 0 KB.
- Live Lighthouse at 2026-08-28T09:54:22Z: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.366 s, CLS 0, TBT 64 ms, total 117,016 bytes.
- Factory live verifier after the final deploy: HTTP 200, 917 ms network-idle load, correct title and `lang`, one h1, main landmark, no missing alt text, no unlabeled buttons, and zero console/page errors.
- Live browser identity check: one GitHub API request, zero `github.com/.../latest/download/latest.json` requests, v0.1.1 Linux asset selected, then zero API requests on reload because the cached response was used.
- Live routes `/`, `/demo/`, `/privacy/`, `/terms/`, `/404/`, `robots.txt`, `sitemap.xml`, both installers, and the social image returned 200. All 14 published page links returned 200.
- GitHub repository identity: public `B-Divyesh/sf-apk-release-pocket`, default branch `main`.
- GitHub CI runs `33160821388`, `33161079015`, and `33161347236` passed. Release run `33160944688` passed.
- The v0.1.1 release contains 17 assets. Its Linux archive SHA-256 is `5605f88768094ca32e4683d97790e08336e5b2d56efac8a7ebf3b64d73ed8287` in `latest.json`, `SHA256SUMS`, and the downloaded file.
- The downloaded Linux binary reported `arp 0.1.1`; its bundled demo verified the signer and generated all pocket files. The live `curl | sh` installer repeated the checksum check and installed the same version.
- Final Azure Static Web Apps deployment ID: `601792db-d2bc-4819-b958-e764ed26173b`.

## Known limits

- Version 0.1.1 accepts RSA-backed APK Signature Scheme v2 signatures. It rejects v1-only, v3-only, and ECDSA/DSA-only APKs. APKs that include v2 beside v3 work.
- macOS `.pkg` and Windows portable artifacts are unsigned. The site states this and directs manual download users to published checksums.
- The Linux release is x86_64. An arm64 Linux browser falls back to the full GitHub Releases page instead of offering the wrong build.
- The checked-in Homebrew, Scoop, and winget templates contain placeholder hashes. The release workflow publishes checksum-complete copies from the real assets.

## Needs operator action

- Register `apk-release-pocket` in the Sociobot billing engine at $39 one time with return URL `https://apk-release-pocket.sociobot.in/?license={token}`. The public page honestly shows “Team sales open soon” until that endpoint exists; license restore and verification are implemented and tested.
- Configure `HOMEBREW_TAP_TOKEN` if the `B-Divyesh/homebrew-apk-release-pocket` repository should be created and updated automatically.
- Submit the generated winget manifest to `microsoft/winget-pkgs` after reviewing the published Windows archive.
