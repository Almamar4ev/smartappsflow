'use strict';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    let hadCache = false;
    try {
      const keys = await caches.keys();
      hadCache = keys.length > 0;
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) {
      console.warn('Failed to clear cached calculator files:', e);
    }

    try {
      if (hadCache) {
        const clients = await self.clients.matchAll({ type: 'window' });
        await Promise.all(clients.map((client) => {
          if (client.url && 'navigate' in client) return client.navigate(client.url);
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
