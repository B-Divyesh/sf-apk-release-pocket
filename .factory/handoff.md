# APK Release Pocket — handoff

## What shipped

- Rust 0.1.0 single-binary CLI (`arp`) with `inspect` and `release` commands, structured JSON output, documented exit codes, CI mode, and publisher fingerprint pinning.
- APK Signature Scheme v2 verification that checks the RSA signature, binds the signer public key to its certificate, and recomputes the APK content digest before any release files are written.
- APK manifest inspection for package name, label, version name/code, min/target SDK, and native ABIs.
- Atomic static pocket generation: immutable APK names, `release.json`, `releases.json`, `SHA256SUMS`, QR download link, device-readable install instructions, and retained rollback history.
- Night-market landing/docs site with a project-owned 96 KB WebP illustration, responsive 390 px layout, release-loading/error/offline states, OS-aware GitHub asset selection, copy feedback, reduced-motion handling, privacy and terms pages, and a cached service-worker shell.
- Free/open tier plus a $39 one-time Team lantern unlock using the Sociobot checkout/verify contract. The token and local audit entries stay in browser local storage; cached validity is rechecked no more than daily and never blocks the free experience.
- SHA-verifying POSIX and PowerShell installers; Homebrew, Scoop, and winget templates; Linux `.deb`/`.rpm`, macOS `.pkg`, portable archives, and generated package-manager metadata in the tag release workflow.

## Run and verify

```sh
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings
cargo fmt --check
cargo package
npm ci
npm audit
npm test
npm run build
```

The deploy command is `npm run build`; the static root is `dist/site` and contains `index.html`.

An end-to-end CLI smoke test used the official NewPipe v0.29.1 GitHub APK: inspection returned package `org.schabi.newpipe`, version code `1015`, SDK/ABI facts, and signer SHA-256 `CB:84:06:9B:…:5C:AB`; a one-byte-mutated copy was rejected with exit code 4. Pocket output and JSON parsed successfully, and its APK checksum passed when checked from the pocket root.

## Quality results

- Rust: 6 tests passed; strict clippy and rustfmt passed.
- Web: 14 Playwright tests passed across Chromium desktop and a 390 × 844 mobile viewport.
- Axe WCAG 2 A/AA: no serious or critical violations.
- Lighthouse mobile: Performance 97, Accessibility 100, Best Practices 96, SEO 91; LCP 1.7 s; CLS 0; transferred bytes 107 KiB.
- Production budgets: JavaScript 5.60 KB raw, CSS 10.44 KB raw, fonts 0 KB, hero WebP 98.57 KB.
- `npm audit`: zero known vulnerabilities.
- YAML workflow/manifests linted; release metadata generator exercised against all four archive names.

## Known gaps

- v0.1.0 deliberately rejects v1-only, v3-only, and ECDSA/DSA-only APKs. RSA-backed v2 APKs (including apps that also carry v3) are supported and verified end to end. Expanding cryptographic algorithm support is the first CLI follow-up.
- Repository Homebrew/Scoop/winget files contain zero checksum placeholders before the first tagged build. The release workflow generates checksum-complete copies from the actual artifacts. Do not submit the checked-in winget template before replacing it with the generated release copy.
- macOS `.pkg` and Windows portable artifacts are unsigned. The site documents OS override and checksum verification.

## Needs operator action

- Register `apk-release-pocket` in the Sociobot billing engine at $39 one-time and set the return URL to `https://apk-release-pocket.sociobot.in/?license={token}`.
- Configure `HOMEBREW_TAP_TOKEN` with permission to create/update `B-Divyesh/homebrew-apk-release-pocket`; the release workflow creates the public tap if missing and writes the checksum-complete formula.
- Submit the generated winget manifests to `microsoft/winget-pkgs` after checking the published Windows archive.
- Deploy `dist/site` through the factory. No DNS, billing, or infrastructure was changed from this repository.
