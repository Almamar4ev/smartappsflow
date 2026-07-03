// Minimal offline-cache service worker for سجل صيانة السيارات
const CACHE = 'car-maint-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((hit) => {
        const network = fetch(e.request)
          .then((res) => {
            try { cache.put(e.request, res.clone()); } catch (_) {}
            return res;
          })
          .catch(() => hit);
        return hit || network;
      })
    )
  );
});
