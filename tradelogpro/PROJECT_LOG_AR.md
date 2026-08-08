# Trade Log Pro — سجل المشروع والأرشيف الشامل
> وثيقة مرجعية لكل ما أُنجز، وما تبقّى، وملاحظات فنية لأي مبرمج (أو مساعد ذكاء اصطناعي) يكمل العمل.
> آخر تحديث: 8 أغسطس 2026 (مواءمة مع ملف تسليم Claude + إضافة privacy-policy.html).
>
> أرشيف المستودع العام (مراحل كل التطبيقات): [`../REPO_STRUCTURE.md`](../REPO_STRUCTURE.md) — خصوصًا §0c.
>
> ملاحظات أقدم ما زالت صالحة كسجل تشغيلي:
> - [`CHANGES_COMPLETED_AR.txt`](CHANGES_COMPLETED_AR.txt) — ما اكتمل في حزمة baseline
> - [`README_NEXT_STEPS_AR.txt`](README_NEXT_STEPS_AR.txt) — خطوات اللابتوب + خطة إعادة الهيكلة A/B

---

## 0) نظرة عامة سريعة

- **التطبيق:** Trade Log Pro — دفتر تداول + أداء (حسابات، صفقات، يوميات، حاسبات، تحليلات، تقارير).
- **المستودع:** `smartappsflow` (متعدد التطبيقات). كل التطبيق داخل مجلد `tradelogpro/`.
- **مصدر التطبيق بعد المرحلة B:**
  - `index.html` — الهيكل + حارس Analytics المبكر
  - `css/app.css` — الأنماط
  - `js/state.js` · `icons.js` · `storage.js` · `theme.js` · `finance.js` · `sanitize.js` · `app.js`
    (سكربتات كلاسيكية بالترتيب؛ بدون ES Modules)
  الـ workflow ينسخها إلى `www/`؛ مكتبات XLSX / jsPDF / Chart.js تُحمَّل محليًا أو من CDN.
- **الويب:** PWA على `smartappsflow.net/tradelogpro/` — كاش SW: `tradelogpro-v3` (بعد دمج المرحلة B).
- **المتجر:** Android AAB عبر `.github/workflows/build-tradelogpro.yml` (push إلى main مقيّد بالمسار، أو workflow_dispatch).
- **معرّف الحزمة:** `com.tradelog.pro`.
- **اللغة في الواجهة:** الإنجليزية (حاليًا).
- **الثيمات:** dark (افتراضي)، light، green — مفتاح `tl_theme`.
- **نموذج البنية في المستودع:** `tradelogpro/` هو الشكل المرجعي لأي تطبيق جديد (انظر `REPO_STRUCTURE.md` §1).

### حالة المرحلة الحالية (7 أغسطس 2026)

| المسار | الحالة |
|--------|--------|
| مجلد مكتفٍ ذاتيًا + workflow + أسرار توقيع | ✅ |
| تحصين baseline (Backup/Restore / Sanitizer / حارس Analytics) | ✅ موثّق ومختبر |
| اختبارات تُبوّب البناء | ✅ 77 حالة محليًا (7 أغسطس 2026) |
| ويب PWA | ✅ مباشر (بعد الدمج: `tradelogpro-v2`) |
| أيقونات PWA (`icon-192` / `icon-512`) | ❌ مفقودة |
| سياسة خصوصية داخل المجلد | ❌ مطلوبة قبل Play |
| إعادة هيكلة CSS/JS (مرحلة A) | ✅ مدموجة |
| تقسيم JS حسب المسؤولية (مرحلة B) | ✅ على فرع refactor (وحدات كلاسيكية) |
| إشعار تحديث PWA للمستخدم (مثل Smart Loan) | ❌ غير موجود (SW يستخدم `skipWaiting()` فورًا) |
| ميزات Premium / Billing | ⏸ مؤجّل حسب استراتيجية التسليم | مجاني بالكامل أولًا؛ **ممنوع Coming Soon**؛ تُبنى الميزات قبل الدفع |

