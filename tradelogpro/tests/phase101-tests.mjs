import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const storageSrc = readFileSync(join(root, 'js', 'storage.js'), 'utf8');
const financeSrc = readFileSync(join(root, 'js', 'finance.js'), 'utf8');
const appSrc = readFileSync(join(root, 'js', 'app.js'), 'utf8');
const cssSrc = readFileSync(join(root, 'css', 'app.css'), 'utf8');

function extractFunction(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('Function not found: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0, inStr = null, prev = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else if (c === '"' || c === "'" || c === '`') {
      inStr = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
    prev = c;
  }
  return src.slice(start, i);
}

let passed = 0, failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 0.0001); }

console.log('Edgeory — 1.0.1 tests\n');

const dateSandbox = {};
vm.createContext(dateSandbox);
vm.runInContext(
  extractFunction(storageSrc, 'localDateStr') + '\n' +
  extractFunction(storageSrc, 'parseLocalDate') + '\n' +
  extractFunction(storageSrc, 'today') + '\n' +
  'this.localDateStr = localDateStr; this.parseLocalDate = parseLocalDate; this.today = today;',
  dateSandbox
);
const { localDateStr, parseLocalDate, today } = dateSandbox;

assert('localDateStr(local 28 Oct 2026 20:00) => 2026-10-28',
  localDateStr(new Date(2026, 9, 28, 20, 0, 0)) === '2026-10-28');
assert('localDateStr(local 29 Oct 2026 02:00) => 2026-10-29',
  localDateStr(new Date(2026, 9, 29, 2, 0, 0)) === '2026-10-29');
assert("parseLocalDate('2026-10-26').getDay() === 1",
  parseLocalDate('2026-10-26').getDay() === 1);
assert('today() matches localDateStr(new Date())', today() === localDateStr(new Date()));
assert('today() in storage.js uses localDateStr, not toISOString',
  /function today\(\)\s*\{\s*return localDateStr\(new Date\(\)\)/.test(storageSrc));

function runInTZ(tz, script) {
  return spawnSync(process.execPath, ['-e', script], {
    env: Object.assign({}, process.env, { TZ: tz }),
    encoding: 'utf8'
  });
}
const tzScript = [
  'function localDateStr(d){var y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();return y+"-"+(m<10?"0":"")+m+"-"+(day<10?"0":"")+day;}',
  'function today(){return localDateStr(new Date());}',
  'var evening=new Date(2026,9,28,20,0,0);',
  'var dawn=new Date(2026,9,29,2,0,0);',
  'console.log(JSON.stringify({tz:Intl.DateTimeFormat().resolvedOptions().timeZone,eveningLocal:localDateStr(evening),eveningIso:evening.toISOString().split("T")[0],dawnLocal:localDateStr(dawn),dawnIso:dawn.toISOString().split("T")[0]}));'
].join('');

const ny = runInTZ('America/New_York', tzScript);
const muscat = runInTZ('Asia/Muscat', tzScript);
let nyData = null, muscatData = null;
try { nyData = JSON.parse((ny.stdout || '').trim()); } catch (e) {}
try { muscatData = JSON.parse((muscat.stdout || '').trim()); } catch (e) {}

assert('America/New_York 20:00 on 2026-10-28 => localDateStr 2026-10-28',
  !!(nyData && nyData.eveningLocal === '2026-10-28'));
assert('Asia/Muscat 02:00 on 2026-10-29 => localDateStr 2026-10-29',
  !!(muscatData && muscatData.dawnLocal === '2026-10-29'));
if (nyData && nyData.tz === 'America/New_York') {
  assert('NY evening is the next UTC date via toISOString (the old bug)',
    nyData.eveningIso === '2026-10-29');
} else {
  assert('NY TZ applied or localDateStr still returns calendar date',
    !!(nyData && nyData.eveningLocal === '2026-10-28'));
}
if (muscatData && muscatData.tz === 'Asia/Muscat') {
  assert('Muscat dawn is the previous UTC date via toISOString (the old bug)',
    muscatData.dawnIso === '2026-10-28');
} else {
  assert('Muscat TZ applied or localDateStr still returns calendar date',
    !!(muscatData && muscatData.dawnLocal === '2026-10-29'));
}

const FINANCE = [
  'calcAvgPrice', '_tradeEvents', 'calcPositionState', 'migrateBasis',
  'calcTotalQty', 'calcBoughtQty', 'calcInvestedValue', 'calcFeesAmt',
  'calcUnrealizedPnl', 'calcRealizedPnl', 'calcAddBuyFees', 'calcPnl',
  'isWin', 'isLoss', 'isBreakeven', 'calcDcaSummary'
];
let financeCode = 'var BE_EPS = 0.005;\n';
for (const name of FINANCE) financeCode += extractFunction(financeSrc, name) + '\n';
financeCode += extractFunction(appSrc, 'getAccountScopedTrades') + '\n';
financeCode += extractFunction(appSrc, 'getVisibleTrades') + '\n';
financeCode += 'function getAccountTrades(aid){ return state.trades.filter(function(t){ return t.accountId===aid; }); }\n';
financeCode += 'function getActiveAccount(){ return state.accounts[0] || null; }\n';

const vis = {
  filterAccountId: 'all',
  window: { _tradeSort: 'pnl_desc', _tradeFilter: 'all', _tradeSearch: '' },
  state: {
    accounts: [{ id: 'a1' }],
    trades: [
      { id: 't1', accountId: 'a1', ticker: 'AAA', status: 'closed', direction: 'Long', entry: 10, exit: 11, qty: 10, original_qty: 10, fees: '0', fees_mode: '$', add_buys: [], partial_closes: [] },
      { id: 't2', accountId: 'a1', ticker: 'ZZZ', status: 'closed', direction: 'Long', entry: 10, exit: 20, qty: 10, original_qty: 10, fees: '0', fees_mode: '$', add_buys: [], partial_closes: [] },
      { id: 't3', accountId: 'a1', ticker: 'MMM', status: 'closed', direction: 'Long', entry: 10, exit: 9, qty: 10, original_qty: 10, fees: '0', fees_mode: '$', add_buys: [], partial_closes: [] }
    ]
  }
};
vm.createContext(vis);
vm.runInContext(financeCode + '\nthis.getVisibleTrades=getVisibleTrades; this.calcDcaSummary=calcDcaSummary;', vis);
const ranked = vis.getVisibleTrades();
assert('getVisibleTrades pnl_desc returns highest P&L first (ZZZ)',
  ranked.length === 3 && ranked[0].ticker === 'ZZZ' && ranked[2].ticker === 'MMM');

const dcaTrade = {
  direction: 'Long', status: 'open', entry: 10, qty: 50, original_qty: 100,
  fees: '0', fees_mode: '$',
  add_buys: [{ id: 'b1', qty: 100, price: 20, date: '2026-10-02' }],
  partial_closes: [{ id: 'p1', qty: 150, price: 25, date: '2026-10-03', fees: '0', fees_mode: '$' }]
};
const dca = vis.calcDcaSummary(dcaTrade);
assert('calcDcaSummary avg is 15.00 after 100@10 + 100@20 then partial 150', approx(dca.avg, 15));
assert('calcDcaSummary totalShares is 200 (not remaining 50)', approx(dca.totalShares, 200));
assert('calcDcaSummary buys is 2', dca.buys === 2);

assert('css/app.css does not contain IBM Plex Mono', cssSrc.indexOf('IBM Plex Mono') === -1);
assert('css/app.css defines Roboto', cssSrc.indexOf("font-family:'Roboto'") !== -1);

console.log('\nPassed: ' + passed);
console.log('Failed: ' + failed);
if (failed) process.exit(1);
