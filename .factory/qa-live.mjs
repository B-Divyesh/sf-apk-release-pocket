import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = 'https://apk-release-pocket.sociobot.in';
const browser = await chromium.launch({ headless: true });
const result = { checkedAt: new Date().toISOString(), base, pages: {}, keyboard: {}, mobile: {}, reducedMotion: {}, pwa: {} };

async function inspectPage(context, path, name) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const requests = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} :: ${request.failure()?.errorText}`));
  page.on('request', (request) => requests.push(request.url()));
  const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const semantics = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1Count: document.querySelectorAll('h1').length,
    h1: document.querySelector('h1')?.textContent?.trim(),
    mainCount: document.querySelectorAll('main').length,
    missingAlt: document.querySelectorAll('img:not([alt])').length,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    cookie: document.cookie,
    localStorageKeys: Object.keys(localStorage).sort(),
  }));
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  result.pages[name] = {
    path,
    status: response?.status(),
    ...semantics,
    seriousCritical: axe.violations.filter((item) => ['serious', 'critical'].includes(item.impact)).map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    allAxeViolations: axe.violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })),
    consoleErrors,
    pageErrors,
    requestFailures,
    requestOrigins: [...new Set(requests.map((url) => new URL(url).origin))],
    requests,
  };
  return page;
}

const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const home = await inspectPage(desktop, '/', 'home');
result.firstRead = {
  headline: await home.locator('h1').innerText(),
  audienceSentence: await home.locator('.lede').innerText(),
  primaryAction: await home.locator('.hero-actions .primary').innerText(),
  facts: await home.locator('.trust-strip p').allInnerTexts(),
  releaseState: await home.locator('#release-state').innerText(),
  releaseHref: await home.locator('#platform-download').getAttribute('href'),
};
await home.screenshot({ path: '.factory/evidence/verification-1/live-home-desktop.jpg', type: 'jpeg', quality: 78 });
await home.close();

for (const [path, name] of [['/demo/', 'demo'], ['/privacy/', 'privacy'], ['/terms/', 'terms'], ['/missing-page', 'missing']]) {
  const page = await inspectPage(desktop, path, name);
  await page.close();
}

const keyboardPage = await desktop.newPage();
await keyboardPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await keyboardPage.waitForTimeout(1800);
const sequence = [];
for (let i = 0; i < 7; i += 1) {
  await keyboardPage.keyboard.press('Tab');
  sequence.push(await keyboardPage.evaluate(() => ({
    tag: document.activeElement?.tagName,
    text: document.activeElement?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 100),
    href: document.activeElement?.getAttribute?.('href'),
    outline: getComputedStyle(document.activeElement).outline,
  })));
}
await keyboardPage.keyboard.press('Enter');
await keyboardPage.waitForURL(/\/demo\/$/);
result.keyboard = { sequence, enterDestination: keyboardPage.url() };
await keyboardPage.close();

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mobilePage = await inspectPage(mobile, '/', 'homeMobile');
await mobilePage.screenshot({ path: '.factory/evidence/verification-1/live-home-mobile.jpg', type: 'jpeg', quality: 78 });
await mobilePage.goto(`${base}/demo/`, { waitUntil: 'domcontentloaded' });
await mobilePage.waitForTimeout(1000);
result.mobile.beforeResize = await mobilePage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
result.mobile.smallTargets = await mobilePage.locator('a, button, input, textarea').evaluateAll((items) => items.filter((item) => {
  const box = item.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
}).map((item) => ({ html: item.outerHTML.slice(0, 180), width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })));
await mobilePage.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
result.mobile.at200Percent = await mobilePage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
await mobilePage.screenshot({ path: '.factory/evidence/verification-1/live-demo-mobile-200pct.jpg', type: 'jpeg', quality: 75, fullPage: false });
await mobilePage.close();
await mobile.close();

const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const reducedPage = await reduced.newPage();
await reducedPage.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await reducedPage.waitForTimeout(1800);
result.reducedMotion = await reducedPage.evaluate(() => {
  const button = getComputedStyle(document.querySelector('.button'));
  return { transitionDuration: button.transitionDuration, animationDuration: button.animationDuration, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior };
});
await reduced.close();

const pwaContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'allow' });
const pwaPage = await pwaContext.newPage();
const pwaErrors = [];
pwaPage.on('pageerror', (error) => pwaErrors.push(error.message));
await pwaPage.goto(`${base}/demo/`, { waitUntil: 'domcontentloaded' });
await pwaPage.waitForTimeout(2500);
const before = await pwaPage.evaluate(async () => ({
  registrations: (await navigator.serviceWorker.getRegistrations()).map((item) => ({ scope: item.scope, active: item.active?.scriptURL, installing: item.installing?.scriptURL, waiting: item.waiting?.scriptURL })),
  controller: navigator.serviceWorker.controller?.scriptURL || null,
  cacheKeys: await caches.keys(),
}));
const ready = await pwaPage.evaluate(() => Promise.race([
  navigator.serviceWorker.ready.then((registration) => ({ ok: true, scope: registration.scope, active: registration.active?.scriptURL || null })),
  new Promise((resolve) => setTimeout(() => resolve({ ok: false, timeout: true }), 8000)),
]));
let offlineHeading = null;
let offlineReloadError = null;
if (ready.ok) {
  await pwaPage.reload({ waitUntil: 'domcontentloaded' });
  await pwaContext.setOffline(true);
  try {
    await pwaPage.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    offlineHeading = await pwaPage.locator('h1').innerText();
  } catch (error) { offlineReloadError = error.message; }
}
result.pwa = { before, ready, offlineHeading, offlineReloadError, errors: pwaErrors };
await pwaContext.close();

await desktop.close();
await browser.close();
console.log(JSON.stringify(result, null, 2));
