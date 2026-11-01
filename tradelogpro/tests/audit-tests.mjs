// Regression tests for the v27 code audit (1 Nov 2026): each case is the example
// from the audit report, run against the real functions in js/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(__dirname, '..', 'js', f), 'utf8');
const appJs = read('app.js');

function extractFunction(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('unbalanced ' + name);
}

let passed = 0, failed = 0;
function assert(name, cond, got) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (got !== undefined ? '  (got ' + JSON.stringify(got) + ')' : '')); }
}
const near = (a, b) => Math.abs(a - b) < 0.01;

const toasts = [];
const dom = {};
const ctx = {
  Math, JSON, Date, String, Object, parseFloat, isNaN,
  state: { accounts: [], trades: [] },
  today: () => '2026-11-01',
  safeTicker: (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 15),
  showToast: (m) => toasts.push(m),
  document: { getElementById: (id) => dom[id] || null },
  save() {}, renderSidebar() {}, renderMain() {}, closeModal() {},
  fmtMoney: (v) => '$' + Number(v).toFixed(2),
};
vm.createContext(ctx);
vm.runInContext(read('finance.js') + '\n' + read('equity.js') + '\n' +
  ['realizedEquityEvents', 'reportData', 'parseT212Csv', 'confirmCSVImport', 'confirmCashOrGo', 'addLinkedDeposit']
    .map((n) => extractFunction(appJs, n)).join('\n') + '\nvar _cashNoDeposit = null;', ctx);
const run = (code) => vm.runInContext(code, ctx);
const mk = (o) => Object.assign({ id: 't' + Math.random().toString(36).slice(2, 7), accountId: 'a1', direction: 'Long',
  fees: 0, fees_mode: '$', add_buys: [], partial_closes: [] }, o);

console.log('Edgeory — code audit regression tests\n');