**قرار المنتج الحالي:** التقسيم A/B تم وفق خارطة Claude. العمل التالي تلميع المتجر/الويب، ثم اختياريًا المرحلة C (Vite) لاحقًا — **ليس** واجهات Coming Soon.

---

## 1) بنية الملفات داخل `tradelogpro/`

```
tradelogpro/
├── index.html                 ← الهيكل + حارس runtime المبكر
├── css/app.css                ← الأنماط (مرحلة A)
├── js/
│   ├── state.js               ← متغيرات الحالة العامة
│   ├── icons.js               ← نظام الأيقونات
│   ├── storage.js             ← IndexedDB / localStorage helpers
│   ├── theme.js               ← الثيمات
│   ├── finance.js             ← محرك P&L
│   ├── sanitize.js            ← تعقيم + تنسيق أرقام
│   └── app.js                 ← العرض / الصفقات / التصدير / init
├── manifest.json              ← PWA (بدون icons بعد)
├── sw.js                      ← service worker (cache v3)
├── package.json / package-lock.json
├── capacitor.config.json      ← appId: com.tradelog.pro
├── .gitignore                 ← node_modules/ www/ android/
├── SHA256SUMS.txt
├── CHANGES_COMPLETED_AR.txt
├── README_NEXT_STEPS_AR.txt
├── PROJECT_LOG_AR.md          ← هذا الملف
└── tests/
    ├── financial-tests.mjs    ← من js/finance.js
    ├── security-tests.mjs     ← من js/sanitize.js
    ├── runtime-guard-tests.mjs← من index.html
    ├── pwa-tests.mjs
    └── display-tests.mjs      ← من js/sanitize.js
```

خارج المجلد:
- `.github/workflows/build-tradelogpro.yml`
- أسرار التوقيع: `TRADELOG_KEYSTORE_BASE64` / `TRADELOG_KEYSTORE_PASSWORD` /
  `TRADELOG_KEY_ALIAS` / `TRADELOG_KEY_PASSWORD` — **لا تُشارك مع Smart Loan**.

الهيكل الحالي بعد المرحلة B:

```
tradelogpro/
  index.html
  css/app.css
  js/{state,icons,storage,theme,finance,sanitize,app}.js
  tests/…
```

---

## 2) ما أُنجز (مرتّبًا)

### أ) حزمة baseline الآمنة (موثّقة 17 يوليو 2026 — انظر CHANGES / README)
- تثبيت Action التوقيع إلى Commit SHA حقيقي.
- اختبارات مالية + أمنية + حارس تشغيل.
- تعقيم كامل عند Restore وعند قراءة localStorage للحسابات والصفقات واليوميات
  والقوالب والملف والـ Benchmark والتفضيلات والحاسبات المحفوظة.
- الحفاظ على `startingCapital` و`broker` و`target` و`stoploss` / risk.
- معالجة معاملات الحساب: إيداع/سحب، ترحيل `withdrawal` → `withdraw`، إسقاط الأنواع المجهولة.
- حارس Analytics: يسمح فقط على `smartappsflow.net` عبر HTTPS؛ يمنع Capacitor / localhost / file /
  والنطاقات غير المعتمدة؛ يقطع Cloudflare `sendBeacon` ويزيل سكربتًا عارضًا.

### ب) اختبارات إضافية لاحقة
- `pwa-tests.mjs` — عزل الـ SW على `/tradelogpro/` وNetwork First للتنقّل.
- `display-tests.mjs` — تنسيق أرقام التقرير وتصنيف CLOSE / PARTIAL CLOSE.

### ج) هذا السجل (7 أغسطس 2026)
- إنشاء `PROJECT_LOG_AR.md` وربط حالة التطبيق في `REPO_STRUCTURE.md` §0c.

### د) إعادة الهيكلة — المرحلة A (7 أغسطس 2026)
الفرع: `refactor/tradelogpro-structure` (ينبني فوق أرشيف التوثيق)

