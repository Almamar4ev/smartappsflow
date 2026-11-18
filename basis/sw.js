/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}-b${self.BASIS_BUILD || 0}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'حجم الصفقة: الرافعة القصوى عند وسيطك بدل نقدي وهامش، في وضع النسب والأسعار.\u200F',
    'الهامش المطلوب، ومتى تخسر رصيدك كاملاً، ورسوم اختيارية تبقي الخسارة كما خططت.\u200F',
    'وضع الأسعار يعرف الشراء والبيع على المكشوف، وينبهك إذا كان الهدف في الجهة الخطأ.\u200F',
  ]),
  en: updateNote([
    'Trade size: max leverage at your broker replaces Cash / Margin, in both modes.',
    'Margin required, the move that wipes out your balance, and optional fees that keep your planned loss.',
    'Price mode knows long from short and flags a target on the wrong side.',
  ]),
  es: updateNote([
    'Tamaño de la operación: el apalancamiento máximo de tu bróker sustituye a contado / margen, en ambos modos.',
    'Margen requerido, el movimiento que borra tu saldo y comisiones opcionales que mantienen la pérdida prevista.',
    'El modo por precios distingue compra de venta en corto y avisa si el objetivo está del lado equivocado.',
  ]),
  pt: updateNote([
    'Tamanho da operação: a alavancagem máxima da corretora substitui à vista / margem, nos dois modos.',
    'Margem necessária, o movimento que zera seu saldo e taxas opcionais que mantêm a perda planejada.',
    'O modo por preços distingue compra de venda a descoberto e avisa se o alvo está do lado errado.',
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
