# Smart Loan Calculator — سجل المشروع والأرشيف الشامل
> وثيقة مرجعية لكل ما أُنجز، وما تبقّى، وملاحظات فنية لأي مبرمج (أو مساعد ذكاء اصطناعي) يكمل العمل.
> آخر تحديث: 25 يوليو 2026.

---

## 0) نظرة عامة سريعة

- **التطبيق:** Smart Loan Calculator — حاسبة قروض (أقساط، مقارنة، تقدير الحد الأقصى حسب البنك).
- **المستودع:** `smartappsflow` (متعدد التطبيقات). كل التطبيق داخل مجلد `smartloan/`.
- **المصدر الوحيد للحقيقة:** `smartloan/index.html` — ملف واحد يحوي كل الـ HTML/CSS/JS.
  الـ workflow ينسخه إلى `www/index.html` عند بناء المتجر.
- **الويب:** PWA على `smartappsflow.net/smartloan/` (يُنشر تلقائيًا عند الدمج إلى `main`).
- **المتجر:** Android AAB يُبنى عبر `.github/workflows/build-smartloan.yml` (يدوي: workflow_dispatch).
- **معرّف الحزمة:** `com.smartapps.smartloanadvisor`.
- **الإصدار الحالي في ملف البناء:** versionCode 31 / versionName 3.1.
- **كاش الـ service worker الحالي:** `smartloan-v39`.
- **اللغات:** العربية، الإنجليزية، الإسبانية (كائن `T` في index.html).
- **الثيمات:** light (الافتراضي)، black، indigo (default)، emerald.
- **هاتف الاختبار:** Samsung S25 Ultra — Android 15 / One UI 7 (مهم: edge-to-edge مفروض).

---

## 1) بنية الملفات داخل `smartloan/`

```
smartloan/
├── index.html            ← التطبيق كامله (المصدر الوحيد للويب والمتجر)
├── manifest.json         ← PWA
├── service-worker.js     ← PWA + نظام إشعار التحديث (cache-first)
├── privacy-policy.html   ← نسخة مساعدة فقط (السياسة الرسمية في مستودع آخر — انظر §6)
├── icon-192/512/maskable-512.png
├── assets/               ← أصول بناء الأيقونة/السبلاش (icon-foreground/background/only, splash-source)
├── package.json          ← اسم + سكربت test
├── capacitor.config.json ← appId + إعداد السبلاش (الـ workflow يولّد نسخته أيضًا)
├── .gitignore
├── tests/                ← اختبارات تُبوّب البناء (financial + pwa)
├── CHANGES_COMPLETED_AR.txt   ← سجل التوحيد الأول
├── README_NEXT_STEPS_AR.txt   ← خطوات النشر
└── PROJECT_LOG_AR.md          ← هذا الملف
```

خارج المجلد: `.github/workflows/build-smartloan.yml` (البناء)، وأسرار توقيع خاصة
بـ Smart Loan في GitHub Actions: `KEYSTORE_BASE64 / KEYSTORE_PASSWORD / KEY_ALIAS / KEY_PASSWORD`.

---

## 2) ما أُنجز (مرتّبًا زمنيًا)

### أ) التوحيد (مدموج إلى main — PR #5)
- نُقلت كل ملفات Smart Loan المبعثرة من جذر المستودع إلى `smartloan/` على نمط `tradelogpro/`.
- أُصلح ملف البناء ليعمل من المجلد الموحّد، وأُضيفت اختبارات، ومشغّلات push/pull_request
  مع حماية خطوات التوقيع من الـ PRs.
- سلسلة إصلاحات CI حتى نجح البناء الموقّع: تثبيت إصدارات Capacitor على v6، حذف
  `capacitor.config.ts` المولّد، تثبيت منصّة Android SDK 35 في مسار Gradle، إعادة محاولة
  تنزيل Gradle، وترقية **AGP إلى 8.6.0 + Gradle 8.7** (السبب الجذري: AGP القديم لا يدعم compileSdk 35).

### ب) إصلاحات الحسابات (فرع fix/smartloan-safearea-and-tweaks)
- **العجز الشهري:** كان التطبيق يعرض «يتبقى لك 0» بدل العجز الحقيقي (كان يقصّ السالب بـ
  `Math.max(0,…)`). الآن يعرض **«عجز شهري X$»** بالأحمر في: التقرير، الرئيسية، تفاصيل القرض
  المحفوظ، صفحة الرسوم، وجدول المقارنة.
- **صفحة الرسوم:** لم تعد تضغط >100% داخل شريط 100%؛ عند التجاوز تُقيّس الأجزاء وتعرض
  ملاحظة حمراء «التزاماتك تتجاوز دخلك بـ X%». النِّسب السالبة داخل `<bdi dir="ltr">`.
- **توضيح التسمية:** «نسبة الدين من الصافي» → «نسبة الأقساط من الصافي (بعد المصروفات)»
  في اللغات الثلاث.
