/* emiGo: EMI & Loan — service worker
   Copyright (c) 2026 Smart Apps Flow. All rights reserved. "emiGo" is a trademark
   of Smart Apps Flow. Copying or reuse is not allowed without written permission.
   See LICENSE.txt.

   On a real release: set VERSION to the app version (4.1, 4.2…) and rewrite CHANGELOG.
   VERSION is shown to users, so it is a product release, not a running fix counter.
   Quiet polish can keep VERSION and bump CACHE only so PWA clients refresh. */
const VERSION = '4.2';

// Each sentence is its own line. U+2028 breaks the line even in the current
// banner, and the RTL mark keeps every Arabic period with its sentence.
function updateNote(lines){ return lines.join('\u2028'); }
const CHANGELOG = {
  ar: updateNote([
    'مقارنة عادلة: أي عرض أرخص، وأي مدة تناسبك.\u200F',
    'أضف قروضك الحالية وعدلها، ويتوقف حسابها عند انتهائها.\u200F',
    'أرقام أوضح وإصلاحات عامة.\u200F'
  ]),
  en: updateNote([
    'A fair comparison: which offer is cheaper, and which term suits you.',
    'Add and edit the loans you already pay; they stop counting when they end.',
    'Clearer numbers and general fixes.'
  ]),
  es: updateNote([
    'Una comparación justa: qué oferta es más barata y qué plazo te conviene.',
    'Añade y edita los préstamos que ya pagas; dejan de contar al terminar.',
    'Números más claros y mejoras generales.'
  ])
};

const CACHE = 'smartloan-4.2i';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

// Install: pre-cache core, then WAIT. No skipWaiting() here on purpose — the new
// version stays "waiting" until the user taps Update, so the UI never changes
// under them mid-session.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

// Activate: drop this app's old caches and take control of open pages. Every app on
// this origin shares Cache Storage, so never touch a cache without our prefix.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('smartloan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Messages from the page: report version info, or apply the waiting update when
// the user consents (Update now).
self.addEventListener('message', (e) => {
  if (e.data === 'GET_VERSION_INFO') {
    if (e.source) e.source.postMessage({ type: 'VERSION_INFO', version: VERSION, changelog: CHANGELOG });
    return;
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: CACHE-FIRST for everything (including HTML). This is required by the
// update-notification model: the page only changes through the notification
// flow (new SW -> banner -> user consent), never silently on navigation. It
// also makes launches instant (no waiting on the network).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        // Never keep an error page: cache-first would serve it forever.
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
