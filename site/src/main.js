const RELEASE_MANIFEST = 'https://github.com/B-Divyesh/sf-apk-release-pocket/releases/latest/download/latest.json';
const BILLING = 'https://api.sociobot.in/api/v1/products/apk-release-pocket';
const LICENSE_KEY = 'sb_license:apk-release-pocket';
const VERDICT_KEY = 'sb_license_verdict:apk-release-pocket';
const AUDIT_KEY = 'arp_team_audit';
const DAY = 86_400_000;

const platformKey = () => {
  const value = `${navigator.userAgentData?.platform || navigator.platform || ''} ${navigator.userAgent}`.toLowerCase();
  if (value.includes('win')) return 'windows-x86_64';
  if (value.includes('mac')) return value.includes('arm') ? 'macos-aarch64' : 'macos-x86_64';
  if (value.includes('linux')) return value.includes('aarch64') || value.includes('arm64') ? 'linux-aarch64' : 'linux-x86_64';
  return null;
};

async function loadRelease() {
  const button = document.querySelector('#platform-download');
  const note = document.querySelector('#platform-note');
  const state = document.querySelector('#release-state');
  if (!button || !note || !state) return;
  try {
    const response = await fetch(RELEASE_MANIFEST, { cache: 'no-store' });
    if (!response.ok) throw new Error(`release manifest returned ${response.status}`);
    const manifest = await response.json();
    const key = platformKey();
    const asset = key && manifest.assets?.[key];
    if (!asset?.url) throw new Error('no matching asset is published yet');
    button.href = asset.url;
    button.dataset.state = 'ready';
    button.querySelector('span').textContent = `Download ${manifest.version}`;
    note.textContent = key.replace('-', ' · ');
    state.textContent = `Ready: ${asset.name || key}. SHA-256 published with the release.`;
  } catch (error) {
    button.dataset.state = 'fallback';
    button.querySelector('span').textContent = 'View release downloads';
    note.textContent = 'Choose your platform on GitHub';
    state.textContent = navigator.onLine ? 'The first release asset is not available yet. Source and install docs are ready.' : 'You are offline. Install instructions remain available below.';
    state.classList.add('error');
  }
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
      status.textContent = 'Clipboard unavailable. Command selected for manual copy.';
    }
  }));
}

function readVerdict() {
  try { return JSON.parse(localStorage.getItem(VERDICT_KEY) || 'null'); } catch { return null; }
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
    setLicenseState(true, 'Team lantern unlocked from today’s verified license.');
    return;
  }
  try {
    const response = await fetch(`${BILLING}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verification service unavailable');
    const verdict = await response.json();
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ ...verdict, checkedAt: Date.now() }));
    if (verdict.valid) setLicenseState(true, 'License verified. Team lantern is unlocked.');
    else setLicenseState(false, `License no longer active (${verdict.reason || 'invalid'}). You can purchase a new unlock above.`);
  } catch {
    if (cached?.valid) setLicenseState(true, 'Offline: using the last verified license.');
    else setLicenseState(false, 'Could not verify right now. Check your connection and try again.');
  }
}

function setupLicense() {
  const params = new URLSearchParams(location.search);
  const returned = params.get('license');
  if (returned) {
    localStorage.setItem(LICENSE_KEY, returned);
    params.delete('license');
    history.replaceState({}, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  }
  const token = returned || localStorage.getItem(LICENSE_KEY);
  const cached = readVerdict();
  if (cached?.valid) setLicenseState(true, 'Checking your saved team license…');
  if (token) verifyLicense(token);
  document.querySelector('#license-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('license')?.toString().trim();
    if (!value) return;
    localStorage.setItem(LICENSE_KEY, value);
    setLicenseState(false, 'Verifying license…');
    verifyLicense(value, true);
  });
}

function getAudit() {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; }
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
    item.textContent = 'No approvals recorded on this device yet.';
    list.append(item);
  }
}

function setupAudit() {
  document.querySelector('#audit-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const field = document.querySelector('#audit-note');
    const entries = getAudit();
    entries.unshift({ note: field.value.trim(), at: new Date().toISOString() });
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
    field.value = '';
    renderAudit();
  });
  document.querySelector('#export-audit')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ product: 'apk-release-pocket', exported_at: new Date().toISOString(), entries: getAudit() }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'apk-release-pocket-audit.json';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

loadRelease();
setupCopy();
setupLicense();
setupAudit();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js');
