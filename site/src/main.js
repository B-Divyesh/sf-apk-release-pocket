const RELEASE_API = 'https://api.github.com/repos/B-Divyesh/sf-apk-release-pocket/releases/latest';
const RELEASES_PAGE = 'https://github.com/B-Divyesh/sf-apk-release-pocket/releases';
const RELEASE_CACHE_KEY = 'arp:github-release';
const RELEASE_CACHE_TTL = 3_600_000;
const BILLING = 'https://api.sociobot.in/api/v1/products/apk-release-pocket';
const LICENSE_KEY = 'sb_license:apk-release-pocket';
const VERDICT_KEY = 'sb_license_verdict:apk-release-pocket';
const AUDIT_KEY = 'arp_team_audit';
const DAY = 86_400_000;
const routePath = location.pathname.replace(/\/+$/, '') || '/';
const demoMode = routePath === '/demo' || new URLSearchParams(location.search).get('demo') === '1';
const notFoundMode = !['/', '/demo'].includes(routePath);

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Browsing still works when storage is unavailable. */ }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* Browsing still works when storage is unavailable. */ }
}

function removeDemoStorage() {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith('demo:')).forEach(storageRemove);
  } catch { /* Demo remains in memory when storage is unavailable. */ }
}

function safeGithubUrl(value, kind = 'release') {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
    const expected = kind === 'asset'
      ? '/B-Divyesh/sf-apk-release-pocket/releases/download/'
      : '/B-Divyesh/sf-apk-release-pocket/releases';
    return url.pathname.startsWith(expected) ? url.href : null;
  } catch { return null; }
}

async function platformKey() {
  const basic = `${navigator.userAgentData?.platform || navigator.platform || ''} ${navigator.userAgent}`.toLowerCase();
  let architecture = '';
  try {
    if (navigator.userAgentData?.getHighEntropyValues) {
      architecture = (await navigator.userAgentData.getHighEntropyValues(['architecture'])).architecture?.toLowerCase() || '';
    }
  } catch { /* Basic platform detection remains available. */ }
  if (basic.includes('win')) return 'windows-x86_64';
  if (basic.includes('mac')) {
    if (architecture.includes('arm') || basic.includes('arm')) return 'macos-aarch64';
    return architecture.includes('x86') ? 'macos-x86_64' : 'macos';
  }
  if (basic.includes('linux')) return architecture.includes('arm') || basic.includes('aarch64') || basic.includes('arm64') ? 'linux-aarch64' : 'linux-x86_64';
  return null;
}

function matchingAsset(release, key) {
  const endings = {
    'windows-x86_64': /windows-x86_64\.zip$/i,
    'macos-x86_64': /macos-x86_64\.tar\.gz$/i,
    'macos-aarch64': /macos-aarch64\.tar\.gz$/i,
    'linux-x86_64': /linux-x86_64\.tar\.gz$/i,
    'linux-aarch64': /linux-aarch64\.tar\.gz$/i,
  };
  const pattern = endings[key];
  if (!pattern || !Array.isArray(release.assets)) return null;
  return release.assets.find((asset) => pattern.test(asset?.name || '') && safeGithubUrl(asset?.browser_download_url, 'asset')) || null;
}

function readReleaseCache() {
  try {
    const cached = JSON.parse(storageGet(RELEASE_CACHE_KEY) || 'null');
    if (!cached?.savedAt || !cached?.release || !Array.isArray(cached.release.assets)) return null;
    return cached;
  } catch { return null; }
}

