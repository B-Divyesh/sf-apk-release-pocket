import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('https://github.com/**/latest.json', (route) => route.fulfill({ status: 404, body: 'not released' }));
  await page.goto('/');
});

test('has one clear heading and resilient release state', async ({ page }) => {
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Hand users an APK they can trust.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /View release downloads/ })).toBeVisible();
  await expect(page.getByText(/first release asset is not available yet/i)).toBeVisible();
});

test('copies the install command and supports keyboard navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Copy macOS and Linux install command' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#copy-status')).toContainText(/copied|selected/i);
});

test('stores returned license without leaving it in the URL', async ({ page }) => {
  await page.route('https://api.sociobot.in/**', (route) => route.fulfill({ json: { valid: true, reason: 'ok', expires_at: null } }));
  await page.goto('/?license=test-token');
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await expect(page.locator('#audit-desk')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sb_license:apk-release-pocket'))).toBe('test-token');
});

test('has no serious accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact))).toEqual([]);
});

test('legal pages render independently', async ({ page }) => {
  await page.goto('/privacy/');
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await page.goto('/terms/');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms' })).toBeVisible();
});
