// Stock Average saved calculations: Save on a loaded calculation updates it in place.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(__dirname, '..', 'js', 'app.js'), 'utf8');

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

const store = {};
const toasts = [];
let promptAnswer = null;
const ctx = {
  JSON, Object, Date,
  getSavedCalcs: (k) => JSON.parse(JSON.stringify(store[k] || [])),
  setSavedCalcs: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  localDateStr: () => '2026-10-31',
  showToast: (m) => toasts.push(m),
  promptSheet: (t, h, v, cb) => cb(promptAnswer),
  renderAvgSaved() {}, calcStockAvg() {}, padAvgRows() {},
  renderAvgCalc: () => '',
  document: { getElementById: () => null },
};
vm.createContext(ctx);
vm.runInContext(
  "var _avgRows = []; var _avgLoadedId = null;\n" +
  ['avgLoadedEntry', 'saveAvgCalc', 'saveAvgCalcAsNew', 'loadAvgCalc', 'newAvgCalc', 'applyOpenTradeToAvg']
    .map((n) => extractFunction(appJs, n)).join('\n'), ctx);

console.log('Edgeory — saved Stock Average tests\n');

const run = (code) => vm.runInContext(code, ctx);
const saved = () => store.tl_avg_calcs || [];

run("_avgRows = [{price:'91.47',qty:'189.054'},{price:'23',qty:'140'}]");
promptAnswer = 'Smci';
run('saveAvgCalc()');
assert('first save asks for a name and creates one entry', saved().length === 1 && saved()[0].name === 'Smci');
assert('after saving, the editor keeps that calculation open', run('_avgLoadedId') === saved()[0].id);

run("_avgRows.push({price:'20',qty:'150'})");
promptAnswer = 'SHOULD NOT ASK';
run('saveAvgCalc()');
assert('saving again updates the same entry (no duplicate)', saved().length === 1);
assert('the update holds the third buy', saved()[0].rows.length === 3 && saved()[0].rows[2].price === '20');
assert('the name is kept and the user is told it was updated', saved()[0].name === 'Smci' && toasts.at(-1) === 'Updated: Smci');

run('newAvgCalc()');
run("_avgRows = [{price:'10',qty:'5'}]");
promptAnswer = 'Other';
run('saveAvgCalc()');
assert('New starts a fresh calculation that saves separately', saved().length === 2 && saved()[0].name === 'Other');

const smciId = saved().find((x) => x.name === 'Smci').id;
run("loadAvgCalc('" + smciId + "')");
run("_avgRows.push({price:'18',qty:'50'})");
run('saveAvgCalc()');
const smci = saved().find((x) => x.name === 'Smci');
assert('loading a saved calculation then saving updates that one', saved().length === 2 && smci.rows.length === 4);

promptAnswer = 'Smci copy';
run('saveAvgCalcAsNew()');
assert('Save as new keeps the original and adds a copy', saved().length === 3 && saved()[0].name === 'Smci copy');

run("applyOpenTradeToAvg({entry:'5', qty:'1', add_buys:[]})");
assert('filling from an open trade detaches from the saved calculation', run('_avgLoadedId') === null);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
