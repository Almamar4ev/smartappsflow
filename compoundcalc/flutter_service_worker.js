'use strict';

// Replaces a previously installed calculator copy, then removes itself.
// Only this app's caches are deleted. Other apps on smartappsflow.net stay.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    let hadCache = false;
    try {
      const keys = await caches.keys();
      const ours = keys.filter((key) =>
        key.indexOf('flutter') !== -1 || key.indexOf('compoundcalc') !== -1);
      hadCache = ours.length > 0;
      await Promise.all(ours.map((key) => caches.delete(key)));
    } catch (e) {
      console.warn('Failed to clear cached calculator files:', e);
    }

    try {
      if (hadCache) {
        const clients = await self.clients.matchAll({ type: 'window' });
        await Promise.all(clients.map((client) => {
          if (!client.url || client.url.indexOf('/compoundcalc') === -1) {
            return Promise.resolve();
          }
          if ('navigate' in client) return client.navigate(client.url);
          return Promise.resolve();
        }));
      }
    } catch (e) {
      console.warn('Failed to reload installed calculator clients:', e);
    }

    try {
      await self.registration.unregister();
    } catch (e) {
      console.warn('Failed to unregister the service worker:', e);
    }
  })());
});
