# Trade Log Pro — سجل المشروع والأرشيف الشامل
> وثيقة مرجعية لكل ما أُنجز، وما تبقّى، وملاحظات فنية لأي مبرمج (أو مساعد ذكاء اصطناعي) يكمل العمل.
> آخر تحديث: 30 أكتوبر 2026 (مرحلة 1.2.0 على الويب: مراجعة ثانية للبطاقة والمرجع والحزمة. المتجر لاحقًا — لا دفع إلى main).
>
> أرشيف المستودع العام (مراحل كل التطبيقات): [`../REPO_STRUCTURE.md`](../REPO_STRUCTURE.md) — خصوصًا §0c.
>
> ملاحظات أقدم ما زالت صالحة كسجل تشغيلي:
> - [`CHANGES_COMPLETED_AR.txt`](CHANGES_COMPLETED_AR.txt) — ما اكتمل في حزمة baseline
> - [`README_NEXT_STEPS_AR.txt`](README_NEXT_STEPS_AR.txt) — خطوات اللابتوب + خطة إعادة الهيكلة A/B

---

## 0) نظرة عامة سريعة

- **التطبيق (العلامة):** Edgeory: Trading Journal — دفتر تداول + أداء (حسابات، صفقات، يوميات، حاسبات، تحليلات، تقارير). المجلد التقني ما زال `tradelogpro/`.
- **المستودع:** `smartappsflow` (متعدد التطبيقات). كل التطبيق داخل مجلد `tradelogpro/`.
- **مصدر التطبيق بعد المرحلة B:**
  - `index.html` — الهيكل + حارس Analytics المبكر
  - `css/app.css` — الأنماط
  - `js/state.js` · `icons.js` · `storage.js` · `theme.js` · `finance.js` · `sanitize.js` · `app.js`
    (سكربتات كلاسيكية بالترتيب؛ بدون ES Modules)
  الـ workflow ينسخها إلى `www/`؛ مكتبات XLSX / jsPDF / Chart.js تُحمَّل محليًا أو من CDN.
- **الويب:** PWA على `smartappsflow.net/tradelogpro/` — كاش SW: `edgeory-v3` (بعد إعادة التسمية).
- **المتجر:** Android AAB عبر `.github/workflows/build-tradelogpro.yml` (artifact: `Edgeory-release`).
- **معرّف الحزمة:** `com.tradelog.pro` — **ثابت للأبد**.
- **اللغة في الواجهة:** الإنجليزية (حاليًا).
- **الثيمات:** dark (افتراضي)، light، green — مفتاح `tl_theme`.
- **نموذج البنية في المستودع:** `tradelogpro/` هو الشكل المرجعي لأي تطبيق جديد (انظر `REPO_STRUCTURE.md` §1).

### حالة التوقيع والنشر (6 سبتمبر 2026)

- Upload key reset: **تم اعتماده** — الرفع بمفتاح `4F` / `my-key-alias` مقبول الآن.
- Internal testing: الـ AAB (versionCode 29, targetSdk **35**) رُفض لأن Play يطلب **targetSdk ≥ 36**.
- إصلاح CI: `compileSdkVersion` / `targetSdkVersion` → **36** + ترقية AGP 8.7.2 / Gradle 8.9 (مثل Smart Loan) في `build-tradelogpro.yml`.
- بعد push لـ `main`: نزّل AAB جديد من artifact **`Edgeory-release`** وارفعه Internal testing.
- الـ keystore: `signing.keystore` / alias `my-key-alias`؛ نسخة احتياطية على Google Drive (خارج git).
- لاحقًا: Closed testing ≥12 مجرّب × 14 يوم قبل Production على الحساب الشخصي.
- معلّق منتجًا: بيانات ديمو للقطات، إصلاحات لقطات، 5 تعديلات privacy، إكمال بقايا اسم TradeLog Pro → Edgeory.

### إصلاحات الاسترجاع على أندرويد (10 سبتمبر 2026)

اختبار مباشر على الجهاز عبر ADB (تثبيت APK من Actions بدل انتظار Internal testing).

- **خلل إنتاج مهم:** كان `sw.js` يُسجَّل داخل التطبيق الأصلي (Capacitor يعمل على `https://localhost`)،
  فيُقدَّم JS **قديم من الكاش** بعد كل تحديث — أي تحديث من Play كان سيبقى يشغّل كود النسخة السابقة.
  الحل: لا تسجيل SW على المنصة الأصلية + إلغاء أي تسجيل قديم وحذف كاشه وإعادة تحميل واحدة (`tl_sw_purged`).
