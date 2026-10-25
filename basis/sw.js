/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'الشريط السفلي يبقى ثابتا اثناء التمرير.\u200F',
    'الارقام تفهم فاصلة كل لغة، مع فواصل الالاف اثناء الكتابة.\u200F',
    'متوسط مستهدف بدل الشراء الاضافي، ومشاركة الحسابات المحفوظة.\u200F',
  ]),
  en: updateNote([
    'The bottom nav stays put while you scroll.',
    'Numbers follow each language, with thousands separators as you type.',
    'Target average replaces extra buy, and saved calculations can be shared.',
  ]),
  es: updateNote([
    'La barra inferior se queda fija al desplazar.',
    'Los números siguen cada idioma, con miles mientras escribes.',
    'El precio medio objetivo sustituye la compra extra, y se pueden compartir los cálculos guardados.',
  ]),
  pt: updateNote([
    'A barra inferior fica fixa ao rolar.',
    'Os números seguem cada idioma, com milhares enquanto você digita.',
    'O preço médio alvo substitui a compra extra, e os cálculos salvos podem ser compartilhados.',
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
