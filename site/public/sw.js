const CACHE = 'arp-site-v2';
const ROUTES = ['/', '/demo/', '/privacy/', '/terms/', '/404/', '/assets/hero.webp', '/assets/demo-terminal.svg', '/install.sh', '/install.ps1'];

async function cacheShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(ROUTES);
  const home = await cache.match('/');
  if (!home) return;
  const html = await home.text();
  const paths = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !path.startsWith('//'));
  await cache.addAll([...new Set(paths)]);
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
