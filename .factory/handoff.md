# APK Release Pocket — verification 2 handoff

## Status

**Independent QA verdict: FAIL.**

Implementation reviewed: `e013eb0c87658b9d69aea1ee708d2557240d71bd`<br>
Documentation baseline: `8f64e770caf6ae0e81dadd20f5e61689f21aa1fb`<br>
Live URL: <https://apk-release-pocket.sociobot.in/><br>
Full report: [verification-2.md](verification-2.md)

No product code was changed during this verification.

## What passed

- All ten exact claim commands passed from a fresh checkout.
- `npm test` passed 42/42 browser tests.
- Rust formatting, strict clippy, six tests, release build, packaging, and crate verification passed.
- `npm audit --omit=dev` reported zero vulnerabilities; `npm run build` produced `dist/site/`.
- The packaged crate installed into a clean consumer root and completed inspect, demo, release, invalid-input, checksum, and recovery checks.
- The public v0.1.1 Linux archive matched `SHA256SUMS`; its demo passed; the live checksum-verifying installer installed `arp 0.1.1` into an isolated directory.
- The live first screen, one-click demo, realistic output, persistent demo label, reset, exit, and separation from pre-seeded real data passed on desktop and a 390 px phone.
- Live marketing, demo, privacy, terms, and 404 pages passed semantics, keyboard, focus, zoom, reduced-motion, link, privacy-request, and axe checks.
- Fresh offline `/demo/` reload passed. Hashed assets are immutable; `sw.js` is no-cache; unknown routes return styled HTTP 404 responses.
- Mobile Lighthouse on `/demo/`: Performance 100, Accessibility 100, Best Practices 100, SEO 100, LCP 907 ms, CLS 0, TBT 29 ms.
- Live product files checked against the clean build matched byte-for-byte.

## Findings

1. **Critical:** the shared Sociobot license verifier returned 30 HTTP 200 responses for 30 concurrent invalid requests, with no HTTP 429 or `Retry-After`.
2. **High:** the CLI-generated release page has a serious axe error because `.qr` uses `aria-label` without a permitted role. Its prior-release link is also only 24.8 px high on mobile.
3. **High:** the documented Homebrew tap does not exist. The documented Scoop bucket lacks a manifest in a standard location, while its checked-in nested manifest is stale with an all-zero hash. Checked-in Homebrew and winget templates are also stale and not ready to use.
4. **Medium:** invalid-license recovery tells the user to buy above, but no purchase link is available while sales are closed.
5. **Medium:** three public CLI promises lack complete claim coverage: retained prior releases, publisher/version/no-write rejection, and the full stable exit-code mapping.

Finding count: **5**. Untested public claim count: **3**.

## How to verify

From a clean checkout:

```sh
npm ci
cargo fmt --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
cargo build --locked --release
cargo package --locked --allow-dirty
npm audit --omit=dev
npm test
npm run build
```

Run each command in `.factory/claims.json` separately. For live structure and console checks:

```sh
/opt/fleet/lib/verify-url.sh https://apk-release-pocket.sociobot.in/ .factory/evidence/verification-2
```

## Required next work

- Configure the shared billing verifier to return HTTP 429 and `Retry-After` under a rapid invalid-request burst. This requires operator work outside this repository.
- Repair and test the generated release page's QR semantics and mobile history-link target.
- Publish the Homebrew tap, expose a valid Scoop bucket manifest, and replace checked-in winget/package templates with v0.1.1 hashes.
- Replace the unavailable purchase instruction in the invalid-license error state.
- Add complete claim entries and outcome tests for the three untested public promises.

After those changes, rerun all clean-checkout claim commands, the installed-artifact flow, generated-page accessibility, package-manager installs, and the live billing burst check.
