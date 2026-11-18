/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}-b${self.BASIS_BUILD || 0}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'حجم الصفقة: الصفقة الأكبر من رصيدك تُكتب «16.67 ضعف رصيدك» بدل نسبة طويلة.\u200F',
    'الرسم البياني: تمرير الصفحة فوقه لا يحرك المؤشر، والسحب الأفقي أو اللمس يحركه.\u200F',
    'رسالة المشاركة: «متوسط الشراء لسهم AAPL».\u200F',
  ]),
  en: updateNote([
    'Trade size: a position bigger than your balance reads "16.67 × your balance" instead of a long percent.',
    'Chart: scrolling the page over it leaves the marker alone; a sideways drag or a tap moves it.',
    'Share message: "Average cost for AAPL".',
  ]),
  es: updateNote([
    'Tamaño de la operación: una posición mayor que tu saldo se lee "16.67 × tu saldo" en lugar de un porcentaje largo.',
    'Gráfico: desplazar la página sobre él no mueve el marcador; arrastrar de lado o tocar sí.',
    'Mensaje para compartir: "Precio medio de AAPL".',
  ]),
  pt: updateNote([
    'Tamanho da operação: uma posição maior que o saldo aparece como "16.67 × seu saldo" em vez de um percentual longo.',
    'Gráfico: rolar a página sobre ele não move o marcador; arrastar para o lado ou tocar move.',
    'Mensagem de compartilhamento: "Preço médio de AAPL".',
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
