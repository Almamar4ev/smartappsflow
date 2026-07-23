حزمة Trade Log Pro — النسخة الأساسية الآمنة قبل إعادة الهيكلة
التاريخ: 17 يوليو 2026

============================================================
0) مطلوب قبل إطلاق PWA العام — الأيقونات
============================================================

الأيقونتان التاليتان مطلوبتان ومفقودتان حاليًا داخل tradelogpro/:

  icon-192.png   (192x192)
  icon-512.png   (512x512)

- لا تُستخدم أيقونة Smart Loan أو أي مشروع آخر.
- عند توفيرهما:
  * أعد قسم icons إلى manifest.json.
  * أعد رابط <link rel="apple-touch-icon" href="icon-192.png"> إلى index.html.
  * الـ Workflow ينسخهما تلقائيًا إلى www إن وُجدا (ولا يفشل إن غابا).

============================================================
1) محتويات الحزمة
============================================================

index.html
- المحرك المالي الحالي.
- تعقيم كامل للبيانات الأساسية المستعادة.
- تعقيم الحاسبات المحفوظة والقوالب واليوميات والملف الشخصي وBenchmark والتفضيلات.
- الحفاظ عند الاستعادة على startingCapital وbroker وtarget وstoploss.
- حارس تتبع Cloudflare:
  * يسمح بالتحليلات فقط عند تشغيل الموقع عبر HTTPS على smartappsflow.net أو نطاق فرعي منه.
  * يمنعها داخل Capacitor Android/iOS.
  * يمنعها على localhost وfile: وأي نطاق غير معتمد.
  * يعطل إرسال Cloudflare sendBeacon ويزيل سكربت Cloudflare إذا أُدخل خطأ في نسخة المتجر.

package.json
- يشغل ثلاث مجموعات اختبارات.

package-lock.json
- إصدارات Capacitor مثبتة.

build.yml
- npm ci.
- npm test قبل Android build.
- Action التوقيع مثبت إلى SHA:
  349ebdef58775b1e0d8099458af0816dc79b6407

capacitor.config.json
- لم يحتج إلى تعديل.

tests/financial-tests.mjs
- 18 اختبارًا للمحرك المالي.

tests/security-tests.mjs
- 28 اختبارًا لتعقيم Backup والحفاظ على البيانات والمعاملات.

tests/runtime-guard-tests.mjs
- 10 اختبارات لحارس الويب/المتجر والتتبع.

============================================================
2) نتائج التحقق المحلي
============================================================

npm test

Financial tests: 18 passed, 0 failed
Security/backup tests: 25 passed, 0 failed
Runtime analytics guard tests: 10 passed, 0 failed

Total: 56 passed, 0 failed

كما اجتازت جميع كتل JavaScript داخل index.html فحص node --check.
تم التحقق من تطابق dependencies بين package.json وpackage-lock.json.
تم التحقق من عدم بقاء PIN_ME_TO_SHA في build.yml.

لم يتم بناء APK/AAB في هذه البيئة، لأن البناء النهائي يحتاج GitHub Actions
وأسرار التوقيع الخاصة بك. يجب التحقق من ذلك بعد Push إلى الفرع التجريبي.

============================================================
3) الخطوات على اللابتوب — قبل إعادة الهيكلة
============================================================

أولًا: تجهيز الأدوات
1. تثبيت Visual Studio Code — User Setup.
2. تثبيت Git for Windows أو GitHub Desktop.
3. داخل VS Code ثبّت إضافة Claude Code الرسمية من Anthropic.
4. سجّل الدخول إلى GitHub وإلى Claude.

ثانيًا: تنزيل المستودع
1. اعمل Clone لمستودع smartappsflow إلى اللابتوب.
2. افتح مجلد smartappsflow كاملًا من VS Code، وليس ملف HTML وحده.
3. افتح Terminal داخل VS Code.
4. تأكد أن main نظيف:

   git status
   git checkout main
   git pull

ثالثًا: إنشاء فرع الإصلاحات الأساسية

   git checkout -b fix/tradelogpro-baseline

مهم:
لا تنسخ الملفات إلى مكان عشوائي.
اطلب أولًا من Claude Code تحديد مكان ملفات Trade Log Pro الحالية وWorkflow الخاص به.
لا تلمس Smart Loan أو Car Maintenance أو Compound Calculator أو الصفحة الرئيسية.

رابعًا: وضع الملفات
- استبدل ملفات Trade Log Pro الحالية بالملفات المناظرة في هذه الحزمة.
- ضع ملف الاختبار بهذا المسار والاسم بالضبط:

  tests/financial-tests.mjs
  tests/security-tests.mjs
  tests/runtime-guard-tests.mjs

- ضع build.yml في مكان Workflow الحالي الخاص بـTrade Log Pro فقط.
- إذا كان اسم Workflow الحالي مختلفًا، احتفظ باسمه ولكن انقل محتوى build.yml إليه.