- `restoreData` / `importCSV`: لا يُحذف `<input type=file>` قبل انتهاء اختيار الملف وقراءته
  (WebView أندرويد كان يُلغي المنتقي / يُبطل الـ File بصمت بلا أي رسالة).
- `readTextFromFile`: قراءة بعدة مسارات (`arrayBuffer` → `readAsText` → `readAsArrayBuffer` → Blob URL)
  مع إظهار الخطأ الحقيقي في الرسالة بدل نص عام + رفض ملف بحجم 0.
- سبب فشل الاختبار الأخير كان **خارج التطبيق**: ملف مدفوع بـ `adb push` غير مُفهرس في MediaStore،
  فيرجع المنتقي رابطًا لا يُفتح (`NotFoundError`). بعد `scan_file` نجح الاسترجاع (3 حسابات / 35 صفقة).
- الحالة: **الاسترجاع يعمل** على الجهاز. الكاش: `edgeory-v6`.
- للنشر: ارفع AAB من `Edgeory-release` في run #33 (targetSdk 36 + هذه الإصلاحات)، لا النسخة الأقدم.

### الأيقونة وشاشة البداية وترقيم الإصدارات (12 سبتمبر 2026)

**الأيقونة وشاشة البداية** — يولّدهما CI من `icon-512.png` في خطوة واحدة، فلا تُضاف ملفات `android/` إلى git.

- `icon-512.png` / `icon-192.png` في المستودع كانا لا يزالان شعار TradeLog القديم (3.6 ك.ب)؛
  شعار Edgeory الأزرق كان على اللابتوب فقط وغير مرفوع، فخرجت حزمة #35 بالشعار القديم.
  **الدرس:** CI يبني من المستودع لا من الجهاز — أي أصل جديد لا يُرفع لا يوجد.
- الشعار الجديد مربع مستدير مرسوم على **أسود معتم**، فتُقص زواياه بقناع بنصف قطر ‎100/512
  (مرسوم بـ 4× ثم يُصغَّر ليبقى ناعم الحواف). إزالة بالألوان غير مقبولة: حلقات الدفتر داخل الشعار سوداء خالصة.
- الأيقونات القديمة (API ≤ 25) تُسطَّح على `#045DF1`؛ طبقة الـ adaptive تُصغَّر إلى **72dp داخل 108dp**
  لأن اللانشر لا يعرض إلا ثلثي الطبقة الأوسط. الخلفية `@color/ic_launcher_background` = `#045DF1`.
- شاشة البداية: `@capacitor/splash-screen@6.0.3` + `drawable/splash.png` (‎2732 على `#0c0f1a`) لما قبل أندرويد 12،
  و`values-v31/styles.xml` (`windowSplashScreenBackground` / `windowSplashScreenAnimatedIcon`) لأندرويد 12+.
