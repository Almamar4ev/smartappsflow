/* Ends the review copy at /compoundcalc-preview/ cleanly.

   Use when the review period is over, BEFORE deleting the folder:
     1. Replace compoundcalc-preview/service-worker.js on the site with this
        file (leave the rest as it is) and publish.
     2. Wait about a week, so testers who open the preview again get it.
     3. Then delete the compoundcalc-preview/ folder.

   When a tester's browser fetches this worker it installs at once, deletes
   only the preview's caches (compoundcalc-preview-*), unregisters itself and
   reloads open preview tabs. Nothing of the live /compoundcalc/ or of other
   apps on smartappsflow.net is touched. Its localStorage keys
   (compoundcalc_preview.*) are cleared by index.html of this same folder
   only if you also publish preview-retire/index.html. */
const PREFIX = 'compoundcalc-preview-';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const tabs = await self.clients.matchAll({ type: 'window' });
    for (const tab of tabs) {
      try { tab.navigate(tab.url); } catch (_) {}
    }
  })());
});
