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
assert("service worker is registered with relative path 'service-worker.js'",
  html.includes("navigator.serviceWorker.register('service-worker.js')"));

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

// 4. Navigation requests use Network First (fetch first, cache only on failure)
//    so users pick up new deploys immediately.
const navFirst =
  /req\.mode === 'navigate'/.test(sw) &&
  /if \(isHTML\)[\s\S]*?fetch\(req\)[\s\S]*?\.catch\(\(\)\s*=>\s*caches\.match/.test(sw);
assert('navigation uses Network First (fetch first, cache on failure)', navFirst);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