- نقل حرفي لكل CSS → `css/app.css` وكل منطق التطبيق → `js/app.js`.
- الإبقاء على حارس Analytics مبكرًا داخل `index.html` (يجب أن يعمل قبل أي سكربت صفحة).
- الإبقاء على أسماء الدوال و`onclick`؛ بدون ES Modules وبدون تغيير سلوك.
- تحديث `build-tradelogpro.yml` لنسخ `css/` و`js/` إلى `www`.
- رفع كاش SW إلى `tradelogpro-v2` وإضافة `css/app.css` و`js/app.js` إلى `ASSETS`.
- توجيه اختبارات الاستخراج إلى `js/app.js` (ما عدا حارس runtime من HTML).
- تحقق محلي: **79 passed, 0 failed** (+ اختباران لبنية CSS/JS).

### هـ) إعادة الهيكلة — المرحلة B (7 أغسطس 2026)
الفرع: `refactor/tradelogpro-modules`

- تقسيم `js/app.js` إلى وحدات كلاسيكية بالترتيب:
  `state` → `icons` → `storage` → `theme` → `finance` → `sanitize` → `app`.
- بدون ES Modules وبدون تغيير سلوك؛ `app.js` ما زال يحمل العرض/الصفقات/التصدير/`initApp`.
- رفع كاش SW إلى `tradelogpro-v3`؛ workflow ينسخ `js/*.js`.
- الاختبارات تقرأ من الملف المختص (`finance.js` / `sanitize.js`).
- تحقق محلي: **80 passed, 0 failed**. تحقق ويب سابق للمرحلة A نجح على `/tradelogpro/`.

---

## 3) محرك التخزين والحالة

| المفتاح / المصدر | الدور |
|------------------|--------|
| `tl_v3` (localStorage) | الحالة الرئيسية: `accounts` + `trades` + `activeAccountId` |
| `tl_state_v2` / `tl_state` | مفاتيح قديمة تُقرأ للترحيل في `initApp` فقط |
| IndexedDB `TradeLogPro` (v2) | مزامنة خلفية على HTTPS (GitHub Pages) عبر `openDB` / `save` / `loadFromDB` |
| `tl_theme` | dark / light / green |
| `tl_show_currency` | إظهار/إخفاء رمز `$` |
| `tl_journals` | يوميات |
| `tl_templates` | قوالب إدخال الصفقات |
| `tl_profile` | الملف الشخصي |
| `tl_benchmark` | أساس مقارنة S&P 500 |
| `tl_pos_calcs` / `tl_comp_calcs` / `tl_avg_calcs` | حاسبات محفوظة |
| Backup JSON `version: tl_v3` / `schemaVersion: 3` | تصدير/استيراد كامل مع خيار الصور |

قواعد ثابتة:
- أي مسار Restore أو تحميل يجب أن يمر عبر دوال `sanitize*` المناسبة.
- لا تُدخل أنواع معاملات أو صفقات مجهولة؛ أصلح الترحيل بدل «التخمين».

فحص الحارس من Console: `window.__TL_RUNTIME__`
- ويب معتمد: `analyticsAllowed: true`, `isNative: false`
- متجر / file: `analyticsAllowed: false`, `isNative: true` (حسب البروتوكول)

---

## 4) ما تبقّى / خطة الجلسات القادمة

أنجز كل بند في **فرع مستقل** بعد نجاح `npm test`، ولا تخلط إعادة الهيكلة مع ميزات المنتج.

### المرحلة 0 — أرشفة
- [x] إنشاء `PROJECT_LOG_AR.md`
- [x] تحديث حالة Trade Log Pro في `REPO_STRUCTURE.md`

### المرحلة 1 — إعادة هيكلة A (نقل حرفي فقط)
الفرع: `refactor/tradelogpro-structure`

- [x] استخراج CSS من `index.html` → `css/app.css`
- [x] استخراج JS الرئيسي → `js/app.js`
- [x] الإبقاء على أسماء الدوال و`onclick` كما هي
- [x] **لا** ES Modules في هذه المرحلة
- [x] **لا** تحسين تصميم ولا تنظيف منطق أثناء النقل
- [x] تحديث `build-tradelogpro.yml` لنسخ `css/` و`js/` إلى `www`
- [x] تحديث `sw.js` `ASSETS` + كاش `tradelogpro-v2`
- [x] `npm test` محليًا (79 passed)
- [x] تحقق ويب بعد الدمج إلى `main` (CSS/JS/SW v2 يعملان على `/tradelogpro/`)

