'use strict';

// Keeps the site installable. Network-first so a new publish is not stuck
// behind an old Flutter cache. Only this app's caches are deleted.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      const ours = keys.filter((key) =>
        key.indexOf('flutter') !== -1 || key.indexOf('compoundcalc') !== -1);
      await Promise.all(ours.map((key) => caches.delete(key)));
    } catch (e) {
      console.warn('Failed to clear old calculator caches:', e);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
