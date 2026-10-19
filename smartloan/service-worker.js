/* emiGo: EMI & Loan — service worker
   On a real release: bump VERSION (1.0, 1.1, 1.2…) and rewrite CHANGELOG.
   VERSION is shown to users, so it is a product release, not a running fix counter. */
const VERSION = '1.1';

// Short, user-facing "what changed" shown in the in-app update banner.
// The size is one left-to-right unit: isolates keep it on one side, and the
// word joiner stops the number and KB from wrapping apart in Arabic.
const UPDATE_SIZE = '\u2066300\u2060KB\u2069';
const CHANGELOG = {
  ar: 'وضع العرض يشارك التطبيق بأرقام تجريبية ثابتة بالدولار، دون إظهار ملفك المالي أو تعديله. على الهاتف المقفل لا تعود إلى ملفك إلا بالبصمة أو رمز الجهاز، وصفحات القرض الخمس تعمل كالمعتاد. حجم التحديث ' + UPDATE_SIZE + '.',
  en: 'Demo Mode shares the app with fixed US-dollar samples, without showing or changing your financial file. On a locked phone you return only with biometrics or the device passcode, and all five loan pages work as usual. Update size: ' + UPDATE_SIZE + '.',
  es: 'El modo demo comparte la app con números fijos en dólares, sin mostrar ni cambiar tu archivo financiero. En un teléfono bloqueado vuelves solo con biometría o el código del dispositivo, y las cinco páginas del préstamo funcionan como siempre. Tamaño: ' + UPDATE_SIZE + '.'
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
