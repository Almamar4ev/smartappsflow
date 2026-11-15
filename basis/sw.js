/* Basis service worker.
   Cache first so the UI only changes after the user taps Update.
   VERSION comes from js/version.js so the app footer and cache stay in sync. */
importScripts('./js/version.js');
const VERSION = self.BASIS_VERSION;
const CACHE = `basis-${VERSION}`;

function updateNote(lines) { return lines.join('\n'); }
const CHANGELOG = {
  ar: updateNote([
    'جدول المقارنة أوضح: كل رقم تحت عنوانه.\u200F',
    'الحسابات المحفوظة: التاريخ والملخص يظهران بالترتيب الصحيح، وتبويب الفائدة المركبة يعمل.\u200F',
    'خفض المتوسط: سعر الشراء يظهر بشكل صحيح، والشراء المضاف يتميز في القائمة.\u200F',
  ]),
  en: updateNote([
    'Clearer comparison table: every number sits under its heading.',
    'Saved calculations: dates and summaries read correctly, and the Compound tab works.',
    'Lower the average: the buy price reads correctly, and the added buy is marked in the list.',
  ]),
  es: updateNote([
    'Tabla de comparación más clara: cada número bajo su título.',
    'Cálculos guardados: fechas y resúmenes se leen bien, y la pestaña de interés compuesto funciona.',
    'Bajar el promedio: el precio de compra se ve bien, y la compra añadida se marca en la lista.',
  ]),
  pt: updateNote([
    'Tabela de comparação mais clara: cada número sob o seu título.',
    'Cálculos salvos: datas e resumos aparecem corretamente, e a aba de juros compostos funciona.',
    'Reduzir o médio: o preço de compra aparece corretamente, e a compra adicionada fica marcada na lista.',
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
