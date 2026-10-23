/* Compound Interest Calculator — service worker
   On a real release: bump VERSION and rewrite CHANGELOG.
   Quiet republish can keep VERSION and let the build stamp change CACHE. */
const VERSION = '1.1';

function updateNote(lines){ return lines.join('\u2028'); }
const CHANGELOG = {
  ar: updateNote([
    'إضافة الإسبانية والبرتغالية داخل التطبيق.\u200F',
    'اللغة تتبع لغة الهاتف أو المتصفح.\u200F'
  ]),
  en: updateNote([
    'Adds Spanish and Portuguese in the app.',
    'The language follows the phone or browser.'
  ]),
  es: updateNote([
    'Se añaden español y portugués en la app.',
    'El idioma sigue el del teléfono o el navegador.'
  ]),
  pt: updateNote([
    'Adiciona espanhol e português no app.',
    'O idioma segue o do telefone ou do navegador.'
  ])
};

const CACHE = 'compoundcalc-20261023074355';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './manifest-en.json',
  './manifest-es.json',
  './manifest-pt.json',
  './flutter_bootstrap.js',
  './main.dart.js',
  './favicon.png',
  './icons/app-icon-192.png',
  './icons/app-icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'GET_VERSION_INFO') {
    if (e.source) e.source.postMessage({ type: 'VERSION_INFO', version: VERSION, changelog: CHANGELOG });
    return;
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('service-worker.js')) return;
  if (url.pathname.endsWith('app_build.txt')) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (!res || !res.ok) return res;
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
