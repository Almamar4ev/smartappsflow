// ==========================================================================
// emiGo — data-safety tests
// ==========================================================================
// Runs the REAL functions from ../index.html inside a small fake page, so the
// tests follow shipped code. Covers: nothing saved is ever deleted automatically,
// "New calculation" keeps the profile, amount inputs accept decimals and Arabic
// digits, and editing the profile returns to the screen it was opened from.
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
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Function not found in index.html: ${name}`);
  let i = html.indexOf('{', start);
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
  'showSavedLimitSheet', 'hideSavedLimitSheet', 'limitViewSaved', 'canSave',
  'saveScenario', 'saveRefinanceScenario', 'isDuplicateActiveLoan', 'restart', 'startForm',
  'beginProfileEdit', 'endProfileEdit', 'cancelProfileEdit', 'editProfile',
  'editProfileBankLimit', 's1Back', 's2Back', 's2Next', 'saveStep2Inputs',
  'syncProfileToInputs', 'goStep', 'calculate', 'openSavedDetail', 'goHome',
];

const STATE = `
  const CUR_DEC={OMR:3,KWD:3,BHD:3,IDR:0};
  const PROFILE_KEYS=['salary','income','expenses','variable','existing','employment','risk'];
  const MAX_SAVED_PLANS=8, FREE_SAVE_LIMIT=2;
  let lang='en',currency='USD',results=null,saved=[],extraLoans=[],isPremium=false;
  let profileSaved=true,_editingLoanIdx=null,_viewingSavedLoan=false,_savedSnap=null;
  let _viewingSavedIdx=-1,_profileReturn=null,_lastSaveClick=0,_guideTourActive=false;
  let profile,form;
  const T={en:{lt_personal:'Personal'},ar:{lt_personal:'x'},es:{lt_personal:'x'}};
  function t(){return {saveScenario:'Save'};}
  function savedLoanDisplayName(s){return s.name||'';}
`;

// One fresh page per test: fake DOM, stubbed drawing, real logic.
function newPage() {
  const elements = {};
  const el = (id) => (elements[id] ??= {
    id, value: '', style: {}, textContent: '', dir: '', onclick: null,
    classList: { add() {}, remove() {} },
    focus() {}, select() {}, scrollIntoView() {},
  });
  el('s3-back').onclick = 'original-back';
  const activeRef = { value: 'home' };
  const sandbox = {
    console,
    window: { scrollTo() {} },
    confirm: () => true,
    setTimeout: () => 0,
    requestAnimationFrame: () => 0,
    document: {
      getElementById: el,
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
    ${REAL.map(extractFunction).join('\n')}
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
{
  const p = newPage();
  p.run(`saved=[${plan('active', 100)},${plan('active', 200)},${[3, 4, 5, 6, 7, 8].map((n) => plan('scenario', n)).join(',')}];
         results={monthly:999};form.amount='777';`);
  p.run('saveScenario()');
  check('a full list stays exactly the same after saving', p.run('saved.length') === 8);
  check('every active loan is still there', p.run(`saved.filter(s=>s.type==='active').length`) === 2);
  check('the limit sheet opens', p.el('limit-overlay').style.display === 'flex');
  check('the limit sheet states the count', p.el('limit-title').textContent.includes('8'));
  check('no upgrade dialog at the limit', p.sandbox.upgraded === 0);
  check('nothing is written to storage', p.sandbox.persisted === 0);
  p.run('limitViewSaved()');
  check('"View my plans" closes the sheet and goes home',
    p.el('limit-overlay').style.display === 'none' && p.active() === 'home');
}
{
  const p = newPage();
  p.run(`_editingLoanIdx=0;saved=[${plan('active', 100)},${plan('active', 200)},${[3, 4, 5, 6, 7, 8].map((n) => plan('scenario', n)).join(',')}];
         results={monthly:999};form.amount='777';`);
  p.run('saveScenario()');
  check('editing at the limit does not push the oldest loan out', p.run('saved.length') === 8
    && p.run(`saved[1].type`) === 'active' && p.run(`saved[0].type`) === 'active');
}
{
  const p = newPage();
  p.run(`saved=[${plan('active', 1)},${[2, 3, 4, 5, 6, 7, 8].map((n) => plan('scenario', n)).join(',')}];`);
  p.run(`saveRefinanceScenario(0,{loanMonthly:50})`);
  check('saveRefinanceScenario also stops at the limit',
    p.run('saved.length') === 8 && p.run(`saved[0].type`) === 'active');
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
check('the field accepts formatted text', /id="inp-existing" type="text"/.test(html));
{
  const p = newPage();
  p.run(`saved=[${plan('active', 1234.5678)}]`);
  p.run('syncProfileToInputs()');
  check('1,000 or more is displayed, not 0', p.el('inp-existing').value === '1,234.568');
  p.run('saveStep2Inputs()');
  check('the rounded display never replaces the exact value', +p.run('profile.existing') === 1234.5678);
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
  check('viewing excludes the viewed loan from existing', +p.run('profile.existing') === 90);
  p.setActive('results-screen');
  p.run('editProfileBankLimit()');
  fillStep2(p, { limit: '35' });
  p.run('s2Next()');
  check('"change limit" on a saved loan returns to that loan', p.active() === 'results-screen'
    && p.run('_viewingSavedLoan') === true && p.run('_viewingSavedIdx') === 0);
  check('the viewed loan stays open', p.run('form.amount') === '2000');
  check('the viewed loan still excludes itself', +p.run('results.existing') === 90);
  check('the working form underneath is kept', p.run('_savedSnap.form.amount') === '12345');
  check('the new limit survives leaving the view', p.run('_savedSnap.profile.bankLimit') === '35');
  check('the real profile counts both loans', +p.run('_savedSnap.profile.existing') === 240);
}
{
  // Editing a saved loan subtracts it from existing; the profile edit must not add it back.
  const p = newPage();
  p.run(`saved=[${plan('active', 150)},${plan('active', 90)}];_editingLoanIdx=0;profile.existing='90';`);
  p.setActive('step3');
  p.run('editProfile()');
  p.run('goStep(2)');
  fillStep2(p);
  p.run('s2Next()');
  check('a loan being edited is not counted twice', +p.run('profile.existing') === 90);
  check('the edit is still in progress', p.run('_editingLoanIdx') === 0);
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

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed ? 1 : 0);
