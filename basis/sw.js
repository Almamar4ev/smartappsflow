/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'الأسعار والمتوسط بخانتين عشريتين، مثل 29.95.\u200F',
    'الأسعار والكميات الأقل من 1 تحتفظ بدقتها، مثل 0.4523 و0.00125.\u200F',
    'الحسابات نفسها لم تتغير، والتقريب في العرض فقط.\u200F',
  ]),
  en: updateNote([
    'Prices and the average show two decimals, like 29.95.',
    'Prices and quantities below 1 keep their precision, like 0.4523 and 0.00125.',
    'The math is unchanged: rounding is for display only.',
  ]),
  es: updateNote([
    'Los precios y el promedio muestran dos decimales, como 29,95.',
    'Los precios y cantidades por debajo de 1 mantienen su precisión, como 0,4523 y 0,00125.',
    'Los cálculos no cambian: el redondeo es solo visual.',
  ]),
  pt: updateNote([
    'Preços e o médio mostram duas casas decimais, como 29,95.',
    'Preços e quantidades abaixo de 1 mantêm a precisão, como 0,4523 e 0,00125.',
    'As contas não mudam: o arredondamento é só na exibição.',
  ]),
};

const CORE = [
  './',
  './index.html',
  './css/app.css',
  './js/version.js',
  './js/boot-theme.js',
  './js/app.js',
  './js/calc.js',
  './js/i18n.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './fonts/IBMPlexSansArabic-Regular.woff2',
  './fonts/IBMPlexSansArabic-Medium.woff2',
  './fonts/IBMPlexSansArabic-SemiBold.woff2',
  './fonts/IBMPlexSansArabic-Bold.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION_INFO') {
    if (event.source) event.source.postMessage({ type: 'VERSION_INFO', version: VERSION, changelog: CHANGELOG });
    return;
  }
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        return undefined;
      });
    })
  );
});
