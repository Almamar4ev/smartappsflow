/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}-b${self.BASIS_BUILD || 0}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'حجم الصفقة: تنبيه واضح إذا كان الهدف لا يغطي الرسوم، مع الهدف الذي يحقق ربحاً.\u200F',
    'سطر مسح الرصيد معلومة هادئة، ويصير تحذيراً أحمر فقط عند الخطر الحقيقي.\u200F',
    'نسبة الصفقة من الحساب مع الرافعة، وقيمة الرسوم ظاهرة في عنوانها.\u200F',
  ]),
  en: updateNote([
    'Trade size: a clear note when the target does not cover the fees, with the target that does.',
    'The wipe-out line is quiet information, and turns red only when the danger is real.',
    'Share of account shows the leverage too, and the fees header shows its value.',
  ]),
  es: updateNote([
    'Tamaño de la operación: aviso claro si el objetivo no cubre las comisiones, con el objetivo que sí las cubre.',
    'La línea de saldo perdido es información discreta y solo se vuelve roja ante un riesgo real.',
    'La parte de la cuenta muestra también el apalancamiento, y el título de comisiones muestra su valor.',
  ]),
  pt: updateNote([
    'Tamanho da operação: aviso claro quando o alvo não cobre as taxas, com o alvo que cobre.',
    'A linha de saldo zerado é informação discreta e só fica vermelha quando o risco é real.',
    'A parte da conta mostra também a alavancagem, e o título das taxas mostra o valor.',
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
