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
  'fmtAmtDec', 'fmtPay', 'fmtRangeDec', 'payTolerance', 'withCurrency', 'getCurrencySymbol',
  'niceStep', 'simAmountBounds', 'syncSimToForm', 'simSlide', 'toggleManual', 'applyManual',
  'simUpdate', 'firstSentence', 'getStartDate',
  'confirmSheet', 'closeConfirmSheet', 'isOverlayOpen', 'handleBackButton', 'registerBackButton',
  'beginProfileEdit', 'endProfileEdit', 'cancelProfileEdit', 'editProfile',
  'editProfileBankLimit', 's1Back', 's2Back', 's2Next', 'saveStep2Inputs',
  'syncProfileToInputs', 'goStep', 'calculate', 'openSavedDetail', 'goHome',
];

const STATE = `
  const CUR_DEC={OMR:3,KWD:3,BHD:3,IDR:0};
  const PROFILE_KEYS=['salary','income','expenses','variable','existing','employment','risk'];
  const MAX_SAVED_PLANS=4, PLANS_MODEL=1, RISK_LEVELS=['safe','moderate','risky'];
  let lang='en',currency='USD',results=null,saved=[],extraLoans=[],isPremium=false;
  let _confirmResolve=null,currentTheme='light',_existingNotice=false,_demo=false,_sim={amt:50000,per:36,rate:8.5};
  const CURRENCIES=[{id:'USD',symbol:'$'},{id:'OMR',symbol:'ر.ع'},{id:'IDR',symbol:'Rp'},{id:'KWD',symbol:'د.ك'},{id:'BHD',symbol:'د.ب'},{id:'NONE',symbol:''}];
  let profileSaved=true,_editingLoanIdx=null,_viewingSavedLoan=false,_savedSnap=null;
  let _viewingSavedIdx=-1,_profileReturn=null,_lastSaveClick=0,_guideTourActive=false;
  let profile,form;
  const T={en:{lt_personal:'Personal',lt_car:'Car'},ar:{lt_personal:'x',lt_car:'y'},es:{lt_personal:'x',lt_car:'y'}};
  function t(){return {saveScenario:'Save',savedScenarios:'My saved plans',months:'mo',noSaved:'none',
    monthlyInstallment:'Monthly',totalCost:'Total',totalInterest:'Interest',dtiRatio:'DTI',compareTitle:'Compare'};}
  function savedLoanDisplayName(s){return s.name||'';}
  function escapeHtml(v){return String(v);}
  function fmtAmt(v){return String(Math.round(v));}
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
    return { add: (c) => set.add(c), remove: (c) => set.delete(c), toggle() {}, contains: (c) => set.has(c) };
  };
  const el = (id) => (elements[id] ??= {
    id, value: '', style: {}, textContent: '', dir: '', onclick: null, clicks: 0,
    classList: makeClassList(),
    focus() {}, select() {}, scrollIntoView() {}, click() { this.clicks++; },
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
  check('compare: first plan is alone against the real profile', body.includes('>1620'));
  check('compare: second plan is alone against the real profile', body.includes('>1920'));
  check('compare: debt ratio ignores the other plan', body.includes('22.67%') && body.includes('12.67%'));
  check('compare: nothing about replacing or activating', !/Replaces|activate/i.test(body));
  p.run(`profile.existing='0'`);
  p.run('renderCompare()');
  check('compare: real payments of 0 change nothing else', p.el('compare-body').innerHTML.includes('>1700'));
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
  check('card shows the agreed badge text', html.includes("'ضمن حد البنك'") && html.includes("يتجاوز حد البنك"));
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
    [1, 'شهر'], [2, 'شهران'], [18, '18 شهراً'], [7, '7 أشهر']];
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
    p.el('existing-notice-body').textContent.includes('فاحذفه من خططك'));
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
}
check('backup restore runs the same migration', /sanitizeSaved\(s\.saved\);\s*if\(s\.form[^\n]*\n\s*migrateToPlans\(s\)/.test(html));
check('backups record the plans model', /saved, form,\s*plansModel:PLANS_MODEL/.test(html));
check('saved state records the plans model', /form,\s*plansModel:PLANS_MODEL,\s*existingNotice:_existingNotice/.test(html));
check('storage key is unchanged', /const STORAGE_KEY='sla_v1'/.test(html));
check('the reschedule tab is hidden', /id="tab-restructure" style="display:none"/.test(html));
check('no activate-scenario code remains', !/activateScenario|confirmActivate/.test(html));
check('no "replaces" banner remains', !/scenario-replace-banner|_replacedLoan/.test(html));
check('the save button says plan', ["saveScenario:'Save plan'", "saveScenario:'حفظ الخطة'", "saveScenario:'Guardar plan'"].every((x) => html.includes(x)));
check('the hint is in all languages', ['أقساط قروض تدفعها حالياً فقط', 'Only loans you are paying now', 'Solo préstamos que pagas ahora'].every((x) => html.includes(x)));

// ── Money shows the decimals of its currency ───────────────────────────────
console.log('\nCurrency decimals');
{
  const p = newPage();
  const pay = (cur, n) => { p.run(`currency='${cur}'`); return p.run(`fmtPay(${n})`); };
  check('OMR installment has three decimals', pay('OMR', 156.5287) === '156.529 ر.ع');
  check('KWD and BHD too', pay('KWD', 1.5).startsWith('1.500') && pay('BHD', 1.5).startsWith('1.500'));
  check('USD has two', pay('USD', 156.5287) === '$ 156.53');
  check('IDR has none', pay('IDR', 156.6) === '157 Rp');
  check('no currency has two', pay('NONE', 12.5) === '12.50');
  p.run(`currency='OMR'`);
  check('the range card follows the currency', p.run('fmtRangeDec(154.96,158.094)').startsWith('154.960 – 158.094'));
  check('an explicit decimal count still wins', p.run('fmtAmtDec(1.5,1)').startsWith('1.5 '));
  // salary 3000, limit 40% -> room of 1200 when existing is 2200-1000 below
  p.run(`profile.existing='1099.8'`); // room = 100.2
  check('OMR: 0.4 over the limit is over the limit', p.run('planWithinBankLimit(100.6)') === false);
  check('OMR: a difference too small to show is within', p.run('planWithinBankLimit(100.2004)') === true);
  p.run(`currency='IDR'`);
  check('IDR: under half a unit still rounds to within', p.run('planWithinBankLimit(100.6)') === true);
}
for (const [needle, label] of [
  ['val:fmtPay(r.monthly)', 'report KPI'], ['<div class="saved-mini-amt">${fmtPay(s.results.monthly)}', 'plan card'],
  ['fmt:v=>fmtPay(v)', 'compare row'], ['${fmtPay(reqPay)}', 'bank-limit sentence'], ['fmtPay(existingPmt)', 'existing payments tile'],
  ['· ${fmtPay(monthly)}/', 'schedule summary'], ['val:fmtPay(c.monthly)', 'simulator KPI'],
]) check(`installment decimals in: ${label}`, html.includes(needle));
check('big totals stay whole', html.includes('val:fmtAmt(r.total)') && html.includes('val:fmtAmt(r.interest)'));

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
  check(`the row is named ${label} in report and PDF`, html.split(label).length - 1 === 2);
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
check('Arabic spelling is fixed', !/ارقاما|بايقونة|مغلقا،/.test(html));

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

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
