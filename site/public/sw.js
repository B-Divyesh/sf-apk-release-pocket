const CACHE = 'arp-site-v3';
const SHELL_ROUTES = ['/', '/demo/', '/privacy/', '/terms/', '/404/', '/install.sh', '/install.ps1'];

function sameOriginPath(value) {
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? url.pathname : null;
  } catch {
    return null;
  }
}

function assetPaths(html) {
  return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => sameOriginPath(match[1]))
    .filter((path) => path && !path.endsWith('/') && !path.startsWith('/#'));
}

async function cachePath(cache, path) {
  const response = await fetch(path, { cache: 'reload' });
  if (!response.ok) throw new Error(`Could not cache ${path}`);
  await cache.put(path, response.clone());
  return response;
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  const home = await cachePath(cache, '/');
  const html = await home.text();
  const paths = [...new Set([...SHELL_ROUTES.slice(1), ...assetPaths(html)])];
  await Promise.all(paths.map((path) => cachePath(cache, path)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match('/'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
