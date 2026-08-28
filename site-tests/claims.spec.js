import { test, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const binary = join(root, 'target', 'debug', 'arp');
const sample = join(root, 'examples', 'imagepipe-0.72.apk');

test.beforeAll(() => {
  execFileSync('cargo', ['build', '--locked'], { cwd: root, stdio: 'pipe' });
});

test('@claim:apk-verification checks the bundled APK signature and content', () => {
  const output = execFileSync(binary, ['inspect', sample, '--json', '--ci'], { encoding: 'utf8' });
  const result = JSON.parse(output);
  expect(result.package).toBe('de.kaffeemitkoffein.imagepipe');
  expect(result.signature_verified).toBe(true);
  expect(result.signature_scheme).toContain('content and signer verified');
  expect(result.sha256).toBe('e6f270dd1c8367e3ccf18c2dde21419a3669cc41d85003ce141116e58ecda4f9');
});

test('@claim:demo-sandbox runs without setup and writes to a new temporary folder', () => {
  const output = execFileSync(binary, ['demo', '--json', '--ci'], { encoding: 'utf8', env: {} });
  const result = JSON.parse(output);
  expect(result.demo).toBe(true);
  expect(result.temporary_directory).toContain('apk-release-pocket-demo-');
  expect(result.temporary_directory.startsWith(tmpdir())).toBe(true);
  expect(existsSync(result.pocket)).toBe(true);
  rmSync(result.temporary_directory, { recursive: true });
});

test('@claim:pocket-files creates the documented release files', () => {
  const result = JSON.parse(execFileSync(binary, ['demo', '--json', '--ci'], { encoding: 'utf8' }));
  for (const name of ['index.html', 'release.json', 'releases.json', 'SHA256SUMS']) {
    expect(existsSync(join(result.pocket, name))).toBe(true);
  }
  expect(readFileSync(join(result.pocket, 'index.html'), 'utf8')).toContain('<svg');
  expect(readFileSync(join(result.pocket, 'SHA256SUMS'), 'utf8')).toContain(result.release.sha256);
  rmSync(result.temporary_directory, { recursive: true });
});

test('@claim:cli-local runs the release flow without network access', () => {
  const work = mkdtempSync(join(tmpdir(), 'arp-network-guard-'));
  const marker = join(work, 'network-used');
  const source = join(work, 'guard.c');
  const guard = join(work, 'guard.so');
  writeFileSync(source, `#include <errno.h>\n#include <fcntl.h>\n#include <sys/socket.h>\n#include <unistd.h>\nint connect(int s,const struct sockaddr *a,socklen_t l){int f=open("${marker}",O_CREAT|O_WRONLY,0600);if(f>=0)close(f);errno=EPERM;return -1;}\n`);
  execFileSync('cc', ['-shared', '-fPIC', source, '-o', guard]);
  const result = JSON.parse(execFileSync(binary, ['demo', '--json', '--ci'], { encoding: 'utf8', env: { LD_PRELOAD: guard } }));
  expect(existsSync(marker)).toBe(false);
  rmSync(result.temporary_directory, { recursive: true });
  rmSync(work, { recursive: true });
});

test('@claim:mit-license ships the CLI under the MIT license', () => {
  expect(readFileSync(join(root, 'Cargo.toml'), 'utf8')).toContain('license = "MIT"');
  expect(readFileSync(join(root, 'LICENSE'), 'utf8')).toContain('Permission is hereby granted, free of charge');
});

test('@claim:checksum-install refuses a bad archive hash and installs a matching one', async () => {
  const work = mkdtempSync(join(tmpdir(), 'arp-installer-'));
  const archiveRoot = join(work, 'archive');
  const archive = join(work, 'arp.tar.gz');
  const install = join(work, 'bin');
  execFileSync('mkdir', ['-p', archiveRoot]);
  writeFileSync(join(archiveRoot, 'arp'), '#!/bin/sh\necho sample arp\n');
  chmodSync(join(archiveRoot, 'arp'), 0o755);
  execFileSync('tar', ['-C', archiveRoot, '-czf', archive, 'arp']);
  const bytes = readFileSync(archive);
  const digest = createHash('sha256').update(bytes).digest('hex');
  let expected = '0'.repeat(64);
  const server = createServer((request, response) => {
    if (request.url === '/latest.json') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ assets: { 'linux-x86_64': { url: `http://127.0.0.1:${server.address().port}/arp.tar.gz`, sha256: expected } } }, null, 2));
    } else if (request.url === '/arp.tar.gz') response.end(bytes);
    else { response.statusCode = 404; response.end(); }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const run = () => new Promise((resolveRun) => {
    const child = spawn('sh', [join(root, 'site/public/install.sh')], {
      env: { ...process.env, ARP_MANIFEST_URL: `http://127.0.0.1:${server.address().port}/latest.json`, ARP_INSTALL_DIR: install },
    });
    let output = '';
    child.stdout.on('data', (part) => { output += part; });
    child.stderr.on('data', (part) => { output += part; });
    child.on('close', (code) => resolveRun({ code, output }));
  });
  const refused = await run();
  expect(refused.code).toBe(4);
  expect(refused.output).toContain('SHA-256 mismatch');
  expect(existsSync(join(install, 'arp'))).toBe(false);
  expected = digest;
  const installed = await run();
  expect(installed.code).toBe(0);
  expect(installed.output).toContain('Installed verified arp');
  expect(readFileSync(join(install, 'arp'), 'utf8')).toContain('sample arp');
  await new Promise((resolveClose) => server.close(resolveClose));
  rmSync(work, { recursive: true });
});

test('@claim:demo-isolation keeps sample notes separate and removes them on exit', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByLabel('Approval note').fill('Checked the sample on a Pixel 8');
  await page.getByRole('button', { name: 'Add approval' }).click();
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain('demo:arp_team_audit');
  expect(keys).not.toContain('arp_team_audit');
  await page.getByRole('link', { name: 'Start for real' }).click();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('demo:')))).toEqual([]);
});

test('@claim:team-audit adds an approval and exports JSON in the demo', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByLabel('Approval note').fill('Matched the publisher fingerprint');
  await page.getByRole('button', { name: 'Add approval' }).click();
  await expect(page.locator('#audit-list')).toContainText('Matched the publisher fingerprint');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export audit JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('apk-release-pocket-audit.json');
});

test('@claim:license-cache reuses a successful license check for one day', async ({ page }) => {
  let checks = 0;
  await page.route('https://api.sociobot.in/**', (route) => {
    checks += 1;
    return route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } });
  });
  await page.goto('/?license=sample-license');
  await expect(page.locator('#audit-desk')).toBeVisible();
  await page.reload();
  await expect(page.locator('#license-message')).toContainText('saved check');
  expect(checks).toBe(1);
});

test('@claim:site-privacy loads the demo without analytics or third-party requests', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(new URL(request.url()).origin));
  await page.goto('/demo/');
  await page.waitForLoadState('networkidle');
  expect([...new Set(requests)]).toEqual(['http://127.0.0.1:4173']);
  expect(await page.evaluate(() => document.cookie)).toBe('');
});
