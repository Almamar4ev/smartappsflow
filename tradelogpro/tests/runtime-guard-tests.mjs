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

const code = extractFunction(html, 'detectTradeLogRuntime') + '\nthis.detectTradeLogRuntime=detectTradeLogRuntime;';
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const detect = sandbox.detectTradeLogRuntime;

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('TradeLog Pro — runtime analytics guard tests\n');

assert('custom-domain web build allows analytics',
  detect({protocol:'https:',hostname:'smartappsflow.net'}, null).analyticsAllowed === true);
assert('SmartAppsFlow subdomain web build allows analytics',
  detect({protocol:'https:',hostname:'app.smartappsflow.net'}, null).analyticsAllowed === true);
assert('unapproved public host blocks analytics',
  detect({protocol:'https:',hostname:'example.com'}, null).analyticsAllowed === false);
assert('localhost blocks analytics',
  detect({protocol:'https:',hostname:'localhost'}, null).analyticsAllowed === false);
assert('Capacitor Android blocks analytics',
  detect({protocol:'https:',hostname:'localhost'}, {isNativePlatform:()=>true,getPlatform:()=> 'android'}).analyticsAllowed === false);
assert('Capacitor iOS blocks analytics',
  detect({protocol:'https:',hostname:'localhost'}, {isNativePlatform:()=>false,getPlatform:()=> 'ios'}).analyticsAllowed === false);
assert('file protocol blocks analytics',
  detect({protocol:'file:',hostname:''}, null).analyticsAllowed === false);
assert('guard exposes analytics flag', html.includes('__TL_ANALYTICS_ALLOWED__'));
assert('guard blocks Cloudflare beacon delivery', html.includes('navigator.sendBeacon') && html.includes('cloudflareinsights.com'));
assert('guard removes accidental Cloudflare scripts', html.includes("script[data-cf-beacon]"));

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
