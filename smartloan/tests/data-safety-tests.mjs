// ==========================================================================
// emiGo — data-safety tests
// ==========================================================================
// Runs the REAL functions from ../index.html inside a small fake page, so the
// tests follow shipped code. Covers: nothing saved is ever deleted automatically,
// "New calculation" keeps the profile, amount inputs accept decimals and Arabic
// digits, editing the profile returns to where it started, every saved loan is an
// independent plan, old data migrates to the manual existing-payments field, money
// shows the right decimals, the simulator matches the report, the service worker
// never stores a bad response, confirmations use the app's own sheet, and the
// Android back button behaves like the on-screen arrow.
//
// Run:  node tests/data-safety-tests.mjs
// ==========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

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

function extractFunction(name) {
  let start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Function not found in index.html: ${name}`);
  if (html.slice(start - 6, start) === 'async ') start -= 6;
  // Skip the parameter list first: it may hold destructuring braces.
  let i = html.indexOf('(', start);
  for (let parens = 0; i < html.length; i++) {
    if (html[i] === '(') parens++;
    if (html[i] === ')' && --parens === 0) break;
  }
  i = html.indexOf('{', i);
  let depth = 0;
  let quote = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}' && --depth === 0) {
      return html.slice(start, i + 1);
    }
  }
  throw new Error(`Malformed function: ${name}`);
}

const REAL = [
  'calcLoan', 'analyse', 'safeRate', 'cleanNum', 'normalizeDigits', 'cleanAmountText',
  'groupAmountText', 'fmtAmountInput', 'curDec', 'updateForm', 'hasRoomToSave',
  'showSavedLimitSheet', 'hideSavedLimitSheet', 'limitViewSaved',
  'saveScenario', 'isDuplicatePlan', 'restart', 'startForm', 'confirmDeleteLoan',
  'planWithinBankLimit', 'savedPlansTitle', 'planTermText', 'renderCompare', 'editSavedLoan',
  'migrateToPlans', 'applyLoadedState', 'sanitizeSaved', 'blankProfile', 'buildDemoBundle',
  'showExistingNotice', 'closeExistingNotice', 'existingNoticeOk', 'existingNoticeReview',
  'numText', 'fmtNum', 'fmtPayNum', 'fmtPct', 'fmtAmt', 'fmtPay', 'fmtRangeDec', 'payTolerance',
  'withCurrency', 'getCurrencySymbol',
  'niceStep', 'simAmountBounds', 'syncSimToForm', 'simSlide', 'toggleManual', 'applyManual',
  'simUpdate', 'firstSentence', 'getStartDate',
  'confirmSheet', 'closeConfirmSheet', 'isOverlayOpen', 'handleBackButton', 'registerBackButton',
  'myLoansTotal', 'realPayments', 'takePlan', 'confirmDeleteMyLoan', 'renderHomeLoans', 'loanLastPayment',
  'planTitle', 'planAmount', 'planLabelInput', 'setPlanLabelInput', 'planRow',
  'comparePlans', 'compareSide', 'compareVerdict',
  'leaveDetailBeforeChange', 'editViewedPlan', 'deleteViewedPlan', 'applyResultsActions', 'leaveSavedDetail',
  'readHomeOpen', 'applyHomeOpen', 'setHomeOpen', 'toggleHomeSection', 'thinRemainder', 'remainderAfter',
  'fitCompareTable', 'renderBankLimitCard', 'maxPrincipal', 'termForPayment', 'updatePeriodUnit', 'cleanDigitsField',
  'beginProfileEdit', 'endProfileEdit', 'cancelProfileEdit', 'editProfile',
  'editProfileBankLimit', 's1Back', 's2Back', 's2Next', 'saveStep2Inputs',
  'syncProfileToInputs', 'goStep', 'calculate', 'openSavedDetail', 'goHome',
];

const STATE = `
  const CUR_DEC={OMR:3,KWD:3,BHD:3,IDR:0};
  const PROFILE_KEYS=['salary','income','expenses','variable','existing','employment','risk'];
  const MAX_SAVED_PLANS=4, PLANS_MODEL=1, RISK_LEVELS=['safe','moderate','risky'];
  let lang='en',currency='USD',results=null,saved=[],myLoans=[],extraLoans=[],isPremium=false,_viewingMyLoan=false;
  let _confirmResolve=null,currentTheme='light',_existingNotice=false,_demo=false,_sim={amt:50000,per:36,rate:8.5};
  const CURRENCIES=[{id:'USD',symbol:'$'},{id:'OMR',symbol:'ر.ع'},{id:'IDR',symbol:'Rp'},{id:'KWD',symbol:'د.ك'},{id:'BHD',symbol:'د.ب'},{id:'NONE',symbol:''}];
  let profileSaved=true,_editingLoanIdx=null,_viewingSavedLoan=false,_savedSnap=null;
  let _viewingSavedIdx=-1,_profileReturn=null,_lastSaveClick=0,_guideTourActive=false;
  let profile,form;
  const HOME_OPEN_KEY='emigo_home_open';
  const DEFAULT_RATE=5;
  let _homeOpen={loans:false,plans:false};
  const T={en:{lt_personal:'Personal',lt_car:'Car'},ar:{lt_personal:'x',lt_car:'y'},es:{lt_personal:'x',lt_car:'y'}};
  function t(){return {saveScenario:'Save',savedScenarios:'My saved plans',months:'mo',noSaved:'none',
    monthlyInstallment:'Monthly',totalCost:'Total',totalInterest:'Interest',dtiRatio:'DTI',compareTitle:'Compare'};}
  function savedLoanDisplayName(s){return s.name||'';}
  function ltIcon(){return '';}
  function escapeHtml(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function isDemoMode(){return _demo;}
  function isKnownLang(l){return !!T[l];}
  function isKnownCurrency(){return true;}
  function isKnownTheme(){return true;}
  function maybeOfferGuide(){}
`;

// One fresh page per test: fake DOM, stubbed drawing, real logic.
function newPage() {
  const elements = {};
  const makeClassList = () => {
    const set = new Set();
    return {
      add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c),
      toggle: (c, on) => { if (on) set.add(c); else set.delete(c); },
    };
  };
  const el = (id) => (elements[id] ??= {
    id, value: '', style: {}, textContent: '', dir: '', onclick: null, clicks: 0,
    classList: makeClassList(),
    focus() {}, select() {}, scrollIntoView() {}, click() { this.clicks++; },
    setAttribute(k, v) { this[k] = v; },
  });
  el('s3-back').onclick = 'original-back';
  const activeRef = { value: 'home' };
  const sandbox = {
    console,
    window: { scrollTo() {} },
    confirm: () => { throw new Error('native confirm() must not be used'); },
    calls: [],
    setTimeout: () => 0,
    requestAnimationFrame: () => 0,
    document: {
      getElementById: (id) => (id === undefined ? null : el(id)),
      querySelector: (q) => (q === '.screen.active' ? { id: activeRef.value } : null),
      querySelectorAll: () => [],
    },
    persisted: 0,
    upgraded: 0,
    renderCalls: [],
    showScreen: (id) => { activeRef.value = id; },
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(`
    ${STATE}
    function persistState(){persisted++;}
    function showUpgradeDialog(){upgraded++;}
    function renderHome(){} function renderHomeSaved(){} function renderSavedTab(){}
    function renderStepLabels(){}
    function renderStep3Dynamic(){renderCalls.push('step3');}
    function renderResults(){renderCalls.push('results');}
    function maybeShowResultTip(){} function showToast(){}
    function hideGuideSheet(){calls.push('guide-sheet');} function hideBankPayInfo(){calls.push('bankpay');}
    function hideRiskInfo(){calls.push('risk');} function hidePremiumSheet(){calls.push('premium');}
    function hideExportSheet(){calls.push('export');} function skipGuideTour(){calls.push('skip-tour');}
    function dismissGuideNudge(){calls.push('nudge');} function dismissWhatsNew(){calls.push('whatsnew');}
    function closeLangMenu(){calls.push('lang-menu');}
    ${REAL.map(extractFunction).join('\n')}
    ${html.slice(html.indexOf('const BACK_LAYERS='), html.indexOf('function handleBackButton('))}
  `, ctx);
  const run = (code) => vm.runInContext(code, ctx);
  run(`profile={salary:'3000',income:'0',expenses:'500',variable:'200',existing:'0',employment:'full',risk:'medium',bankLimit:'40',limitBasis:'gross'};
       form={loanType:'personal',amount:'10000',period:'36',rate:'8.5',startMonth:0,startYear:2026};`);
  return { run, el, sandbox, active: () => activeRef.value, setActive: (id) => { activeRef.value = id; } };
}

function plan(type, monthly, amount = 1000) {
  return `{type:'${type}',loanType:'personal',loanAmount:${amount},loanMonthly:${monthly},name:'p${monthly}',
    results:{monthly:${monthly}},form:{amount:'${amount}',period:'12',rate:'5',loanType:'personal'}}`;
}
const settle = () => new Promise((r) => setTimeout(r, 0));
function typeAmount(page, id, key, value) {
  const input = page.el(id);
  input.value = value;
  page.sandbox._input = input;
  page.run(`fmtAmountInput(_input,'${key}')`);
  return input.value;
}

console.log('\nemiGo — data-safety tests\n');

// ── Nothing saved is deleted automatically ─────────────────────────────────
console.log('Saved list limit');
check('no code path drops a saved item with pop()', !/saved\.pop\(\)/.test(html));
check('the free plan limit is 4', /const MAX_SAVED_PLANS = 4;/.test(html));
{
  const p = newPage();
  p.run(`saved=[${plan('active', 100)},${plan('active', 200)},${[3, 4].map((n) => plan('scenario', n)).join(',')}];
         results={monthly:999};form.amount='777';`);
  p.run('saveScenario()');
  check('a full list stays exactly the same after saving', p.run('saved.length') === 4);
  check('every plan is still there', p.run(`saved.map(s=>s.loanMonthly).join()`) === '100,200,3,4');
  check('the limit sheet opens', p.el('limit-overlay').style.display === 'flex');
  check('the limit sheet states the count', p.el('limit-title').textContent.includes('4'));
  check('no upgrade dialog at the limit', p.sandbox.upgraded === 0);
  check('the limit sheet does not mention Pro or soon',
    !/Pro|Premium|soon/i.test(p.el('limit-title').textContent + p.el('limit-body').textContent));
  check('nothing is written to storage', p.sandbox.persisted === 0);
  p.run('limitViewSaved()');
  check('"View my plans" closes the sheet and goes home',
    p.el('limit-overlay').style.display === 'none' && p.active() === 'home');
}
{
  const p = newPage();
  p.run(`_editingLoanIdx=2;saved=[${[1, 2, 3, 4].map((n) => plan('active', n)).join(',')}];
         results={monthly:999};form.amount='777';`);
  p.run('saveScenario()');
  check('editing at the limit updates the plan in place', p.run('saved.length') === 4
    && p.run('saved.map(s=>s.loanMonthly).join()') === '1,2,999,4');
  check('editing never opens the limit sheet', p.el('limit-overlay').style.display !== 'flex');
  check('editing finishes the edit state', p.run('_editingLoanIdx') === null);
}
{
  const p = newPage();
  p.run(`saved=[${Array.from({ length: 11 }, (_, n) => plan('scenario', n + 1)).join(',')}];results={monthly:9};`);
  p.run('saveScenario()');
  check('a restored list above the limit is kept whole', p.run('saved.length') === 11);
}
{
  const p = newPage();
  p.run(`results={monthly:9};`);
  p.run('saveScenario()');
  check('saving below the limit still works', p.run('saved.length') === 1);
}

// ── New calculation ────────────────────────────────────────────────────────
console.log('\nNew calculation');
{
  const p = newPage();
  p.run(`results={monthly:1};_editingLoanIdx=3;saved=[${plan('active', 100)}];extraLoans=[1];form.amount='55';`);
  p.setActive('results-screen');
  p.run('restart()');
  check('keeps salary and expenses', p.run('profile.salary') === '3000' && p.run('profile.expenses') === '500');
  check('keeps bank limit', p.run('profile.bankLimit') === '40');
  check('stays marked as saved', p.run('profileSaved') === true);
  check('clears the current loan only', p.run(`form.amount`) === '' && p.run('results') === null
    && p.run('extraLoans.length') === 0);
  check('ends any edit in progress', p.run('_editingLoanIdx') === null);
  check('keeps saved loans', p.run('saved.length') === 1);
  check('opens the loan form directly', p.active() === 'step3');
  check('persists the result', p.sandbox.persisted >= 1);
}
for (const [needle, label] of [
  ["restart:'New calculation'", 'English'], ["restart:'حساب جديد'", 'Arabic'], ["restart:'Nuevo cálculo'", 'Spanish'],
]) check(`button is renamed in ${label}`, html.includes(needle));

// ── Amount inputs ──────────────────────────────────────────────────────────
console.log('\nAmount inputs');
{
  const p = newPage();
  const clean = (v) => p.run(`cleanNum(${JSON.stringify(v)})`);
  check('"850.500" is 850.5, not 850500', +clean('850.500') === 850.5);
  check('Arabic digits "٥٠٠٠" are 5000', +clean('٥٠٠٠') === 5000);
  check('Persian digits "۵۰۰۰" are 5000', +clean('۵۰۰۰') === 5000);
  check('"1,250.75" is 1250.75', +clean('1,250.75') === 1250.75);
  check('Arabic decimal mark "٣٫٥" is 3.5', +clean('٣٫٥') === 3.5);
  check('a second dot is ignored', +clean('1.2.3') === 1.23);
  check('empty stays empty', clean('') === '' && clean(null) === '');
  check('a trailing dot is dropped from the stored value', clean('850.') === '850');
  check('whole number with grouping', p.run(`groupAmountText('1234567')`) === '1,234,567');
  check('grouping leaves decimals alone', p.run(`groupAmountText('1234.5670')`) === '1,234.5670');
}
{
  const p = newPage();
  p.run(`currency='OMR'`);
  check('OMR keeps three decimals', typeAmount(p, 'inp-salary', 'salary', '850.5007') === '850.500');
  check('value is stored for calculation', +p.run('profile.salary') === 850.5);
  check('"850." survives while typing', typeAmount(p, 'inp-salary', 'salary', '850.') === '850.');
  check('thousands are grouped while typing', typeAmount(p, 'inp-amount', 'amount', '12345.678') === '12,345.678');
  check('loan amount reaches the form', +p.run('form.amount') === 12345.678);
  check('Arabic typing works end to end', typeAmount(p, 'inp-amount', 'amount', '٨٥٠٫٥') === '850.5');
  check('deleting a digit regroups', typeAmount(p, 'inp-amount', 'amount', '1,23') === '123');
  check('clearing leaves nothing stored', typeAmount(p, 'inp-amount', 'amount', '') === '' && p.run('form.amount') === '');
  for (const c of ['KWD', 'BHD']) {
    p.run(`currency='${c}'`);
    check(`${c} keeps three decimals`, p.run('curDec()') === 3);
  }
  p.run(`currency='IDR'`);
  check('IDR has no decimals', typeAmount(p, 'inp-amount', 'amount', '1500.75') === '1,500');
  p.run(`currency='USD'`);
  check('USD keeps two decimals', typeAmount(p, 'inp-amount', 'amount', '1500.755') === '1,500.75');
  p.run(`currency='NONE'`);
  check('no currency keeps two decimals', p.run('curDec()') === 2);
}
{
  const p = newPage();
  p.run(`lang='es'`);
  typeAmount(p, 'inp-amount', 'amount', '1,500');
  check('Spanish: a comma typed last is the decimal mark',
    typeAmount(p, 'inp-amount', 'amount', '1,500,') === '1,500.');
  check('Spanish: decimals continue after it', typeAmount(p, 'inp-amount', 'amount', '1,500.5') === '1,500.5');
  p.run(`lang='en'`);
  check('English: a comma stays a thousands mark', typeAmount(p, 'inp-amount', 'amount', '1,') === '1');
}
for (const id of ['inp-salary', 'inp-income', 'inp-expenses', 'inp-variable', 'inp-amount']) {
  check(`${id} opens the decimal keyboard`, new RegExp(`id="${id}" type="text" inputmode="decimal"`).test(html));
}
check('the amount field shows decimals when reopened', /amtEl\.value=groupAmountText\(cleanNum\(form\.amount\)\)/.test(html));

// ── Existing payments field ────────────────────────────────────────────────
console.log('\nExisting payments field');
check('the field is editable text', /id="inp-existing" type="text" inputmode="decimal"[^>]*oninput="fmtAmountInput\(this,'existing'\)"/.test(html)
  && !/id="inp-existing"[^>]*readonly/.test(html));
{
  const p = newPage();
  p.run(`profile.existing='1234.567';saved=[${plan('active', 50)}]`);
  p.run('syncProfileToInputs()');
  check('1,000 or more is displayed, not 0', p.el('inp-existing').value === '1,234.567');
  check('opening the profile never overwrites the number', p.run('profile.existing') === '1234.567');
  p.el('inp-existing').value = '80.5';
  p.run('saveStep2Inputs()');
  check('the typed number is saved', p.run('profile.existing') === '80.5');
  p.el('inp-existing').value = '';
  p.run('saveStep2Inputs()');
  check('an empty field is 0', p.run('profile.existing') === '0');
  check('startForm leaves it alone', (p.run(`profile.existing='70'`), p.run('startForm()'), p.run('profile.existing') === '70'));
}

// ── Editing the profile returns to where it started ────────────────────────
console.log('\nEdit profile');
function fillStep2(p, { expenses = '500', variable = '200', limit = '40' } = {}) {
  p.el('inp-expenses').value = expenses;
  p.el('inp-variable').value = variable;
  p.el('inp-banklimit').value = limit;
}
check('the step 2 button is not rewritten at runtime', !/s2next\.onclick|s2-next'\)\.onclick/.test(html));
{
  const p = newPage();
  p.setActive('home');
  p.run('editProfile()');
  check('edit from home opens step 1', p.active() === 'step1');
  p.el('inp-salary').value = '4,000';
  p.run('goStep(2)');
  fillStep2(p);
  p.run('s2Next()');
  check('edit from home returns home', p.active() === 'home');
  check('new salary is saved', p.run('profile.salary') === '4000');
  p.run(`form={...form,amount:'9000'}`);
  p.setActive('step2');
  p.run('s2Next()');
  check('the normal flow continues to the loan step afterwards', p.active() === 'step3');
}
{
  const p = newPage();
  p.run(`form.amount='45000'`);
  p.setActive('step3');
  p.run(`document.getElementById('s3-back').onclick='to-home'`);
  p.run('editProfile()');
  p.run('goStep(2)');
  fillStep2(p, { expenses: '600' });
  p.run('s2Next()');
  check('edit from the loan step returns there', p.active() === 'step3');
  check('the loan being entered is untouched', p.run('form.amount') === '45000');
  check('the new expense is applied', p.run('profile.expenses') === '600');
  check('the step 3 back button is restored', p.el('s3-back').onclick === 'to-home');
  check('the loan step is redrawn with the new profile', p.sandbox.renderCalls.includes('step3'));
}
{
  const p = newPage();
  p.run(`form.amount='45000'`);
  p.setActive('step3');
  p.run(`document.getElementById('s3-back').onclick='to-home'`);
  p.run('editProfile()');
  p.el('inp-salary').value = '9,999';
  p.run('goStep(2)');
  p.run('s2Back()');
  check('back from step 2 goes to step 1 when the edit began there', p.active() === 'step1');
  p.run('s1Back()');
  check('back from step 1 returns to the origin, not home', p.active() === 'step3');
  check('backing out discards the change', p.run('profile.salary') === '3000');
  check('the step 3 back button survives a cancelled edit', p.el('s3-back').onclick === 'to-home');
  check('the edit state is cleared', p.run('_profileReturn') === null);
}
{
  const p = newPage();
  p.run(`results={monthly:1,rate:0.085};`);
  p.setActive('results-screen');
  p.run('editProfileBankLimit()');
  check('"change limit" opens step 2', p.active() === 'step2');
  fillStep2(p, { limit: '33' });
  p.run('s2Next()');
  check('"change limit" returns to the report', p.active() === 'results-screen');
  check('the report is recalculated', p.sandbox.renderCalls.includes('results') && p.run('results.monthly') > 1);
  check('the new limit is saved', p.run('profile.bankLimit') === '33');
}
{
  const p = newPage();
  p.setActive('results-screen');
  p.run('editProfileBankLimit()');
  fillStep2(p, { limit: '33' });
  p.run('s2Back()');
  check('back from "change limit" returns to the report', p.active() === 'results-screen');
  check('the limit is unchanged after backing out', p.run('profile.bankLimit') === '40');
}
{
  // Viewing a saved loan works on a temporary copy of form and profile.
  const p = newPage();
  p.run(`saved=[${plan('active', 150, 2000)},${plan('active', 90, 800)}];results={monthly:7};profile.existing='240';form.amount='12345';`);
  p.run('openSavedDetail(0)');
  check('viewing keeps the real existing payments', +p.run('profile.existing') === 240);
  p.setActive('results-screen');
  p.run('editProfileBankLimit()');
  fillStep2(p, { limit: '35' });
  p.run('s2Next()');
  check('"change limit" on a saved loan returns to that loan', p.active() === 'results-screen'
    && p.run('_viewingSavedLoan') === true && p.run('_viewingSavedIdx') === 0);
  check('the viewed loan stays open', p.run('form.amount') === '2000');
  check('the viewed plan uses the real existing payments', +p.run('results.existing') === 240);
  check('the working form underneath is kept', p.run('_savedSnap.form.amount') === '12345');
  check('the new limit survives leaving the view', p.run('_savedSnap.profile.bankLimit') === '35');
  check('the real profile is unchanged', +p.run('_savedSnap.profile.existing') === 240);
}
{
  const p = newPage();
  p.setActive('home');
  p.run('editProfile()');
  p.run('startForm()');
  check('starting a new loan abandons a stale edit', p.run('_profileReturn') === null);
}
{
  const p = newPage();
  p.el('inp-income').value = '';
  p.el('inp-salary').value = '3,000';
  fillStep2(p, { expenses: '', variable: '' });
  p.run(`profile.income='700'`);
  p.run('goStep(3)');
  check('empty additional income is 0', p.run('profile.income') === '0');
  check('empty variable expenses is 0', p.run('profile.variable') === '0');
  check('empty fixed expenses is 0', p.run('profile.expenses') === '0');
  p.el('inp-salary').value = '';
  p.run('goStep(3)');
  check('salary keeps its value when left empty', p.run('profile.salary') === '3000');
}

// ── Plans: every saved loan stands alone ───────────────────────────────────
console.log('\nPlans');
const oldState = (over = '') => `({lang:'ar',currency:'OMR',profileSaved:true,
  profile:{salary:'3000',income:'0',expenses:'500',variable:'200',existing:'17',bankLimit:'40'},
  saved:[${plan('active', 100.1234)},${plan('active', 50)},${plan('scenario', 999)}],form:{},${over}})`;
{
  const p = newPage();
  p.run(`profile.existing='80';saved=[${plan('active', 600)},${plan('scenario', 300)}];`);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  // net 3000-500-200 = 2300; each plan alone after real payments of 80
  check('compare: first plan is alone against the real profile', body.includes('>1,620<'));
  check('compare: second plan is alone against the real profile', body.includes('>1,920<'));
  check('compare: debt ratio ignores the other plan', body.includes('22.67%') && body.includes('12.67%'));
  check('compare: nothing about replacing or activating', !/Replaces|activate/i.test(body));
  p.run(`profile.existing='0'`);
  p.run('renderCompare()');
  check('compare: real payments of 0 change nothing else', p.el('compare-body').innerHTML.includes('>1,700<'));
  p.run(`saved=[${[1, 2, 3].map((n) => plan('active', n)).join(',')}]`);
  p.run('renderCompare()');
  check('compare: three plans open without a coming-soon screen', !/soon|development/i.test(p.el('compare-body').innerHTML));
}
{
  const p = newPage();
  p.run(`profile.existing='80';saved=[${plan('active', 600)},${plan('active', 300)}]`);
  p.run('confirmDeleteLoan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('deleting a plan leaves existing payments alone', p.run('saved.length') === 1 && p.run('profile.existing') === '80');
  p.run(`results={monthly:150};form.amount='4242';saved=[];_lastSaveClick=0`);
  p.run('saveScenario()');
  check('saving a plan leaves existing payments alone', p.run('saved.length') === 1 && p.run('profile.existing') === '80');
  check('a new plan has no active/scenario type', p.run('saved[0].type') === undefined);
  p.run('editSavedLoan(0)');
  check('opening a plan for edit leaves existing payments alone', p.run('profile.existing') === '80');
}
{
  const p = newPage();
  p.run(`form.amount='5000';form.period='12';form.rate='5';saved=[${plan('active', 9)}];results={monthly:1};
         saved[0].form.amount='5000';saved[0].form.period='12';saved[0].form.rate='5';saved[0].loanAmount=5000;saved[0].type='scenario'`);
  check('a duplicate is detected whatever its old type', p.run('isDuplicatePlan()') === true);
}
{
  const p = newPage();
  // salary 3000, limit 40% -> 1200 of room
  p.run(`profile.existing='0'`);
  check('badge: plan within the limit', p.run('planWithinBankLimit(1200)') === true);
  check('badge: plan over the limit', p.run('planWithinBankLimit(1201)') === false);
  p.run(`profile.existing='300'`);
  check('badge: real payments reduce the room', p.run('planWithinBankLimit(901)') === false);
  p.run(`saved=[${plan('active', 5000)}]`);
  check('badge: other saved plans do not reduce the room', p.run('planWithinBankLimit(900)') === true);
  check('a plan row shows the agreed short flag', html.includes("'ضمن الحد'") && html.includes("يتجاوز الحد"));
  check('the old active pill is gone', !/isAr\?'نشط'/.test(html));
}
{
  const p = newPage();
  const title = (n) => { p.run(`saved=Array.from({length:${n}},()=>({}))`); return p.run('savedPlansTitle()'); };
  check('title without plans has no count', title(0) === 'My saved plans');
  check('title shows the count of 4', title(3) === 'My saved plans (3 of 4)');
  p.run(`lang='ar'`);
  check('Arabic title reads "n من 4"', title(4) === 'My saved plans (4 من 4)');
  check('above the limit shows the count only', title(6) === 'My saved plans (6)');
}
{
  const p = newPage();
  const term = (m) => p.run(`planTermText(${m})`);
  p.run(`lang='ar'`);
  const ar = [[12, 'سنة'], [24, 'سنتان'], [36, '3 سنوات'], [120, '10 سنوات'], [132, '11 سنة'], [240, '20 سنة'],
    [1, 'شهر'], [2, 'شهران'], [18, '18 شهرا'], [7, '7 أشهر']];
  for (const [m, want] of ar) check(`Arabic term ${m} months: ${want}`, term(m) === want);
  p.run(`lang='en'`);
  check('English term', term(12) === '1 year' && term(240) === '20 years' && term(18) === '18 months' && term(1) === '1 month');
  p.run(`lang='es'`);
  check('Spanish term', term(12) === '1 año' && term(36) === '3 años' && term(18) === '18 meses');
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  check('migration: the old auto-sum becomes the manual number', p.run('profile.existing') === '150.123');
  check('migration: uses the old sum, not a stale stored value', p.run('profile.existing') !== '17');
  check('migration: scenarios were not counted', +p.run('profile.existing') < 200);
  check('migration: every saved item is kept', p.run('saved.length') === 3);
  check('migration: old types are dropped', p.run('saved.every(s=>s.type===undefined)') === true);
  check('migration: the notice is pending', p.run('_existingNotice') === true);
  p.run('showExistingNotice()');
  check('notice: tells people to delete loans they really pay',
    p.el('existing-notice-body').textContent.includes('أخذت هذا القرض'));
  check('notice: RTL in Arabic', p.el('existing-notice-overlay').dir === 'rtl');
  p.run('closeExistingNotice()');
  check('notice: closes and clears', p.run('_existingNotice') === false
    && p.el('existing-notice-overlay').style.display === 'none');
  check('notice: the decision is stored', p.sandbox.persisted >= 1);
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  p.setActive('home');
  p.run('existingNoticeReview()');
  check('review: opens the expenses step', p.active() === 'step2');
  check('review: shows the migrated number', p.el('inp-existing').value === '150.123');
  fillStep2(p);
  p.el('inp-existing').value = '0';
  p.run('s2Next()');
  check('review: setting zero returns home with zero', p.active() === 'home' && p.run('profile.existing') === '0');
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState('plansModel:1,')})`);
  check('no second migration once on plans', p.run('profile.existing') === '17' && p.run('_existingNotice') === false);
  check('a saved notice stays pending', (p.run(`applyLoadedState(${oldState('plansModel:1,existingNotice:true,')})`), p.run('_existingNotice') === true));
}
{
  const p = newPage();
  p.run(`applyLoadedState({profile:{salary:'1',existing:'0'},saved:[],form:{}})`);
  check('old state with no loans: no notice', p.run('_existingNotice') === false && p.run('profile.existing') === '0');
  p.run(`currency='IDR';profile.existing='0';applyLoadedState({currency:'IDR',saved:[${plan('active', 1500.75)}],form:{}})`);
  check('migration rounds to the currency', p.run('profile.existing') === '1501');
  p.run(`applyLoadedState({lang:'en',profile:{salary:'1'}})`);
  check('state without a list is left alone', p.run('saved.length') >= 0);
}
{
  const p = newPage();
  p.run(`_demo=true;applyLoadedState(${oldState()})`);
  check('demo: old stored demo starts at zero', p.run('profile.existing') === '0');
  check('demo: never shows the notice', p.run('_existingNotice') === false);
  p.run(`var _b=buildDemoBundle({lang:'en',currentTheme:'light'});`);
  check('demo: new bundle has no real payments', p.run('_b.profile.existing') === '0');
  check('demo: plans are measured alone', p.run('_b.saved.every(s=>s.results.existing===0)') === true);
  check('demo: bundle is on the plans model', p.run('_b.plansModel') === 1);
  check('demo: bundle keeps two plans', p.run('_b.saved.length') === 2);
  p.run(`_demo=false;myLoans=[${plan('active', 500)}];var _c=buildDemoBundle({lang:'en',currentTheme:'light'});`);
  check('demo: real loans never reach the sample numbers', p.run('_c.saved.every(s=>s.results.existing===0)') === true);
  check('demo: building it leaves the real loans in place', p.run('myLoans.length') === 1);
}
check('backup restore runs the same migration', /sanitizeSaved\(s\.saved\);\s*myLoans=sanitizeSaved\(s\.myLoans\);\s*if\(s\.form[^\n]*\n\s*migrateToPlans\(s\)/.test(html));
check('backups record the plans model', /saved, myLoans, form,\s*plansModel:PLANS_MODEL/.test(html));
check('saved state records the plans model', /form,\s*plansModel:PLANS_MODEL,\s*existingNotice:_existingNotice/.test(html));
check('storage key is unchanged', /const STORAGE_KEY='sla_v1'/.test(html));
check('the reschedule tab is hidden', /id="tab-restructure" style="display:none"/.test(html));
check('no activate-scenario code remains', !/activateScenario|confirmActivate/.test(html));
check('no "replaces" banner remains', !/scenario-replace-banner|_replacedLoan/.test(html));
check('the save button says plan', ["saveScenario:'Save as plan'", "saveScenario:'حفظ كخطة'", "saveScenario:'Guardar como plan'"].every((x) => html.includes(x)));
check('the hint is in all languages', ['أقساط قروض تدفعها حاليا فقط', 'Only loans you are paying now', 'Solo préstamos que pagas ahora'].every((x) => html.includes(x)));

// ── Money shows the decimals of its currency ───────────────────────────────
console.log('\nCurrency decimals');
{
  const p = newPage();
  const pay = (cur, n) => { p.run(`currency='${cur}'`); return p.run(`fmtPay(${n})`); };
  const amt = (cur, n) => { p.run(`currency='${cur}'`); return p.run(`fmtAmt(${n})`); };
  check('OMR installment keeps three decimals', pay('OMR', 156.5287) === '156.529 ر.ع');
  check('KWD and BHD too', pay('KWD', 1.2345).startsWith('1.235') && pay('BHD', 1.2345).startsWith('1.235'));
  check('a whole installment has no zeros', pay('OMR', 157) === '157 ر.ع');
  check('USD installment has two', pay('USD', 156.5287) === '$ 156.53');
  check('IDR installment has none', pay('IDR', 156.6) === '157 Rp');
  check('no currency has two', pay('NONE', 12.256) === '12.26');
  check('other amounts round to two', amt('OMR', 100.2253) === '100.23 ر.ع');
  check('a whole amount has no zeros', amt('OMR', 100) === '100 ر.ع');
  check('a whole amount with thousands', amt('USD', 1234567) === '$ 1,234,567');
  check('IDR amounts stay whole', amt('IDR', 100.6) === '101 Rp');
  check('percentages round to two', p.run('fmtPct(7.8866)') === '7.89%');
  check('a whole percentage has no zeros', p.run('fmtPct(22)') === '22%');
  p.run(`currency='OMR'`);
  check('the range card uses two decimals', p.run('fmtRangeDec(154.964,158.094)').startsWith('154.96 – 158.09'));
  // salary 3000, limit 40% -> room of 1200 when existing is 2200-1000 below
  p.run(`profile.existing='1099.8'`); // room = 100.2
  check('OMR: 0.4 over the limit is over the limit', p.run('planWithinBankLimit(100.6)') === false);
  check('OMR: a difference too small to show is within', p.run('planWithinBankLimit(100.2004)') === true);
  p.run(`currency='IDR'`);
  check('IDR: under half a unit still rounds to within', p.run('planWithinBankLimit(100.6)') === true);
}
for (const [needle, label] of [
  ['val:fmtPay(r.monthly)', 'report KPI'], ['<span class="saved-mini-amt">${fmtPay(s.results.monthly)}', 'plan row'],
  ['fmt:v=>fmtPayNum(v)', 'compare row'], ['${fmtPay(reqPay)}', 'bank-limit sentence'],
  ['· ${fmtPay(monthly)}/', 'schedule summary'], ['val:fmtPay(c.monthly)', 'simulator KPI'],
]) check(`installment decimals in: ${label}`, html.includes(needle));
for (const [needle, label] of [
  ['val:fmtAmt(r.total)', 'total cost'], ['val:fmtAmt(r.interest)', 'total interest'], ['${fmtAmt(maxPayAvail)}', 'allowed limit'],
  ['fmtAmt(existingPmt)', 'existing payments tile'], ['fmtAmt(r.existing)', 'existing payments row'],
]) check(`two decimals at most in: ${label}`, html.includes(needle));
check('the old fixed-decimals formatter is gone', !html.includes('fmtAmtDec'));
check('no percentage keeps forced zeros', !/toFixed\(2\)\+'%'|toFixed\(2\)\}%/.test(html));

