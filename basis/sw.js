/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}-b${self.BASIS_BUILD || 0}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'متوسط الشراء: عمليات الشراء في بطاقات أنحف، وعناوين السعر والأسهم مرة واحدة فوقها.\u200F',
    'الحذف بعلامة × صغيرة، وتبقى دائماً عمليتا شراء على الأقل.\u200F',
  ]),
  en: updateNote([
    'Average cost: slimmer buy cards, with the Price and Shares titles shown once above them.',
    'Remove a buy with a small ×; there are always at least two buys.',
  ]),
  es: updateNote([
    'Precio medio: tarjetas de compra más delgadas, con los títulos Precio y Acciones una sola vez encima.',
    'Quita una compra con una × pequeña; siempre quedan al menos dos compras.',
  ]),
  pt: updateNote([
    'Preço médio: cartões de compra mais finos, com os títulos Preço e Ações uma vez acima deles.',
    'Remova uma compra com um × pequeno; sempre ficam pelo menos duas compras.',
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
  // cache: 'reload' skips the browser HTTP cache (GitHub Pages sends max-age=600); without it a new
  // version could be packed with the previous version's files and the update would not show.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE.map((url) => new Request(url, { cache: 'reload' })))));
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
        return Response.error();
      });
    })
  );
});
