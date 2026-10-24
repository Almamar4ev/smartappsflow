/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   Bump VERSION for a user-facing release and rewrite CHANGELOG.
   Quiet polish can keep VERSION and bump CACHE only. */
const VERSION = '1.1';
const CACHE = 'basis-1.1';

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'ترس إعدادات أوضح.\u200F',
    'مفاتيح أوضح في المظهر الفاتح للشراء والبيع وللنسبة والسعر.\u200F',
    'تثبيت المتصفح يفتح التطبيق بشكل صحيح.\u200F',
  ]),
  en: updateNote([
    'A proper settings gear.',
    'Clearer light-theme switches for long/short and percent/price.',
    'Browser install now opens the app.',
  ]),
  es: updateNote([
    'Icono de ajustes corregido.',
    'Interruptores más claros en el tema claro.',
    'La instalación en el navegador abre la app.',
  ]),
  pt: updateNote([
    'Ícone de definições corrigido.',
    'Interruptores mais claros no tema claro.',
    'A instalação no navegador abre o app.',
  ]),
};

const CORE = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/calc.js',
  './js/i18n.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).catch(() => {}));
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
      }).catch(() => caches.match('./index.html'));
    })
  );
});