// ── Simulator ──────────────────────────────────────────────────────────────
console.log('\nSimulator');
{
  const p = newPage();
  const bounds = (a) => JSON.parse(p.run(`JSON.stringify(simAmountBounds(${a}))`));
  for (const a of [4500000, 500000, 8000.5, 500, 1, 1234567890]) {
    const b = bounds(a);
    check(`range holds ${a}`, b.min <= a && a <= b.max && b.step > 0 && b.min > 0);
  }
  const big = bounds(4500000);
  check('range runs from about a quarter to double', big.min === 1100000 && big.max === 9000000);
  check('steps are round numbers', ['1', '2', '5'].includes(String(big.step)[0]) && /^.0+$/.test(String(big.step)));

  const open = (amount, period, rate) => {
    p.run(`form.amount='${amount}';form.period='${period}';form.rate='${rate}';syncSimToForm();simUpdate()`);
  };
  open('4500000', '240', '8.5');
  check('a big loan is not capped', p.run('_sim.amt') === 4500000);
  check('the slider moves to the loan', p.el('sim-range-amt').value === 4500000 && p.el('sim-range-amt').max === 9000000);
  p.run(`currency='OMR'`);
  open('8000.5', '60', '6.555');
  const shown = p.el('sim-kpi').innerHTML;
  const exact = p.run(`fmtPay(calcLoan(8000.5,0.06555,60).monthly)`);
  check('simulator opens on the exact report payment', shown.includes(`>${exact}<`));
  check('the exact amount survives the slider step', p.run('_sim.amt') === 8000.5);
  check('the exact rate survives the slider step', p.run('_sim.rate') === 6.555);
  p.run(`simSlide('amt','9000')`);
  check('dragging changes the amount', p.run('_sim.amt') === 9000);
  p.run(`currency='USD'`);
  open('1000', '36', '8.5');
  p.el('manual-amt').style.display = 'none';
  p.el('manual-inp-amt').value = '';
  p.run(`toggleManual('amt')`);
  check('the manual box opens on the exact value', p.el('manual-inp-amt').value === 1000);
  p.el('manual-inp-amt').value = '7000000';
  p.run(`applyManual('amt')`);
  check('typing above the range is never clamped', p.run('_sim.amt') === 7000000);
  check('the slider widens up to it', +p.el('sim-range-amt').max === 7000000);
  p.el('manual-inp-amt').value = '3';
  p.run(`applyManual('amt')`);
  check('typing below the range widens it too', p.run('_sim.amt') === 3 && +p.el('sim-range-amt').min === 3);
  p.el('manual-inp-per').value = '999';
  p.el('per-unit').value = 'months';
  p.run(`applyManual('per')`);
  check('the period stays within 360 months', p.run('_sim.per') === 360);
}
check('no fixed 500,000 clamp remains', !/Math\.min\(500000/.test(html));
for (const word of ["'اكتب'", "'Escribir'", "'Type'"]) check(`edit button says ${word}`, html.includes(word));
check('edit buttons get an icon and a name', /b\.innerHTML=PENCIL_ICON/.test(html) && /b\.setAttribute\('aria-label'/.test(html));

// ── Report details ─────────────────────────────────────────────────────────
console.log('\nReport details');
check('the percent ring shows a whole number that fits it', html.includes('${Math.round(remPct)}%</span>'));
check('no invalid color like var(--x)40 is built', !/\$\{[a-zA-Z_]+\}[0-9a-fA-F]{2}[;"' )]/.test(html));
check('the Arabic question mark is Arabic only', html.includes(`\${lang==='ar'?'؟':'?'}</span>`));
check('the last payment is start + N-1 in report and PDF',
  (html.match(/endDate\.setMonth\(endDate\.getMonth\(\)\+months-1\)/g) || []).length === 2
  && !/endDate\.getMonth\(\)\+months\)/.test(html));
for (const label of ["'آخر قسط'", "'Última cuota'", "'Last payment'"]) {
  check(`the row is named ${label} in report and PDF`, html.split(label).length - 1 >= 2);
}
{
  const p = newPage();
  p.run(`form.startMonth=9;form.startYear=2026;var e=getStartDate();e.setMonth(e.getMonth()+60-1);`);
  check('60 months from Oct 2026 ends in Sep 2031', p.run('e.getMonth()') === 8 && p.run('e.getFullYear()') === 2031);
}
check('compare header clears the status bar', /padding:calc\(18px \+ var\(--safe-top\)\) 20px 0;flex-shrink:0">\s*<button class="back-btn" onclick="goHome\(\)" id="compare-back"/.test(html));
check('compare body clears the home bar', /id="compare-body"[^>]*padding-bottom:calc\(30px \+ var\(--safe-bottom\)\)/.test(html));

// ── What's new card ────────────────────────────────────────────────────────
console.log("\nWhat's new card");
{
  const p = newPage();
  const first = (t) => p.run(`firstSentence(${JSON.stringify(t)})`);
  check('English body is the first sentence', first('One thing. Two things.\n\nThree.') === 'One thing.');
  check('Arabic body is the first sentence', first('جملة أولى. جملة ثانية.') === 'جملة أولى.');
  check('a decimal number does not end the sentence', first('Costs 1.5 more. Later.') === 'Costs 1.5 more.');
  check('no period keeps the whole line', first('Just a line') === 'Just a line');
}
check('the body is no longer the title', html.includes('firstSentence(guidePick(feat.body))') && !html.includes("guide-whatsnew-body').textContent=formatGuideText(guidePick(feat.title))"));
check('the brand is isolated in the Arabic title', html.includes('جديد في \\u2068emiGo\\u2069:'));
check('the card is RTL in Arabic', /el\.dir=lang==='ar'\?'rtl':'ltr';\s*document\.getElementById\('guide-whatsnew-title'\)/.test(html));
check('the card hides when leaving home', /function showScreen\(id\)\{[\s\S]{0,200}?id!=='home'[\s\S]{0,120}?guide-whatsnew/.test(html));
check('Arabic hamza spelling is fixed', !/ارقاما|بايقونة/.test(html));

// ── Service worker: the real file, run against a fake network ──────────────
console.log('\nService worker');
function loadWorker(fetchImpl) {
  const listeners = {};
  const store = new Map();
  const key = (k) => (typeof k === 'string' ? k : k.url);
  const sandbox = {
    self: { addEventListener: (type, fn) => { listeners[type] = fn; }, location: { origin: 'https://emigo.test' }, clients: { claim() {} } },
    caches: {
      match: async (k) => store.get(key(k)),
      open: async () => ({ put: async (k, v) => { store.set(key(k), v); }, addAll: async () => {} }),
      keys: async () => [], delete: async () => true,
    },
    fetch: fetchImpl, URL, Response: { error: () => ({ isNetworkError: true }) }, console,
  };
  vm.runInNewContext(sw, sandbox);
  const request = async (url, mode = 'cors') => {
    let answer;
    listeners.fetch({ request: { method: 'GET', url, mode }, respondWith: (p) => { answer = p; } });
    const res = await answer;
    await new Promise((r) => setTimeout(r, 0));
    return res;
  };
  return { request, store };
}
const sw = readFileSync(join(here, '..', 'service-worker.js'), 'utf8');
const response = (ok, type) => ({ ok, type, clone() { return this; } });
{
  const w = loadWorker(async () => response(true, 'basic'));
  await w.request('https://emigo.test/a.png');
  check('a good response is cached', w.store.has('https://emigo.test/a.png'));
}
{
  const w = loadWorker(async () => response(false, 'basic'));
  const res = await w.request('https://emigo.test/missing.png');
  check('a 404 is returned but never cached', res.ok === false && w.store.size === 0);
}
{
  const w = loadWorker(async () => response(true, 'opaque'));
  await w.request('https://emigo.test/x.png');
  check('an opaque response is never cached', w.store.size === 0);
}
{
  const offline = async () => { throw new Error('offline'); };
  const w = loadWorker(offline);
  w.store.set('./index.html', 'THE APP');
  check('offline navigation falls back to the app', (await w.request('https://emigo.test/', 'navigate')) === 'THE APP');
  check('an offline image does not get the app as its content',
    (await w.request('https://emigo.test/a.png', 'no-cors')).isNetworkError === true);
}
check('the cache name changed so clients refresh', sw.includes("const CACHE = 'smartloan-1.3e'"));
check('the first visit does not reload the page', /var hadController = !!navigator\.serviceWorker\.controller/.test(html)
  && /if \(!hadController\) \{ hadController = true; return; \}/.test(html));

// ── Confirmation sheet ─────────────────────────────────────────────────────
console.log('\nConfirmation sheet');
check('no native browser dialog remains', !/(?<![A-Za-z_.])(confirm|alert|prompt)\(/.test(html));
{
  const p = newPage();
  p.run(`saved=[${plan('active', 600)},${plan('active', 300)}];lang='ar'`);
  p.run('confirmDeleteLoan(0)');
  check('nothing is deleted before the answer', p.run('saved.length') === 2);
  check('the sheet opens', p.el('confirm-sheet').style.display === 'flex');
  check('the sheet is RTL in Arabic', p.el('confirm-sheet').dir === 'rtl');
  check('the sheet names the plan', p.el('confirm-sheet-body').textContent.startsWith('p600'));
  check('delete uses the danger color', p.el('confirm-sheet-ok').style.background === 'var(--risk)');
  check('cancel has a default label', p.el('confirm-sheet-cancel').textContent === 'إلغاء');
  p.run('closeConfirmSheet(false)');
  await settle();
  check('cancel keeps the plan', p.run('saved.length') === 2);
  check('cancel closes the sheet', p.el('confirm-sheet').style.display === 'none');
  p.run('confirmDeleteLoan(1)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('confirm deletes the right plan', p.run('saved.length') === 1 && p.run('saved[0].loanMonthly') === 600);
  check('the deletion is stored', p.sandbox.persisted >= 1);
}
{
  const p = newPage();
  p.run(`var _a='?',_b='?';confirmSheet({title:'A',okLabel:'x'}).then(v=>{_a=v});confirmSheet({title:'B',okLabel:'y'}).then(v=>{_b=v});`);
  await settle();
  check('a second sheet answers the first with no', p.run('_a') === false);
  check('a sheet without a body hides it', (p.run('closeConfirmSheet(true)'), p.el('confirm-sheet-body').style.display === 'none'));
  await settle();
  check('the second sheet gets the real answer', p.run('_b') === true);
  p.run(`closeConfirmSheet(true)`);
  check('closing with nothing open is harmless', true);
}
check('restore asks first', /const ok=await confirmSheet\(\{\s*title:isAr\?'استعادة البيانات؟'/.test(html));
check('demo without a screen lock asks first', /const ok=await confirmSheet\(\{\s*title:isAr\?'هذا الهاتف بلا قفل شاشة'/.test(html));
check('leaving demo asks first', /const ok=await confirmSheet\(\{\s*title:isAr\?'العودة إلى ملفك؟'/.test(html));
check('a tap outside the sheet cancels', /id="confirm-sheet" onclick="if\(event\.target===this\)closeConfirmSheet\(false\)"/.test(html));
check('the guide stays away from an open sheet', html.includes("'confirm-sheet','guide-sheet'].some(isOverlayOpen)"));

// ── Android back button ────────────────────────────────────────────────────
console.log('\nAndroid back button');
function nativePage(active) {
  const p = newPage();
  p.setActive(active);
  p.sandbox.window.Capacitor = { Plugins: { App: { exitApp() { p.sandbox.exits = (p.sandbox.exits || 0) + 1; } } } };
  return p;
}
for (const [screen, arrow] of [['step1', 's1-back'], ['step2', 's2-back'], ['step3', 's3-back'], ['results-screen', 'res-back'],
  ['settings-screen', 'settings-back-btn'], ['compare-screen', 'compare-back'], ['saved-detail', 'detail-back']]) {
  const p = nativePage(screen);
  p.run('handleBackButton()');
  check(`${screen} uses its own back arrow`, p.el(arrow).clicks === 1 && !p.sandbox.exits);
  check(`${arrow} exists on the page`, html.includes(`id="${arrow}"`));
}
for (const screen of ['home', 'splash']) {
  const p = nativePage(screen);
  p.run('handleBackButton()');
  check(`${screen} leaves the app`, p.sandbox.exits === 1);
}
for (const [layer, call] of [['guide-sheet', 'guide-sheet'], ['bankpay-overlay', 'bankpay'], ['risk-info-overlay', 'risk'],
  ['premium-overlay', 'premium'], ['export-sheet', 'export'], ['guide-welcome', 'skip-tour'], ['guide-tour-card', 'skip-tour'],
  ['guide-nudge', 'nudge'], ['guide-whatsnew', 'whatsnew']]) {
  const p = nativePage('home');
  p.el(layer).style.display = 'block';
  p.run('handleBackButton()');
  check(`${layer} closes first and the app stays`, p.sandbox.calls.includes(call) && !p.sandbox.exits);
}
{
  const p = nativePage('results-screen');
  p.run(`saved=[${plan('active', 1)},${plan('active', 2)},${plan('active', 3)},${plan('active', 4)}];showSavedLimitSheet()`);
  p.run('handleBackButton()');
  check('the limit sheet closes first', p.el('limit-overlay').style.display === 'none' && p.el('res-back').clicks === 0);
}
{
  const p = nativePage('home');
  p.el('risk-info-overlay').style.display = 'flex';
  p.run(`var _r='?';confirmSheet({title:'x',okLabel:'y'}).then(v=>{_r=v})`);
  p.run('handleBackButton()');
  await settle();
  check('the confirmation is on top and means no', p.run('_r') === false && p.sandbox.calls.length === 0);
}
{
  const p = nativePage('home');
  p.el('existing-notice-overlay').style.display = 'flex';
  p.run('handleBackButton()');
  check('the migration notice waits for a decision', p.el('existing-notice-overlay').style.display === 'flex' && !p.sandbox.exits);
}
{
  const p = nativePage('home');
  p.el('lang-dd-menu').classList.add('open');
  p.run('handleBackButton()');
  check('an open language menu closes first', p.sandbox.calls.includes('lang-menu') && !p.sandbox.exits);
}
{
  const p = newPage();
  p.run('registerBackButton()');
  check('the web has no Capacitor and stays quiet', true);
  const seen = [];
  p.sandbox.window.Capacitor = { Plugins: { App: { addListener: (e, f) => seen.push([e, f]) } } };
  p.run('registerBackButton()');
  check('the Android app registers the listener', seen.length === 1 && seen[0][0] === 'backButton');
  p.sandbox.window.Capacitor = { Plugins: {} };
  p.run('registerBackButton()');
  check('a missing plugin does not crash', seen.length === 1);
}
check('the listener is registered at startup', /function initApp\(\)\{\s*registerBackButton\(\);/.test(html));
{
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  check('the App plugin ships with the Android build', pkg.dependencies['@capacitor/app'] === '6.0.3');
}

// ── Header ─────────────────────────────────────────────────────────────────
console.log('\nHeader');
check('home shows emiGo in every language', html.includes('id="home-app-name">emiGo</span>')
  && !/home-app-name'\)\.textContent=/.test(html));
check('the tagline is still translated', html.includes("document.getElementById('home-tagline').textContent=tc.appTagline"));
check('the PDF keeps the translated app name', html.includes('<h1>${tc.appName}</h1>'));

// ── Report layout and readable sizes ───────────────────────────────────────
console.log('\nLayout');
{
  const start = html.indexOf('id="tc-report"');
  const order = ['id="kpi-grid"', 'id="banklimit-card"', 'id="lbl-basis"', 'id="bankpay-card"', 'id="bankcmp-card"', 'id="btn-save"', 'id="btn-go-home"', 'id="btn-restart"']
    .map((id) => html.indexOf(id, start));
  check('report follows the agreed order', order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])));
}
check('the bank estimate is one compact row', html.includes('${tc.bpWhyShort}') && !html.includes('bpStatusT'));
check('"Why?" exists in every language', ["bpWhyShort:'لماذا؟'", "bpWhyShort:'Why?'", "bpWhyShort:'¿Por qué?'"].every((x) => html.includes(x)));
check('compare with a bank offer starts collapsed', html.includes(`<details class="bankcmp"\${_bankOffer?' open':''}>`));
{
  const pdfStart = html.indexOf('function exportPDF(){');
  const pdfEnd = html.indexOf('function restart(){');
  const appOnly = html.slice(0, pdfStart) + html.slice(pdfEnd);
  check('no app text is under 12px', !/font-size:(?:[0-9]|1[01])(?:\.\d+)?px/.test(appOnly));
}
check('plan rows are easy to tap', /\.plan-row\{width:100%;min-height:60px/.test(html));
check('plan actions come after the report details', html.indexOf('id="bankcmp-card"') < html.indexOf('id="plan-actions"') && html.indexOf('id="plan-actions"') < html.indexOf('id="btn-go-home"'));
check('plan action buttons are at least 44px', /\.plan-act\{min-height:44px/.test(html));

// ── Arabic text and guide ──────────────────────────────────────────────────
console.log('\nArabic text and guide');
check('no Arabic diacritics in the app', !/[\u064B-\u0652\u0670]/.test(html));
check('no Arabic diacritics in update notes', !/[\u064B-\u0652\u0670]/.test(sw));
check('the tour teaches plans', html.includes("title:{en:'Plans, My loans & Demo'") && html.includes('احفظ حتى 4 عروض بنوك لنفس القرض'));
check('the tour teaches My loans', html.includes('فينتقل إلى قروضي ويحسب من ملفك المالي'));
check('the tour mentions the payments you enter', html.includes('وأقساطك الحالية وحد القسط البنكي'));
check('what is new announces plans first', html.indexOf("id:'plans_model'") < html.indexOf("id:'demo_mode'") && html.includes("id:'plans_model'"));

// ── My loans: real loans, chosen on purpose ────────────────────────────────
console.log('\nMy loans');
{
  const p = newPage();
  p.run(`profile.existing='100';saved=[${plan('active', 150, 5000)},${plan('active', 300)}];`);
  check('a saved plan is not a real payment', p.run('realPayments()') === 100);
  p.run('takePlan(0)');
  check('taking asks first', p.el('confirm-sheet').style.display === 'flex' && p.run('myLoans.length') === 0);
  check('the question is explicit', p.el('confirm-sheet-title').textContent === 'Did you really take this loan?');
  p.run('closeConfirmSheet(false)');
  await settle();
  check('cancel changes nothing', p.run('saved.length') === 2 && p.run('myLoans.length') === 0);
  p.run('takePlan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('the plan leaves the four', p.run('saved.length') === 1);
  check('the loan keeps every detail', p.run('myLoans[0].loanAmount') === 5000 && p.run('myLoans[0].form.period') === '12');
  check('the total is the manual number plus the loan', p.run('realPayments()') === 250);
  check('the manual number is not touched', p.run('profile.existing') === '100');
  check('the taking is stored', p.sandbox.persisted >= 1);
  check('new calculations count it', p.run('analyse().existing') === 250);
  check('the bank room counts it', p.run('planWithinBankLimit(951)') === false && p.run('planWithinBankLimit(950)') === true);
  p.run('renderCompare()');
  p.run(`saved=[${plan('active', 600)},${plan('active', 300)}];renderCompare()`);
  check('compare counts it and does not list it', p.el('compare-body').innerHTML.includes('>1,450<'));
  p.run('renderHomeLoans()');
  check('the section appears', p.el('home-loans-section').style.display === 'block');
  check('the section shows the other payments', p.el('home-loans-note').textContent.includes('Other payments: $ 100'));
  check('the loan card shows its payment', p.el('home-loans-list').innerHTML.includes('$ 150'));
  p.run('openSavedDetail(0,true)');
  check('a loan opened from My loans does not count itself', +p.run('results.existing') === 100);
  check('the view knows where it came from', p.run('_viewingMyLoan') === true);
  check('its real profile stays manual', p.run('profile.existing') === '100');
  p.run(`_savedSnap=null;_viewingSavedLoan=false`);
  p.run('openSavedDetail(0)');
  check('a plan opened counts every real payment', +p.run('results.existing') === 250);
  p.run(`_savedSnap=null;_viewingSavedLoan=false`);
  p.run('confirmDeleteMyLoan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('deleting a finished loan lowers the total', p.run('realPayments()') === 100 && p.run('myLoans.length') === 0);
  p.run('renderHomeLoans()');
  check('an empty section hides', p.el('home-loans-section').style.display === 'none');
}
{
  const p = newPage();
  p.run(`saved=[${[1, 2, 3, 4].map((n) => plan('active', n)).join(',')}]`);
  p.run('takePlan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  p.run(`results={monthly:9};form.amount='4321';_lastSaveClick=0`);
  p.run('saveScenario()');
  check('taking frees a place among the four', p.run('saved.length') === 4 && p.run('myLoans.length') === 1);
  p.run(`myLoans=[${Array.from({ length: 9 }, (_, n) => plan('active', n + 1)).join(',')}];saved=[]`);
  check('My loans has no limit', p.run('myLoans.length') === 9 && p.run('hasRoomToSave()') === true);
}
{
  // An old user: the manual number already holds their real loan.
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  check('migration remembers what it counted', p.run('saved[0].countedMonthly') === 100.1234 && p.run('saved[2].countedMonthly') === undefined);
  p.run('takePlan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('taking it does not count it twice', Math.abs(p.run('realPayments()') - 150.1234) < 0.001);
  check('the leftover number is right', p.run('profile.existing') === '50');
  check('the marker does not stay on the loan', p.run('myLoans[0].countedMonthly') === undefined);
  p.run('takePlan(1)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('a scenario was never counted so it adds in full', Math.abs(p.run('realPayments()') - 1149.1234) < 0.001);
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  p.run(`profile.existing='0'`);
  p.run('takePlan(0)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('a zeroed number never goes negative', p.run('profile.existing') === '0');
}
{
  const p = newPage();
  p.run(`applyLoadedState({plansModel:1,saved:[],form:{},myLoans:[${plan('active', 70)}]})`);
  check('saved loans come back on load', p.run('myLoans.length') === 1);
  p.run(`applyLoadedState({plansModel:1,saved:[],form:{}})`);
  check('a file without the section loads empty', p.run('myLoans.length') === 0);
  p.run(`applyLoadedState({plansModel:1,saved:[],form:{},myLoans:'bad'})`);
  check('a damaged section is ignored', p.run('myLoans.length') === 0);
}
check('the short line stays visible', html.includes('للمقارنة فقط، ليست قروضا حقيقية'));
check('the open list explains the plans', html.includes('احفظ عروض البنوك لنفس القرض وقارن بينها. ولا تخصم من ملفك المالي.'));
check('backups include My loans', /saved, myLoans, form,/.test(html));
check('saved state includes My loans', /saved,\s*myLoans,\s*form,/.test(html));
check('restore puts My loans back on failure', /\(\{currency,profileSaved,saved,myLoans\}=snap\)/.test(html));
check('leaving demo clears My loans first', /saved=\[\];\s*myLoans=\[\];/.test(html));
check('a plan edit keeps what migration counted', html.includes('if(old.countedMonthly) plan.countedMonthly=old.countedMonthly;'));

// ── Compare: no winner, the trade-off in the user's numbers ────────────────
console.log('\nCompare');
const offer = (monthly, interest, { amount = 10000, period = 60, rate = 5, label = '' } = {}) =>
  `{loanType:'car',loanAmount:${amount},loanMonthly:${monthly},name:'Car',${label ? `label:${JSON.stringify(label)},` : ''}
    results:{monthly:${monthly},interest:${interest},total:${amount + interest}},
    form:{amount:'${amount}',period:'${period}',rate:'${rate}',loanType:'car'}}`;
const greens = (body) => (body.match(/color:var\(--safe\)/g) || []).length;
const rowOf = (body, name) => body.slice(body.indexOf(`>${name}</td>`), body.indexOf('</tr>', body.indexOf(`>${name}</td>`)));
check('the word best is gone', !html.includes('الأفضل بأقل قسط') && !html.includes('Best by Lowest'));
{
  // The same loan over 9, 8 and 5 years.
  const p = newPage();
  p.run(`profile.salary='5000';saved=[${offer(126.6, 2153.52, { period: 96 })},${offer(188.71, 1322.74)},${offer(115.17, 2438.66, { period: 108 })}]`);
  p.run('var _v=comparePlans(saved)');
  check('same amount shows a trade-off', p.run('_v.kind') === 'tradeoff');
  check('the lowest payment is the 9 years plan', p.run('_v.lowPay.results.monthly') === 115.17);
  check('the least interest is the 5 years plan', p.run('_v.lowCost.results.monthly') === 188.71);
  check('the monthly saving is right', Math.abs(p.run('_v.payGap') - 73.54) < 1e-9);
  check('the extra interest is right', Math.abs(p.run('_v.costGap') - 1115.92) < 1e-9);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('the card states both sides', body.includes('Lowest payment') && body.includes('Least interest'));
  check('the card gives the numbers', body.includes('$ 73.54') && body.includes('$ 1,115.92'));
  check('the card leaves the choice to the user', body.includes('It is your call'));
  p.run(`saved=[${offer(188.71, 1322.745)},${offer(115.17, 2438.664, { period: 108 })}]`);
  check('the gap is the difference of the shown numbers', p.run(`fmtAmt(comparePlans(saved).costGap)`) === p.run(`fmtAmt(+numText(saved[1].results.interest,2).replace(/,/g,'')-+numText(saved[0].results.interest,2).replace(/,/g,''))`));
  check('the table shows the term', body.includes('>8 years<') && body.includes('>5 years<'));
  check('the table shows the amount', rowOf(body, 'Amount').includes('10,000'));
  check('a row where all plans match has no winner', !rowOf(body, 'Amount').includes('--safe') && !rowOf(body, 'Rate').includes('--safe'));
  check('the interest row marks the lowest', rowOf(body, 'Interest').includes('--safe'));
}
{
  const p = newPage();
  p.run(`saved=[${offer(188.71, 1322.74)},${offer(208.23, 496.22, { amount: 7000, period: 36, rate: 4.5 })}]`);
  check('different amounts have no cheapest', p.run('comparePlans(saved).kind') === 'mixed');
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('the notice explains why', body.includes('Different amounts') && body.includes('not which is cheaper'));
  check('no winner on interest across amounts', !rowOf(body, 'Interest').includes('--safe'));
  check('no winner on cost across amounts', !rowOf(body, 'Total').includes('--safe'));
  check('the budget rows still mark the lightest', rowOf(body, 'Monthly').includes('--safe'));
  check('no trade-off card across amounts', !body.includes('Lowest payment'));
}
{
  const p = newPage();
  p.run(`saved=[${offer(190, 1400, { rate: 5.2 })},${offer(188.71, 1322.74, { label: 'Bank B' })}]`);
  check('lowest on both is the cheapest', p.run('comparePlans(saved).kind') === 'cheapest');
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('it says cheapest and never best', body.includes('The cheapest') && !/\bbest\b/i.test(body));
  check('it gives the saving', body.includes('$ 77.26'));
  p.run(`saved=[${offer(188.71, 1322.74)},${offer(188.712, 1322.741, { label: 'Other' })}]`);
  check('plans equal after rounding are equal', p.run('comparePlans(saved).kind') === 'equal');
  p.run('renderCompare()');
  check('equal plans say so', p.el('compare-body').innerHTML.includes('same payment and interest'));
  check('a row of equal values marks no winner', !rowOf(p.el('compare-body').innerHTML, 'Monthly').includes('--safe'));
  p.run(`saved=[${offer(120, 2400)},${offer(120, 2000, { rate: 4 })}]`);
  check('a tie on payment goes to the least interest', p.run('comparePlans(saved).kind') === 'cheapest' && p.run('comparePlans(saved).plan.results.interest') === 2000);
}
{
  const p = newPage();
  p.run(`profile.bankLimit='10';saved=[${offer(115, 2400)},${offer(700, 1300, { label: 'Short' })}]`);
  p.run('renderCompare()');
  check('the card warns when the least interest is over the bank limit', p.el('compare-body').innerHTML.includes('Short: exceeds the bank limit'));
  p.run(`profile.bankLimit='60'`);
  p.run('renderCompare()');
  check('no warning when it fits', !p.el('compare-body').innerHTML.includes('exceeds the bank limit'));
}
{
  const p = newPage();
  p.run(`saved=[${offer(100, 900, { label: 'Bank <b>' })},${offer(90, 1000, { label: 'Bank B' })}]`);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('a plan name heads its column', body.includes('Bank B'));
  check('a plan name cannot inject markup', body.includes('Bank &lt;b&gt;') && !body.includes('Bank <b>'));
}
{
  const p = newPage();
  p.run(`var _d=buildDemoBundle({lang:'ar',currentTheme:'light'});saved=_d.saved;currency='USD'`);
  check('demo shows offers for one loan', p.run('comparePlans(saved).kind') === 'tradeoff');
  check('demo plans have names', p.run('saved[0].label') === 'عرض البنك أ');
}

// ── Plan names ─────────────────────────────────────────────────────────────
console.log('\nPlan names');
{
  const p = newPage();
  p.run(`results={monthly:9};form.amount='4321';_lastSaveClick=0`);
  p.el('inp-plan-label').value = '  Bank A  ';
  p.run('saveScenario()');
  check('a name is saved trimmed', p.run('saved[0].label') === 'Bank A');
  check('the field clears after saving', p.el('inp-plan-label').value === '');
  p.el('inp-plan-label').value = 'Bank B';
  p.run(`_lastSaveClick=0;saveScenario()`);
  check('same numbers from another bank are allowed', p.run('saved.length') === 2);
  p.el('inp-plan-label').value = 'Bank B';
  p.run(`_lastSaveClick=0;saveScenario()`);
  check('the same name and numbers are a duplicate', p.run('saved.length') === 2);
  p.el('inp-plan-label').value = '';
  p.run(`_lastSaveClick=0;saveScenario()`);
  check('a plan without a name has no label', p.run('saved.length') === 3 && p.run(`'label' in saved[0]`) === false);
  check('a name replaces the type in the title', p.run('planTitle(saved[1])') === 'Bank B');
  check('no name falls back to the type', p.run('planTitle(saved[0])') === 'Personal');
  p.run('editSavedLoan(1)');
  check('editing fills in the name', p.el('inp-plan-label').value === 'Bank B');
  p.el('inp-plan-label').value = 'Bank C';
  p.run(`_lastSaveClick=0;saveScenario()`);
  check('editing renames in place', p.run('saved[1].label') === 'Bank C' && p.run('saved.length') === 3);
  p.el('inp-plan-label').value = 'left over';
  p.run('startForm()');
  check('a new loan starts with an empty name', p.el('inp-plan-label').value === '');
}
{
  const p = newPage();
  p.run(`var _s=sanitizeSaved([${offer(1, 1, { label: 'x'.repeat(40) })},Object.assign(${offer(2, 1)},{label:5}),Object.assign(${offer(3, 1)},{label:'   '})])`);
  check('a long name is cut on load', p.run('_s[0].label.length') === 24);
  check('a damaged name is dropped', p.run(`'label' in _s[1]`) === false);
  check('a blank name is dropped', p.run(`'label' in _s[2]`) === false);
}

// ── Compact rows and the actions inside a plan ─────────────────────────────
console.log('\nPlan rows and actions');
{
  const home = extractFunction('renderHomeSaved') + extractFunction('renderHomeLoans') + extractFunction('planRow');
  check('home has no action buttons', !/takePlan|confirmDelete|editSavedLoan/.test(home));
  const p = newPage();
  p.run(`saved=[${offer(100, 900)},${offer(90, 1000, { label: 'Bank B' })}];myLoans=[${offer(80, 700)}]`);
  const row = p.run('planRow(saved[1],1,false)');
  check('a row opens its own plan', row.includes('openSavedDetail(1)'));
  check('a row shows the payment', row.includes('$ 90'));
  check('a long name can never hide the amount', row.includes('$ 10,000') && row.indexOf('$ 10,000') > row.indexOf('plan-row-sub'));
  check('a row shows the bank limit', row.includes('Within limit'));
  const loan = p.run('planRow(myLoans[0],0,true)');
  check('a loan row opens from My loans', loan.includes('openSavedDetail(0,true)'));
  check('a loan row shows its last payment', loan.includes('Last payment'));
  check('a loan row has no bank limit flag', !loan.includes('limit'));
  p.run('openSavedDetail(1)');
  p.run('applyResultsActions()');
  check('a plan shows its actions', p.el('plan-actions').classList.contains('on'));
  check('a plan can be taken and edited', p.el('btn-take-plan').style.display === '' && p.el('btn-edit-plan').style.display === '');
  check('the name field hides inside a plan', p.el('plan-label-box').style.display === 'none');
  check('the title names the plan', p.el('res-title').textContent === 'Bank B');
  p.run('leaveDetailBeforeChange()');
  check('leaving clears the view', p.run('_viewingSavedLoan') === false);
  p.run('applyResultsActions()');
  check('a new report has no plan actions', !p.el('plan-actions').classList.contains('on'));
  check('a new report offers the name field', p.el('plan-label-box').style.display === 'block');
  p.run('openSavedDetail(0,true)');
  p.run('applyResultsActions()');
  check('a real loan cannot be taken or edited', p.el('btn-take-plan').style.display === 'none' && p.el('btn-edit-plan').style.display === 'none');
  check('a real loan keeps delete', p.el('plan-actions').classList.contains('mine'));
}
{
  // Actions run from the detail view, which holds a temporary profile.
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  const realForm = p.run('JSON.stringify(form)');
  p.run('openSavedDetail(0)');
  p.run('takePlan(_viewingSavedIdx)');
  check('taking from a plan still asks first', p.run('saved.length') === 3 && p.run('_viewingSavedLoan') === true);
  p.run('closeConfirmSheet(false)');
  await settle();
  check('cancel stays on the plan', p.run('_viewingSavedLoan') === true && p.run('saved.length') === 3);
  p.run('takePlan(_viewingSavedIdx)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('taking leaves the plan view', p.run('_viewingSavedLoan') === false && p.run('_savedSnap') === null);
  check('taking moves it', p.run('myLoans.length') === 1 && p.run('saved.length') === 2);
  check('taking lowers the real number once', p.run('profile.existing') === '50');
  check('the real profile survives', p.run('profile.salary') === '3000' && p.run('profile.bankLimit') === '40');
  check('the form is the real form again', p.run('JSON.stringify(form)') === realForm);
}
{
  const p = newPage();
  p.run(`saved=[${offer(100, 900)},${offer(90, 1000)}];myLoans=[${offer(80, 700)}]`);
  p.run('openSavedDetail(1)');
  p.run('deleteViewedPlan()');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('delete removes the viewed plan', p.run('saved.length') === 1 && p.run('saved[0].results.monthly') === 100);
  check('delete leaves the view', p.run('_viewingSavedLoan') === false);
  p.run('openSavedDetail(0,true)');
  p.run('deleteViewedPlan()');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('delete removes the viewed loan and no plan', p.run('myLoans.length') === 0 && p.run('saved.length') === 1);
  p.run(`saved=[${offer(100, 900, { amount: 5000, label: 'Bank A' })}];profile.existing='30'`);
  p.run('openSavedDetail(0)');
  p.run('editViewedPlan()');
  check('edit leaves the view', p.run('_viewingSavedLoan') === false);
  check('edit loads the plan', p.run('_editingLoanIdx') === 0 && p.run('form.amount') === '5000');
  check('edit keeps the real number', p.run('profile.existing') === '30');
  check('edit opens the form', p.active() === 'step3');
}

// ── Home sections open and close ───────────────────────────────────────────
console.log('\nHome sections');
{
  const p = newPage();
  const store = {};
  p.sandbox.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  p.run(`saved=[${offer(100, 900)}];myLoans=[${offer(80, 700)}]`);
  p.run('applyHomeOpen()');
  check('both lists start closed', p.el('home-loans-body').hidden === true && p.el('home-plans-body').hidden === true);
  p.run(`toggleHomeSection('loans')`);
  check('a tap opens a list', p.el('home-loans-body').hidden === false && p.el('home-loans-toggle')['aria-expanded'] === 'true');
  check('the other list stays closed', p.el('home-plans-body').hidden === true);
  check('the choice is remembered', JSON.parse(store.emigo_home_open || '{}').loans === true);
  check('it is kept apart from the user data', p.sandbox.persisted === 0);
  check('it comes back on restart', p.run('readHomeOpen().loans') === true && p.run('readHomeOpen().plans') === false);
  p.run(`toggleHomeSection('loans')`);
  check('a second tap closes it', p.el('home-loans-body').hidden === true);
  store.emigo_home_open = 'not json';
  check('a damaged value is ignored', p.run('readHomeOpen().loans') === false);
  p.run(`saved=[]`);
  p.run('applyHomeOpen()');
  check('an empty plans list stays open to explain itself', p.el('home-plans-body').hidden === false);
  check('an empty plans list has nothing to toggle', p.el('home-plans-toggle').disabled === true);
  p.run(`saved=[${offer(100, 900)}];_homeOpen.plans=false;applyHomeOpen()`);
  check('the plans are closed before saving', p.el('home-plans-body').hidden === true);
  p.run(`results={monthly:9};form.amount='4321';_lastSaveClick=0`);
  p.run('saveScenario()');
  check('saving shows the new plan', p.el('home-plans-body').hidden === false);
  p.run(`_homeOpen.loans=false;takePlan(0)`);
  p.run('closeConfirmSheet(true)');
  await settle();
  check('taking shows the new loan', p.el('home-loans-body').hidden === false);
}
check('the hero says calculate', html.includes("'احسب قرضا'") && html.includes("'واحفظه كخطة لتقارن بين العروض'"));
check('no button promises a new loan', !html.includes('+ قرض جديد') && !html.includes('hero-btn'));
check('the guide no longer names a missing button', !html.includes('اضغط ابدأ') && !html.includes('Get Started'));

// ── Bank limit against what is really left ─────────────────────────────────
console.log('\nBank limit and what is left');
check('thin: at the same line as the home ring', extractFunction('thinRemainder').includes('<=15'));
{
  // A tight budget: three real loans and one manual payment.
  const p = newPage();
  p.run(`currency='OMR';profile.salary='2332';profile.expenses='560';profile.variable='550';profile.existing='100';profile.bankLimit='60';
         myLoans=[${offer(225.791, 837.95, { period: 48, rate: 4 })},${offer(139.002, 1676.14, { period: 84, rate: 4.5 })},${offer(731.576, 40462.64, { amount: 100000, period: 192, rate: 4.5 })}]`);
  check('all real payments add up', Math.abs(p.run('realPayments()') - 1196.369) < 1e-9);
  check('the remainder matches home', Math.abs(p.run('remainderAfter(0).remaining') - 25.631) < 1e-9);
  check('15% of income or less is thin', p.run('thinRemainder(1200,8000)') === true && p.run('thinRemainder(1201,8000)') === false);
  check('a deficit is thin', p.run('thinRemainder(-5,8000)') === true);
  check('no income is not thin', p.run('thinRemainder(0,0)') === false);
  p.run('openSavedDetail(0,true)');
  check('a loan does not count itself', Math.abs(p.run('results.existing') - 970.578) < 1e-9);
  check('the same remainder from inside the loan', Math.abs(p.run('results.remaining') - 25.631) < 1e-9);
  p.run('renderBankLimitCard(results)');
  const card = p.el('banklimit-card').innerHTML;
  check('it warns that little is left', card.includes('Within the bank limit, but little is left'));
  check('it shows all payments against the limit', card.includes('1,196.37') && card.includes('1,399.2'));
  check('it shows what is left', card.includes('25.63'));
  check('it is amber, not green', card.includes('--mod') && !card.includes('--safe') && !card.includes('✓'));
  check('a taken loan offers no new borrowing', !card.includes('You can borrow') && !card.includes('Maximum amount'));
  p.run('leaveSavedDetail()');
  const row = p.run(`planRow(${offer(50, 900)},0,false)`);
  check('a plan row warns too', row.includes('Little left') && row.includes('--mod'));
}
{
  const p = newPage();
  p.run(`profile.salary='10000';profile.expenses='500';profile.variable='0';profile.existing='0';profile.bankLimit='40';saved=[${offer(300, 900)}]`);
  p.run('openSavedDetail(0)');
  p.run('renderBankLimitCard(results)');
  const card = p.el('banklimit-card').innerHTML;
  check('plenty left stays green', card.includes('Your installment is within the limit') && card.includes('✓') && !card.includes('--mod'));
  check('a plan still shows the borrowing room', card.includes('You can borrow up to'));
  p.run('leaveSavedDetail()');
  check('a plan row stays plain', p.run(`planRow(saved[0],0,false)`).includes('Within limit'));
}
{
  const p = newPage();
  p.run(`profile.salary='1000';profile.expenses='800';profile.variable='0';profile.existing='0';profile.bankLimit='50';saved=[${offer(400, 900)}]`);
  p.run('openSavedDetail(0)');
  p.run('renderBankLimitCard(results)');
  const card = p.el('banklimit-card').innerHTML;
  check('within the limit with a deficit says so', card.includes('with a monthly deficit') && card.includes('$ 200'));
  p.run('leaveSavedDetail()');
  p.run(`myLoans=[${offer(600, 900)}]`);
  p.run('openSavedDetail(0,true)');
  p.run('renderBankLimitCard(results)');
  const over = p.el('banklimit-card').innerHTML;
  check('a loan over the limit says all payments', over.includes('Your payments exceed the limit'));
  check('a taken loan gets no term advice', !over.includes('extend the repayment') && !over.includes('Reduce it'));
}
check('a taken loan is not called new', html.includes("'قسط هذا القرض'") && html.includes("'أقساطك الأخرى'"));

// ── Defaults ───────────────────────────────────────────────────────────────
console.log('\nDefaults');
check('the default rate is 5%', html.includes('const DEFAULT_RATE=5;'));
check('the slider starts at 5%', html.includes('value="5" id="range-rate"'));
check('the rate box starts at 5%', html.includes('id="form-inp-rate" value="5"'));
check('no 8.5 default is left in the app', !/value="8\.5"|rate:'8\.5'|\?8\.5:|rate:8\.5|placeholder="8\.5"/.test(html));
check('the form starts in years', html.includes('id="form-opt-years" selected'));
check('the period slider starts on the years scale', html.includes('min="1" max="30" step="1" value="3" id="range-period"'));
check('the period box starts at 3 years', html.includes('id="form-inp-per" value="3"'));
check('the app name is larger', /\.home-app-name\{font-size:27px/.test(html));
{
  const p = newPage();
  p.el('form-per-unit').value = 'months';
  p.run('startForm()');
  check('a new loan asks for 5%', p.run('form.rate') === '5');
  check('a new loan keeps 36 months inside', p.run('form.period') === '36');
  check('a new loan is back in years', p.el('form-per-unit').value === 'years');
  check('the box shows 3 years', p.el('form-inp-per').value === 3);
  check('the slider shows 3 years', p.el('range-period').value === 3 && p.el('range-period').max === '30');
  check('an empty rate falls back to 5', p.run(`safeRate('')`) === 5);
  check('a real zero rate stays zero', p.run(`safeRate('0')`) === 0);
  p.run(`var _s=sanitizeSaved([${offer(100, 900, { rate: 3 })},Object.assign(${offer(100, 900)},{results:{monthly:100,interest:900,total:10900,rate:0.085},form:{amount:'10000',period:'60',rate:'',loanType:'car'}})])`);
  check('an old plan keeps the rate it used', p.run('_s[1].form.rate') === '8.5');
  check('a stated rate is left alone', p.run('_s[0].form.rate') === '3');
}

// ── Arabic digits in every number field ────────────────────────────────────
console.log('\nNumber fields');
{
  const p = newPage();
  const clean = (v) => { const e = { value: v }; p.sandbox._f = e; p.run('cleanDigitsField(_f)'); return e.value; };
  check('Arabic digits and mark', clean('٦٫٥') === '6.5');
  check('Arabic comma as decimal', clean('٥،٥') === '5.5');
  check('Latin comma as decimal', clean('5,5') === '5.5');
  check('Persian digits', clean('۱۲') === '12');
  check('Arabic thousands mark dropped', clean('١٢٬٣٤٥') === '12345');
  check('a dot still being typed stays', clean('5.') === '5.');
  check('a second dot is dropped', clean('1.2.3') === '1.23');
  check('letters are dropped', clean('a5b') === '5');
  check('plain digits untouched', clean('4.5') === '4.5');
}
check('number fields clean themselves on every input', /addEventListener\('input',e=>\{\s*if\(e\.target\.matches&&e\.target\.matches\('\[data-digits\]'\)\) cleanDigitsField/.test(html));
for (const id of ['inp-banklimit', 'form-inp-per', 'form-inp-rate', 'manual-inp-amt', 'manual-inp-per', 'manual-inp-rate', 'bank-offer-inp']) {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
  check(`${id} is a clean text field`, tag.includes('type="text"') && tag.includes('data-digits') && tag.includes('inputmode="decimal"'));
}

check('system bars are set again after the splash', /\[300,1200,2200,3200,4500\]\.forEach/.test(html));
check('system bars are set again on return', /visibilitychange[^\n]*\n\s*if\(!document\.hidden\)\{ try\{ applyStatusBar/.test(html));

// ── The compare table on small phones ──────────────────────────────────────
console.log('\nCompare width');
{
  const p = newPage();
  p.run(`saved=[${offer(100, 900)},${offer(90, 1000)}];renderCompare()`);
  const box = p.el('cmp-table');
  box.scrollWidth = 341; box.clientWidth = 320;
  p.run('fitCompareTable()');
  check('a table that does not fit changes layout', box.classList.contains('stacked'));
  box.scrollWidth = 320;
  p.run('fitCompareTable()');
  check('a table that fits stays a table', !box.classList.contains('stacked'));
  check('the table knows its column count', p.el('compare-body').innerHTML.includes('--cols:2'));
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
