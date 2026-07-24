import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(src, name) {
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

const sandbox = {};
vm.createContext(sandbox);
['fmtReportNum', 'fmtReportQty', 'closeEventLabel'].forEach(function (fn) {
  vm.runInContext(extractFunction(html, fn) + '\nthis.' + fn + '=' + fn + ';', sandbox);
});
const { fmtReportNum, fmtReportQty, closeEventLabel } = sandbox;

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('TradeLog Pro — report display formatting tests\n');

// fmtReportNum: thousands separators + 2 decimals, keeps sign
assert('fmtReportNum(100000) => "100,000.00"', fmtReportNum(100000) === '100,000.00');
assert('fmtReportNum(-5778.01) => "-5,778.01"', fmtReportNum(-5778.01) === '-5,778.01');
assert('fmtReportNum(1234.5) => "1,234.50"', fmtReportNum(1234.5) === '1,234.50');
assert('fmtReportNum(0) => "0.00"', fmtReportNum(0) === '0.00');
assert('fmtReportNum(999.99) has no comma', fmtReportNum(999.99) === '999.99');

// fmtReportQty: separators, trims trailing zeros
assert('fmtReportQty(1500) => "1,500"', fmtReportQty(1500) === '1,500');
assert('fmtReportQty(12.5) => "12.5"', fmtReportQty(12.5) === '12.5');
assert('fmtReportQty(189.054) => "189.054"', fmtReportQty(189.054) === '189.054');

// closeEventLabel: final sell on a closed trade is CLOSE, others PARTIAL CLOSE
assert('full close on closed trade => CLOSE',
  closeEventLabel({ status: 'closed', partial_closes: [{}] }, 0) === 'CLOSE');
assert('sell on still-open trade => PARTIAL CLOSE',
  closeEventLabel({ status: 'open', partial_closes: [{}] }, 0) === 'PARTIAL CLOSE');
assert('earlier of two sells => PARTIAL CLOSE',
  closeEventLabel({ status: 'closed', partial_closes: [{}, {}] }, 0) === 'PARTIAL CLOSE');
assert('final of two sells on closed trade => CLOSE',
  closeEventLabel({ status: 'closed', partial_closes: [{}, {}] }, 1) === 'CLOSE');

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