// P1: correcting the entry price after a partial sell must correct that sell's profit.
{
  const t = mk({ status: 'open', entry: 100, qty: 5, original_qty: 10, entry_date: '2026-10-01',
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-10-05', fees: 0, fees_mode: '$', basis: 100 }] });
  ctx.t = t;
  assert('P1 before the fix: 5 sold @110 on a 100 buy = +50', near(run('calcRealizedPnl(t)'), 50));
  t.entry = 120; run('rebuildBasis(t)');
  assert('P1 entry corrected to 120: the same sell is now -50', near(run('calcRealizedPnl(t)'), -50), run('calcRealizedPnl(t)'));
  assert('P1 the stored basis follows (120)', near(t.partial_closes[0].basis, 120));
}
// rebuildBasis keeps chronology: a buy after the sell does not change that sell.
{
  const t = mk({ status: 'open', entry: 100, qty: 15, original_qty: 10, entry_date: '2026-01-01',
    add_buys: [{ id: 'b1', qty: 10, price: 50, date: '2026-01-03', fees: 0, fees_mode: '$' }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-02', fees: 0, fees_mode: '$', basis: 75 }] });
  ctx.t = t; run('rebuildBasis(t)');
  assert('rebuildBasis: a sell before a later buy keeps the earlier cost (100, not 75)', near(t.partial_closes[0].basis, 100), t.partial_closes[0].basis);
}

// P2 break-even: buy 10@100, sell 5, buy 10@50 -> 15 held at 66.67; lifetime avg 75.
{
  const t = mk({ status: 'open', entry: 100, qty: 15, original_qty: 10, entry_date: '2026-01-01',
    add_buys: [{ id: 'b1', qty: 10, price: 50, date: '2026-01-03', fees: 0, fees_mode: '$' }],
    partial_closes: [{ id: 'p1', qty: 5, price: 110, date: '2026-01-02', fees: 0, fees_mode: '$', basis: 100 }] });
  ctx.t = t;
  const d = run('calcDcaSummary(t)');
  assert('Break-even uses the shares still held (66.67)', near(d.breakEven, 66.6667), d.breakEven);
  assert('lifetime average stays available (75)', near(d.avg, 75));
}

// P2 cash: fees paid on a position still open leave the cash at once.
{
  const acc = { id: 'a1', startingCapital: 2000 };
  const t = mk({ status: 'open', entry: 50, qty: 20, original_qty: 10, fees: 5, fees_mode: '$', entry_date: '2026-01-01',
    add_buys: [{ id: 'b1', qty: 10, price: 50, date: '2026-01-02', fees: '10', fees_mode: '$' }] });
  ctx.acc = acc; ctx.t = t;
  assert('Cash: 2,000 - 1,000 shares - 15 fees = 985 while open', near(run('calcAccountCash(acc, [t])'), 985), run('calcAccountCash(acc, [t])'));
  t.status = 'closed'; t.exit = 50; t.exit_date = '2026-01-05';
  assert('Cash after selling all 20 flat at 50: 2,000 - 15 fees = 1,985 (fees counted once)', near(run('calcAccountCash(acc, [t])'), 1985), run('calcAccountCash(acc, [t])'));
}
// A trade closed by its last partial sell still pays its own $ buy fee.
{
  const t = mk({ status: 'closed', entry: 100, qty: 0, original_qty: 10, fees: 5, fees_mode: '$', entry_date: '2026-01-01', exit: 110, exit_date: '2026-01-04',
    partial_closes: [{ id: 'p1', qty: 10, price: 110, date: '2026-01-04', fees: 0, fees_mode: '$', basis: 100 }] });
  ctx.t = t;
  assert('Closed through partial sells: +100 gross - $5 buy fee = +95', near(run('calcPnl(t)'), 95), run('calcPnl(t)'));
  assert('and the fees shown for it include that $5', near(run('calcTradeFees(t)'), 5), run('calcTradeFees(t)'));
}

// P1 report: P&L belongs to the day it was realized.
{
  ctx.state.trades = [
    mk({ id: 'sep', ticker: 'AAA', status: 'closed', entry: 10, qty: 10, original_qty: 10, entry_date: '2026-09-20', exit: 12, exit_date: '2026-10-10' }),
    mk({ id: 'nov', ticker: 'BBB', status: 'closed', entry: 10, qty: 10, original_qty: 10, entry_date: '2026-10-20', exit: 15, exit_date: '2026-11-01' }),
    mk({ id: 'part', ticker: 'CCC', status: 'open', entry: 20, qty: 5, original_qty: 10, entry_date: '2026-09-01',
      partial_closes: [{ id: 'pc', qty: 5, price: 30, date: '2026-10-15', fees: 0, fees_mode: '$' }] }),
  ];
  run("rebuildBasis(state.trades[2])");
  const R = run("reportData({ accId: 'all', from: '2026-10-01', to: '2026-10-31' })");
  const ids = R.rows.map((r) => r.t.id).sort();
  assert('Report October: September buy closed in October is included', ids.includes('sep'));
  assert('Report October: October buy closed in November is not', !ids.includes('nov'));
  assert('Report October: the partial sell made in October counts (+50)', R.rows.find((r) => r.t.id === 'part') && near(R.rows.find((r) => r.t.id === 'part').pnl, 50));
  assert('Report October: realized P&L = 20 + 50 = 70', near(R.pnl, 70), R.pnl);
  assert('Report October: 1 closed, 1 partly sold, the open position listed apart', R.closed === 1 && R.partly === 1 && R.open.length === 1);
  const N = run("reportData({ accId: 'all', from: '2026-11-01', to: '2026-11-30' })");
  assert('Report November: the October buy closed in November shows here (+50)', N.rows.length === 1 && N.rows[0].t.id === 'nov' && near(N.pnl, 50));
}

// P2 Trading 212: rows newest first, fees shared out, re-import skipped.
const csv = [
  'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total,Transaction fee,Currency conversion fee',
  'Market sell,2026-03-10 15:00:00,US0,AAPL,Apple,5,120,USD,1,100,600,0.50,1.00',
  'Market buy,2026-02-01 10:00:00,US0,AAPL,Apple,10,100,USD,1,,1000,0,2.00',
].join('\n');
{
  const res = run('parseT212Csv(' + JSON.stringify(csv) + ')');
  const closed = res.parsed.find((p) => p.status === 'closed'), open = res.parsed.find((p) => p.status === 'open');
  assert('CSV newest-first: the sell still pairs with the earlier buy (none skipped)', res.unmatched === 0 && closed && closed.qty === 5, res);
  assert('CSV: 5 shares stay open from the 10 bought', open && open.qty === 5);
  assert('CSV fees: closed lot = half the buy fee (1.00) + the sell fees (1.50) = 2.50', closed && near(closed.fees, 2.5), closed && closed.fees);
  ctx.state.trades = []; ctx.state.accounts = [{ id: 'a1', name: 'T212', type: 'cash', startingCapital: 0, transactions: [] }];
  dom.csvTargetAccount = { value: 'a1' };
  ctx.window = { _csvParsed: res.parsed };
  run('confirmCSVImport()');
  assert('CSV import adds 2 trades', ctx.state.trades.length === 2, ctx.state.trades.length);
  ctx.window._csvParsed = run('parseT212Csv(' + JSON.stringify(csv) + ')').parsed;
  run('confirmCSVImport()');
  assert('Importing the same file again adds nothing', ctx.state.trades.length === 2 && /already in this account/.test(toasts.at(-1)), toasts.at(-1));
}

// P2 Balance curve: each account's capital starts with that account.
{
  const accounts = [
    { id: 'A', startingCapital: 5000, transactions: [], createdAt: '2025-01-01T09:00:00.000Z' },
    { id: 'B', startingCapital: 10000, transactions: [], createdAt: '2026-03-01T09:00:00.000Z' },
  ];
  const trades = [mk({ accountId: 'A', status: 'closed', entry: 10, qty: 10, original_qty: 10, entry_date: '2025-02-01', exit: 11, exit_date: '2025-06-01' })];
  ctx.accounts = accounts; ctx.trades2 = trades;
  const pts = run('equitySeries(trades2, accounts)');
  const mid = pts.filter((p) => p.t <= Date.parse('2025-12-31T12:00:00')).pop();
  assert('Balance in 2025 holds only account A (5,000 + 10), not B', mid && near(mid.bal, 5010), mid && mid.bal);
  assert('Balance today includes B from March 2026 (15,010)', near(pts[pts.length - 1].bal, 15010), pts[pts.length - 1].bal);
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
