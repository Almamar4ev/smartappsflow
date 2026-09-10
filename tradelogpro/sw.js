// Service Worker — Edgeory ONLY.
//
// Registered from ./sw.js inside /tradelogpro/. Scope is that directory only.
// It must never cache or intercept the site root or other SmartAppsFlow apps.
//
// Caching strategy:
//   - Network First for navigations and index.html
//   - Cache First for other static files inside /tradelogpro/

const CACHE = 'edgeory-v6';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/state.js',
  './js/icons.js',
  './js/storage.js',
  './js/theme.js',
  './js/finance.js',
  './js/sanitize.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        // Clear this app's caches + legacy TradeMory / TradeLog Pro prefixes.
        var isOurs =
          key.indexOf('edgeory-') === 0 ||
          key.indexOf('trademory-') === 0 ||
          key.indexOf('tradelogpro-') === 0;
        if (isOurs && key !== CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

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

  if (req.url.indexOf(self.registration.scope) !== 0) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1 ||
    req.url.indexOf('index.html') !== -1;

  if (isNavigation) {
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

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req)
        .then(function (resp) { return putInCache(req, resp); })
        .catch(function () { return cached; });
    })
  );
});
