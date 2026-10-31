// ==========================================================================
// Edgeory — calculator tests (Position Size, risk mode switch, Compound)
// ==========================================================================
// Loads the real calculator functions from ../js/finance.js.
// Run:  node tests/calculator-tests.mjs
// ==========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'js', 'finance.js'), 'utf8');
const NEEDED = ['convertRiskValue', 'calcPositionPlan', 'calcCompoundPlan'];

function extractFunction(text, name) {
  const start = text.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('Function not found in js/finance.js: ' + name);
  let i = text.indexOf('{', start), depth = 0, inStr = null, prev = '';
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; }
    else if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return text.slice(start, i);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(NEEDED.map(n => extractFunction(src, n)).join('\n') + '\nthis.__api = {' + NEEDED.join(',') + '};', sandbox);
const { convertRiskValue, calcPositionPlan, calcCompoundPlan } = sandbox.__api;

let passed = 0, failed = 0;
function eq(name, got, want, eps = 0.01) {
  const ok = typeof want === 'number' ? Math.abs(got - want) <= eps : got === want;
  if (ok) { passed++; console.log('  \u2713 ' + name); }
  else { failed++; console.log('  \u2717 ' + name + '  expected ' + want + ', got ' + got); }
}

console.log('\nRisk mode switch');
eq('2% of $10,000 -> $200', convertRiskValue('2', '10000', '$'), 200);
eq('$200 of $10,000 -> 2%', convertRiskValue('200', '10000', '%'), 2);
eq('round trip keeps the same risk', convertRiskValue(convertRiskValue('1.5', '8000', '$'), '8000', '%'), 1.5);
eq('no balance -> null (field is cleared)', convertRiskValue('2', '', '$'), null);

console.log('\nPosition Size — distance in %');
const base = { balance: '10000', risk: '2', riskMode: '%', slPct: '5', tpPct: '10' };
let r = calcPositionPlan(base);
eq('position value $4,000', r.posVal, 4000);
eq('max loss $200', r.actualRisk, 200);
eq('potential profit $400', r.reward, 400);
eq('risk : reward 2', r.rr, 2);
eq('balance if stop hit $9,800', r.balanceIfStop, 9800);
eq('balance if target hit $10,400', r.balanceIfTarget, 10400);
r = calcPositionPlan({ ...base, risk: '200', riskMode: '$' });
eq('fixed $200 gives the same $4,000', r.posVal, 4000);
r = calcPositionPlan({ ...base, tpPct: '' });
eq('no target -> reward null', r.reward, null);
eq('no target -> balance if target null', r.balanceIfTarget, null);

console.log('\nCash cap and margin');
r = calcPositionPlan({ ...base, slPct: '0.5' });
eq('cash: capped at balance', r.posVal, 10000);
eq('cash: capped flag', r.capped, true);
eq('cash: actual risk falls to $50', r.actualRisk, 50);
eq('cash: requested risk stays $200', r.idealRisk, 200);
r = calcPositionPlan({ ...base, slPct: '0.5', margin: true });
eq('margin: full $40,000 position', r.posVal, 40000);
eq('margin: 4x leverage', r.leverage, 4);
eq('margin: needs leverage', r.needsLeverage, true);
eq('margin: risk stays $200', r.actualRisk, 200);

console.log('\nPosition Size — chart prices');
const px = { balance: '10000', risk: '2', riskMode: '%', priceMode: true, entry: '100', stop: '95', target: '110' };
r = calcPositionPlan(px);
eq('40 shares', r.qty, 40);
eq('position $4,000', r.posVal, 4000);
eq('stop distance 5%', r.slPct, 5);
eq('risk : reward 2', r.rr, 2);
eq('long', r.short, false);
r = calcPositionPlan({ ...px, stop: '105', target: '90' });
eq('short: 40 shares', r.qty, 40);
eq('short flag', r.short, true);

console.log('\nValidation');
eq('target on the wrong side', calcPositionPlan({ ...px, target: '90' }).error, 'targetSide');
eq('stop equals entry', calcPositionPlan({ ...px, stop: '100' }).error, 'prices');
eq('missing stop %', calcPositionPlan({ ...base, slPct: '' }).error, 'stopPct');
eq('stop 100% or more', calcPositionPlan({ ...base, slPct: '100' }).error, 'stopTooBig');
eq('risk over 100%', calcPositionPlan({ ...base, risk: '120' }).error, 'riskTooHigh');
eq('fixed risk over balance', calcPositionPlan({ ...base, risk: '20000', riskMode: '$' }).error, 'riskTooHigh');
eq('missing balance', calcPositionPlan({ ...base, balance: '' }).error, 'risk');

console.log('\nCompound');
const cg = { capital: 10000, rate: 10, ratePer: 'annual', duration: 20, durUnit: 'months', deposit: 378, freq: 12 };
let c = calcCompoundPlan(cg);
eq('20 months final balance', c.finalBalance, 19994.96);
eq('20 months = 20 rows', c.rows.length, 20);
eq('20 months deposits', c.totalDeposited, 7560);
c = calcCompoundPlan({ ...cg, durUnit: 'years' });
eq('20 years final balance', c.finalBalance, 360322.16);
eq('20 years = 240 rows', c.rows.length, 240);
eq('20 years growth', c.totalGrowth, 259602.16);
c = calcCompoundPlan({ ...cg, duration: 12, deposit: 0 });
eq('12 months monthly compounding', c.finalBalance, 11047.13);
c = calcCompoundPlan({ ...cg, duration: 1, durUnit: 'years', deposit: 0, freq: 1 });
eq('1 year yearly compounding', c.finalBalance, 11000);
eq('invalid input -> null', calcCompoundPlan({ ...cg, capital: 0 }), null);

console.log('\nPassed: ' + passed + '\nFailed: ' + failed);
process.exit(failed ? 1 : 0);