### المرحلة 2 — إعادة هيكلة B (تقسيم حسب المسؤولية)
الفرع: `refactor/tradelogpro-modules`

- [x] تقسيم أولي: state / icons / storage / theme / finance / sanitize / app
- [x] تحميل كلاسيكي بـ script tags بالترتيب
- [x] تحديث workflow + SW v3 + tests
- [x] `npm test` → 80 passed
- [ ] تحقق ويب بعد الدمج + بناء Actions

تقسيم أدق لاحقًا (اختياري، فرع مستقل) إن لزم:

| وحدة | مسؤوليات تقريبية |
|------|-------------------|
| `views` / `trades` / `export` | ما زال داخل `js/app.js` ويمكن فصله لاحقًا |

### المرحلة 3 — نشر وتلميع
- [ ] توفير `icon-192.png` و`icon-512.png` الخاصين بـ Trade Log Pro (ليس من تطبيق آخر)
- [ ] إعادة قسم icons في `manifest.json` ورابط apple-touch في `index.html`
- [x] إنشاء `tradelogpro/privacy-policy.html` (8 أغسطس 2026)
- [ ] (اختياري لاحقًا) إشعار تحديث PWA بموافقة المستخدم — على غرار Smart Loan — بدل `skipWaiting()` الفوري
- [ ] اختبار يدوي على الجهاز (خصوصًا Partial→Add→Final و Backup/Restore) + نسخة keystore خارجية

### المرحلة 4 — مراحل هيكلية لاحقة (من ملف التسليم؛ ليست عاجلة)
- [ ] **C:** Vite + ES Modules + ESLint (بعد استقرار المنتج)
- [ ] **D:** طبقة تخزين مجرّدة، مصادقة، مزامنة Supabase، اشتراكات
      (RevenueCat / Play Billing على أندرويد + Paddle أو Lemon Squeezy للويب؛ Stripe غير متاح في عُمان)

### المرحلة 5 — Premium (محفوظة من تسليم Claude — يوليو 2026)
قواعد ثابتة:
- النشر الحالي **مجاني بالكامل** حتى قاعدة مستخدمين كافية (~٤٠٠ على الأقل كهدف تقريبي).
- **لا** تُضاف أزرار أو شاشات «Coming Soon» (تضرّ التقييمات).
- ميزات Premium تُبنى كاملة قبل تفعيل الدفع؛ لا تُعرض قفل/شراء مبكرًا.

الميزات المخطّطة (بالترتيب):
1. تحليلات متقدمة (Equity Curve مفصّل، Drawdown، R-Multiple)
2. مزامنة سحابية + حساب إيميل (Supabase) — الأقوى للاحتفاظ
3. حسابات غير محدودة (المجاني: ٢)
4. استيراد CSV من وسطاء مثل XTB و Baraka
5. تخصيص التقارير بشعار/اسم المستخدم

تسعير مقترح: ٣٫٩٩$/شهر · ٢٤٫٩٩$/سنة (تجربة ٧ أيام) · ٥٩٫٩٩$ مدى الحياة.
Watermark «Generated by TradeLog Pro» في تذييل PDF (تسويق، ليس محرّك اشتراك).

---

## 5) البناء والنشر والاختبار

- **الويب:** دمج إلى `main` → GitHub Pages فورًا. ارفع اسم كاش `CACHE` في `sw.js` عند تغييرات ويب جوهرية.
- **المتجر:** Actions → «Build TradeLog Pro AAB» → نزّل AAB/APK من Artifacts → ارفع يدويًا إلى Play عند الجاهزية.
- **توقيع الـ PR:** الاختبارات + بناء غير موقّع فقط؛ التوقيع على push/trusted أو workflow_dispatch فقط.
- **الاختبارات المحلية:**

```bash
cd tradelogpro
npm test
```

نتيجة مرجعية بعد المرحلة B (7 أغسطس 2026): **80 passed, 0 failed**
(18 financial + 28 security + 10 runtime + 12 pwa + 12 display).

---

