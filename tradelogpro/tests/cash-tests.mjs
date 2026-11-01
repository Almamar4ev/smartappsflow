// Cash available and deposits linked to buys: the real functions from js/finance.js
// and js/app.js, run in a vm with a small stub of the page.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(__dirname, '..', 'js', f), 'utf8');
const finance = read('finance.js');
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
function assert(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

const sheets = [];
const ctx = {
  Math, JSON, Date, String, parseFloat,
  state: { accounts: [], trades: [] },
  fmtMoney: (v) => '$' + Number(v).toFixed(2),
  esc: (v) => String(v),
  eid: (v) => String(v),
  today: () => '2026-11-01',
  closeModal() {},
  confirmSheet: (opts, cb) => sheets.push({ opts, cb }),
};
vm.createContext(ctx);
vm.runInContext(finance + '\nvar _cashNoDeposit = null;\n' +
  ['cashNoteHtml', 'confirmCashOrGo', 'addLinkedDeposit', 'removeLinkedDeposits', 'restoreLinkedDeposits', 'linkedDepositTotal']
    .map((n) => extractFunction(appJs, n)).join('\n'), ctx);
const run = (code) => vm.runInContext(code, ctx);

console.log('Edgeory — cash and linked deposit tests\n');

const acc = { id: 'a1', name: 'XTB 1', type: 'cash', startingCapital: 1000, transactions: [] };
const open = { id: 't1', accountId: 'a1', direction: 'Long', status: 'open', entry: 50, qty: 10, original_qty: 10,
  fees: 0, fees_mode: '$', add_buys: [], partial_closes: [] };
ctx.state.accounts = [acc]; ctx.state.trades = [open];   // 500 tied up, 500 cash

let saved = null;
run('confirmCashOrGo(state.accounts[0], 400, null, function(d){ this.__saved = d; })');
saved = ctx.__saved;
assert('a buy within the cash saves at once with no deposit', saved === 0 && sheets.length === 0);

run('confirmCashOrGo(state.accounts[0], 2000, null, function(d){ this.__saved = d; })');
assert('a buy past the cash asks first', sheets.length === 1 && /1,?500\.00 deposit|1500\.00 deposit/.test(sheets[0].opts.ok));
sheets[0].cb();
assert('choosing the deposit saves with the exact missing amount (1,500)', ctx.__saved === 1500);
run("__saved = null; _cashNoDeposit && _cashNoDeposit()");
assert('the dialog callback is cleared once used', ctx.__saved === null);

run('confirmCashOrGo(state.accounts[0], 2000, null, function(d){ this.__saved = d; })');
run('_cashNoDeposit()');
assert('Save without deposit saves with 0', ctx.__saved === 0);

run("addLinkedDeposit(state.accounts[0], 1500, '2026-11-01', 't2', null, 'TSLA')");
assert('the deposit is recorded and raises capital to 2,500', acc.transactions.length === 1 && acc.startingCapital === 2500 &&
  acc.transactions[0].tradeId === 't2' && acc.transactions[0].note === 'For TSLA buy');
run("addLinkedDeposit(state.accounts[0], 200, '2026-11-02', 't2', 'b1', 'TSLA')");
assert('two deposits for one trade add up', run("linkedDepositTotal('t2')") === 1700 && run("linkedDepositTotal('t2','b1')") === 200);

const gone = run("removeLinkedDeposits('t2', 'b1')");
assert('deleting one add-buy removes only its deposit', gone.length === 1 && acc.startingCapital === 2500 && acc.transactions.length === 1);
const gone2 = run("removeLinkedDeposits('t2')");
assert('deleting the trade removes its other deposit and capital returns to 1,000', gone2.length === 1 && acc.startingCapital === 1000 && acc.transactions.length === 0);
ctx.__undo = gone2;
run('restoreLinkedDeposits(__undo)');
assert('undo puts the deposit back', acc.transactions.length === 1 && acc.startingCapital === 2500);

const margin = { id: 'm1', name: 'IBKR', type: 'margin', startingCapital: 1000, transactions: [] };
ctx.state.accounts.push(margin);
sheets.length = 0;
run('confirmCashOrGo(state.accounts[1], 5000, null, function(d){ this.__saved = d; })');
assert('a margin account never asks and never adds a deposit', sheets.length === 0 && ctx.__saved === 0);
assert('the margin note shows the part on margin', /4000\.00 on margin/.test(run('cashNoteHtml(state.accounts[1], 5000, null)')));

const untracked = { id: 'u1', name: 'Demo', type: 'cash', startingCapital: 0, transactions: [] };
ctx.state.accounts.push(untracked);
run('confirmCashOrGo(state.accounts[2], 5000, null, function(d){ this.__saved = d; })');
assert('an account with no capital and no deposits is not checked', sheets.length === 0 && ctx.__saved === 0 &&
  run('cashNoteHtml(state.accounts[2], 5000, null)') === '');

// Reloading the app runs every account through the sanitizer: the account type
// and the deposit links must survive it, and a bad link must not.
const sctx = {};
vm.createContext(sctx);
vm.runInContext(read('sanitize.js'), sctx);
const clean = vm.runInContext('_sanAccount', sctx)({ id: 'a1', name: 'X', type: 'margin', startingCapital: 5, transactions: [
  { id: 'tx_1', type: 'deposit', amount: 10, date: '2026-11-01', tradeId: 'tr_9', buyId: 'b1x', note: 'For TSLA buy' },
  { id: 'tx_2', type: 'deposit', amount: 3, date: '2026-11-01', tradeId: 'bad id<script>' }] });
assert('reload keeps the account type and the deposit link', clean.type === 'margin' &&
  clean.transactions[0].tradeId === 'tr_9' && clean.transactions[0].buyId === 'b1x' && clean.transactions[0].note === 'For TSLA buy');
assert('reload drops a malformed link and defaults the type to cash', !('tradeId' in clean.transactions[1]) &&
  vm.runInContext('_sanAccount', sctx)({ id: 'a2', name: 'Y', type: 'weird' }).type === 'cash');

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
