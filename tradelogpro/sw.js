// Service Worker — Edgeory ONLY.
//
// Registered from ./sw.js inside /tradelogpro/. Scope is that directory only.
// It must never cache or intercept the site root or other SmartAppsFlow apps.
//
// Caching strategy:
//   - Cache First for the shell and static files inside /tradelogpro/, so the
//     HTML, CSS and JS on screen always come from the same release.
//   - A new release installs and waits. The page shows "Update available" and
//     sends SKIP_WAITING when the user taps Update.

const CACHE = 'edgeory-v43';
const UPDATE_NOTE = 'Accounts explain a negative cash figure in plain words.';

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
  './js/screenshot-import.js',
  './js/app.js',
  './js/equity.js',
  './js/tour.js',
  './icon-192.png',
  './icon-512.png',
  './fonts/roboto-400.woff2',
  './fonts/roboto-500.woff2',
  './fonts/roboto-700.woff2'
];

// Pinned third-party libraries (Chart.js 4.4.1, SheetJS 0.18.5, jsPDF 2.5.1), same
// files and SRI hashes as index.html. They never change between releases, so they
// live in their own cache: fetched once, kept across updates, and the chart and
// PDF/Excel export keep working offline on the web.
const VENDOR_CACHE = 'edgeory-vendor-1';
const VENDOR = ['./chart.umd.min.js', './xlsx.full.min.js', './jspdf.umd.min.js'];
function cacheVendor() {
  return caches.open(VENDOR_CACHE).then(function (cache) {
    return Promise.all(VENDOR.map(function (url) {
      return cache.match(url).then(function (hit) {
        // Best effort: a failed library download must not block the app update.
        return hit || cache.add(url).catch(function () {});
      });
    }));
  });
}

// Releases up to edgeory-v17 have no update banner, so they get this worker straight away.
function hasLegacyCache() {
  return caches.keys().then(function (keys) {
    return keys.some(function (key) {
      var m = /^edgeory-v(\d+)$/.exec(key);
      return (m && parseInt(m[1], 10) < 18) || key.indexOf('trademory-') === 0 || key.indexOf('tradelogpro-') === 0;
    });
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS.map(function (url) { return new Request(url, { cache: 'reload' }); }));
    }).then(cacheVendor).then(hasLegacyCache).then(function (legacy) {
      if (legacy) return self.skipWaiting();
    })
  );
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
        if (isOurs && key !== CACHE && key !== VENDOR_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data === 'GET_VERSION_INFO') {
    if (event.source) event.source.postMessage({ type: 'VERSION_INFO', note: UPDATE_NOTE });
    return;
  }
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
  if (new URL(req.url).pathname.endsWith('/sw.js')) return;

  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if (isNavigation) {
    const path = new URL(req.url).pathname;
    const isShell = /\/$/.test(path) || /\/index\.html$/.test(path);
    event.respondWith(
      caches.match(isShell ? './index.html' : req, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        return fetch(req)
          .then(function (resp) { return isShell ? putInCache(req, resp) : resp; })
          .catch(function () { return caches.match('./index.html'); });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (resp) { return putInCache(req, resp); });
    })
  );
});
