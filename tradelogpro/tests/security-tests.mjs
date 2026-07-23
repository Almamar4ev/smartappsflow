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

const names = [
  '_sid','_sstr','_snum','_sdate','_siso','_schoice','_parseMaybeJson',
  '_sanEvent','_sanTrade','_sanAccount','sanitizeState',
  '_sanPosCalc','_sanCompCalc','_sanAvgCalc','sanitizeSavedCalcs',
  'sanitizeTemplates','sanitizeJournals','sanitizeProfile','sanitizeBenchmark','sanitizePrefs',
  'safePhoto'
];
let code = 'var ID_RE = /^[A-Za-z0-9_.-]+$/;\n';
for (const name of names) code += extractFunction(html, name) + '\n';
code += '\nthis.api={' + names.join(',') + '};';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const api = sandbox.api;

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('TradeLog Pro — backup/security sanitizer tests\n');

const rawState = {
  accounts: [{
    id:'acc_main', name:'Main', startingCapital:1234.5, broker:'IBKR', createdAt:'2026-07-17T10:00:00.000Z',
    transactions:[{id:"x');alert(1)//", type:'withdraw', amount:-50, date:'<bad>'}]
  }],
  trades: [{
    id:'tr_1', accountId:'acc_main', ticker:'AAPL', type:'Bad<script>', direction:'Long', status:'closed',
    entry:100, exit:110, qty:10, original_qty:10, entry_date:'2026-01-01', exit_date:'<bad>',
    target:120, stoploss:95, risk:25, notes:'ok', createdAt:'2026-01-01T00:00:00.000Z',
    photos:['javascript:alert(1)', 'data:image/png;base64,AAAA'], add_buys:[], partial_closes:[]
  }],
  activeAccountId:'acc_main', updatedAt:'2026-07-17T10:00:00.000Z', schemaVersion:3
};
const cleanState = api.sanitizeState(rawState);
assert('account startingCapital is preserved', cleanState.accounts[0].startingCapital === 1234.5);
assert('account broker is preserved', cleanState.accounts[0].broker === 'IBKR');
assert('trade target is preserved', cleanState.trades[0].target === 120);
assert('trade stop loss is preserved', cleanState.trades[0].stoploss === 95);
assert('unsafe transaction id is replaced', /^[A-Za-z0-9_.-]+$/.test(cleanState.accounts[0].transactions[0].id));
assert('withdraw transaction type is preserved', cleanState.accounts[0].transactions[0].type === 'withdraw');
assert('invalid transaction date is rejected', cleanState.accounts[0].transactions[0].date === '');

const txAccount = api._sanAccount({
  id:'acc_tx', name:'Transactions',
  transactions:[
    {id:'d1', type:'deposit', amount:100, date:'2026-07-17'},
    {id:'w1', type:'withdraw', amount:50, date:'2026-07-17'},
    {id:'legacy1', type:'withdrawal', amount:25, date:'2026-07-17'},
    {id:'bad1', type:'<script>', amount:999, date:'2026-07-17'}
  ]
});
assert('deposit transaction type is preserved', txAccount.transactions[0].type === 'deposit');
assert('legacy withdrawal is normalized to withdraw', txAccount.transactions[2].type === 'withdraw');
assert('unknown transaction type is dropped', txAccount.transactions.length === 3 && !txAccount.transactions.some(function(tx){ return tx.id === 'bad1'; }));
assert('unknown trade type is rejected', cleanState.trades[0].type === '');
assert('invalid trade exit date is rejected', cleanState.trades[0].exit_date === '');
assert('only data-image photos survive', cleanState.trades[0].photos.length === 1 && cleanState.trades[0].photos[0].startsWith('data:image/png'));

const calcs = api.sanitizeSavedCalcs({
  pos:[{id:"bad'id",name:'N'.repeat(150),date:'<x>',mode:'oops',riskMode:'oops',balance:'1000'}],
  comp:[{id:'c1',name:'Compound',date:'2026-07-17',capital:'100'}],
  avg:[{id:'a1',name:'Avg',date:'2026-07-17',rows:Array.from({length:120},()=>({price:'1',qty:'2'}))}]
});
assert('saved calculation id is safe', /^[A-Za-z0-9_.-]+$/.test(calcs.pos[0].id));
assert('saved calculation name is clamped', calcs.pos[0].name.length === 100);
assert('saved calculation date is validated', calcs.pos[0].date === '');
assert('average rows are capped', calcs.avg[0].rows.length === 100);

const templates = api.sanitizeTemplates([{id:"x' onclick='bad",name:'Template',type:'Injected',direction:'Short'}]);
assert('template id is safe', /^[A-Za-z0-9_.-]+$/.test(templates[0].id));
assert('template type is whitelisted', templates[0].type === '');
assert('template direction is preserved safely', templates[0].direction === 'Short');

const journals = api.sanitizeJournals({
  '<script>':{notes:'bad'},
  '2026-07-17':{mood:'focused',notes:'x'.repeat(25000),tags:Array.from({length:25},(_,i)=>'tag'+i)}
});
assert('invalid journal date key is dropped', !Object.prototype.hasOwnProperty.call(journals, '<script>'));
assert('valid journal is retained', journals['2026-07-17'].mood === 'focused');
assert('journal notes are clamped', journals['2026-07-17'].notes.length === 20000);
assert('journal tags are capped', journals['2026-07-17'].tags.length === 20);

assert('invalid benchmark is rejected', api.sanitizeBenchmark({basePrice:'<x>'}) === null);
assert('valid benchmark is retained', api.sanitizeBenchmark({basePrice:5000,savedAt:'2026-07-17T00:00:00.000Z'}).basePrice === 5000);
assert('preferences are restricted to allowed values', api.sanitizePrefs({theme:'evil',showCurrency:'evil'}).theme === 'dark' && api.sanitizePrefs({theme:'evil',showCurrency:'evil'}).showCurrency === 'on');
assert('profile fields are clamped', api.sanitizeProfile({name:'x'.repeat(100)}).name.length === 80);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