- **مصدر دقيق واحد (مبدأ ChatGPT):** يُخزَّن `loanMonthly` بقيمته الدقيقة (أُزيل `Math.round`
  عند الحفظ)، وصفحة الرسوم تحسب من قيم دقيقة، والتقريب عند العرض فقط عبر `fmtAmt`. أُضيف
  **ترحيل** في `loadState` يصحّح المحفوظات القديمة (loanMonthly = results.monthly) لتطابق
  كل الصفحات للسنت.

### ج) رفع الإصدار
- versionCode 30→31، versionName 3.0→3.1 في ملف البناء.

### د) نظام إشعار تحديث PWA (للويب فقط)
- `service-worker.js` صار **cache-first لكل شيء** (بما فيه HTML)، بدون `skipWaiting()` تلقائي؛
  ثابتان في الأعلى: `VERSION` و`CHANGELOG {ar,en,es}` هما لوحة تحكم الإصدار.
- `index.html` يسجّل بـ `updateViaCache:'none'`، يفحص التحديث عند الفتح/العودة/كل دقيقة،
  ويعرض بانرًا سفليًا (وصف + «تحديث الآن»/«لاحقًا») + بطاقة دائمة في الإعدادات. محميّ بـ
  `!window.Capacitor` فلا يعمل في المتجر.
- **لإطلاق تحديث ويب:** عدّل index.html، ثم ارفع `VERSION` واكتب `CHANGELOG` في service-worker.js، ثم ادمج.

### هـ) حارس التتبّع
- سكربت Cloudflare Analytics محاط بـ `if(!window.Capacitor && location.protocol.indexOf('http')===0)`
  فلا يعمل داخل تطبيق المتجر إطلاقًا (خصوصية 100%). موجود ويعمل.

---

## 3) مشكلة المحاذاة (safe-area) — التاريخ الكامل والحل النهائي

**العَرَض:** في نسخة المتجر (APK) المحتوى يتداخل مع شريط الحالة أعلى وأزرار التنقّل أسفل.
الويب سليم.

**السبب الجذري:** Android 15 + targetSdk 35 يفرض edge-to-edge إجباريًا، و`env(safe-area-inset-*)`
ترجع **صفرًا** داخل WebView الأصلي (تعمل في المتصفح فقط).

**المحاولات (فشلت جميعها على S25 Ultra):**
1. جسر insets يستمع على WebView + `evaluateJavascript` لحقن `--safe-*`.
2. + إعادة تطبيق بتأخيرات + onResume.
3. الاستماع على جذر المحتوى + `setOverlaysWebView({overlay:true})` + حذف `setDecorFitsSystemWindows`.

**الخلاصة:** حقن CSS عبر evaluateJavascript **لم يُطبَّق** على هذا الجهاز (توقيت/تسليم الحدث).

**الحل النهائي المطبّق (نهج مختلف جذريًا — حشوة أصلية، حُصّن في 25 يوليو 2026):**
- في `MainActivity` (يُولّده ملف البناء): يُفعّل edge-to-edge صراحةً عبر
  `WindowCompat.setDecorFitsSystemWindows(false)`، ثم يضع مستمع insets على
  `android.R.id.content` ويطبّق الحشوة **أصليًا** عبر `v.setPadding(...)`، ثم يعيد
  `WindowInsetsCompat.CONSUMED`. لا يعتمد موضع المحتوى على JS أو توقيت تحميل الصفحة.
- الحشوة تشمل system bars + display cutout، وعند ظهور الكيبورد تستخدم أكبر قيمة بين
  `systemBars.bottom` و`ime.bottom` (لا تجمعهما)، فتتكيّف مع الدوران والإيماءات والتنقّل
  بثلاثة أزرار والكيبورد دون مساحة زائدة.
- في Android الأصلي فقط، يضيف `index.html` الصنف `android-native` الذي يجعل `--safe-* = 0`؛
  لأن الحشوة الأصلية تكفي. في الويب تبقى المتغيرات مع `env(safe-area-inset-*)` كما هي.
- أُضيف جسر Capacitor أصلي محدود `SmartLoanSystemBars`، ويُسجّل قبل
  `super.onCreate()` ليكون حاضرًا من أول تحميل. يستقبل لون `#RRGGBB` ودرجة تباين
  الأيقونات فقط، ثم يغيّر خلفية منطقة الحشوة ويضبط أيقونات شريطي الحالة والتنقّل عبر
  `WindowInsetsControllerCompat` حسب الثيم الحالي.
- في `applyStatusBar`: يبقى `setOverlaysWebView({overlay:true})` لمنع حجز مساحة إضافية.
  عند وجود الجسر يكون هو المسؤول عن اللون والأيقونات؛ والـStatusBar plugin fallback صُحّح
  بحيث تستخدم الخلفية الفاتحة أيقونات داكنة.

