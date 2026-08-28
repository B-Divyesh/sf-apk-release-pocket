import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API = 'https://api.github.com/repos/B-Divyesh/sf-apk-release-pocket/releases/latest';
const release = {
  tag_name: 'v0.1.1',
  html_url: 'https://github.com/B-Divyesh/sf-apk-release-pocket/releases/tag/v0.1.1',
  assets: [
    {
      name: 'apk-release-pocket-0.1.1-linux-x86_64.tar.gz',
      browser_download_url: 'https://github.com/B-Divyesh/sf-apk-release-pocket/releases/download/v0.1.1/apk-release-pocket-0.1.1-linux-x86_64.tar.gz',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route(API, (route) => route.fulfill({ status: 404, json: { message: 'Not Found' } }));
});

test('renders a calm state when no release exists', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Ship a verified APK release.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /View GitHub releases/ })).toBeVisible();
  await expect(page.getByText(/Downloads are being published/i)).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('uses the GitHub API and never fetches the blocked latest.json URL', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.unroute(API);
  await page.route(API, (route) => route.fulfill({ json: release }));
  await page.goto('/');
  const download = page.locator('#platform-download');
  await expect(download).toHaveAttribute('href', release.assets[0].browser_download_url);
  await expect(download).toContainText('v0.1.1');
  await expect(page.locator('#release-state')).toContainText('is ready');
  expect(requests.filter((url) => url.includes('/releases/latest/download/latest.json'))).toEqual([]);
  expect(requests.filter((url) => url === API)).toHaveLength(1);
});

test('caches a successful API response for one hour', async ({ page }) => {
  let requests = 0;
  await page.unroute(API);
  await page.route(API, (route) => {
    requests += 1;
    return route.fulfill({ json: release });
  });
  await page.goto('/');
  await expect(page.locator('#platform-download')).toContainText('v0.1.1');
  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('arp:github-release')));
  expect(cached.release.tag_name).toBe('v0.1.1');
  expect(Date.now() - cached.savedAt).toBeLessThan(3_600_000);
  await page.reload();
  await expect(page.locator('#release-state')).toContainText('saved release data');
  expect(requests).toBe(1);
});

test('uses stale successful data when refresh is unavailable', async ({ page }) => {
  await page.addInitScript((value) => localStorage.setItem('arp:github-release', JSON.stringify({ savedAt: 1, release: value })), release);
  await page.unroute(API);
  await page.route(API, (route) => route.abort('connectionfailed'));
  await page.goto('/');
  await expect(page.locator('#platform-download')).toHaveAttribute('href', release.assets[0].browser_download_url);
  await expect(page.locator('#release-state')).toContainText('saved release data');
});

test('rejects unsafe cached asset links', async ({ page }) => {
  const unsafe = structuredClone(release);
  unsafe.assets[0].browser_download_url = 'javascript:alert(1)';
  await page.addInitScript((value) => localStorage.setItem('arp:github-release', JSON.stringify({ savedAt: Date.now(), release: value })), unsafe);
  await page.goto('/');
  await expect(page.locator('#platform-download')).toHaveAttribute('href', release.html_url);
  await expect(page.locator('#release-state')).toContainText('Choose the build');
});

test('copies the install command with the keyboard', async ({ page }) => {
  await page.goto('/');
  const copy = page.getByRole('button', { name: 'Copy macOS and Linux install command' });
  await copy.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#copy-status')).toContainText(/copied|selected/i);
});

test('stores a returned license and removes it from the address', async ({ page }) => {
  await page.route('https://api.sociobot.in/**', (route) => route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } }));
  await page.goto('/?license=test-token');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('#audit-desk')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb_license:apk-release-pocket'))).toBe('test-token');
});

test('demo is one click away and exposes isolated controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Try it with sample data/ }).click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page).toHaveTitle('Demo — APK Release Pocket');
  await expect(page.getByRole('complementary', { name: 'Demo controls' })).toBeVisible();
  await expect(page.locator('#demo-terminal')).toContainText('Imagepipe sample');
  await expect(page.getByRole('heading', { name: 'See a verified APK release.' })).toBeVisible();
});

test('has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/demo/');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact))).toEqual([]);
});

test('legal and not-found routes have independent titles and one h1', async ({ page }) => {
  for (const route of ['/privacy/', '/terms/', '/404/']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).not.toHaveTitle('APK Release Pocket — verify and publish Android APKs');
  }
});

test('mobile layout has no horizontal overflow and keeps controls large', async ({ page }) => {
  await page.goto('/demo/');
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  const tooSmall = await page.locator('a, button, input, textarea').evaluateAll((items) => items.filter((item) => {
    const box = item.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && (box.height < 44 || box.width < 44);
  }).map((item) => item.outerHTML));
  expect(tooSmall).toEqual([]);
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const resized = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(resized.scroll).toBeLessThanOrEqual(resized.client);
});

test('loads without uncaught errors when the API succeeds', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.unroute(API);
  await page.route(API, (route) => route.fulfill({ json: release }));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});

test('demo shell reloads offline after the first visit', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${baseURL}/404/`);
  await page.evaluate(() => caches.open('arp-site-v1'));
  await page.goto(`${baseURL}/demo/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(['arp-site-v2']);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'See a verified APK release.' })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