async function showRelease(release, cached = false) {
  const button = document.querySelector('#platform-download');
  const note = document.querySelector('#platform-note');
  const state = document.querySelector('#release-state');
  if (!button || !note || !state) return;
  const key = await platformKey();
  const asset = matchingAsset(release, key);
  const releaseUrl = safeGithubUrl(release.html_url) || RELEASES_PAGE;
  state.className = 'release-state';
  button.href = asset ? safeGithubUrl(asset.browser_download_url, 'asset') : releaseUrl;
  button.dataset.state = asset ? 'ready' : 'fallback';
  if (asset) {
    button.querySelector('span').textContent = `Download ${release.tag_name || 'latest release'}`;
    note.textContent = key.replace('-', ' · ');
    state.textContent = `${asset.name} is ready.${cached ? ' Using saved release data.' : ''}`;
  } else {
    button.querySelector('span').textContent = 'Choose a release download';
    note.textContent = key === 'macos' ? 'Choose Apple silicon or Intel on GitHub' : 'Choose your platform on GitHub';
    state.textContent = 'The release is ready. Choose the build that matches your computer.';
  }
}

function showReleasePending(reason) {
  const button = document.querySelector('#platform-download');
  const note = document.querySelector('#platform-note');
  const state = document.querySelector('#release-state');
  if (!button || !note || !state) return;
  button.href = RELEASES_PAGE;
  button.dataset.state = 'fallback';
  button.querySelector('span').textContent = 'View GitHub releases';
  note.textContent = 'Install steps remain available';
  state.className = `release-state ${reason === 'offline' ? 'offline' : 'pending'}`;
  state.textContent = reason === 'offline'
    ? 'You are offline. Saved install steps remain available.'
    : 'Downloads are being published. Check GitHub Releases in a moment.';
}

async function loadRelease() {
  if (demoMode) {
    showReleasePending('demo');
    return;
  }
  const cached = readReleaseCache();
  if (cached && Date.now() - cached.savedAt < RELEASE_CACHE_TTL) {
    await showRelease(cached.release, true);
    return;
  }
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) {
      if (cached) await showRelease(cached.release, true);
      else showReleasePending(response.status === 404 ? 'missing' : navigator.onLine ? 'unavailable' : 'offline');
      return;
    }
    const release = await response.json();
    if (!release || !Array.isArray(release.assets)) {
      if (cached) await showRelease(cached.release, true);
      else showReleasePending('unavailable');
      return;
    }
    storageSet(RELEASE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release }));
    await showRelease(release);
  } catch {
    if (cached) await showRelease(cached.release, true);
    else showReleasePending(navigator.onLine ? 'unavailable' : 'offline');
  }
}

function setupDemo() {
  if (!demoMode) return;
  document.body.classList.add('demo-mode');
  document.title = 'Demo — APK Release Pocket';
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://apk-release-pocket.sociobot.in/demo/');
  const banner = document.querySelector('#demo-banner');
  if (banner) banner.hidden = false;
  const heading = document.querySelector('h1');
  if (heading) heading.textContent = 'See a verified APK release.';
  const lede = document.querySelector('.lede');
  if (lede) lede.textContent = 'This bundled sample runs through the same signature check and release-page writer as your APK.';
  document.querySelector('#demo-reset')?.addEventListener('click', () => {
    removeDemoStorage();
    seedDemoAudit();
    const status = document.querySelector('#demo-status');
    if (status) status.textContent = 'Demo reset to the bundled Imagepipe release.';
  });
  document.querySelector('#start-real')?.addEventListener('click', () => {
    removeDemoStorage();
  });
}

function setupNotFound() {
  document.title = 'Page not found — APK Release Pocket';
  document.querySelector('link[rel="canonical"]')?.remove();
  document.querySelector('.site-header a[href="#install"]')?.setAttribute('href', '/#install');
  const main = document.querySelector('#main');
  if (!main) return;
  main.className = 'legal-main';
  main.innerHTML = '<p class="kicker">Missing receipt</p><h1>That page is not in this pocket.</h1><p>The address may have changed, or the page may never have existed.</p><a class="button primary" href="/">Return to the release counter</a>';
}

function setupCopy() {
  const status = document.querySelector('#copy-status');
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    const target = document.querySelector(`#${button.dataset.copy}`);
    try {
      await navigator.clipboard.writeText(target.textContent);
      button.textContent = 'Copied';
      status.textContent = 'Install command copied';
      setTimeout(() => { button.textContent = 'Copy'; }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      status.textContent = 'Clipboard access is off. The command is selected so you can copy it.';
    }
  }));
}

