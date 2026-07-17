// ==========================================================================
// TradeLog Pro — automated financial engine tests
// ==========================================================================
// This file loads the REAL financial functions out of ../index.html (so the
// tests always run against shipped code, never a copy) and exercises the
// average-cost ledger, partial closes, DCA, fees, short direction, the
// chronological basis migration, and the break-even band.
//
// Run:  node tests/financial-tests.mjs
// Exit code 0 = all pass, 1 = any failure (so CI can gate the build).
// ==========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

// --- Pull the pure financial functions out of index.html by name ----------
const NEEDED = [
  'calcAvgPrice',
  '_tradeEvents',
  'calcPositionState',
  'migrateBasis',
  'calcTotalQty',
  'calcBoughtQty',
  'calcInvestedValue',
  'calcFeesAmt',
  'calcUnrealizedPnl',
  'calcRealizedPnl',
  'calcAddBuyFees',
  'calcPnl',
  'isWin',
  'isLoss',
  'isBreakeven'
];

function extractFunction(src, name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('Function not found in index.html: ' + name);
  // Walk braces from the first { after the signature to find the matching }.
  let i = src.indexOf('{', start);
  if (i === -1) throw new Error('Malformed function: ' + name);
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

// Also pull the BE_EPS constant line the helpers depend on.
let code = 'var BE_EPS = 0.005;\n';
for (const name of NEEDED) code += extractFunction(html, name) + '\n';

// Sandbox: no DOM, just the extracted functions.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.__api = {' + NEEDED.join(',') + '};', sandbox);
const api = sandbox.__api;
const { calcPnl, calcPositionState, calcRealizedPnl, migrateBasis, isWin, isLoss, isBreakeven } = api;

// --- Tiny assertion helpers ----------------------------------------------
let passed = 0, failed = 0;
function approx(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }
function test(name, got, want, eps = 0.01) {
  const ok = approx(got, want, eps);
  if (ok) { passed++; console.log('  \u2713 ' + name + '  (= ' + round(got) + ')'); }
  else { failed++; console.log('  \u2717 ' + name + '  expected ' + want + ', got ' + round(got)); }
}
function assert(name, cond) {
  if (cond) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name); }
}
function round(n) { return Math.round(n * 100) / 100; }

// Trade factory with sane defaults.
function T(o) {
  return Object.assign({
    direction: 'Long', status: 'closed', entry: 0, exit: 0,
    qty: 0, original_qty: 0, entry_date: '2026-01-01', exit_date: '2026-01-10',
    fees: '0', fees_mode: '$', add_buys: [], partial_closes: []
  }, o);
}

console.log('TradeLog Pro — financial engine tests\n');

// 1) Simple long win.
test('1. Long win: buy 10@100, sell 10@110, no fees',
  calcPnl(T({ entry: 100, qty: 10, original_qty: 10, exit: 110 })), 100);

// 2) Simple long loss.
test('2. Long loss: buy 10@100, sell 10@90',
  calcPnl(T({ entry: 100, qty: 10, original_qty: 10, exit: 90 })), -100);

// 3) Short win: price falls.
test('3. Short win: short 10@100, cover 10@80',
  calcPnl(T({ direction: 'Short', entry: 100, qty: 10, original_qty: 10, exit: 80 })), 200);

// 4) Short loss: price rises.
test('4. Short loss: short 10@100, cover 10@120',
  calcPnl(T({ direction: 'Short', entry: 100, qty: 10, original_qty: 10, exit: 120 })), -200);

// 5) Flat percentage fee on a long win (1% of gross).
test('5. Long win with 1% fee: buy 10@100 sell 10@110',
  calcPnl(T({ entry: 100, qty: 10, original_qty: 10, exit: 110, fees: '1', fees_mode: '%' })), 99);

// 6) Flat dollar fee.
test('6. Long win with $5 fee',
  calcPnl(T({ entry: 100, qty: 10, original_qty: 10, exit: 110, fees: '5', fees_mode: '$' })), 95);

// 7) DCA average cost: buy 10@100 then 10@50, sell all 20@80.
test('7. DCA: buy 10@100 + 10@50, sell 20@80 (avg 75 -> +100)',
  calcPnl(T({ entry: 100, qty: 20, original_qty: 10, exit: 80,
    add_buys: [{ id: 'a1', qty: 10, price: 50, date: '2026-01-02', fees: '0', fees_mode: '$' }] })), 100);

