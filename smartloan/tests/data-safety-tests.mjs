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
  'planRate', 'planPay', 'planInterest', 'shownPay', 'shownAmt', 'compareFacts', 'fairGrid', 'setCompareTerm', 'cmpWords', 'compareQ1', 'compareQ2', 'moneyText', 'impliedRate',
  'loanEndIndex', 'loanPastEnd', 'isLoanEnded', 'loanNeedsCheck', 'nextLoanEnding', 'lsWords', 'setLoanSheetText',
  'showLoanSheetRow', 'openLoanSheet', 'pickLoanPay', 'readLoanSheetDate', 'updateLoanSheetEnd', 'closeLoanSheet',
  'submitLoanSheet', 'loanFromSheet', 'addMyLoan', 'editMyLoan', 'confirmLoanEnded', 'onBankOfferInput',
  'leaveDetailBeforeChange', 'editViewedPlan', 'deleteViewedPlan', 'applyResultsActions', 'leaveSavedDetail',
  'readHomeOpen', 'applyHomeOpen', 'setHomeOpen', 'toggleHomeSection', 'thinRemainder', 'remainderAfter',
  'fitCompareTable', 'renderBankLimitCard', 'maxPrincipal', 'termForPayment', 'updatePeriodUnit', 'cleanDigitsField', 'parsePastedNumber', 'isNumberField', 'onNumberInput', 'noteNumberEdit', 'cashAfterExpenses', 'dtiPct', 'fmtDti',
  'biometricPlugin', 'deviceAuthStatus', 'authenticateForExit', 'authErrorKind', 'isNativeApp',
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
  let _cmpTerm=0,_planDirty=false,_loanSheet=null,_bankOffer='',_bankOfferSig='';
  const LOAN_TYPES=['personal','car','home','business','education','other'];
  function renderBankOfferResult(){}
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
    toasts: [],
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
    function maybeShowResultTip(){} function showToast(m){toasts.push(m);}
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
  ['cell:s=>fmtPayNum(planPay(s))', 'compare row'], ['${fmtPay(reqPay)}', 'bank-limit sentence'],
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
check('the cache name changed so clients refresh', sw.includes("const CACHE = 'smartloan-4.2b'"));
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
check('the guide stays away from an open sheet', html.includes("'confirm-sheet','loan-sheet','guide-sheet'].some(isOverlayOpen)"));

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
check('the tour teaches plans', html.includes("title:{en:'Plans, My loans & Demo'") && html.includes('احفظ حتى 4 عروض بنوك لنفس القرض') && html.includes('أي عرض أرخص وأي مدة تناسبك'));
check('the home add button has its own style, not the old full-width one', html.includes('class="home-add-loan-btn" id="home-add-loan"') && !html.includes('.add-loan-btn{'));
check('the loan sheet arrow moves left in Arabic, away from the text', html.includes('#loan-sheet[dir="rtl"] .app-sel{background-position:left 10px center}'));
check('sheet text isolates the plan name from its amount, even as plain text', html.includes("return '\\u2068'+planTitle(s)+'\\u2069'+(amt?' — '+fmtAmt(amt):'');"));
check('the web app bars are a light neutral, not purple', /"theme_color": "#f1f5f9"/.test(readFileSync(join(here, '..', 'manifest.json'), 'utf8')));
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
  check('taking asks first', p.el('loan-sheet').style.display === 'flex' && p.run('myLoans.length') === 0);
  check('the question is explicit', p.el('ls-title').textContent === 'Did you really take this loan?');
  p.run('closeLoanSheet()');
  await settle();
  check('cancel changes nothing', p.run('saved.length') === 2 && p.run('myLoans.length') === 0);
  p.run('takePlan(0)');
  p.run('submitLoanSheet()');
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
  check('the section shows its loan', p.el('home-loans-title').textContent.includes('(1)'));
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
  check('an empty section stays, to add a loan', p.el('home-loans-section').style.display !== 'none' && p.el('home-loans-sub').textContent === 'No loans yet');
}
{
  const p = newPage();
  p.run(`saved=[${[1, 2, 3, 4].map((n) => plan('active', n)).join(',')}]`);
  p.run('takePlan(0)');
  p.run('submitLoanSheet()');
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
  p.run('submitLoanSheet()');
  await settle();
  check('taking it does not count it twice', Math.abs(p.run('realPayments()') - 150.1234) < 0.001);
  check('the leftover number is right', p.run('profile.existing') === '50');
  check('the marker does not stay on the loan', p.run('myLoans[0].countedMonthly') === undefined);
  p.run('takePlan(1)');
  p.run('submitLoanSheet()');
  await settle();
  check('a scenario was never counted so it adds in full', Math.abs(p.run('realPayments()') - 1149.1234) < 0.001);
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState()})`);
  p.run(`profile.existing='0'`);
  p.run('takePlan(0)');
  p.run('submitLoanSheet()');
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

// ── Compare 4.2: the rate decides the bank, the term is the user's choice ──
console.log('\nCompare');
const offer = (monthly, interest, { amount = 10000, period = 60, rate = 5, label = '', bank = 0 } = {}) =>
  `{loanType:'car',loanAmount:${amount},loanMonthly:${monthly},name:'Car',${label ? `label:${JSON.stringify(label)},` : ''}${bank ? `bankMonthly:${bank},` : ''}
    results:{monthly:${monthly},interest:${interest},total:${amount + interest}},
    form:{amount:'${amount}',period:'${period}',rate:'${rate}',loanType:'car'}}`;
const rowOf = (body, name) => body.slice(body.indexOf(`>${name}</td>`), body.indexOf('</tr>', body.indexOf(`>${name}</td>`)));
// A plan built from the app's own loan formula, as saving builds it.
const real = (p, amount, months, rate, label, bank) => {
  const r = p.run(`calcLoan(${amount},${rate}/100,${months})`);
  return offer(r.monthly, r.interest, { amount, period: months, rate, label, bank });
};
const facts = (p, ...plans) => { p.run(`saved=[${plans.join(',')}]`); return p.run('compareFacts(saved)'); };
check('the word best is gone', !html.includes('الأفضل بأقل قسط') && !html.includes('Best by Lowest'));
{
  // 1. The owner's case: A 7,000 at 5% over 36, B 7,000 at 4.5% over 48.
  const p = newPage();
  p.run(`profile.salary='5000'`);
  const A = real(p, 7000, 36, 5, 'A'), B = real(p, 7000, 48, 4.5, 'B');
  const f = facts(p, A, B);
  check('owner case: B has the lower rate', f.winners.length === 1 && f.winners[0].label === 'B');
  const g36 = p.run('fairGrid(compareFacts(saved),36)'), g48 = p.run('fairGrid(compareFacts(saved),48)');
  check('owner case at 36: B 208.23 / 496.22', g36[0].s.label === 'B' && g36[0].pay === 208.23 && g36[0].interest === 496.22);
  check('owner case at 36: A 209.80 / 552.67', g36[1].pay === 209.8 && g36[1].interest === 552.67);
  check('owner case at 48: B 159.62 / 661.97, A 161.21 / 737.84', g48[0].pay === 159.62 && g48[0].interest === 661.97 && g48[1].pay === 161.21 && g48[1].interest === 737.84);
  check('owner case: the term card pairs A and B', f.term.S.label === 'A' && f.term.L.label === 'B' && f.term.k === 12);
  check('owner case: B lower by 50.18 for 36 months', Math.abs(f.term.payDiff - 50.18) < 1e-9);
  check('owner case: B more interest by 109.30', Math.abs(f.term.intDiff - 109.3) < 1e-9);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('owner case: the bank answer names B', body.includes('<b><bdi>B</bdi></b> has the lowest rate'));
  check('owner case: two plans say who has the other rate, without "up to"', body.includes('vs <bdi dir="ltr">5%</bdi> for <bdi>A</bdi>.') && !body.includes('vs up to'));
  check('owner case: the second sentence says what a lower rate means', body.includes('a lower rate always means a lower payment and less interest'));
  check('owner case: every name in a sentence is isolated from the numbers', !/[^>]B [0-9$]/.test(body) && body.includes('saves <bdi dir') === false);
  check('the term card says longer by 1 year in plain words', body.includes('<bdi>B</bdi> is longer by 1 year'));
  p.run(`lang='ar'`); p.run('renderCompare()');
  const ar = p.el('compare-body').innerHTML;
  check('Arabic: longer by a year reads بسنة', ar.includes('مدتها أطول بسنة،'));
  check('Arabic: the cheaper sentence names both plans and rates', ar.includes('أقل فائدة عند <b><bdi>B</bdi></b>: <bdi dir="ltr">4.5%</bdi>، مقابل <bdi dir="ltr">5%</bdi> عند <bdi>A</bdi>.'));
  check('Arabic: the saving line keeps the name apart from the amount', ar.includes('يوفر <b><bdi>B</bdi></b> '));
  p.run(`lang='en'`);
  check('owner case: same-term saving 56.45', body.includes('$ 56.45'));
  check('owner case: the same-term grid is hypothetical', body.includes('If you took the offers over the same term'));
  check('owner case: term chips for 3 and 4 years', body.includes('setCompareTerm(36)') && body.includes('setCompareTerm(48)'));
  check('owner case: the term card speaks for 36 then 12 months', body.includes('First 36 months') && body.includes('Last 12 months') && body.includes('$ 50.18 a month') && body.includes('$ 159.62 a month'));
  check('owner case: money shows two decimals', body.includes('$ 209.80') || body.includes('209.80'));
  check('owner case: the flat-rate caveat is there', body.includes('flat rate'));
  check('owner case: it is the user\'s call', body.includes('It is your call'));
  p.run('setCompareTerm(48)');
  check('a chip switches the grid to 4 years and B still saves 75.87', p.el('compare-body').innerHTML.includes('$ 75.87'));
}
{
  // 2. Only the rate differs.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 36, 4.5, 'C'));
  check('rate only: C is cheaper', f.winners[0].label === 'C' && !f.term);
  p.run('renderCompare()');
  check('rate only: saves 56.45, no term card', p.el('compare-body').innerHTML.includes('$ 56.45') && !p.el('compare-body').innerHTML.includes('Which term suits you'));
}
{
  // 3. Only the term differs.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 48, 5, 'D'));
  check('term only: same rate, so the same price', f.sameR && !f.winners);
  check('term only: lower by 48.59', Math.abs(f.term.payDiff - 48.59) < 1e-9);
  check('term only: interest more by 185.17', Math.abs(f.term.intDiff - 185.17) < 1e-9);
  p.run('renderCompare()');
  check('term only: says the price is the same', p.el('compare-body').innerHTML.includes('All plans have the same rate'));
}
{
  // 4. Only the amount differs.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 5, 'A'), real(p, 10000, 36, 5, 'B'));
  check('amount only: same rate and term', f.sameR && f.sameN && !f.sameP && !f.term);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('amount only: per 1,000 shows 29.97 twice', (rowOf(body, 'Monthly per 1,000').match(/>29\.97</g) || []).length === 2);
  check('amount only: the warning blames the amount, not the bank', body.includes('A bigger payment comes from the bigger amount'));
  check('amount only: interest and cost rows hidden', !body.includes('>Interest</td>') && !body.includes('>Total</td>'));
}
{
  // 5. Amount and rate differ.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 5, 'A'), real(p, 10000, 36, 4.5, 'B'));
  check('amount and rate: the 4.5% plan wins, per 1,000', f.winners[0].label === 'B' && f.pref === 1000);
  const g = p.run('fairGrid(compareFacts(saved),36)');
  check('amount and rate: 29.75 vs 29.97, interest 70.89 vs 78.95', g[0].pay === 29.75 && g[1].pay === 29.97 && g[0].interest === 70.89 && g[1].interest === 78.95);
  p.run('renderCompare()');
  check('amount and rate: the saving is per 1,000', p.el('compare-body').innerHTML.includes('in interest per 1,000'));
}
{
  // 6. Everything the same.
  const p = newPage();
  facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 36, 5, 'B'));
  p.run('renderCompare()');
  check('all same: fees or insurance explain any bank difference', p.el('compare-body').innerHTML.includes('Any difference at the bank comes from fees or insurance'));
}
{
  // 7. A tie for the lowest rate names both.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 4.5, 'A'), real(p, 7000, 36, 4.5, 'B'), real(p, 7000, 36, 5, 'C'));
  check('tie: both 4.5% plans are winners', f.winners.length === 2);
  p.run('renderCompare()');
  check('tie: both named, saving says up to', p.el('compare-body').innerHTML.includes('<b><bdi>A</bdi> and <bdi>B</bdi></b>') && p.el('compare-body').innerHTML.includes('saves up to'));
  check('tie: the rest share one rate, so it is named, not "up to"', p.el('compare-body').innerHTML.includes('vs <bdi dir="ltr">5%</bdi> for <bdi>C</bdi>.'));
}
{
  const p = newPage();
  facts(p, real(p, 7000, 36, 4, 'A'), real(p, 7000, 36, 5, 'B'), real(p, 7000, 36, 6, 'C'));
  p.run('renderCompare()');
  check('different other rates are given as a range', p.el('compare-body').innerHTML.includes('The others range from <bdi dir="ltr">5%</bdi> to <bdi dir="ltr">6%</bdi>.'));
}
{
  // 8. Zero rate.
  const p = newPage();
  const f = facts(p, real(p, 7000, 36, 0, 'Z'), real(p, 7000, 36, 3, 'T'));
  const g = p.run('fairGrid(compareFacts(saved),36)');
  check('zero rate wins with 194.44 and no interest', f.winners[0].label === 'Z' && g[0].pay === 194.44 && g[0].interest === 0);
  const f2 = facts(p, real(p, 7000, 36, 0, 'A'), real(p, 7000, 48, 0, 'B'));
  check('interest-free over two terms: same price, same interest', f2.sameR && f2.term.intDiff === 0);
  p.run('renderCompare()');
  check('interest-free: lower payment and the same interest', p.el('compare-body').innerHTML.includes('has a lower payment and the same interest'));
}
{
  // 9. No green anywhere in the table.
  const p = newPage();
  facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 48, 4.5, 'B'), real(p, 5000, 72, 5, 'C'));
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  const table = body.slice(body.indexOf('id="cmp-table"'), body.indexOf('</table>'));
  check('the table has no winner colour', !/color:var\(--safe\)/.test(table));
  check('the table comes first and the answers after it, as in 4.1',
    body.indexOf('id="cmp-table"') < body.indexOf('cmp-q') && body.indexOf('</table>') < body.indexOf('Different amounts'));
  check('the remainder states its term', /<span class="cmp-cell-sub">3 years<\/span>/.test(rowOf(body, 'Monthly Remainder')));
}
{
  // 10. OMR keeps three decimals on installments, two on the rest.
  const p = newPage();
  p.run(`currency='OMR'`);
  facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 48, 4.5, 'B'));
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('OMR: installments 209.796 and 159.624', rowOf(body, 'Monthly').includes('>209.796<') && rowOf(body, 'Monthly').includes('>159.624<'));
  check('OMR: interest with two decimals', rowOf(body, 'Interest').includes('>552.67<'));
}
{
  // 11. Arabic keeps the percent after the number.
  const p = newPage();
  p.run(`lang='ar'`);
  facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 48, 4.5, 'B'));
  p.run('renderCompare()');
  check('Arabic: 5% sits in its own box', p.el('compare-body').innerHTML.includes('<bdi dir="ltr">5%</bdi>'));
}
{
  // The bank's own payment decides the rate when the user entered it.
  const p = newPage();
  const A = real(p, 7000, 36, 4, 'Flat bank', 216.5), B = real(p, 7000, 36, 5, 'B');
  const f = facts(p, A, B);
  check('bank payment: its real rate is used', f.rates[0].fromBank && f.rates[0].rate > 5);
  check('bank payment: the 5% offer is cheaper than a 4% that pays 216.50', f.winners[0].label === 'B');
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('bank payment: the card says where the rate came from', body.includes('comes from the bank payment you entered'));
  check('bank payment: the table uses the bank payment', rowOf(body, 'Monthly').includes('>216.50<'));
  check('bank payment: the rate row marks it', rowOf(body, 'Rate').includes('from the bank payment'));
}
{
  const p = newPage();
  p.run(`profile.bankLimit='10'`);
  facts(p, real(p, 7000, 36, 5, 'A'), real(p, 7000, 12, 5, 'Short'));
  p.run('renderCompare()');
  check('a plan over the bank limit is still flagged', p.el('compare-body').innerHTML.includes('<bdi>Short</bdi>: exceeds the bank limit'));
}
{
  const p = newPage();
  p.run(`saved=[${offer(100, 900, { label: 'Bank <b>' })},${offer(90, 1000, { label: 'Bank B', rate: 4 })}]`);
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('a plan name heads its column', body.includes('Bank B'));
  check('a plan name cannot inject markup', body.includes('Bank &lt;b&gt;') && !body.includes('Bank <b>'));
}
{
  const p = newPage();
  p.run(`var _d=buildDemoBundle({lang:'ar',currentTheme:'light'});saved=_d.saved;currency='USD'`);
  check('demo shows two offers for one loan', p.run('compareFacts(saved).sameP') === true && p.run('compareFacts(saved).winners.length') === 1);
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
  check('a real loan cannot be taken again, but can be edited', p.el('btn-take-plan').style.display === 'none' && p.el('btn-edit-plan').style.display === '');
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
  p.run('closeLoanSheet()');
  await settle();
  check('cancel stays on the plan', p.run('_viewingSavedLoan') === true && p.run('saved.length') === 3);
  p.run('takePlan(_viewingSavedIdx)');
  p.run('submitLoanSheet()');
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
  p.run('submitLoanSheet()');
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
check('number fields clean themselves on every input', html.includes("document.addEventListener('input',onNumberInput,true);"));
check('the field remembers its value before each edit', html.includes("document.addEventListener('beforeinput',noteNumberEdit,true);"));
check('a field with a suffix keeps the page direction', !/<input[^>]*has-suffix[^>]*dir="ltr"/.test(html));
check('the hint says what to enter', html.includes('اكتب هنا فقط الأقساط غير المسجلة في قروضي'));
check('the hint total follows the two-decimal rule', html.includes('const sum=fmtAmt(myLoansTotal());'));
check('the tour says the form is reached from Home', html.includes('هذا نموذج حساب القرض، وتصل إليه دائما من زر احسب قرضا في الرئيسية'));
for (const id of ['inp-banklimit', 'form-inp-per', 'form-inp-rate', 'manual-inp-amt', 'manual-inp-per', 'manual-inp-rate', 'bank-offer-inp']) {
  const tag = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0];
  check(`${id} is a clean text field`, tag.includes('type="text"') && tag.includes('data-digits') && tag.includes('inputmode="decimal"'));
}

check('system bars are set again after the splash', /\[300,1200,2200,3200,4500\]\.forEach/.test(html));
check('system bars are set again on return', /visibilitychange[^\n]*\n\s*if\(!document\.hidden\)\{ try\{ applyStatusBar/.test(html));

// ── Device check for Demo mode on Android ──────────────────────────────────
console.log('\nDevice check');
check('no code asks for the npm-only plugin name', !html.includes('Plugins.BiometricAuth;') && !html.includes('.BiometricAuth '));
{
  const p = newPage();
  const asked = [];
  const native = (check_, auth) => ({ isNativePlatform: () => true, Plugins: { BiometricAuthNative: { checkBiometry: check_, internalAuthenticate: auth } } });
  p.sandbox.window.Capacitor = native(async () => ({ isAvailable: true, deviceIsSecure: true }), async (o) => { asked.push(o); });
  check('a secure phone is available', (await p.run('deviceAuthStatus()')) === 'available');
  check('a successful check lets the user out', (await p.run('authenticateForExit()')) === 'success');
  check('the device PIN is allowed as well', asked[0].allowDeviceCredential === true);
  p.sandbox.window.Capacitor = native(async () => ({ isAvailable: false, deviceIsSecure: false }), async () => { throw Object.assign(new Error('x'), { code: 'userCancel' }); });
  check('a phone with no lock says so', (await p.run('deviceAuthStatus()')) === 'unavailable');
  check('cancelling keeps the user in demo', (await p.run('authenticateForExit()')) === 'fail');
  p.sandbox.window.Capacitor = native(async () => ({}), async () => { throw Object.assign(new Error('x'), { code: 'biometryNotAvailable' }); });
  check('an odd answer is an error', (await p.run('deviceAuthStatus()')) === 'error');
  check('no biometrics at exit is unavailable', (await p.run('authenticateForExit()')) === 'unavailable');
  p.sandbox.window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  check('a missing plugin is an error, never a pass', (await p.run('deviceAuthStatus()')) === 'error');
  check('a missing plugin never unlocks the exit', (await p.run('authenticateForExit()')) === 'unavailable');
}

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

// ── Numbers pasted from anywhere ───────────────────────────────────────────
console.log('\nPasted numbers');
{
  const p = newPage();
  const read = (v, l = 'en') => { p.run(`lang='${l}'`); p.sandbox._v = v; return p.run('parsePastedNumber(_v)'); };
  check('Spanish thousands and decimals', read('1.234,56', 'es') === '1234.56');
  check('English thousands and decimals', read('1,234.56') === '1234.56');
  check('the same in any app language', read('1.234,56', 'ar') === '1234.56' && read('1,234.56', 'es') === '1234.56');
  check('a lone decimal comma', read('1234,56') === '1234.56' && read('1234,56', 'es') === '1234.56');
  check('Arabic marks', read('١٬٢٣٤٫٥٦', 'ar') === '1234.56');
  check('Arabic comma', read('١٢٣٤،٥', 'ar') === '1234.5');
  check('long groups', read('1,234,567') === '1234567' && read('1.234.567', 'es') === '1234567');
  check('three digits after a comma are thousands', read('1,234') === '1234' && read('1,234', 'ar') === '1234');
  check('three digits after a dot are decimals', read('1.234') === '1.234' && read('1.234', 'ar') === '1.234');
  check('Spanish reads those the other way', read('1.234', 'es') === '1234' && read('1,234', 'es') === '1.234');
  check('a real three-decimal amount survives', read('12.345') === '12.345' && read('0,500', 'es') === '0.500');
  check('a currency around the number', read('$ 1,234.50') === '1234.50' && read('1.234,50 €', 'es') === '1234.50' && read('ر.ع 500') === '500');
  check('spaces and marks', read('1 234,56') === '1234.56' && read('\u200F1,234.56') === '1234.56');
  check('a trailing separator', read('100.') === '100' && read('100,') === '100');
  check('a leading separator', read('.5') === '0.5');
  check('negative is refused', read('-500') === null && read('−500') === null && read('(500)') === null);
  check('broken groups are refused', read('12,34,56') === null && read('1.2.3') === null && read('1234,567.89') === null);
  check('text is refused', read('abc') === null && read('12a34') === null && read('') === null);
  p.run(`lang='en'`);
  const input = (before, after, inputType = 'insertText', digits = true) => {
    const el = { value: after, _beforeEdit: before, matches: (q) => q.includes(digits ? 'data-digits' : 'data-money') && (digits || !q.startsWith('[data-digits]') || q.includes(',')) };
    p.sandbox._e = { target: el, inputType };
    p.run('onNumberInput(_e)');
    return el.value;
  };
  check('paste into a rate field', input('', '5,5', 'insertFromPaste') === '5.5');
  check('paste into the bank offer', input('', '1,234.56', 'insertFromPaste') === '1234.56');
  check('a keyboard paste with no paste event', input('', '1.234,56') === '1234.56');
  check('a money paste keeps its decimals', input('', '1.234,56', 'insertFromPaste', false) === '1234.56');
  check('typing one digit is left alone', input('1,23', '1,234', 'insertText', false) === '1,234');
  check('a typed minus is refused', input('50', '-50') === '50' && p.sandbox.toasts.length === 1);
  {
    const el = { value: '1,234.56', matches: () => true };
    p.sandbox._e = { target: el, inputType: 'insertText', data: '1234,56' };
    p.run('noteNumberEdit(_e)');
    el.value = '1234,56';
    p.run('onNumberInput(_e)');
    check('a shorter paste over a selection is still a paste', el.value === '1234.56');
    p.sandbox._e = { target: el, inputType: 'insertCompositionText', data: '123' };
    p.run('noteNumberEdit(_e)');
    check('composing a number is not a paste', el._bulkEdit === false);
    p.sandbox._e = { target: el, inputType: 'insertText', data: '5' };
    p.run('noteNumberEdit(_e)');
    check('one typed digit is not a paste', el._bulkEdit === false);
  }
  check('a bad paste keeps the old value', input('700', '12,34,56', 'insertFromPaste') === '700');
  check('and says so', p.sandbox.toasts.length === 2);
}
check('every money field reads pastes', (html.match(/data-money oninput="fmtAmountInput/g) || []).length === 6);

// ── Other apps on this origin ──────────────────────────────────────────────
console.log('\nShared origin');
{
  const removed = [];
  const listeners = {};
  const sandbox = {
    self: { addEventListener: (n, f) => { listeners[n] = f; }, clients: { claim: async () => {} }, location: { origin: 'https://emigo.test' } },
    caches: { keys: async () => ['smartloan-1.3e', 'smartloan-v40', 'smartloan-4.1', 'smartloan-4.1a', 'smartloan-4.1b', 'smartloan-4.2', 'smartloan-4.2a', 'smartloan-4.2b', 'compoundcalc-1', 'edgeory-v43', 'basis-2', 'car-maint-3'], delete: async (k) => { removed.push(k); return true; } },
    URL, console,
  };
  vm.runInNewContext(sw, sandbox);
  let done; listeners.activate({ waitUntil: (w) => { done = w; } });
  await done;
  check('old emiGo caches are cleared', removed.includes('smartloan-1.3e') && removed.includes('smartloan-v40'));
  check('the current cache stays', !removed.includes('smartloan-4.2b') && removed.includes('smartloan-4.2a'));
  check('no other app loses its cache', removed.length === 7);
}

// ── Honest backup and take messages ────────────────────────────────────────
console.log('\nBackup and take messages');
{
  const body = extractFunction('doExportShare');
  check('sharing never claims a saved file', body.includes('showToast(sharedMsg)') && !/Share\.share[\s\S]{0,260}showToast\(okMsg\)/.test(body));
  check('cancelling says nothing was saved', body.includes('فلا توجد نسخة محفوظة'));
  check('a failed write is reported', !/catch\(err\)\{ \/\*/.test(body));
  check('the file warns it is readable', html.includes('الملف يحتوي بياناتك المالية بنص مقروء'));
  check('the old promise about app storage is gone', !html.includes('file already saved in app storage'));
}
{
  const p = newPage();
  p.run(`applyLoadedState(${oldState()});lang='en'`);
  p.run('takePlan(0)');
  check('taking a migrated loan says what it deducts', p.el('ls-info').textContent.includes('comes off the payments'));
  p.run('closeLoanSheet()');
  await settle();
  p.run(`profile.existing='60'`);
  p.run('takePlan(0)');
  check('it never promises more than is there', p.el('ls-info').textContent.includes('60'));
  p.run('closeLoanSheet()');
  await settle();
  p.run('takePlan(2)');
  check('a plan never counted deducts nothing', !p.el('ls-info').textContent.includes('comes off'));
  p.run('closeLoanSheet()');
  await settle();
}
{
  const p = newPage();
  p.run(`saved=[${[1, 2, 3, 4, 5, 6].map((n) => plan('active', n * 10)).join(',')}]`);
  p.run('renderCompare()');
  check('more than four plans says so', p.el('compare-body').innerHTML.includes('Showing the first 4 of 6 plans'));
  p.run(`saved=saved.slice(0,4)`);
  p.run('renderCompare()');
  check('four plans need no note', !p.el('compare-body').innerHTML.includes('Showing the first'));
}
check('the bank range is not called expected', html.includes("bpRange:'نطاق تقريبي لقسط البنك (±1%)'") && !html.includes('النطاق المتوقع لقسط البنك'));

// ── A deficit is never hidden ──────────────────────────────────────────────
console.log('\nDeficit');
{
  // Reviewer's case: income 1,000, expenses 1,500, a new 100 payment.
  const p = newPage();
  p.run(`profile.salary='1000';profile.income='0';profile.expenses='1500';profile.variable='0';profile.existing='0';
         form.amount='3500';form.period='36';form.rate='0'`);
  const r = p.run('analyse()');
  check('the cash left before the loan is -500', p.run('cashAfterExpenses()') === -500);
  check('the report shows a 600 deficit', Math.abs(r.remaining - (-500 - r.monthly)) < 1e-9 && Math.abs(r.monthly - 97.22222222222223) < 1e-6);
  p.run(`form.amount='3600'`);
  check('with a 100 payment it is exactly -600', Math.abs(p.run('analyse().remaining') + 600) < 1e-9);
  check('debt ratios use a net income of zero, with no made-up 100%', p.run('analyse().netIncome') === 0 && p.run('analyse().dtiNet') === null);
  p.run(`saved=[${offer(100, 0, { amount: 3600, period: 36, rate: 0 })},${offer(150, 0, { amount: 3600, period: 24, rate: 0 })}]`);
  check('a row warns about the deficit', p.run('remainderAfter(100).remaining') === -600);
  p.run('openSavedDetail(0)');
  check('a plan opened shows -600', p.run('results.remaining') === -600);
  p.run('leaveSavedDetail()');
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  check('compare shows -600 and -650', body.includes('>-600<') && body.includes('>-650<'));
  check('compare keeps the minus before the number', body.includes('<bdi dir="ltr">-600</bdi>'));
}
{
  const p = newPage();
  p.run(`profile.salary='3000';profile.income='0';profile.expenses='900';profile.variable='0';profile.existing='200';form.amount='3600';form.period='36';form.rate='0'`);
  check('a normal budget is unchanged: 1,800 left', Math.abs(p.run('analyse().remaining') - 1800) < 1e-9);
}
{
  const p = newPage();
  p.run(`profile.salary='0';profile.income='0';profile.expenses='400';profile.variable='0';profile.existing='0';form.amount='3600';form.period='36';form.rate='0'`);
  check('no income keeps the whole deficit', Math.abs(p.run('analyse().remaining') + 500) < 1e-9);
}
{
  // A real loan opened from My loans is not counted twice in a deficit.
  const p = newPage();
  p.run(`profile.salary='1000';profile.income='0';profile.expenses='1500';profile.variable='0';profile.existing='50';myLoans=[${offer(100, 0)},${offer(30, 0)}]`);
  p.run('openSavedDetail(0,true)');
  check('a loan in a deficit counts itself once', p.run('results.remaining') === -680);
  check('and matches home', p.run('cashAfterExpenses(_savedSnap.profile)-realPayments()') === -680);
}
check('home uses the same source', /const rem=cashAfterExpenses\(\)-totalLoans;/.test(html));
check('no remainder starts from a zeroed net income', !/netIncome-monthly-existing|cmpCurNet-s\.loanMonthly|curNetInc-results\.monthly/.test(html));

// ── No income, no made-up ratio ────────────────────────────────────────────
console.log('\nZero income');
{
  const p = newPage();
  p.run(`profile.salary='0';profile.income='0';profile.expenses='400';profile.variable='0';profile.existing='0';form.amount='3600';form.period='36';form.rate='0'`);
  const r = p.run('analyse()');
  check('the real income stays zero', r.grossIncome === 0 && r.netIncome === 0);
  check('the gross ratio is not available', r.dtiGross === null);
  check('the net ratio is not available', r.dtiNet === null);
  check('the loan is still risky', r.riskLevel === 'risky');
  check('affordability is zero, not full', r.affordability === 0);
  check('the deficit is untouched', Math.abs(r.remaining + 500) < 1e-9);
  check('shown as not available', p.run('fmtDti(null)') === 'N/A' && p.run('fmtDti(undefined)') === 'N/A' && p.run('fmtDti(Infinity)') === 'N/A');
  check('a real ratio still shows', p.run('fmtDti(25.5)') === '25.5%');
  check('a zero ratio is a real ratio', p.run('fmtDti(0)') === '0%');
  check('no income is thin when money is short', p.run('thinRemainder(-500,0)') === true);
  p.run(`saved=[${offer(100, 0, { amount: 3600, period: 36, rate: 0 })},${offer(150, 0, { amount: 3600, period: 24, rate: 0 })}]`);
  p.run('openSavedDetail(0)');
  check('a plan opened keeps zero income', p.run('results.grossIncome') === 0 && p.run('results.dtiGross') === null && p.run('results.dtiNet') === null);
  p.run('leaveSavedDetail()');
  p.run('renderCompare()');
  const body = p.el('compare-body').innerHTML;
  const dti = rowOf(body, 'DTI');
  check('compare shows the ratio as not available', (dti.match(/>N\/A</g) || []).length === 2);
  check('a missing ratio wins nothing', !dti.includes('--safe'));
  check('compare still shows the deficit', body.includes('>-500<') && body.includes('>-550<'));
}
{
  const p = newPage();
  p.run(`profile.salary='1000';profile.income='0';profile.expenses='1000';profile.variable='0';profile.existing='0';form.amount='3600';form.period='36';form.rate='0'`);
  const r = p.run('analyse()');
  check('income with no net keeps a gross ratio', Math.abs(r.dtiGross - 10) < 1e-9);
  check('but no made-up 100% on net', r.dtiNet === null);
}
{
  const p = newPage();
  p.run(`profile.salary='3000';profile.income='0';profile.expenses='900';profile.variable='0';profile.existing='200';form.amount='3600';form.period='36';form.rate='0'`);
  const r = p.run('analyse()');
  check('a normal budget keeps its ratios', Math.abs(r.dtiGross - 10) < 1e-9 && Math.abs(r.dtiNet - 300 / 2100 * 100) < 1e-9);
}
{
  const p = newPage();
  p.run(`var _z=sanitizeSaved([Object.assign(${offer(100, 0)},{results:{monthly:100,interest:0,total:3600,dtiGross:null,dtiNet:null}})])`);
  check('a saved plan with no ratio keeps it missing', p.run('_z[0].results.dtiGross') === null && p.run('_z[0].results.dtiNet') === null);
  p.run(`_z=sanitizeSaved([Object.assign(${offer(100, 0)},{results:{monthly:100,interest:0,total:3600,dtiGross:'x'}})])`);
  check('a damaged ratio is still cleaned', p.run('_z[0].results.dtiGross') === 0);
}
check('no ratio divides by a fake 1', !/Math\.max\(salary\+income,1\)|Math\.max\(cmpCurGross,1\)/.test(html));
check('every ratio on screen goes through the safe format', !/fmtPct\((r|s\.results)\.dti/.test(html));

// ── Mixed directions on one line ───────────────────────────────────────────
console.log('\nLine direction');
{
  const p = newPage();
  p.run(`currency='OMR';lang='en'`);
  const row = p.run(`planRow(${offer(98.645, 3021.12, { amount: 10000, period: 132, rate: 5 })},0,false)`);
  check('the amount is boxed with its currency', /<bdi dir="ltr">10,000 [^<]+<\/bdi>/.test(row));
  check('the rate keeps its percent after it', row.includes('<bdi dir="ltr">5%</bdi>'));
  check('the term is boxed', row.includes('<bdi>11 years</bdi>'));
  p.run(`saved=[${offer(100, 900, { label: 'Personal' })},${offer(90, 1000, { rate: 4 })}];renderCompare()`);
  check('compare sides box the rate', p.el('compare-body').innerHTML.includes('<bdi dir="ltr">5%</bdi> · <bdi>'));
}
check('names break only between words', !/overflow-wrap:anywhere/.test(html));
check('a piece never splits across lines', html.includes('.plan-row-sub bdi,.cmp-sub bdi{white-space:nowrap}'));

// ── Every mix of amount, term and rate: what the screen says must be true ──
console.log('\nCompare scenarios');
{
  const p = newPage();
  p.run(`currency='USD';lang='en'`);
  let seed = 7;
  const rnd = (list) => { seed = (seed * 1103515245 + 12345) % 2147483648; return list[seed % list.length]; };
  const wrong = [];
  for (let i = 0; i < 3000; i++) {
    const n = 2 + (i % 3);
    const plans = Array.from({ length: n }, (_, k) => real(p, rnd([7000, 7000, 7000, 10000]), rnd([12, 36, 48, 60, 240]), rnd([0, 4.5, 5, 6.82, 12]), 'P' + k));
    p.run(`saved=[${plans.join(',')}]`);
    const f = p.run('compareFacts(saved)');
    const rates = f.rates.map((r) => r.rate);
    let ok = true;
    if (!f.sameR) {
      const min = Math.min(...rates);
      ok = ok && f.winners.length === rates.filter((r) => r === min).length;
      for (const term of f.termChoices) {
        const g = p.run(`fairGrid(compareFacts(saved),${term})`);
        // At the same amount and term, a lower rate is never more expensive.
        for (let k = 1; k < g.length; k++) if (g[k].rate > g[k - 1].rate && (g[k].pay < g[k - 1].pay || g[k].interest < g[k - 1].interest)) ok = false;
      }
    }
    if (f.term) {
      const S = f.term.S, L = f.term.L;
      ok = ok && +L.form.period > +S.form.period && f.term.k === +L.form.period - +S.form.period;
      const shown = (v) => +p.run(`shownPay(${v})`), shownI = (v) => +p.run(`shownAmt(${v})`);
      ok = ok && Math.abs(f.term.payDiff - (shown(S.results.monthly) - shown(L.results.monthly))) < 1e-9;
      ok = ok && Math.abs(f.term.intDiff - (shownI(L.results.interest) - shownI(S.results.interest))) < 1e-9;
    }
    if (!f.sameP && f.term) ok = false;
    p.run('renderCompare()');
    const body = p.el('compare-body').innerHTML;
    if (/color:var\(--safe\)/.test(body.slice(body.indexOf('id="cmp-table"'), body.indexOf('</table>')))) ok = false;
    if (!ok) wrong.push(plans.length + ' plans');
  }
  check('3,000 random comparisons all tell the truth', wrong.length === 0, wrong.slice(0, 3).join(' | '));
}

// ── 4.2: My loans you add, edit and end ────────────────────────────────────
console.log('\nMy loans 4.2');
{
  const p = newPage();
  const set = (id, v) => { p.el(id).value = v; };
  // Add a loan with the payment, start, term and rate: the amount is worked out.
  p.run('addMyLoan()');
  check('the add sheet opens', p.el('loan-sheet').style.display === 'flex' && p.el('ls-title').textContent === 'Add a loan you already pay');
  set('ls-label', 'Home'); set('ls-type', 'home'); set('ls-pay', '731.58'); set('ls-month', '0'); set('ls-year', '2027'); set('ls-term', '192'); set('ls-rate', '4.5'); set('ls-amount', '');
  p.run('submitLoanSheet()');
  await settle();
  check('the loan is added to My loans', p.run('myLoans.length') === 1 && p.run('myLoans[0].manual') === true);
  check('its bank payment is what counts', p.run('myLoans[0].loanMonthly') === 731.58 && p.run('realPayments()') === 731.58);
  check('its start date is confirmed', p.run('myLoans[0].startConfirmed') === true && p.run('myLoans[0].form.startYear') === 2027);
  check('the amount is worked out from rate, payment and term', Math.abs(p.run('myLoans[0].loanAmount') - 100000) < 15);
  check('the last payment is December 2042', p.run('loanLastPayment(myLoans[0])') === 'December 2042');
  // Amount given instead: the rate is worked out.
  p.run('addMyLoan()');
  set('ls-label', 'Car'); set('ls-type', 'car'); set('ls-pay', '186.43'); set('ls-month', '0'); set('ls-year', '2026'); set('ls-term', '60'); set('ls-rate', ''); set('ls-amount', '10000');
  p.run('submitLoanSheet()');
  await settle();
  check('the rate is worked out from amount, payment and term', Math.abs(+p.run('myLoans[0].form.rate') - 4.5) < 0.01);
  check('two loans now count', Math.abs(p.run('realPayments()') - 918.01) < 1e-9);
  // Mistakes are named, nothing is saved.
  const tryAdd = (pay, term, rate, amount) => {
    p.run('addMyLoan()'); set('ls-pay', pay); set('ls-term', term); set('ls-rate', rate); set('ls-amount', amount);
    p.run('submitLoanSheet()'); const e = p.el('ls-err').textContent; p.run('closeLoanSheet()'); return e;
  };
  check('a missing payment is refused', tryAdd('', '60', '5', '') === 'Enter the monthly payment.');
  check('a term out of range is refused', tryAdd('100', '0', '5', '') === 'Enter a term from 1 to 360 months.');
  check('rate or amount is required', tryAdd('100', '60', '', '') === 'Enter the rate or the original amount.');
  check('payments below the amount are refused', tryAdd('100', '12', '', '5000').startsWith('The payments add up to less'));
  check('nothing was added by the mistakes', p.run('myLoans.length') === 2);
  // Edit in place.
  p.run('editMyLoan(0)');
  check('edit opens filled in', p.el('ls-pay').value === '186.43' && p.el('ls-term').value === '60' && p.el('ls-label').value === 'Car');
  set('ls-pay', '190');
  p.run('submitLoanSheet()');
  await settle();
  check('editing the payment changes the total by 3.57', Math.abs(p.run('realPayments()') - 921.58) < 1e-9);
  check('the loan stays in its place', p.run('myLoans.length') === 2 && p.run('myLoans[0].label') === 'Car');
  p.run('editMyLoan(0)'); set('ls-year', '2030'); p.run('submitLoanSheet()');
  await settle();
  check('editing the start moves the last payment', p.run('loanLastPayment(myLoans[0])') === 'December 2034');
  check('cancel changes nothing', (p.run('editMyLoan(0)'), p.run('closeLoanSheet()'), p.run('myLoans[0].loanMonthly')) === 190);
}
{
  // Ended loans: a confirmed date stops counting; a guessed date only asks.
  const p = newPage();
  const now = new Date(2026, 10, 15);
  p.sandbox._now = now;
  const loan = (startYear, startMonth, period, flags = '') => `Object.assign(${offer(100, 0, { period })},{form:{amount:'1000',period:'${period}',rate:'5',loanType:'car',startMonth:${startMonth},startYear:${startYear}}}${flags ? ',' + flags : ''})`;
  p.run(`myLoans=[${loan(2025, 9, 12, '{startConfirmed:true}')},${loan(2025, 11, 12, '{startConfirmed:true}')},${loan(2025, 0, 12)}]`);
  check('ended last month: not counted', p.run('isLoanEnded(myLoans[0],_now)') === true);
  check('ends this month: still counted', p.run('isLoanEnded(myLoans[1],_now)') === false);
  check('a guessed date never ends on its own', p.run('isLoanEnded(myLoans[2],_now)') === false && p.run('loanNeedsCheck(myLoans[2],_now)') === true);
  check('the total skips only the ended loan', p.run('myLoansTotal(_now)') === 200);
  p.run('confirmLoanEnded(2)');
  p.run('closeConfirmSheet(true)');
  await settle();
  check('confirming the end stops it counting', p.run('myLoans[2].endConfirmed') === true && p.run('isLoanEnded(myLoans[2],_now)') === true);
}
{
  const p = newPage();
  p.run(`myLoans=[Object.assign(${offer(186.43, 0, { period: 60 })},{label:'Car',startConfirmed:true,form:{amount:'10000',period:'60',rate:'4.5',loanType:'car',startMonth:2,startYear:2022}})]`);
  const n = p.run('nextLoanEnding(new Date(2026,10,1))');
  check('home: a loan ending within 12 months is found', n && n.left === 3);
  check('home: nothing ends within 12 months otherwise', p.run('nextLoanEnding(new Date(2020,0,1))') === null);
}
{
  // Taking a plan with the bank's payment.
  const p = newPage();
  p.run(`saved=[Object.assign(${offer(159.62, 661.97, { amount: 7000, period: 48, rate: 4.5, label: 'B' })},{bankMonthly:161})]`);
  p.run('takePlan(0)');
  check('take: the bank payment is offered first', p.el('ls-pay-choice').innerHTML.includes('Bank payment: $ 161') && p.el('ls-pay-choice').innerHTML.includes('App estimate: $ 159.62'));
  p.el('ls-month').value = '11'; p.el('ls-year').value = '2026';
  p.run('submitLoanSheet()');
  await settle();
  check('take: the bank payment counts', p.run('myLoans[0].loanMonthly') === 161 && p.run('myLoans[0].results.monthly') === 161);
  check('take: the start is the confirmed one', p.run('myLoans[0].form.startMonth') === 11 && p.run('myLoans[0].startConfirmed') === true);
  p.run(`saved=[Object.assign(${offer(159.62, 661.97, { amount: 7000, period: 48, rate: 4.5, label: 'C' })},{bankMonthly:161})]`);
  p.run('takePlan(0)');
  p.run("pickLoanPay('app')");
  p.run('submitLoanSheet()');
  await settle();
  check('take: the app estimate can be chosen', p.run('myLoans[0].loanMonthly') === 159.62);
  p.run(`saved=[${offer(159.62, 661.97, { amount: 7000, period: 48, rate: 4.5, label: 'D' })}]`);
  p.run('takePlan(0)');
  check('take: without a bank payment there is no choice', !p.el('ls-pay-choice').innerHTML.includes('ls-opt'));
  p.run('closeLoanSheet()');
  await settle();
  check('take: cancel keeps the plan', p.run('saved.length') === 1);
}
{
  // The bank payment is kept with the plan.
  const p = newPage();
  p.run(`results={monthly:159.62};form.amount='7000';form.period='48';form.rate='4.5';_bankOffer='161';_bankOfferSig=[form.amount,form.period,form.rate,currency].join('|');_lastSaveClick=0`);
  p.run('saveScenario()');
  check('saving keeps the bank payment', p.run('saved[0].bankMonthly') === 161);
  p.run(`_bankOffer='';_lastSaveClick=0;form.amount='8000'`);
  p.run('saveScenario()');
  check('no bank payment, no field', p.run(`'bankMonthly' in saved[0]`) === false);
  p.run('openSavedDetail(1)');
  check('opening the plan fills the bank box', p.run('_bankOffer') === '161');
  p.run(`onBankOfferInput('165')`);
  check('typing a new bank payment updates the plan', p.run('saved[1].bankMonthly') === 165);
  const before = p.sandbox.persisted;
  p.run('leaveSavedDetail()');
  check('it is saved after leaving the plan view', p.sandbox.persisted > before);
}
{
  const p = newPage();
  p.run(`var _z=sanitizeSaved([Object.assign(${offer(1, 1)},{bankMonthly:'x',manual:'yes',startConfirmed:true,endConfirmed:1}),Object.assign(${offer(1, 1)},{bankMonthly:'161.5'})])`);
  check('a bad bank payment is dropped', p.run(`'bankMonthly' in _z[0]`) === false && p.run('_z[1].bankMonthly') === 161.5);
  check('only true flags survive', p.run('_z[0].startConfirmed') === true && p.run(`'manual' in _z[0]`) === false && p.run(`'endConfirmed' in _z[0]`) === false);
}
{
  // Money: whole stays whole, a fraction shows all its decimals.
  const p = newPage();
  check('money: 100 stays 100', p.run('fmtAmt(100)') === '$ 100');
  check('money: 209.8 shows 209.80', p.run('fmtAmt(209.8)') === '$ 209.80' && p.run('fmtPay(209.8)') === '$ 209.80');
  check('money: 1,391.8 shows 1,391.80', p.run('fmtAmt(1391.8)') === '$ 1,391.80');
  check('money: 100.004 rounds to 100', p.run('fmtAmt(100.004)') === '$ 100');
  p.run(`currency='OMR'`);
  check('money: OMR installment 209.8 shows 209.800', p.run('fmtPayNum(209.8)') === '209.800');
  check('money: OMR other money keeps two', p.run('fmtNum(154.2)') === '154.20');
  p.run(`currency='IDR'`);
  check('money: IDR has none', p.run('fmtNum(1234.56)') === '1,235');
  check('percent keeps trimming', p.run('fmtPct(5)') === '5%' && p.run('fmtPct(6.5)') === '6.5%');
}
check('a migrated number is cut with the currency decimals', html.includes("profile.existing=String(+Math.max(0,(+profile.existing||0)-s.countedMonthly).toFixed(curDec()));"));
check('the loan sheet answers the back button', html.includes("['loan-sheet',()=>closeLoanSheet()]"));

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
