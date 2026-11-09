# smartappsflow — دليل البداية لأي جلسة (Claude Code / Cursor)

> اقرأ هذا الملف أولا في كل جلسة. آخر تحديث: 9 نوفمبر 2026.
> المالك: يوسف. **اكتب له دائما بالعربية**، بما فيها الملاحظات القصيرة بين الأدوات. أسماء الملفات والأزرار والكود تبقى كما هي.

## 0) أين المشروع الحقيقي؟ (سبب نسيان الجلسات السابقة)

- **النسخة الصحيحة الوحيدة:** `C:\Users\DELL\Documents\GitHub\smartappsflow`. افتح Cursor على هذا المجلد.
- `C:\Users\DELL\FlutterApps\smartappsflow` **نسخة قديمة** من نفس المستودع، متأخرة عنه بأسابيع. جلسة فتحت عليها في 9 نوفمبر قرأت سجلا من 3 أكتوبر وظنته الحالي. لا تعمل فيها.
- ذاكرة Claude Code تحفظ لكل مسار مجلد على حدة، لذلك المجلد الخطأ يعني ذاكرة فارغة أو قديمة. هذا الملف موجود داخل المستودع حتى يعمل في أي مسار.
- **المستودع على GitHub:** `Almamar4ev/smartappsflow`، وهو **عام (Public)**. لا تضع أرقام المالك أو بياناته الشخصية في commit أو سجل أو اختبار.

**تنبيه عن نسخة العمل المحلية:** المالك غير اسم `smartloan/` محليا إلى `emiGo/` بدون commit. لذلك يظهر `smartloan/` كمحذوف في `git status`، ويظهر `emiGo/` كمجلد غير متتبع. المستودع وملف البناء ما زالا يستخدمان `smartloan/`.
- لا تعمل مباشرة في نسخة العمل المحلية.
- اعمل في worktree من `origin/main`. بعد الدمج انسخ الملفات المعدلة إلى `emiGo/` بعد التأكد أنها لم تتغير هناك.

## 1) التطبيقات في المستودع

| المجلد | التطبيق | النوع | الحالة والتفاصيل |
|---|---|---|---|
| `smartloan/` | **emiGo: EMI & Loan** (`com.smartapps.smartloanadvisor`) | ويب PWA + أندرويد (Capacitor) | **ابدأ من [`smartloan/CLAUDE.md`](smartloan/CLAUDE.md)**، ثم `smartloan/PROJECT_LOG_AR.md` |
| `tradelogpro/` | **Edgeory** (كان Trade Log Pro، `com.tradelog.pro`) | ويب + أندرويد | `tradelogpro/EDGEORY_HANDOFF.md` ثم `PROJECT_LOG_AR.md`. لها قيود خاصة: لا دمج إلى main إلا بطلب المالك |
| `edgeory/`، `trademory/` | صفحات تعريف وسياسة خصوصية | ويب فقط | — |
| `basis/`، `carmaintenance/`، `compoundcalc/` | تطبيقات ويب PWA | ويب فقط | انظر §4 (تذكير الكاش) |
| `index.html`، `CNAME` | الصفحة الرئيسية `smartappsflow.net` | — | لا تلمسها إلا بطلب |

المرجع العام للبنية والإصدارات: [`REPO_STRUCTURE.md`](REPO_STRUCTURE.md)، وخاصة §4 و§4a.

## 2) طريقة العمل الثابتة

1. **فرع لكل مهمة** من `origin/main`، وتطبيق واحد في كل مهمة.
2. **الاختبارات:** شغّل `cd <app> && npm test` قبل التعديل وبعده.
3. **الدمج إلى main ينشر الويب فورا**، ويبني الحزمة الموقعة كـ artifact. الرفع إلى Play يدوي.
4. **أرقام الإصدار:**
   - `versionCode` تلقائي (380000 + رقم التشغيل في emiGo).
   - `versionName` من `package.json` ويغيّر يدويا بقرار المالك فقط.
5. **كل تعديل ويب يحتاج رفع رقم `CACHE`** في عامل الخدمة، وإلا لا يصل لمستخدمي PWA لأنه cache-first.
6. **بعد كل مهمة:** سجّلها في `PROJECT_LOG_AR.md` و`CHANGES_COMPLETED_AR.txt` للتطبيق، وحدّث ملف `CLAUDE.md` الخاص به.
7. **قبل أي تعديل في الكود يطلب المالك رأيك أو معاينة:**
   - اعرض الحلول أو صورة معاينة من التطبيق الحقيقي.
   - انتظر موافقته، ثم نفّذ.

