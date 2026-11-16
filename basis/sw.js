/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}-b${self.BASIS_BUILD || 0}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'الكتابة في الحقول أدق: المؤشر يبقى في مكانه عند الحذف والكتابة.\u200F',
    'زر المشاركة يفتح قائمة المشاركة في الجوال.\u200F',
    'حجم الصفقة: بطاقة الربح مقابل بطاقة الخسارة.\u200F',
    'الفائدة المركبة: المس الرسم لترى الرصيد والنمو في أي سنة.\u200F',
  ]),
  en: updateNote([
    'Smoother typing: the cursor stays in place when you delete and type.',
    'Share opens your phone\'s share menu.',
    'Trade size: the profit card now faces the loss card.',
    'Compound growth: touch the chart to see the balance and growth for any year.',
  ]),
  es: updateNote([
    'Escritura más fluida: el cursor se queda en su sitio al borrar y escribir.',
    'Compartir abre el menú de compartir del teléfono.',
    'Tamaño de la operación: la tarjeta de ganancia queda frente a la de pérdida.',
    'Interés compuesto: toca el gráfico para ver el saldo y el crecimiento de cualquier año.',
  ]),
  pt: updateNote([
    'Digitação mais suave: o cursor fica no lugar ao apagar e digitar.',
    'Compartilhar abre o menu de compartilhamento do celular.',
    'Tamanho da operação: o cartão de lucro fica de frente para o de perda.',
    'Juros compostos: toque no gráfico para ver o saldo e o crescimento de qualquer ano.',
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