خامسًا: الاختبار المحلي
من مجلد Trade Log Pro الذي يحتوي على package.json:

   npm ci
   npm test

يجب أن تكون النتيجة:
56 passed, 0 failed

سادسًا: المراجعة والحفظ

   git status
   git diff
   git add <ملفات TradeLog فقط>
   git commit -m "fix(tradelogpro): complete baseline hardening and analytics guard"
   git push -u origin fix/tradelogpro-baseline

- افتح Pull Request من fix/tradelogpro-baseline إلى main.
- لا تدمج Pull Request بعد؛ افتحه فقط لكي تعمل اختبارات GitHub Actions على الفرع.

سابعًا: GitHub Actions
- افتح صفحة Actions في GitHub.
- شغّل Workflow الخاص بـTrade Log Pro أو انتظر تشغيله تلقائيًا.
- تأكد من نجاح:
  npm ci
  npm test
  Android build
  Sign AAB
  Sign APK
  Upload artifacts

- نزّل APK واختبره على هاتف Samsung.
- تأكد من ظهور AAB وAPK موقعين.
- اختبر Backup ثم Restore على بيانات تجريبية.
- تأكد أن رأس المال والوسيط والهدف ووقف الخسارة لا تختفي بعد Restore.

============================================================
4) التحقق من حارس التتبع
============================================================

نسخة الويب:
- افتح https://smartappsflow.net أو مسار Trade Log Pro على الدومين.
- افتح Console واكتب:

  window.__TL_RUNTIME__

المتوقع:
analyticsAllowed: true
isNative: false

نسخة Android:
- اربط الهاتف بـChrome Remote Debugging عند الحاجة.
- في Console اكتب:

  window.__TL_RUNTIME__

المتوقع:
analyticsAllowed: false
isNative: true

الحارس لا يمنع وظائف التطبيق الأخرى مثل Yahoo S&P 500 أو المشاركة أو البريد.
هو يستهدف Cloudflare Analytics فقط.

ملاحظة:
إذا كنت تستخدم Cloudflare Web Analytics بطريقة Automatic Setup، فالسكربت يُضاف
إلى استجابة الموقع من Cloudflare ولا يكون جزءًا من ملفات Capacitor أصلًا.
الحارس المضاف الآن يوفر حماية إضافية إذا نُسخ السكربت لاحقًا إلى HTML بالخطأ.

============================================================
5) بعد نجاح الفرع — إعادة الهيكلة
============================================================

لا تعمل إعادة الهيكلة في نفس فرع الإصلاحات.
بعد نجاح الاختبارات والبناء:

   git checkout main
   git pull
   git checkout -b refactor/tradelogpro-structure

المرحلة A فقط:
- إنشاء مجلد مصدر موحد Trade Log Pro.
- نقل CSS من index.html إلى css/app.css.
- نقل JavaScript من index.html إلى js/app.js.
- لا تغير أسماء الدوال.
- لا تغير onclick.
- لا تستخدم ES Modules في هذه المرحلة.
- لا تحسن التصميم ولا تنظف المنطق أثناء النقل.
- عدّل Workflow لنسخ css وjs والأصول إلى www.
- شغّل npm test قبل وبعد كل نقل.

الهيكل الأولي المقترح:

tradelogpro/
  index.html
  css/
    app.css
  js/
    app.js
  tests/
    financial-tests.mjs
    security-tests.mjs
    runtime-guard-tests.mjs
  package.json
  package-lock.json
  capacitor.config.json

بعد نجاح المرحلة A على الويب وAndroid، تبدأ المرحلة B لتقسيم app.js حسب المسؤولية.

============================================================
6) رسالة جاهزة إلى Claude Code
============================================================

أنت تعمل داخل مستودع smartappsflow متعدد المشاريع.
هذه المهمة تخص Trade Log Pro فقط.

لا تعدل Smart Loan أو Car Maintenance أو Compound Calculator أو الصفحة الرئيسية
أو CNAME أو Workflows التطبيقات الأخرى.

ابدأ بتحليل المستودع فقط وحدد:
1. مكان مصدر Trade Log Pro الحالي.
2. مكان package.json وpackage-lock.json وcapacitor.config.json الخاص به.
3. Workflow الذي يبني Trade Log Pro تحديدًا.
4. هل المسارات في build.yml الحالي صحيحة بالنسبة لمكان التطبيق؟

بعد التقرير، ضع ملفات حزمة baseline الجديدة في مواقعها المناظرة فقط.
لا تبدأ إعادة الهيكلة.
لا تنقل CSS أو JavaScript الآن.

شغّل:
npm ci
npm test

يجب أن تنجح 56 حالة.
اعرض Git Diff وتأكد أن التغييرات تخص Trade Log Pro فقط.
بعد موافقتي أنشئ Commit على فرع fix/tradelogpro-baseline.
لا تدمج إلى main قبل نجاح GitHub Actions وخروج APK وAAB موقعين.
