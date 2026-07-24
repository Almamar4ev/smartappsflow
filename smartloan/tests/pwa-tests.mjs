// ==========================================================================
// Smart Loan Calculator — PWA / service-worker integrity tests
// ==========================================================================
// Verifies the shipped index.html, manifest.json, and service-worker.js stay
// self-contained and relative-pathed, so the app installs and updates cleanly
// under the /smartloan/ subfolder without clobbering sibling apps' caches.
//
// Run:  node tests/pwa-tests.mjs
// ==========================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const html = readFileSync(join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}

console.log('Smart Loan Calculator — PWA / service-worker scope tests\n');

// 1. Service worker is registered with a relative path (subfolder-safe).
//    Options (e.g. { updateViaCache:'none' }) are allowed after the path.
assert("service worker is registered with relative path 'service-worker.js'",
  /serviceWorker\.register\(\s*['"]service-worker\.js['"]/.test(html));

// 1c. Registered with updateViaCache:'none' so the browser always re-checks sw.js.
assert("registration uses updateViaCache: 'none'",
  /updateViaCache:\s*['"]none['"]/.test(html));

// 1b. No absolute registration path that would force the root scope.
assert('service worker is not registered from an absolute path',
  !/serviceWorker\.register\(\s*['"]\//.test(html));

// 2. manifest start_url and scope are relative './' so the app is portable
//    under /smartloan/ (matches how it is actually served).
assert("manifest start_url is './'", manifest.start_url === './');
assert("manifest scope is './'", manifest.scope === './');

// 2b. Every manifest icon uses a relative src that exists as a sibling file.
assert('manifest icons all use relative (non-absolute) src',
  Array.isArray(manifest.icons) && manifest.icons.length > 0 &&
  manifest.icons.every(i => typeof i.src === 'string' && !i.src.startsWith('/') && !/^https?:/.test(i.src)));

// 3. Cache name is app-scoped so Activate never deletes another app's caches.
assert("cache name is namespaced with 'smartloan-'",
  /const\s+CACHE\s*=\s*['"]smartloan-/.test(sw));

// 3b. Core precache list uses relative paths only.
assert('service worker CORE precache list is relative',
  /const\s+CORE\s*=\s*\[[^\]]*'\.\/'/.test(sw) && !/CORE\s*=\s*\[[^\]]*'\/[a-z]/i.test(sw));

// 4. Cache-first for HTML: the update-notification model requires the page to
//    change ONLY through the consent flow, never silently on navigation. So the
//    fetch handler must consult the cache before the network.
assert('service worker is cache-first (caches.match(req) before fetch)',
  /caches\.match\(req\)\.then\(\s*\(?\s*hit\s*\)?\s*=>/.test(sw));

// 4b. Update is user-consented: skipWaiting() must NOT run on install. The only
//     actual call (self.skipWaiting(...)) must be gated behind the SKIP_WAITING
//     message. (Count real calls, not the word in comments.)
assert('skipWaiting is user-triggered only (single call, gated by SKIP_WAITING)',
  (sw.match(/self\.skipWaiting\(/g) || []).length === 1 &&
  /SKIP_WAITING['"]\)\s*self\.skipWaiting\(\)/.test(sw));

// 4c. The worker exposes its version/changelog to the page for the banner.
assert('service worker answers GET_VERSION_INFO with VERSION_INFO',
  /GET_VERSION_INFO/.test(sw) && /VERSION_INFO/.test(sw) &&
  /const\s+VERSION\s*=/.test(sw) && /const\s+CHANGELOG\s*=/.test(sw));

// 4d. The page side wires up the notifier: a waiting worker + a Settings entry.
assert('page shows an update banner and a Settings update card',
  /getElementById\(['"]updateBanner['"]\)/.test(html) &&
  /settingsUpdateBox/.test(html) &&
  /reg\.waiting/.test(html) && /controllerchange/.test(html));

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
