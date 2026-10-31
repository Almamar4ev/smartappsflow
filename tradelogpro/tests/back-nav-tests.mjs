// Back navigation: shared backStep() order + the web/PWA history guard.
// Runs the real functions from js/app.js inside a vm with a fake history/DOM.
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

function makeEnv() {
  const listeners = {}, docListeners = {};
  const timers = [];
  const env = {
    log: [], toasts: [], view: 'dashboard', modals: [], left: false,
    stack: ['root'], // history entries; last = current
  };
  const ctx = {
    MORE_VIEWS: { journal: 1, accounts: 1, formulas: 1, import: 1, 'import-review': 1 },
    _modalStack: env.modals,
    get currentView() { return env.view; },
    setView(v) { env.view = v; env.log.push('view:' + v); },
    dismissModal(id) { env.modals.splice(env.modals.indexOf(id), 1); env.log.push('close:' + id); },
    closeLightbox() {}, closeDrawer() {},
    showToast(m) { env.toasts.push(m); },
    Date: { now: () => env.now },
    setTimeout(fn, ms) { timers.push({ fn, at: env.now + ms }); return timers.length; },
    clearTimeout(id) { if (timers[id - 1]) timers[id - 1].fn = null; },
    history: { pushState() { env.stack.push('guard'); } },
    document: {
      getElementById() { return null; },
      addEventListener(t, fn) { docListeners[t] = fn; },
      removeEventListener(t) { delete docListeners[t]; },
    },
    window: { addEventListener(t, fn) { listeners[t] = fn; } },
  };
  env.now = 1.7e12; // a real epoch time, like Date.now()
  vm.createContext(ctx);
  vm.runInContext(
    'var _backExitAt = 0; var _webGuardOn = false, _webGuardTimer = null;\n' +
    ['backStep', 'pushWebBackGuard', 'initWebBack'].map((n) => extractFunction(appJs, n)).join('\n') +
    '\ninitWebBack();', ctx);
  env.tap = () => { if (docListeners.pointerdown) docListeners.pointerdown(); };
  env.back = () => {
    env.stack.pop();
    if (!env.stack.length) { env.left = true; return; }
    listeners.popstate();
  };
  env.wait = (ms) => {
    env.now += ms;
    timers.forEach((t) => { if (t.fn && t.at <= env.now) { const f = t.fn; t.fn = null; f(); } });
  };
  return env;
}

console.log('Edgeory — back navigation tests\n');

{
  const e = makeEnv();
  assert('no guard before the first tap (Chrome would skip it)', e.stack.length === 1);
  e.tap();
  assert('first tap adds one guard entry', e.stack.length === 2);
  e.tap();
  assert('later taps do not stack more guards', e.stack.length === 2);
}

{
  const e = makeEnv();
  e.tap(); e.view = 'journal';
  e.back();
  assert('back from an inner More page goes to More', e.view === 'more' && !e.left);
  e.back();
  assert('back from More goes to Home', e.view === 'dashboard' && !e.left);
  assert('guard is re-armed after each handled back', e.stack.length === 2);
  e.back();
  assert('first back on Home warns and stays', !e.left && e.toasts.indexOf('Press back again to exit') >= 0);
  e.wait(500);
  e.back();
  assert('second back within 2s leaves the app', e.left);
}

{
  const e = makeEnv();
  e.tap(); e.modals.push('tradeDetailModal'); e.view = 'analytics';
  e.back();
  assert('back closes an open sheet first, page unchanged', e.modals.length === 0 && e.view === 'analytics');
  e.back();
  assert('then back goes to Home', e.view === 'dashboard');
}

{
  const e = makeEnv();
  e.tap();
  e.back();
  e.wait(2100);
  assert('after the 2s window the guard returns', e.stack.length === 2 && !e.left);
  e.back();
  assert('a late second back warns again instead of exiting', !e.left && e.toasts.length === 2);
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
