# APK Release Pocket demo

## Entry points

- Browser: <https://apk-release-pocket.sociobot.in/demo/>
- CLI: `arp demo`
- Machine-readable CLI output: `arp demo --json --ci`

The browser demo opens in one click from the first screen. It shows the same Imagepipe release facts and terminal output as the CLI command.

## Sample data

The CLI bundles the signed F-Droid Imagepipe 0.72 APK. Its package is `de.kaffeemitkoffein.imagepipe`, and its version code is 51. Provenance and license details are in `examples/README.md`.

`arp demo` copies that APK into a new operating-system temporary directory. It runs the normal signature check and pocket writer. It prints the exact output path and never reads an existing release directory.

## Isolation and reset

Browser demo data uses local-storage keys beginning with `demo:`. Real license and audit keys are not read in demo mode. **Reset demo** deletes the demo keys and restores the sample approval. **Start for real** deletes the demo keys before returning home.

The CLI sandbox uses a new path named `apk-release-pocket-demo-<process>-<time>` under the operating-system temporary directory. It leaves that directory in place so the generated page can be opened. The user may remove it after inspection.

## Claim verification

Every entry in `.factory/claims.json` has one matching Playwright test. Run all claims with `npm test`, or run the exact command recorded beside one claim.
