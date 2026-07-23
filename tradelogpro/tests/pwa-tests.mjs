import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const sw = readFileSync(join(root, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('TradeLog Pro — PWA / service-worker scope tests\n');

// 1. Service worker is registered with the relative path ./sw.js
assert("service worker is registered with relative path './sw.js'",
  html.includes("navigator.serviceWorker.register('./sw.js')"));

// 1b. The old absolute /tradelog-pro/sw.js path is gone
assert('legacy /tradelog-pro/sw.js registration is removed',
  !html.includes('/tradelog-pro/sw.js'));

// 2. manifest start_url and scope are exactly /tradelogpro/
assert("manifest start_url is '/tradelogpro/'", manifest.start_url === '/tradelogpro/');
assert("manifest scope is '/tradelogpro/'", manifest.scope === '/tradelogpro/');

// 2b. manifest does not reference any (currently missing) icon files.
assert('manifest has no icons referencing missing files',
  !('icons' in manifest) || (Array.isArray(manifest.icons) && manifest.icons.length === 0));

// 3. Service worker must not claim the root scope '/'
assert('service worker does not use root scope /',
  !/setScope\(\s*['"]\/['"]\s*\)/.test(sw) &&
  !/registration\.scope\s*=\s*['"]\/['"]/.test(sw));

// 3b. Service worker restricts fetch handling to its own registration scope
assert('service worker limits fetch handling to registration.scope',
  sw.includes('self.registration.scope'));

// 3c. Service worker only clears its own caches (no cross-app cache deletion)
assert("service worker only deletes its own 'tradelogpro-' caches",
  sw.includes("indexOf('tradelogpro-')"));

// 4. Navigation requests use Network First: a fetch() is attempted first and
//    the cache is only consulted in the .catch() offline fallback.
const navFirst =
  /req\.mode === 'navigate'/.test(sw) &&
  /if \(isNavigation\)[\s\S]*?fetch\(req\)[\s\S]*?\.catch\(function \(\) \{[\s\S]*?caches\.match/.test(sw);
assert('navigation uses Network First (fetch first, cache on failure)', navFirst);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
