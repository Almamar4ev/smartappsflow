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
  plural: (n, one, many) => n + ' ' + (n === 1 ? one : many),
};
vm.createContext(ctx);
vm.runInContext(read('finance.js') + '\n' + read('equity.js') + '\n' +
  ['realizedEquityEvents', 'reportData', 'parseT212Csv', 'planCsvImport', 'confirmCSVImport', 'confirmCashOrGo', 'addLinkedDeposit']
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
  // Open on 31 Oct: CCC (still held) and BBB (bought 20 Oct, sold 1 Nov) — as they stood then.
  assert('Report October: 1 closed, 1 partly sold, 2 positions open on 31 Oct', R.closed === 1 && R.partly === 1 && R.open.length === 2, R.open.map((o) => o.t.id));
  const N = run("reportData({ accId: 'all', from: '2026-11-01', to: '2026-11-30' })");
  assert('Report November: the October buy closed in November shows here (+50)', N.rows.length === 1 && N.rows[0].t.id === 'nov' && near(N.pnl, 50));
}

// R2-08: an add-buy in November is not in a report ending 31 October.
{
  ctx.state.trades = [mk({ id: 'pos', ticker: 'POS', status: 'open', entry: 10, qty: 20, original_qty: 10, entry_date: '2026-09-01',
    add_buys: [{ id: 'nb', qty: 10, price: 20, date: '2026-11-05', fees: 0, fees_mode: '$' }] })];
  const R = run("reportData({ accId: 'all', from: '2026-10-01', to: '2026-10-31' })");
  assert('R2-08 October report holds 10 shares at 10 (not the November buy)', R.open.length === 1 && near(R.open[0].qty, 10) && near(R.open[0].cost, 100), R.open[0]);
  const T = run("reportData({ accId: 'all', from: '', to: '' })");
  assert('R2-08 with no end date: today, 20 shares', near(T.open[0].qty, 20));
}
// R2-09: partial +100 in September, final -50 in October (whole trade +50).
{
  ctx.state.trades = [mk({ id: 'w', ticker: 'W', status: 'closed', entry: 10, qty: 0, original_qty: 20, entry_date: '2026-08-01', exit: 7.5, exit_date: '2026-10-10',
    partial_closes: [{ id: 'p1', qty: 10, price: 20, date: '2026-09-10', fees: 0, fees_mode: '$' }, { id: 'p2', qty: 10, price: 5, date: '2026-10-10', fees: 0, fees_mode: '$' }] })];
  run('rebuildBasis(state.trades[0])');
  const R = run("reportData({ accId: 'all', from: '2026-10-01', to: '2026-10-31' })");
  assert('R2-09 October P&L is -50 (the October sell only)', near(R.pnl, -50), R.pnl);
  assert('R2-09 win rate counts the trade by its whole result (+50 = win), as labelled', R.closed === 1 && R.wins === 1);
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

// Re-importing a newer Trading 212 file: 10 trades, then 5 more opened since.
{
  const hdr = 'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total,Transaction fee';
  const row = (act, time, tk, sh, px) => [act, time, 'X', tk, tk, sh, px, 'USD', 1, '', sh * px, 0].join(',');
  // File 1: 9 closed round trips + AAPL bought and still open = 10 trades
  const f1 = [hdr];
  for (let k = 1; k <= 9; k++) { f1.push(row('Market buy', `2026-0${1 + (k % 8)}-0${k} 10:00:00`, 'T' + k, 10, 20)); f1.push(row('Market sell', `2026-0${1 + (k % 8)}-2${k} 10:00:00`, 'T' + k, 10, 22)); }
  f1.push(row('Market buy', '2026-05-01 10:00:00', 'AAPL', 10, 100));
  // File 2: everything in file 1, AAPL now sold, plus 5 new trades
  const f2 = f1.slice();
  f2.push(row('Market sell', '2026-06-01 10:00:00', 'AAPL', 10, 120));
  for (let k = 1; k <= 5; k++) f2.push(row('Market buy', `2026-07-0${k} 10:00:00`, 'N' + k, 5, 50));
  const runImport = (text) => { ctx.window = { _csvParsed: run('parseT212Csv(' + JSON.stringify(text.join('\n')) + ')').parsed }; run('confirmCSVImport()'); };
  ctx.state.trades = []; ctx.state.accounts = [{ id: 'a1', name: 'T212', type: 'cash', startingCapital: 0, transactions: [] }];
  dom.csvTargetAccount = { value: 'a1' };
  runImport(f1);
  const aapl = ctx.state.trades.find((t) => t.ticker === 'AAPL');
  assert('Sync: first file gives 10 trades, AAPL open', ctx.state.trades.length === 10 && aapl && aapl.status === 'open', ctx.state.trades.length);
  aapl.notes = 'my note';
  runImport(f2);
  const aapl2 = ctx.state.trades.filter((t) => t.ticker === 'AAPL');
  assert('Sync: second file adds only the 5 new trades (15, not 25)', ctx.state.trades.length === 15, ctx.state.trades.length);
  assert('Sync: AAPL is the same trade, now closed at 120, note kept (no duplicate)',
    aapl2.length === 1 && aapl2[0].id === aapl.id && aapl2[0].status === 'closed' && aapl2[0].exit === 120 && aapl2[0].notes === 'my note', aapl2);
  assert('Sync: the toast says what happened', /5 new trades/.test(toasts.at(-1)) && /1 updated/.test(toasts.at(-1)) && /9 already here/.test(toasts.at(-1)), toasts.at(-1));
  // Partly sold since the last import: 4 of 10 sold
  ctx.state.trades = [];
  runImport(f1);
  const open1 = ctx.state.trades.find((t) => t.ticker === 'AAPL');
  const f3 = f1.concat([row('Market sell', '2026-06-01 10:00:00', 'AAPL', 4, 120)]);
  runImport(f3);
  const after = ctx.state.trades.filter((t) => t.ticker === 'AAPL');
  const keep = after.find((t) => t.id === open1.id), sold = after.find((t) => t.id !== open1.id);
  assert('Sync partly sold: the open trade keeps 6 shares, the 4 sold are a closed trade',
    after.length === 2 && keep && keep.status === 'open' && keep.original_qty === 6 && sold && sold.status === 'closed' && sold.qty === 4, after);
}

// Second audit R2-01..R2-03: one fee policy. Buy fees leave cash when paid and
// enter realized P&L (and Fees paid) once, when the trade fully closes.
{
  const acc = { id: 'a1', startingCapital: 2000 };
  const t = mk({ status: 'open', entry: 100, qty: 10, original_qty: 10, fees: 5, fees_mode: '$', current_price: 100, entry_date: '2026-01-01' });
  ctx.acc = acc; ctx.t = t;
  const bal = () => 2000 + run('calcRealizedTotal(t)');
  const openBook = () => (t.status === 'open' ? run('calcPositionState(t).cost') + run('calcOpenBuyFees(t)') : 0);
  assert('R2-01 open: cash 995', near(run('calcAccountCash(acc, [t])'), 995));
  assert('R2-01 open: Balance = cash + open cost + buy fee paid (2000 = 995 + 1000 + 5)', near(bal(), run('calcAccountCash(acc, [t])') + openBook()));
  assert('R2-01 open: nothing realized yet, so P&L 0 and Fees paid 0 (fee is in the open cost)', near(run('calcRealizedTotal(t)'), 0) && near(run('calcTradeFees(t)'), 0));
  assert('R2-01 open with a price: P&L if sold now = -5 (the buy fee)', near(run('calcPnl(t)'), -5), run('calcPnl(t)'));
  t.partial_closes = [{ id: 'p1', qty: 5, price: 110, date: '2026-01-05', fees: 0, fees_mode: '$' }]; t.qty = 5; run('rebuildBasis(t)');
  assert('R2-02 after selling 5@110: realized +50, cash 1545, Balance reconciles', near(run('calcRealizedTotal(t)'), 50) && near(run('calcAccountCash(acc, [t])'), 1545) && near(bal(), run('calcAccountCash(acc, [t])') + openBook()));
  t.partial_closes.push({ id: 'p2', qty: 5, price: 120, date: '2026-01-09', fees: 0, fees_mode: '$' }); t.qty = 0; t.status = 'closed'; t.exit = 120; t.exit_date = '2026-01-09'; run('rebuildBasis(t)');
  const evs = run('tradeRealizedEvents(t)');
  assert('R2-02 closed: P&L = 50 + 100 - 5 fee once = 145, Fees paid 5', near(run('calcPnl(t)'), 145) && near(run('calcTradeFees(t)'), 5));
  assert('R2-02 the sum of the realized events equals the trade P&L', near(evs.reduce((s, e) => s + e.pnl, 0), run('calcPnl(t)')));
  assert('R2-02 closed: Balance = cash (2145)', near(bal(), 2145) && near(run('calcAccountCash(acc, [t])'), 2145));
  const u = mk({ status: 'open', entry: 100, qty: 20, original_qty: 10, fees: 5, fees_mode: '$', entry_date: '2026-01-01',
    add_buys: [{ id: 'b', qty: 10, price: 100, date: '2026-01-02', fees: '10', fees_mode: '$' }] });
  ctx.u = u;
  assert('R2-03 open with add-buy fee: realized 0 and Fees paid 0, same rule for both buy fees', near(run('calcRealizedTotal(u)'), 0) && near(run('calcTradeFees(u)'), 0) && near(run('calcPnl(u)'), 0));
  assert('R2-03 cash 2000 - 2000 cost - 15 fees = -15; Balance reconciles', near(run('calcAccountCash(acc, [u])'), -15) && near(2000, run('calcAccountCash(acc, [u])') + run('calcPositionState(u).cost') + run('calcOpenBuyFees(u)')));
  u.status = 'closed'; u.exit = 100; u.exit_date = '2026-01-05';
  assert('R2-03 closed flat: P&L -15 and Fees paid 15, each fee once', near(run('calcPnl(u)'), -15) && near(run('calcTradeFees(u)'), 15));
}

// R2-12: two buys of the same ticker, day and price; re-import must not merge or double them.
{
  const hdr = 'Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total,Transaction fee';
  const f = [hdr, 'Market buy,2026-03-02 10:00:00,X,ZZ,ZZ,10,50,USD,1,,500,0', 'Market buy,2026-03-02 10:05:00,X,ZZ,ZZ,10,50,USD,1,,500,0',
    'Market sell,2026-03-09 10:00:00,X,ZZ,ZZ,15,60,USD,1,150,900,0'].join('\r\n');   // CRLF line ends
  const res = run('parseT212Csv(' + JSON.stringify(f) + ')');
  const sum = (st) => res.parsed.filter((p) => p.status === st).reduce((s, p) => s + p.qty, 0);
  assert('R2-12 CRLF file parses; FIFO: 15 closed, 5 still open from 20 bought', !res.error && sum('closed') === 15 && sum('open') === 5, res);
  ctx.state.trades = []; ctx.state.accounts = [{ id: 'a1', name: 'T', type: 'cash', startingCapital: 0, transactions: [] }];
  dom.csvTargetAccount = { value: 'a1' };
  ctx.window = { _csvParsed: res.parsed }; run('confirmCSVImport()');
  const n1 = ctx.state.trades.length;
  ctx.window = { _csvParsed: run('parseT212Csv(' + JSON.stringify(f) + ')').parsed }; run('confirmCSVImport()');
  assert('R2-12 re-importing keeps the same pieces (no merge, no double)', ctx.state.trades.length === n1 && n1 === 3, [n1, ctx.state.trades.length]);
}
// Quoted fields with commas parse.
{
  const f = ['Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total',
    'Market buy,2026-04-01 10:00:00,X,QQ,"Name, Inc.",4,25,USD,1,,100'].join('\n');
  const res = run('parseT212Csv(' + JSON.stringify(f) + ')');
  assert('a quoted name with a comma does not shift the columns', res.parsed && res.parsed[0].qty === 4 && res.parsed[0].entry === 25, res);
}
// R2-13: price in another currency than the fees -> fees left out and reported.
{
  const f = ['Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total,Currency conversion fee',
    'Market buy,2026-05-01 10:00:00,X,EU,EU,10,100,USD,1.0850,,921.66,1.38'].join('\n');
  const res = run('parseT212Csv(' + JSON.stringify(f) + ')');
  assert('R2-13 other-currency row: fee not mixed in, and counted for the warning', res.otherCurrency === 1 && res.parsed[0].fees === 0, res);
}
// A trade entered by hand that looks like a broker lot is never changed by an import.
{
  ctx.state.trades = [mk({ id: 'manual1', accountId: 'a1', ticker: 'MM', status: 'open', entry: 30, qty: 10, original_qty: 10, entry_date: '2026-06-01', notes: 'mine' })];
  const f = ['Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Currency (Price / share),Exchange rate,Result,Total',
    'Market buy,2026-06-01 10:00:00,X,MM,MM,10,30,USD,1,,300', 'Market sell,2026-06-20 10:00:00,X,MM,MM,10,33,USD,1,30,330'].join('\n');
  ctx.window = { _csvParsed: run('parseT212Csv(' + JSON.stringify(f) + ')').parsed }; run('confirmCSVImport()');
  const m = ctx.state.trades.find((t) => t.id === 'manual1');
  assert('manual trade stays open and unchanged; the import adds its own closed trade', m && m.status === 'open' && m.original_qty === 10 && ctx.state.trades.length === 2, ctx.state.trades.map((t) => [t.id, t.status]));
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
