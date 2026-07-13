// Service Worker — سجل صيانة السيارات
//
// ══════════════════════════════════════════════════════════════
//  عند كل إصدار جديد: غيّر VERSION + اكتب وصف التحديث في CHANGELOG
// ══════════════════════════════════════════════════════════════
const VERSION = 'v10';

const CHANGELOG = {
  ar: 'أيقونات جديدة احترافية، إعادة ترتيب الإعدادات، وإشعار تحديث محسّن بالتفاصيل وزر «لاحقاً».',
  en: 'New professional icons, reorganized Settings, and an improved update notice with details and a Later button.'
};

const CACHE = 'car-maint-' + VERSION;
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // نزّل ملفات النسخة الجديدة في كاش خاص بها، ثم ابقَ في حالة "waiting"
  // حتى يوافق المستخدم من شريط الإشعار. لا نستدعي skipWaiting() هنا إطلاقاً.
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  // الصفحة تسأل النسخة المنتظرة: ما إصدارك وما الجديد فيك؟
  if (e.data === 'GET_VERSION_INFO') {
    if (e.source) e.source.postMessage({ type: 'VERSION_INFO', version: VERSION, changelog: CHANGELOG });
    return;
  }
  // المستخدم ضغط "تحديث الآن"
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // ─── CACHE FIRST (كاش أولاً) لكل الملفات ───
  // يضمن أمرين:
  //  ١) التطبيق يفتح فوراً من الكاش (لا بطء).
  //  ٢) الواجهة لا تتغيّر أبداً من تلقاء نفسها. الطريق الوحيد لأي تحديث هو
  //     تثبيت سيرفس ووركر جديد → يعرض شريط الإشعار → بموافقة المستخدم.
  //     فيستحيل أن يفاجأ المستخدم بواجهة جديدة بلا علمه.
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
