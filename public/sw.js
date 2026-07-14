// Littgram service worker — makes the app installable on Android/Chrome
// ("Add to Home Screen" installs it like a real app) and keeps the shell
// usable on flaky connections.
//
// Strategy:
//  - navigations: network-first, falling back to the last cached shell
//  - hashed build assets (/assets/*): cache-first (immutable filenames)
//  - everything else same-origin: network, opportunistically cached
//  - never touches /api/, cross-origin (Firebase, fonts), or big media
//    folders (/texts/, /comics/) — those stay live-only.

const CACHE = 'littgram-v1';
const SHELL = '/__shell';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/texts/') ||
      url.pathname.startsWith('/comics/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(SHELL, copy));
        return res;
      }).catch(() => caches.match(SHELL))
    );
    return;
  }

  const immutable = url.pathname.startsWith('/assets/');
  e.respondWith(
    caches.match(req).then(hit => {
      const fresh = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      });
      // hashed assets never change: cached copy wins; otherwise prefer network
      return immutable && hit ? hit : fresh.catch(() => hit || Promise.reject(new Error('offline')));
    })
  );
});