function readVerdict() {
  try { return JSON.parse(storageGet(VERDICT_KEY) || 'null'); } catch { return null; }
}

function setLicenseState(valid, message) {
  const desk = document.querySelector('#audit-desk');
  const output = document.querySelector('#license-message');
  if (!desk || !output) return;
  desk.hidden = !valid;
  output.textContent = message;
  output.classList.toggle('error', !valid && Boolean(message));
  if (valid) renderAudit();
}

async function verifyLicense(token, force = false) {
  const cached = readVerdict();
  if (!force && cached?.valid && Date.now() - cached.checkedAt < DAY) {
    setLicenseState(true, 'Team lantern is active from today’s saved check.');
    return;
  }
  try {
    const response = await fetch(`${BILLING}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification service unavailable');
    const verdict = await response.json();
    storageSet(VERDICT_KEY, JSON.stringify({ ...verdict, checkedAt: Date.now() }));
    if (verdict.valid) setLicenseState(true, 'License checked. Team lantern is active.');
    else setLicenseState(false, `This license is not active (${verdict.reason || 'invalid'}). You can buy a new license above.`);
  } catch {
    if (cached?.valid) setLicenseState(true, 'You are offline. The last successful license check still applies.');
    else setLicenseState(false, 'The license could not be checked. Check your connection and try again.');
  }
}

function setupLicense() {
  if (demoMode) {
    setLicenseState(true, 'Demo license active. Sample data stays separate.');
    return;
  }
  const params = new URLSearchParams(location.search);
  const returned = params.get('license');
  if (returned) {
    storageSet(LICENSE_KEY, returned);
    params.delete('license');
    history.replaceState({}, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }
  const token = returned || storageGet(LICENSE_KEY);
  const cached = readVerdict();
  if (cached?.valid) setLicenseState(true, 'Checking your saved team license…');
  if (token) verifyLicense(token);
  document.querySelector('#license-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('license')?.toString().trim();
    if (!value) return;
    storageSet(LICENSE_KEY, value);
    setLicenseState(false, 'Checking license…');
    verifyLicense(value, true);
  });
}

function auditKey() { return demoMode ? `demo:${AUDIT_KEY}` : AUDIT_KEY; }

function getAudit() {
  try { return JSON.parse(storageGet(auditKey()) || '[]'); } catch { return []; }
}

function seedDemoAudit() {
  if (demoMode && !storageGet(auditKey())) {
    storageSet(auditKey(), JSON.stringify([{ note: 'Checked publisher fingerprint on the test phone', at: '2026-08-28T09:00:00Z' }]));
  }
  renderAudit();
}

function renderAudit() {
  const list = document.querySelector('#audit-list');
  if (!list) return;
  const entries = getAudit();
  list.replaceChildren(...entries.map((entry) => {
    const item = document.createElement('li');
    const note = document.createElement('strong');
    const time = document.createElement('small');
    note.textContent = entry.note;
    time.textContent = new Date(entry.at).toLocaleString();
    item.append(note, time);
    return item;
  }));
  if (!entries.length) {
    const item = document.createElement('li');
    item.textContent = 'Approval notes will appear here after you add one.';
    list.append(item);
  }
}

function setupAudit() {
  seedDemoAudit();
  document.querySelector('#audit-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const field = document.querySelector('#audit-note');
    const entries = getAudit();
    entries.unshift({ note: field.value.trim(), at: new Date().toISOString() });
    storageSet(auditKey(), JSON.stringify(entries));
    field.value = '';
    renderAudit();
  });
  document.querySelector('#export-audit')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ product: 'apk-release-pocket', demo: demoMode, exported_at: new Date().toISOString(), entries: getAudit() }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'apk-release-pocket-audit.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

if (notFoundMode) {
  setupNotFound();
} else {
  setupDemo();
  loadRelease().catch(() => showReleasePending(navigator.onLine ? 'unavailable' : 'offline'));
  setupCopy();
  setupLicense();
  setupAudit();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}