**قاعدة CSS مهمة (للويب):** لا تستخدم `env()` مباشرة في padding/margin — استخدم `var(--safe-*)`
دائمًا (معرّفة في `:root` مع env كقيمة احتياطية). العناصر السفلية تأخذ `var(--safe-bottom)`،
والعلوية `var(--safe-top)`. viewport فيه `viewport-fit=cover, interactive-widget=resizes-content`.
استخدم `100dvh` لا `100vh`.

---

## 4) ما تبقّى / أمور معلّقة (TODO)

- [ ] **تأكيد حلّ المحاذاة** بالبناء الأخير (الحشوة الأصلية) على S25 Ultra — أعلى وأسفل، وكل الثيمات.
- [x] **لون أشرطة النظام حسب الثيم:** أُنجز بجسر `SmartLoanSystemBars`؛ يضبط خلفية منطقة
      الحشوة وأيقونات status/navigation للثيمات الفاتحة والداكنة. يبقى التحقق المرئي ضمن
      اختبار الجهاز في البند السابق.
- [ ] **رفع versionCode** قبل كل رفعة للمتجر (31 → 32 …) وrename في build-smartloan.yml.
- [ ] **تحديث سياسة الخصوصية المنشورة** (انظر §6) في مستودع `smart-apps-legal` عند الحاجة.
- [ ] **تغيير اسم التطبيق على المتجر** (اقتراح: «Loan Calculator: EMI & Mortgage») + تحسين لقطات الشاشة — في Play Console (ليس كودًا).
- [ ] **الميزات المدفوعة (مؤجّلة):** PDF، إعادة الجدولة، حفظ/مقارنة أكثر من قرضين. حاليًا نظام
      «Coming Soon» بشارة ✨ بدل الشراء (لتجنّب مخالفة سياسة Google Play Billing قبل دمج الفوترة).
- [ ] **إضافة اختبارات** لدوال العرض الجديدة (العجز، توزيع الرسوم) إن أمكن.

---

## 5) البناء والنشر

- **الويب:** يُنشر تلقائيًا عند الدمج إلى `main` (GitHub Pages). ارفع رقم كاش الـ SW مع كل تحديث ويب.
- **المتجر:** Actions → «Build Smart Loan AAB» → Run workflow → اختر الفرع. ينتج AAB موقّع + APK.
  نزّل الـ AAB وارفعه في Play Console → Production → Create new release.
- **الاختبارات:** `cd smartloan && npm test` (تعمل بلا تثبيت؛ تستورد دوال index.html الحقيقية).

---

## 6) سياسة الخصوصية (نقطة حسّاسة)

السياسة **المنشورة** والمسجّلة في Google Play Console موجودة في **مستودع منفصل** اسمه
`smart-apps-legal` (وليس هنا)، وتُخدَّم عبر GitHub Pages على الرابط الثابت:
```
https://almamar4ev.github.io/smart-apps-legal/smart-loan-calculator/privacy-policy.html
```
- تحديث *محتوى* الملف على نفس الرابط لا يتطلّب أي تغيير في Play Console (يُحفظ الرابط فقط).
- ملف `smartloan/privacy-policy.html` هنا **نسخة مساعدة** لا أكثر.
- لا تغيّر اسم/مسار الملف في `smart-apps-legal`.

---

## 7) خرائط سريعة داخل index.html (لأي مبرمج)

- الدوال المالية النقية: `calcLoan`, `maxPrincipal`, `termForPayment` (تُختبَر في tests/).
- التحليل الرئيسي: `analyse()` — يرجع `{monthly,total,interest,dtiGross,dtiNet,remaining,…}`.
  `remaining` قد يكون سالبًا = عجز (لا تُعِد `Math.max(0,…)`).
- عرض النتائج: `renderResults()`؛ صفحة الرسوم: `drawCharts()` (بطاقة توزيع الدخل داخلها).
- الرئيسية: `renderHome()` (بطاقة الملف المالي + بطاقة العجز/المتبقّي).
- بطاقة حد البنك: `renderBankLimitCard(r)`.
- التخزين: `persistState()/loadState()` بمفتاح `sla_v1` (يشمل ترحيل loanMonthly).
- الثيم/شريط الحالة: `applyTheme` → `applyStatusBar` (StatusBar plugin).
- الإشعارات: بلوك تسجيل الـ SW أسفل السكربت (البانر + بطاقة الإعدادات).

---

## 8) قواعد ثابتة

- لا تلمس التطبيقات الأخرى في المستودع ولا الصفحة الرئيسية ولا CNAME.
- لا تشارك أسماء أسرار توقيع Smart Loan مع أي تطبيق آخر.
- المصدر الوحيد للحقيقة `smartloan/index.html` — طبّق التقريب عند العرض فقط.
- كل مهمة على فرعها الخاص، وتُدمج عبر PR بعد نجاح Actions وتجربة الـ APK.
- سجّل كل إنجاز هنا وفي `CHANGES_COMPLETED_AR.txt`.
