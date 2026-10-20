import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(
  path.join(repo, '.github', 'workflows', 'build-smartloan.yml'),
  'utf8',
);

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}`);
    failed++;
  }
}

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const brace = html.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  return '';
}

console.log('\nemiGo — Demo Mode security/build tests\n');

const hydrate = functionSource('hydrateDemoSession');
const persist = functionSource('persistState');
const finish = functionSource('finishExitDemo');
const load = functionSource('loadState');
const auth = functionSource('authenticateForExit');
const enter = functionSource('enterDemoMode');

check('demo session has an in-memory active latch',
  /let\s+_demoSessionActive\s*=\s*false/.test(html));
check('demo session has an in-memory fixed protection latch',
  /let\s+_demoSessionProtected\s*=\s*false/.test(html));
check('startup treats the demo blob itself as a demo-session artifact',
  /getItem\(DEMO_STORAGE_KEY\)/.test(hydrate));
check('protected bundle metadata participates in fail-closed recovery',
  /_demoProtected/.test(hydrate) && /bundleProtection/.test(hydrate));
check('demo persistence restores markers before choosing the storage key',
  /_demoSessionActive\)\s*restoreDemoMarkers/.test(persist) &&
  /activeStorageKey\(\)/.test(persist));
check('direct calls cannot finish a demo exit without authorization',
  /!_demoSessionActive\s*\|\|\s*!_demoExitAuthorized/.test(finish));
check('native bridge errors abort entry instead of creating an unprotected demo',
  /authStatus==='error'/.test(enter) && /Demo mode did not start/.test(enter));
check('missing or corrupt demo data is rebuilt without falling through to sla_v1',
  /missing or corrupt demo blob/.test(load) &&
  /buildDemoBundle/.test(load));
check('native exit uses device credentials as a supported fallback',
  /allowDeviceCredential\s*:\s*true/.test(auth));
check('Android biometric plugin is pinned for Capacitor 6',
  pkg.dependencies?.['@aparajita/capacitor-biometric-auth'] === '8.0.2');
check('Android runtime includes the patched Capacitor release',
  pkg.dependencies?.['@capacitor/android'] === '6.2.2');
check('Android CI installs only locked dependencies',
  /npm ci/.test(workflow) && /smartloan\/package-lock\.json/.test(workflow));
check('store version 4.0.0 is shown to users as 4.0',
  pkg.version === '4.0.0' &&
  /require\('\.\/package\.json'\)\.version/.test(workflow) &&
  /endsWith\('\.0'\)/.test(workflow));
check('API 36 uses a supported AGP and Gradle pair',
  /gradle:8\.9\.1/.test(workflow) && /gradle-8\.11\.1/.test(workflow));
check('Android release excludes WebView financial data from backup and transfer',
  /allowBackup",\s*"false"/.test(workflow) &&
  /data_extraction_rules/.test(workflow));
check('signing secrets are passed through quoted environment variables',
  /KEYSTORE_PASSWORD_VALUE/.test(workflow) &&
  /store\.password=\$KEYSTORE_PASSWORD_VALUE"/.test(workflow));
check('backup import is blocked during demo mode',
  /function importBackup\(input\)\{\s*if\(isDemoMode\(\)\)/.test(html));
check('backup export is blocked during demo mode',
  /function exportBackup\(\)\{\s*if\(isDemoMode\(\)\)/.test(html));

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}\n`);
if (failed) process.exit(1);
