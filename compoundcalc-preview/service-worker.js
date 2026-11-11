/* Compound Interest Calculator — service worker
   VERSION is stamped from pubspec.yaml by scripts/patch_web_update.py, so
   it always equals Settings → Version. On a real release: raise the
   version in pubspec.yaml and rewrite CHANGELOG. A quiet republish keeps
   the version and lets the build stamp change CACHE. */
const VERSION = '1.0.0';

// One line per change; the update card shows them with white-space: pre-line.
function updateNote(lines){ return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'تصميم جديد: نتيجة أوضح، ونطاق متوقع للرصيد، وجدول سنوي.\u200F',
    'التطبيق يتذكر اللغة والسمة والعملة.\u200F'
  ]),
  en: updateNote([
    'New design: a clearer result, an expected balance range and a yearly table.',
    'The app remembers your language, theme and currency.'
  ]),
  es: updateNote([
    'Nuevo diseño: un resultado más claro, un rango esperado del saldo y una tabla anual.',
    'La app recuerda tu idioma, tema y moneda.'
  ]),
  pt: updateNote([
    'Novo design: um resultado mais claro, uma faixa esperada do saldo e uma tabela anual.',
    'O app lembra seu idioma, tema e moeda.'
  ])
};

// Every app on smartappsflow.net shares one cache store, so this worker
// only ever deletes its own old caches (CACHE_PREFIX), never another app's.
// patch_web_update.py stamps both lines; a preview build gets its own prefix.
const CACHE_PREFIX = 'compoundcalc-preview-';
const CACHE = 'compoundcalc-preview-20261111040654';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './manifest-en.json',
  './manifest-es.json',
  './manifest-pt.json',
  './flutter_bootstrap.js',
  './main.dart.js',
  './js/page-setup.js',
  './js/analytics.js',
  './js/splash.js',
  './js/updates.js',
  './favicon.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png'
];

// A new version must cache the new files, not copies the browser still
// holds from before (GitHub Pages lets it keep them 10 minutes): 'reload'
// skips the HTTP cache, 'no-cache' asks the server whether a copy changed.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'GET_VERSION_INFO') {
    if (e.source) e.source.postMessage({ type: 'VERSION_INFO', version: VERSION, changelog: CHANGELOG });
    return;
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('service-worker.js')) return;
  if (url.pathname.endsWith('app_build.txt')) return;

  e.respondWith(
    // Look only in this app's cache, not in other apps' on the same site.
    caches.open(CACHE).then((c) => c.match(req)).then((hit) => {
      if (hit) return hit;
      // A page navigation cannot take options; everything else revalidates.
      const fresh = req.mode === 'navigate' ? req : new Request(req, { cache: 'no-cache' });
      return fetch(fresh).then((res) => {
        if (!res || !res.ok) return res;
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.open(CACHE).then((c) => c.match('./index.html')));
    })
  );
});