## 3) مهارات وأدوات مجربة

- **`gh` غير مسجل الدخول** على الجهاز، لكن Git يحفظ توكن GitHub. استعمله للجلسة فقط، بدون طباعته وبدون حفظه:
  `export GH_TOKEN=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill | sed -n 's/^password=//p')`
- **PR ثم دمج:**
  - `gh pr create`، وانتظر فحص Actions على الـ PR.
  - `gh pr merge N --merge`.
  - راقب `pages build and deployment` و`Build Smart Loan AAB` على commit الدمج.
  - الدمج يحتاج إذن المالك الصريح في الجلسة. أعطاه في 9 نوفمبر 2026 لهذه الجولة.
- **فشل البناء بخطأ 504 عند تنزيل Gradle** عطل خارجي: تأكد أن الرابط يعمل ثم `gh run rerun <id>`. لا تغيّر الكود بسببه.
- **فحص الحزمة بعد البناء:**
  1. `gh run download <id> -n SmartLoanCalculator-release-aab`.
  2. تأكد أن `base/assets/public/index.html` يحتوي التعديل.
  3. تأكد من بصمة التوقيع `E0:12:B5…B4:C8` (keytool على `META-INF/SMARTLOA.RSA`).
  4. تأكد من `versionCode` في سجل التشغيل.
  5. انسخها إلى `Downloads` و`emiGo/releases/`، واحذف الحزمة الأقدم غير المرفوعة من Downloads.
- **فحص الويب المنشور:** `curl` لملف `service-worker.js` ورقم `CACHE`، و`curl` لـ `index.html` للبحث عن النص الجديد.
- **نهايات الأسطر:** ملفات المستودع LF، ونسخة Windows قد تكون CRLF. عند التعديل ببايثون استخدم `newline=''` وطابق نوع السطر.
- **صور المتجر:** أدوات التوليد في `smartloan/store-graphics/tools/`، وطريقة الاستعمال في README داخلها.
- **المتصفح الآلي:** Playwright (`playwright-core`) مع Chrome المثبت (`C:/Program Files/Google/Chrome/Application/chrome.exe`)، وخادم محلي `python -m http.server`.

## 4) أخطاء وقعت ولا تتكرر

- **الكاش المشترك:** كل التطبيقات على نفس النطاق `smartappsflow.net`، فذاكرة الكاش مشتركة. `basis` و`carmaintenance` و`compoundcalc` (وربما `tradelogpro`) تحذف كاش كل التطبيقات عند التفعيل.
  - **ذكّر المالك** عند أي عمل على هذه التطبيقات، واقترح التعديل الذي يحذف مفاتيح التطبيق نفسه فقط.
  - لا تصلحها بدون طلب. emiGo يحذف `smartloan-` فقط.
- **بيانات هاتف المالك:** قبل أي تشغيل آلي على الهاتف خذ نسخة احتياطية، وأوقف التشغيل إن فشلت.
  - لا تعتمد على `set -e` مع `|`.
  - لا تلمس الحزمة الأصلية، والتجربة على نسخة `.dev` فقط.
- **Play Console:** لا تضع حزمتين في نفس الإصدار. ولا تعِد رفع ملف رقم versionCode فيه استخدم سابقا.
- **HTML:** أي تعليق قبل `<!DOCTYPE html>` يدخل الصفحة وضع quirks، و`<meta charset>` يجب أن يكون في أول 1024 بايت.
- **العربية:**
  - اعزل كل اسم يكتبه المستخدم داخل جملة عربية بـ `<bdi>` أو `U+2068/2069`.
  - النوافذ خارج `#app` لا تصلها قواعد RTL، فافحصها بالعربية.
  - لا تشكيل في نصوص التطبيق.
- **ملاحظات الإصدار للمتجر:** عامة، ولا توحي بوجود مشاكل.
- **جعل المستودع خاصا** يوقف GitHub Pages في الخطة المجانية. هو قرار المالك، فلا تغيّره.

## 5) ذاكرة Claude Code خارج المستودع

ذاكرة الجلسات في `C:\Users\DELL\.claude\projects\C--Users-DELL-Documents-GitHub-smartappsflow\memory\`، وتُحمّل فقط عند فتح المسار الصحيح. هذا الملف وملفات `CLAUDE.md` داخل كل تطبيق هي المصدر المضمون.