- **لا تستخدم `-draw 'alpha … floodfill'`**: بدائية ImageMagick **7** والرنر عليه 6.x (أفشلت run #36).
- تحقق على الجهاز (run #37): شاشة البداية تظهر خلال ‎0.25s وتختفي عند ‎0.9s، والأيقونة 432×432 بزوايا شفافة
  ولون الخلفية `#ff045df1` مقروءًا من جدول موارد الحزمة نفسها.

**ترقيم الإصدارات** — القاعدة الكاملة في `REPO_STRUCTURE.md` §4a وتنطبق على كل التطبيقات.

- كان `versionName` يُشتق من رقم تشغيل CI (`1.0.${GITHUB_RUN_NUMBER}`)، فكان أول إصدار عام سيُسمّى `1.0.37`.
  صار يُقرأ من `version` في `package.json` (الآن `1.0.0`)، و`versionCode` وحده يبقى رقم التشغيل.
- الرفع يدوي بـ `npm version patch|minor|major --no-git-tag-version`. نسيانه لا يكسر شيئًا.
- اسم الإصدار في Play Console: اترك ما يعبّئه Play تلقائيًا `versionCode (versionName)` — مثل `38 (1.0.0)`.
- أول حزمة Closed testing: **run #38** (`1.0.0`، versionCode 38). لا ترفع #37 (اسمها `1.0.37`).

### مشاركة التطبيق (18 أكتوبر 2026)

زر **Share App** في القائمة يفتح ورقة المشاركة في النظام (نفس شاشة الهاتف في emiGo)، والرسالة فيها الرابطان معًا داخل النص — بدون حقل `url` منفصل، وإلا يعرض أندرويد بطاقة رابط ويسقط باقي الرسالة:

```
Try Edgeory to log trades and track your P&L.

Android — Google Play:
https://play.google.com/store/apps/details?id=com.tradelog.pro

iPhone & browser:
https://smartappsflow.net/tradelogpro/
```

على التطبيق الأصلي تُستخدم إضافة Capacitor Share؛ على الويب `navigator.share`؛ وإن لم يتوفرا تُنسخ الرسالة. الكاش: `edgeory-v8`. الويب نُشر وتأكد المستخدم منه.

زر **Rate App** في القائمة يفتح صفحة Edgeory في Google Play (`PLAY_STORE_URL`) عبر `@capacitor/browser` داخل التطبيق، و`window.open` على الويب. لا نافذة تقييم تلقائية. يُرفع مع تحديث المشاركة في حزمة واحدة على **Production**، بعد رفع الحد إلى minSdk 24. #41 و#43 بلا هذا الزر. Play يستهلك `versionCode` عند أول رفع حتى لو حُذفت الحزمة من المسودة، لذلك 44 محجوز والحزمة التالية هي التي تُرفع.

### النشر في الإنتاج (أكتوبر 2026)

- شرط الحساب الشخصي اكتمل: **12 مختبرًا** في Closed testing. أول نشر عام ظهر في Play بتاريخ **12 أكتوبر 2026**. الإصدار الذي كان حيًا قبل هذا التحديث هو **38 (1.0.0)**.
- أي حزمة بعد ذلك تُرفع على مسار **Production**.
- Play Automatic Protection تشترط **minSdk ≥ 24**. CI يثبّت `minSdkVersion = 24`. حزم 23 رُفضت.
- Play يستهلك `versionCode` عند أول رفع حتى لو حُذفت الحزمة من المسودة. **43** و**44** محجوزان ولا يُعاد رفعهما.
- **18 أكتوبر 2026، حوالي 5:12 م:** أُرسل **45 (1.0.0)** إلى مراجعة Production بوصف **Start full rollout**. Managed publishing مطفأ، فينشر عند اكتمال المراجعة. الحالة هنا: **قيد المراجعة**. لا ترفع حزمة أحدث إلا بطلب صريح.
- محتويات 45: رسالة المشاركة (Play + المتصفح)، زر **Rate App**، minSdk 24، targetSdk 36.

### المرحلة 1 — الإصدار 1.0.1 (29 أكتوبر 2026)

البطاقة الملزمة: `EDGEORY_CURSOR_CARD_AR.md` (29 أكتوبر، التحديث الثاني، المعاينة رقم 6). **مرحلة واحدة ثم موافقة يوسف.** هذه المرحلة لا تغيّر تصميم الشاشات.

- الفرع: `fix/edgeory-1.0.1`. ويب أولًا. لا رفع AAB ولا تطبيق على المتجر حتى يطلب يوسف.
- الإصدار: `APP_VERSION` و`package.json` = **1.0.1**. الكاش: **edgeory-v9**.
- خط الأرقام: Roboto 400/500/700 في `tradelogpro/fonts/` و`--mono`. صفر بدون نقطة.
- إصلاحات: تاريخ محلي، فرز P&L، بحث لا ينهار، DCA من `original_qty` عبر `calcDcaSummary`، زر رجوع أندرويد، حذف S&P وشاشة التحميل وTM.
- الاختبارات: `tests/phase101-tests.mjs` ضمن `npm test`.
- **التالي بعد موافقة يوسف:** المرحلة 2 `feat/edgeory-1.1-polish` من المرجع البصري، ثم المرحلة 3 استيراد الصورة. لا تبدأ أي منهما قبل الموافقة.

### المرحلة 2+3 — الإصدار 1.2.0 (29 أكتوبر 2026)

يوسف طلب تنفيذ المرحلتين دفعة واحدة ثم المقارنة مع ملف المعاينة ثم التشغيل على الهاتف قبل أي نشر.

- الإصدار: **1.2.0**. الكاش: **edgeory-v10**. الفرع الحالي ما زال `fix/edgeory-1.0.1` (غير مدفوع).
- تلميع الهاتف: شريط 5 تبويبات، صفحة More، List/Calendar، تفاصيل ورقة، حاسبات 2×2، تنسيق أرقام، confirmSheet، تراجع حذف.
- استيراد لقطة: `js/screenshot-import.js` + fixtures. الويب يعرض `Available in the Android app`. الحفظ فقط بعد `Confirm & save`.
- `npm test`: 164 ناجح (108 السابقة + 19 تنسيق + 37 استيراد).
- **لا دفع إلى main / Pages / Play** حتى يطلب يوسف. ADB بلا جهاز عند التنفيذ.

#### مراجعة ثانية للملفات الثلاثة (30 أكتوبر 2026)

مراجعة بندًا بندًا للبطاقة و`design-reference.html` و`edgeory-cursor-pack.zip`، والتطبيق على نسخة الويب. الكاش: **edgeory-v12**. الإصدار ما زال 1.2.0 (لم يُنشر).

- حذف فوري + `UNDO` للصفقة والحاسبات والقوالب. `Back up first` قبل الاستعادة. سحب الورقة لأسفل للإغلاق، وزر الرجوع عبر `dismissModal`.
- لوحة التحكم: حلقة Win / Loss بـ SVG مع `N closed`، ونص Net P&L. تفاصيل الصفقة: الرسوم، ولون Net P&L، وحذف صفوف الشراء والبيع داخل DCA.
- المقاسات: لا 15px عشوائية، والتقويم وبطاقة الحساب حسب المرجع، وإزالة FAB و`.logo-mark`. باقي الأرقام المعروضة عبر المنسّقات.
- الاستيراد: تواريخ IBKR بسطر النطاق، وبيوع IBKR بيع جزئي، ورسوم IBKR `$`، ونص التحقق لكل منصة، وصفوف حمراء عند عدم التطابق، ولقطة XTB الثانية، وخيارا بيع Trading 212، وجدول الاسم ← الرمز المحلي.
- `@capacitor-community/in-app-review` **6.0.0** مثبت بدقة.
- `npm test`: 169 ناجح، 0 فشل. فحص المتصفح بعرض 390 لكل منصة من fixtures الحزمة.
- غير مختبر: تكبير الخط 130%، وOCR على لقطات حقيقية على الهاتف.
- قرار يوسف: صافي الربح في لوحة التحكم والحسابات **محقق فقط** (`calcRealizedTotal` في `finance.js`). التقارير (Excel/PDF والمعاينة) صارت أيضًا محققة فقط عبر `calcRealizedTotal` (قرار يوسف، 30 أكتوبر).
- مراجعة الحاسبات: حجم الصفقة (أسماء، تحقق، Cash/Margin في الوضعين، From open trade بالرصيد الحالي)، والمتوسط بصفّين دائماً. شاشتا الاستيراد بشريط أزرار ثابت وبلا الشريط السفلي.
- ملاحظات يوسف على الهاتف (30 أكتوبر): تأكيد قبل الحذف ثم UNDO، وزر Buy more، وترتيب شبكة التفاصيل (تواريخ ثم أسعار)، وإزالة From open trade من حاسبة حجم الصفقة لأنها ليست في البطاقة، وإزالة نسب Outcome، وتبديل دليل الاستيراد دون إعادة رسم، وأسهم التقويم SVG. 169 اختبارًا ناجحًا. مُثبّت على الهاتف للمراجعة، دون commit.

#### Edgeory 1.1 Refined (30 أكتوبر 2026)

يوسف اعتمد تصميم 1.1 أساسًا بصريًا مع أفضل ما في Polish، حسب مراجعة ChatGPT في `Downloads\chatGPT opinion between polish vs 1.1\`. هذا هو المرجع الأخير للتطوير.

- نقطة الاستعادة: commit محلي `f67ce6e` على `fix/edgeory-1.0.1`. العمل على `feat/edgeory-1.1-refined`. لا شيء مدفوع. الكاش **edgeory-v13**.
- المقاسات: 12px حد أدنى للنص الثانوي، والشريط العلوي 56، والسفلي 64، والحقول 44/16px، وصفوف More 50.
- الحاسبات وتفاصيل الصفقة بتخطيط 1.1. More بأربع مجموعات. ثيم System (الافتراضي يبقى Dark). اختيار العملة في `sanitize.js` (`CURRENCIES`، `currCode`، `currLbl`).
- مختبر في المتصفح بعرض 360 و390 و430: أرقام طويلة، وصفقة مفتوحة بلا سعر وبسعر، وجزئية، ومغلقة رابحة وخاسرة، وحاسبة فارغة، وتصدير Excel بعملتين، وتعقيم prefs.
- لقطات Play لا تُعاد الآن. بعد اعتماد التصميم تُحدَّث فقط اللقطات المتأثرة.

#### ملاحظات الهاتف + Edgeory 1.2 Review من ChatGPT (30 أكتوبر 2026)

- إصلاحات: أسهم التقويم المفقودة، ونافذة التقرير (تصادم `.wide` مع `.modal.wide`)، و«partial close · 0 left».
- الحاسبات: Position Size ببطاقتين مرقمتين ونتيجة متدرجة، وP&L وCompound بنفس لغة نتيجة Stock Average. المعادلات في `finance.js` ومختبرة في `tests/calculator-tests.mjs`.
- سجل الصفقات أقصر بطبقة، وتسميات unrealized / total صحيحة. الكاش **edgeory-v14**. `npm test`: 213 ناجح.
- لم يُنفّذ: توحيد أدوات البيانات بين Accounts وMore (قرار منتج)، وتكبير الخط 130%.
- فواصل الآلاف في حقول الحاسبات الأربع أثناء الكتابة (`fmtNumInput`/`groupNum`)، والقراءة والحفظ بلا فواصل (`numStr`/`numVal`). الكاش **edgeory-v15**.
- Position Size «Option B» (نتيجة مثبتة أعلى الشاشة + سلّم أسعار Target/Entry/Stop) جُرّب كنموذج مستقل في مخزن الوكيل `possize-b/index.html`.
- **قرار يوسف (31 أكتوبر 2026):** اعتماد Option B داخل التطبيق. نسخة من التصميم السابق محفوظة في مخزن الوكيل `possize-a-backup.js`. نفس معرّفات الحقول، فالحسابات المحفوظة القديمة تُحمَّل.
  - المارجن لا يعكس الرسم: الاتجاه يحدده موضع الوقف (تحت الدخول = شراء، فوقه = بيع على المكشوف، والسلّم ينقلب تلقائيًا). المارجن يغيّر الحجم فقط ويظهر «Margin: 2x leverage. $X cash + $Y borrowed».
  - وضع Distance % يعرض «Position size» بدل «Buy» لأن الاتجاه غير معروف من المسافات.
- **قرار يوسف:** نسبة صافي الربح في التقرير (المعاينة وExcel وPDF) = الربح المحقق ÷ تكلفة الأسهم المباعة فقط (`calcRealizedCost`)، مع «on closed».
- لون الأرقام الرئيسية في الحاسبات موحّد أبيض (`--text`)؛ الربح والخسارة أخضر وأحمر فقط.
- زر الرجوع في الرئيسية: الضغطة الأولى «Press back again to exit»، والثانية خلال ثانيتين تصغّر التطبيق. الكاش **edgeory-v16**. `npm test`: 217 ناجح.
- مراجعة السلّم بعد صور الهاتف: الخط بين الدخول والهدف والوقف ثابت الظهور (متقطع للفارغ)، وبلا خلفيات متدرجة، وتنبيه المخاطرة الصغيرة بالدولار. الكاش **edgeory-v17**.
- مراجعة أمنية (31 أكتوبر 2026): لا XSS نشط. أُضيف eid() لمعرّفات onclick، وesc() لعناوين الحساب والتيكر في التحليلات، و_sname لإزالة الوسوم من الأسماء. CDN لـ xlsx/jspdf/chart يبقى مع SRI. CSP مؤجّل بسبب onclick المضمّن. Compound الافتراضي Years. رسالة تحديث ويب. الكاش **edgeory-v18**. npm test: 225 ناجح.
- حجم الخط (31 أكتوبر 2026): Default / Large / Extra large في Preferences عبر `html[data-font]` و`--fz`/`--fzh`. المفتاح `tl_font`. مُثبّت على الهاتف للمراجعة، غير مُلتزم وغير منشور. الكاش **edgeory-v19**.
- رسالة «Edgeory updated» لمرة واحدة للمستخدمين الحاليين (`maybeShowWhatsNew`، المفتاح `tl_whats_new`). عند كل إصدار يجب الإعلان عنه: غيّر `WHATS_NEW_ID` و`WHATS_NEW_TEXT` في `state.js` و`UPDATE_NOTE` في `sw.js` وارفع الكاش. نُشر الويب إلى `main` في 31 أكتوبر 2026.
- قاعدة: لا حركة دخول على إعادة الرسم داخل الصفحة نفسها — `.view-enter` يُضاف فقط عند تغيير الصفحة في `setView`. ولا تغلق ورقة ثم تعيد فتحها لتبديل محتواها. الكاش **edgeory-v20**.
- زر الرجوع: `backStep()` هو المصدر الوحيد لترتيب الرجوع؛ أندرويد عبر `handleAndroidBack` والويب عبر `initWebBack` (history guard). لا تضف pushState قبل تفاعل المستخدم.

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
- [x] توفير `icon-192.png` و`icon-512.png` الخاصين بـ Trade Log Pro (الأيقونة الفاتحة المعتمدة)
- [x] إعادة قسم icons في `manifest.json` ورابط apple-touch في `index.html`
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
