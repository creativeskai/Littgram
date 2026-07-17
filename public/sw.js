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

// ── Web push (daily quote + continue-reading nudges from /api/push-daily) ──
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Littgram', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || 'littgram-daily', // one visible daily notification, not a pile
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    })
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
