/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'خطط خطوتك التالية: خفض المتوسط أو بيع جزء، مع نتيجة قبل وبعد.\u200F',
    'مشاركة أوضح: معلومة واحدة في كل سطر، وتأكيد الحذف داخل البطاقة.\u200F',
    'جدول المقارنة داخل أداة البيع فقط.\u200F',
  ]),
  en: updateNote([
    'Plan your next move: lower the average or sell part, with before and after.',
    'Clearer sharing: one fact per line, and delete confirmation on the card.',
    'The comparison table lives only inside Sell part.',
  ]),
  es: updateNote([
    'Planifica el siguiente paso: baja el promedio o vende parte, con antes y después.',
    'Compartir más claro: un dato por línea, y confirmar el borrado en la tarjeta.',
    'La tabla de comparación está solo en Vender parte.',
  ]),
  pt: updateNote([
    'Planeje o próximo passo: reduza o médio ou venda parte, com antes e depois.',
    'Compartilhar mais claro: um fato por linha, e confirmar a exclusão no cartão.',
    'A tabela de comparação fica só em Vender parte.',
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
