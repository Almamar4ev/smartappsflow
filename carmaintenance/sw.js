// Service Worker — سجل صيانة السيارات
// نطاقه محصور تلقائياً في المجلد الذي يوجد فيه (/carmaintenance/)
//
// استراتيجية التحديث:
//  • HTML (index.html / "./")  → Network First: يجلب أحدث نسخة دائماً من الشبكة،
//    ويرجع للكاش فقط عند انقطاع الإنترنت. هكذا يصل التحديث فوراً بلا فتح مزدوج.
//  • باقي الملفات (أيقونات/manifest) → Stale-While-Revalidate: يعرض المخزّن فوراً
//    (سرعة) ويحدّثه في الخلفية للمرة القادمة.

const VERSION = 'v6';
const CACHE = 'car-maint-' + VERSION;
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {})
  );
  // ملاحظة مهمة: لا نستدعي skipWaiting() هنا عمداً.
  // نترك النسخة الجديدة في حالة "waiting" حتى يضغط المستخدم "تحديث الآن"
  // في الشريط، فتُرسل الصفحة رسالة SKIP_WAITING (انظر معالج message أدناه).
  // لو استدعيناها هنا، لتسلّمت النسخة الجديدة فوراً وأُعيد تحميل الصفحة
  // تحت يد المستخدم بلا إشعار.
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// يسمح للصفحة بإجبار السيرفس ووركر الجديد على العمل فوراً
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const url = new URL(request.url);
  return url.pathname.endsWith('/') || url.pathname.endsWith('.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // تجاهل الطلبات الخارجية (نطاق آخر)
  if (new URL(req.url).origin !== self.location.origin) return;

  // ─── HTML: Network First (التحديث يصل فوراً) ───
  if (isHtmlRequest(req)) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          // لا يوجد إنترنت → استخدم آخر نسخة مخزّنة (يعمل أوفلاين)
          caches.match(req).then(hit => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // ─── باقي الملفات: Stale-While-Revalidate ───
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const net = fetch(req)
          .then(res => {
            try { cache.put(req, res.clone()); } catch (_) {}
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