// 8) Partial close then final close (both profitable).
test('8. Partial: buy 10@100, partial 5@120, final 5@130',
  calcPnl(T({ entry: 100, qty: 10, original_qty: 10, exit: 130,
    partial_closes: [{ id: 'p1', qty: 5, price: 120, date: '2026-01-05', fees: '0', fees_mode: '$', basis: 100 }] })), 250);

// 9) THE ANALYST CASE: buy 10@100, partial 5@110, add 5@80, final 10@100 => +150.
//    Uses basis snapshots + chronological ledger.
{
  const t = T({ entry: 100, qty: 10, original_qty: 10, exit: 100,
    entry_date: '2026-01-01',
    add_buys: [{ id: 'a1', qty: 5, price: 80, date: '2026-01-10', fees: '0', fees_mode: '$' }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05', fees: '0', fees_mode: '$', basis: 100 }] });
  test('9. Analyst case: partial before add, final close => +150', calcPnl(t), 150);
}

// 10) Remaining-quantity average is correct after partial + add.
{
  const t = T({ status: 'open', entry: 100, qty: 15, original_qty: 10,
    add_buys: [{ id: 'a1', qty: 10, price: 50, date: '2026-01-10' }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05', basis: 100 }] });
  const st = calcPositionState(t);
  // Events in date order: buy10@100, sell5(basis100), buy10@50.
  // After sell: qty5 cost500 avg100. After add: qty15 cost1000 avg~66.67.
  test('10. Remaining avg after partial+add = 66.67', st.avg, 66.67);
  test('10b. Remaining qty after partial+add = 15', st.qty, 15);
}

// 11) migrateBasis backfills a legacy partial close that had no basis.
{
  const t = T({ status: 'open', entry: 100, qty: 5, original_qty: 10,
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05' }] }); // no basis
  migrateBasis(t);
  test('11. migrateBasis fills legacy basis = 100', t.partial_closes[0].basis, 100);
}

// 12) Realized P&L uses each close's own basis, not the shifting average.
//     Buy 10@100, partial 5@110 (basis 100 => +50), then add 10@50.
//     Realized must stay +50 even though the running average later drops.
{
  const t = T({ status: 'open', entry: 100, qty: 15, original_qty: 10,
    add_buys: [{ id: 'a1', qty: 10, price: 50, date: '2026-01-10' }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05', basis: 100 }] });
  test('12. Realized stays +50 after a later cheaper add-buy', calcRealizedPnl(t), 50);
}

// 13) Break-even band: a ~0 P&L is neither win nor loss.
{
  const t = T({ entry: 100, qty: 10, original_qty: 10, exit: 100 }); // exactly flat
  assert('13. Flat trade isBreakeven = true', isBreakeven(t) === true);
  assert('13b. Flat trade isWin = false', isWin(t) === false);
  assert('13c. Flat trade isLoss = false', isLoss(t) === false);
}

// 14) Tiny positive noise under the band is still break-even, not a win.
{
  const t = T({ entry: 100, qty: 1, original_qty: 1, exit: 100.001 }); // +0.001
  assert('14. +0.001 trade is break-even (under band)', isBreakeven(t) === true && isWin(t) === false);
}

// 15) Intraday ordering: with ts, a same-day add AFTER a partial is ordered
//     by ts, not forced before the sell.
{
  // buy 10@100 (entry), same-day partial 5@110 (ts=2), same-day add 5@80 (ts=1)
  // ts says the add happened first that day => events: buy10, add5@80, sell5.
  // After buy10@100 + add5@80: qty15 cost1400 avg93.33; sell5 basis 93.33.
  const t = T({ status: 'open', entry: 100, qty: 10, original_qty: 10,
    entry_date: '2026-01-01',
    add_buys: [{ id: 'a1', qty: 5, price: 80, date: '2026-01-05', ts: 1 }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05', ts: 2 }] });
  const st = calcPositionState(t);
  test('15. Intraday ts orders add before sell (avg 93.33)', st.avg, 93.33);
}

console.log('\n----------------------------------------');
console.log('  Passed: ' + passed + '   Failed: ' + failed);
console.log('----------------------------------------');
if (failed > 0) process.exit(1);