## 6) خرائط سريعة للمصدر

| الملف | المحتوى |
|-------|---------|
| `index.html` | حارس runtime المبكر، روابط المكتبات، هيكل الصفحة، سكربتات `js/*` |
| `css/app.css` | الخطوط + الثيمات + التخطيط + المكوّنات |
| `js/state.js` | متغيرات الحالة العامة |
| `js/icons.js` | SVG icons |
| `js/storage.js` | IndexedDB / localStorage |
| `js/theme.js` | الثيمات |
| `js/finance.js` | محرك P&L |
| `js/sanitize.js` | تعقيم النسخ الاحتياطي + تنسيق العرض |
| `js/app.js` | العرض، الصفقات، الحاسبات، التصدير، analytics، `initApp` |

### مجموعات دوال مهمة (في `js/app.js`)

- **تخزين:** `openDB`, `save`, `loadFromDB`, `initApp`
- **محرك مالي:** `calcAvgPrice`, `calcPositionState`, `migrateBasis`, `calcPnl`, `calcRealizedPnl`,
  `calcUnrealizedPnl`, `isWin` / `isLoss` / `isBreakeven`, `calcFeesAmt`, `calcTradeFees`
- **تعقيم:** `sanitizeState`, `_sanTrade`, `_sanAccount`, `sanitizeSavedCalcs`, `sanitizeTemplates`,
  `sanitizeJournals`, `sanitizeProfile`, `sanitizeBenchmark`, `sanitizePrefs`, `safePhoto`
- **عرض:** `setView`, `renderMain`, `renderDashboard`, `renderTradeLog`, `renderCalendar`,
  `renderJournal`, `renderAccountsView`, `renderCalculators`, `renderAnalytics`
- **صفقات:** `openTradeModal`, `saveTradeModal`, `openPartialClose`, `savePartialClose`,
  `openAddBuy`, `saveAddBuy`, `openTradeDetail`
- **تصدير/نسخ:** `exportExcel`, `exportPDF`, `backupData`, `restoreData`, `importCSV`, `saveFileSmart`
- **واجهة:** `applyTheme`, `toggleTheme`, `openDrawer`, `showToast`, `icon` / `cicon`

حارس Analytics: `detectTradeLogRuntime` ما زال في `index.html` عمدًا.
الاختبارات تستخرج من المصدر الحقيقي — أي تقسيم لاحق (مرحلة B) يجب أن يبقى `npm test` أخضر.

---

## 7) قواعد ثابتة

1. لا تلمس التطبيقات الأخرى ولا الصفحة الرئيسية ولا `CNAME`.
2. لا تشارك أسماء أسرار توقيع Trade Log Pro مع أي تطبيق آخر.
3. كل مهمة على فرعها؛ أعد الهيكلة في فرع منفصل عن الإصلاحات والميزات.
4. الدمج إلى `main` ينشر الويب فورًا — ادمج فقط ما هو جاهز للويب.
5. أثناء إعادة الهيكلة (A/B/C): نقل/تقسيم حرفي فقط — لا تنظيف منطق ولا تغيير سلوك في نفس الفرع.
6. بعد كل معلم: حدّث هذا الملف و`CHANGES_COMPLETED_AR.txt` و`REPO_STRUCTURE.md` §0c.
7. **ممنوع** Coming Soon للميزات المدفوعة قبل بنائها وتفعيل الفوترة (استراتيجية التسليم).
8. ممنوع ترقية Capacitor إلى 7/8 وإعادة كتابة بـ Flutter (قرار محسوم).
9. عند تعديل يمسّ الحسابات: `npm test` قبل أي commit.
10. أي نص مستخدم عبر `esc()`؛ أي صورة عبر `safePhoto()`.

---

## 8) رسالة جاهزة للجلسة التالية

```
اقرأ tradelogpro/PROJECT_LOG_AR.md (خصوصًا Premium § مرحلة 5) وملف التسليم إن وُجد.
لا Coming Soon. لا تلمس التطبيقات الأخرى.
التالي العملي: أيقونات PWA الخاصة بـ TradeLog Pro أو اختبار جهاز / رفع Play.
```
