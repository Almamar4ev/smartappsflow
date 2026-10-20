/* emiGo: EMI & Loan — service worker
   On a real release: bump VERSION (1.0, 1.1, 1.2…) and rewrite CHANGELOG.
   VERSION is shown to users, so it is a product release, not a running fix counter. */
const VERSION = '1.3';

// Each sentence is its own line. U+2028 breaks the line even in the current
// banner, and the RTL mark keeps every Arabic period with its sentence.
function updateNote(lines){ return lines.join('\u2028'); }
const CHANGELOG = {
  ar: updateNote([
    'جولة تعريفية قصيرة ودليل استخدام من الإعدادات.\u200F',
    'إعدادات أوضح للثيم والعملة وترتيب الخيارات.\u200F',
    'عرض أوضح لحالة القروض وحد البنك.\u200F',
    'تحسينات عامة على الاستقرار وسلاسة الاستخدام.\u200F'
  ]),
  en: updateNote([
    'Short intro tour and Help guide in Settings.',
    'Clearer theme and currency options, better Settings layout.',
    'Clearer loan status with bank-limit indicators.',
    'General stability and usability improvements.'
  ]),
  es: updateNote([
    'Tour introductorio breve y guía de uso en Ajustes.',
    'Tema y moneda más claros, mejor orden en Ajustes.',
    'Estado de préstamos más claro con el límite del banco.',
    'Mejoras generales de estabilidad y fluidez.'
  ])
};

const CACHE = 'smartloan-' + VERSION;
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

// Install: pre-cache core, then WAIT. No skipWaiting() here on purpose — the new
// version stays "waiting" until the user taps Update, so the UI never changes
// under them mid-session.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}));
});

// Activate: drop old caches and take control of open pages.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
