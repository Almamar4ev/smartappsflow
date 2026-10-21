import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

console.log('\nemiGo — Smart App Guide tests\n');

check('guide state uses dedicated emigo_guide_v1 key',
  /const\s+GUIDE_KEY\s*=\s*['"]emigo_guide_v1['"]/.test(html));
check('guide persistence never writes into sla_v1 or sla_demo_v1 paths',
  /function saveGuideState\(/.test(html) &&
  /localStorage\.setItem\(GUIDE_KEY/.test(html) &&
  !/function saveGuideState\([\s\S]*?localStorage\.setItem\(STORAGE_KEY/.test(html) &&
  !/function saveGuideState\([\s\S]*?localStorage\.setItem\(DEMO_STORAGE_KEY/.test(html));
check('tour has five guided steps',
  /const\s+GUIDE_TOUR_STEPS\s*=\s*\[/.test(html) &&
  (html.match(/id:'profile'|id:"profile"/g) || []).length >= 1 &&
  (html.match(/id:'loan'|id:"loan"/g) || []).length >= 1 &&
  (html.match(/id:'rate_period'|id:"rate_period"/g) || []).length >= 1 &&
  (html.match(/id:'results'|id:"results"/g) || []).length >= 1 &&
  (html.match(/id:'extras'|id:"extras"/g) || []).length >= 1 &&
  /GUIDE_TOUR_STEPS\.length/.test(html));
check('what\'s new features include demo_mode id',
  /id:'demo_mode'|id:"demo_mode"/.test(html) &&
  /featuresSeen/.test(html) &&
  /maybeShowWhatsNew/.test(html));
check('shared guide sheet and welcome/tour cards exist',
  /id="guide-sheet"/.test(html) &&
  /id="guide-welcome"/.test(html) &&
  /id="guide-tour-card"/.test(html) &&
  /id="guide-whatsnew"/.test(html) &&
  /id="guide-nudge"/.test(html));
check('contextual tip buttons and result tip hooks exist',
  /openGuideTip\('salary'\)/.test(html) &&
  /openGuideTip\('amount'\)/.test(html) &&
  /openGuideTip\('rate'\)/.test(html) &&
  /maybeShowResultTip/.test(html) &&
  /results\.report/.test(html) &&
  /markAllResultTipsSeen/.test(html));
check('tour step 4 is Calculate overview (not live result tabs)',
  /id:'results'[\s\S]*?target:'calculate'/.test(html) &&
  /بعد الضغط على «احسب» تظهر خمس صفحات|After you tap Calculate, five pages appear/.test(html) &&
  !/لا تحتاج قرضاً محفوظاً الآن|you do not need a saved loan yet/.test(html));
check('tour Next keeps card and avoids smooth scroll shake',
  /Same screen: do not reset scrollTop/.test(html) &&
  /update copy in place/.test(html) &&
  /ensureGuideTargetVisible/.test(html) &&
  /guide-tour-on/.test(html) &&
  /id="guide-spot-ring"/.test(html) &&
  !/scrollIntoView\(\{behavior:'auto'/.test(html));
check('help sheet list inherits RTL outside #app',
  /Sheet lives outside #app/.test(html) &&
  /ov\.setAttribute\('dir', dir\)/.test(html) &&
  /\[dir="rtl"\] \.guide-help-item svg\{transform:scaleX\(-1\)\}/.test(html) &&
  !/body\.removeAttribute\('dir'\)/.test(html));
check('settings help row reuses catalog and can restart tour',
  /id="settings-guide-row"/.test(html) &&
  /openGuideHelp/.test(html) &&
  /function startGuideTour\(/.test(html) &&
  /function skipGuideTour\(/.test(html) &&
  /helpRestart/.test(html) &&
  /GUIDE_HELP/.test(html) &&
  /_guideFromHelp/.test(html) &&
  /openGuideHelp\(\); \/\/ swap content in place/.test(html));
check('currency settings use slim dropdown not grid panel',
  /id="cur-dropdown"/.test(html) &&
  /cur-dd-item/.test(html) &&
  !/id="cur-panel"/.test(html) &&
  !/id="currency-grid"/.test(html));
check('Arabic guide text keeps periods with sentences',
  /formatGuideText/.test(html) && /\\u200F/.test(html));
check('guide strips Arabic tashkeel for plain copy',
  /\\u064B-\\u065F\\u0670/.test(html));
check('demo help card uses experimental demo title in Arabic',
  /helpDemo:'وضع العرض التجريبي'/.test(html) &&
  /title:'وضع العرض التجريبي'/.test(html) &&
  /ملفك الحقيقي يبقى مغلقا، تعود إليه بعد البصمة ورمز الجهاز/.test(html) &&
  !/على الهاتف المقفل تعود إليه/.test(html));
check('scenario banner keeps EMI amounts neutral and loan name in title',
  /تفعيل السيناريو يوفر/.test(html) &&
  /يستبدل قرض \$\{repName\}/.test(html) &&
  /color:var\(--txt\)">\$\{fmtAmt\(rep\.loanMonthly\)\}/.test(html) &&
  /لكن إجمالي الفائدة يزيد/.test(html));
check('report page does not show the 35% estimated-loan range card',
  !/id="lbl-rec"/.test(html) &&
  !/id="rec-range-hint"/.test(html) &&
  !/35% من صافي دخلك كقاعدة عامة/.test(html));
check('Help guide no longer includes a What\'s new topic',
  !/helpWhatsNew/.test(html) &&
  !/help:whatsnew/.test(html) &&
  !/GUIDE_HELP[\s\S]*?whatsnew:/.test(html));
check('Rate hint Arabic asks for support via review',
  /ادعمنا بتقييمك/.test(html));
check('guide is blocked during sensitive flows',
  /function isGuideBlocked\(/.test(html) &&
  /setGuideBlocked\(true\)/.test(html) &&
  /hideGuideChrome\(\)/.test(html));
check('guide anchors use data-guide-id fail-soft targets',
  /data-guide-id="salary"/.test(html) &&
  /data-guide-id="amount"/.test(html) &&
  /data-guide-id="results-tabs"/.test(html) &&
  /id="guide-spot-ring"/.test(html));
check('npm test script includes guide-tests',
  typeof pkg.scripts?.test === 'string' &&
  pkg.scripts.test.includes('guide-tests.mjs'));

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}\n`);
if (failed) process.exit(1);
