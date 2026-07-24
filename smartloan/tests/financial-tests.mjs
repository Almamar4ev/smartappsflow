// ==========================================================================
// Smart Loan Calculator — automated loan-math tests
// ==========================================================================
// This file loads the REAL calculation functions out of ../index.html (so the
// tests always run against shipped code, never a copy) and exercises the
// amortized-payment formula, the maximum-affordable-principal inverse, and the
// term-for-a-target-payment inverse, including the zero-interest edge cases.
//
// Rates are DECIMAL annual rates (0.12 = 12% / year); the functions divide by
// 12 internally for the monthly rate.
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

// --- Pull the pure calculation functions out of index.html by name --------
const NEEDED = ['calcLoan', 'maxPrincipal', 'termForPayment'];

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

let code = '';
for (const name of NEEDED) code += extractFunction(html, name) + '\n';

// Sandbox: no DOM, just the extracted functions.
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.__api = {' + NEEDED.join(',') + '};', sandbox);
const { calcLoan, maxPrincipal, termForPayment } = sandbox.__api;

// --- Tiny assertion helpers ----------------------------------------------
let passed = 0, failed = 0;
function approx(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }
function test(name, got, want, eps = 0.01) {
  const ok = approx(got, want, eps);
  if (ok) { passed++; console.log('  ✓ ' + name + '  (= ' + round(got) + ')'); }
  else { failed++; console.log('  ✗ ' + name + '  expected ' + want + ', got ' + round(got)); }
}
function assert(name, cond) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}
function round(n) { return Math.round(n * 100) / 100; }

console.log('Smart Loan Calculator — loan-math tests\n');

// --- calcLoan: standard amortized monthly payment -------------------------
// Textbook value: 100,000 @ 12%/yr (1%/mo) over 360 months = 1028.61/mo.
{
  const r = calcLoan(100000, 0.12, 360);
  test('1. calcLoan 100k @12% x360mo monthly = 1028.61', r.monthly, 1028.61);
  test('1b.   total = monthly * months', r.total, r.monthly * 360, 0.001);
  test('1c.   interest = total - principal', r.interest, r.total - 100000, 0.001);
}

// Shorter, rounder case: 12,000 @ 12%/yr over 12 months = 1066.19/mo.
test('2. calcLoan 12k @12% x12mo monthly = 1066.19',
  calcLoan(12000, 0.12, 12).monthly, 1066.19);

// Zero interest: payment is a straight division, no interest owed.
{
  const r = calcLoan(12000, 0, 24);
  test('3. calcLoan 0% x24mo monthly = 500', r.monthly, 500);
  test('3b.   total equals principal at 0%', r.total, 12000);
  assert('3c.   interest is 0 at 0%', r.interest === 0);
}

// Guard: non-positive term returns zeros, never NaN/Infinity.
{
  const r = calcLoan(10000, 0.1, 0);
  assert('4. calcLoan with 0 months returns zeros',
    r.monthly === 0 && r.total === 0 && r.interest === 0);
}

// --- maxPrincipal: inverse of calcLoan ------------------------------------
// The most you can borrow at a given payment/term/rate must round-trip back
// to that payment through calcLoan.
{
  const P = maxPrincipal(1028.61, 0.12, 360);
  test('5. maxPrincipal(1028.61 @12% x360) = 100,000', P, 100000, 1);
  test('5b.   round-trips: calcLoan(P).monthly = 1028.61',
    calcLoan(P, 0.12, 360).monthly, 1028.61, 0.01);
}

// Zero interest: principal is simply payment * months.
test('6. maxPrincipal 0% = payment*months', maxPrincipal(500, 0, 24), 12000);

// Guards: non-positive payment or term yields 0, never negative/NaN.
assert('7. maxPrincipal with 0 payment = 0', maxPrincipal(0, 0.1, 12) === 0);
assert('7b. maxPrincipal with 0 months = 0', maxPrincipal(500, 0.1, 0) === 0);

// --- termForPayment: months needed to reach a target payment --------------
// Inverse of calcLoan on the term axis: paying 1028.61 on 100k @12% => 360mo.
test('8. termForPayment(100k, 1028.61 @12%) = 360 months',
  termForPayment(100000, 1028.61, 0.12), 360, 0.05);

// Zero interest: months = principal / payment.
test('9. termForPayment 0% = principal/payment',
  termForPayment(12000, 500, 0), 24);

// Impossible: if the interest alone meets/exceeds the payment, no finite term.
{
  // 100k @12%/yr => 1000/mo interest on day one; a 900 payment never amortizes.
  assert('10. termForPayment returns null when payment <= monthly interest',
    termForPayment(100000, 900, 0.12) === null);
}

// Guards: non-positive payment or principal returns null.
assert('11. termForPayment with 0 payment = null', termForPayment(10000, 0, 0.1) === null);
assert('11b. termForPayment with 0 principal = null', termForPayment(0, 500, 0.1) === null);

console.log('\n----------------------------------------');
console.log('  Passed: ' + passed + '   Failed: ' + failed);
console.log('----------------------------------------');
if (failed > 0) process.exit(1);
