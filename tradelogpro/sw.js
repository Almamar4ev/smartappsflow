// Service Worker — TradeLog Pro ONLY.
//
// This file is registered from ./sw.js inside /tradelogpro/, so its default
// scope is the /tradelogpro/ directory. It must never cache, control, or
// intercept the site root ("/"), the SmartAppsFlow home page, Smart Loan,
// Car Maintenance, Compound Calculator, or any other app.
//
// Two safeguards keep it isolated:
//   1. It is served from /tradelogpro/, so the browser limits its scope there.
//   2. The fetch handler ignores any request outside registration.scope.
//
// Caching strategy:
//   - Network First for navigations and index.html (always try fresh app
//     shell, fall back to cache when offline).
//   - Cache First for other static files inside /tradelogpro/ (fast, with a
//     background network fallback that also refreshes the cache).

const CACHE = 'tradelogpro-v1';

// URLs are relative to /tradelogpro/, so they stay inside this app's scope.
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Never fail install if one asset is missing (e.g. icons not added yet).
      return cache.addAll(ASSETS).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        // Only delete this app's own old caches. Never touch other apps' caches.
        if (key.indexOf('tradelogpro-') === 0 && key !== CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Store a fresh copy of a same-scope, successful, same-origin response.
function putInCache(req, resp) {
  if (resp && resp.status === 200 && resp.type === 'basic') {
    const copy = resp.clone();
    caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
  }
  return resp;
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Hard isolation: only handle requests inside this worker's own scope.
  // Anything else (site root, other apps, cross-origin) is left to the network.
  if (req.url.indexOf(self.registration.scope) !== 0) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1 ||
    req.url.indexOf('index.html') !== -1;

  if (isNavigation) {
    // Network First: try the network, fall back to cache when offline.
    event.respondWith(
      fetch(req)
        .then(function (resp) { return putInCache(req, resp); })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Cache First for other static assets inside /tradelogpro/.
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req)
        .then(function (resp) { return putInCache(req, resp); })
        .catch(function () { return cached; });
    })
  );
});
