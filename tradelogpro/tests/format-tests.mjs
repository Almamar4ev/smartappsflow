import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'js', 'sanitize.js'), 'utf8');

function extractFunction(name) {
  const marker = 'function ' + name + '(';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('Function not found: ' + name);
  let i = src.indexOf('{', start), depth = 0, quote = null, prev = '';
  for (; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { i++; break; }
    prev = c;
  }
  return src.slice(start, i);
}

const sandbox = { localStorage: { getItem: function(){ return 'on'; } } };
vm.createContext(sandbox);
vm.runInContext(
  'function currSym(){ return "$"; }\n' +
  extractFunction('_fmtAbs') + '\n' +
  extractFunction('fmtMoney') + '\n' +
  extractFunction('fmtPnl') + '\n' +
  extractFunction('fmtPrice') + '\n' +
  extractFunction('fmtQty') + '\n' +
  extractFunction('fmtPct') + '\n' +
  extractFunction('fmtWinRate') + '\n' +
  extractFunction('fmtDateLong') + '\n' +
  extractFunction('fmtN') + '\n' +
  'this.fmtMoney=fmtMoney;this.fmtPnl=fmtPnl;this.fmtPrice=fmtPrice;this.fmtQty=fmtQty;this.fmtPct=fmtPct;this.fmtWinRate=fmtWinRate;this.fmtDateLong=fmtDateLong;this.fmtN=fmtN;',
  sandbox
);

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('Edgeory — display number format tests\n');

assert('fmtMoney(1234) drops .00', sandbox.fmtMoney(1234) === '$1,234');
assert('fmtMoney(1234.5) keeps 2dp', sandbox.fmtMoney(1234.5) === '$1,234.50');
assert('fmtMoney(0) is $0', sandbox.fmtMoney(0) === '$0');
assert('fmtMoney tiny is $0', sandbox.fmtMoney(0.001) === '$0');
assert('fmtPnl positive whole', sandbox.fmtPnl(250) === '+$250');
assert('fmtPnl negative cents', sandbox.fmtPnl(-12.5) === '-$12.50');
assert('fmtPnl near-zero is $0', sandbox.fmtPnl(0.002) === '$0');
assert('fmtPrice always 2dp', sandbox.fmtPrice(58.7) === '$58.70');
assert('fmtPrice thousands', sandbox.fmtPrice(1234.5) === '$1,234.50');
assert('fmtPrice under 1 uses 4dp', sandbox.fmtPrice(0.9483) === '$0.9483');
assert('fmtQty whole', sandbox.fmtQty(200) === '200');
assert('fmtQty cents', sandbox.fmtQty(14.22) === '14.22');
assert('fmtQty under 1', sandbox.fmtQty(0.6496).indexOf('0.6496') === 0);
assert('fmtPct drops .00', sandbox.fmtPct(10) === '+10%');
assert('fmtPct 2dp', sandbox.fmtPct(-5.79) === '-5.79%');
assert('fmtWinRate drops .0', sandbox.fmtWinRate(50) === '50%');
assert('fmtWinRate 1dp', sandbox.fmtWinRate(66.666) === '66.7%');
assert('fmtDateLong', sandbox.fmtDateLong('2026-10-01') === '01 Oct 2026');
assert('fmtN aliases fmtMoney', sandbox.fmtN(1000) === sandbox.fmtMoney(1000));

console.log('\nPassed: ' + passed);
console.log('Failed: ' + failed);
if (failed) process.exit(1);
