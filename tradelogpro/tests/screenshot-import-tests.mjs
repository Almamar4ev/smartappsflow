import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'js', 'screenshot-import.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.parseScreenshotText=parseScreenshotText;this.screenshotDraftToTrade=screenshotDraftToTrade;this.siMergeBuys=siMergeBuys;', sandbox);

function fixture(name) {
  return readFileSync(join(__dirname, 'fixtures', name + '.txt'), 'utf8');
}

let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name); }
}
function near(a, b, tol) {
  return Math.abs(a - b) <= (tol == null ? 0.0002 : tol);
}

console.log('Edgeory — screenshot import tests\n');

const xtb = sandbox.parseScreenshotText(fixture('xtb-rocket-lab'));
assert('XTB platform', xtb.platform === 'XTB');
assert('XTB 3 buys', xtb.buys && xtb.buys.length === 3);
assert('XTB shares 40.1993', xtb.summary && near(xtb.summary.shares, 40.1993, 0.0002));
assert('XTB avg 61.9243', xtb.summary && near(xtb.summary.avg, 61.9243, 0.0002));
assert('XTB invested 2489.31', xtb.summary && near(xtb.summary.invested, 2489.31, 0.02));
assert('XTB name Rocket Lab', xtb.name === 'Rocket Lab');
assert('XTB current 58.69', near(xtb.current, 58.69, 0.01));
assert('XTB no account id', JSON.stringify(xtb).indexOf('account') < 0 || (xtb.ignored && xtb.ignored.indexOf('account number') >= 0) || !/U\d{6,}/.test(JSON.stringify(xtb)));

const baraka = sandbox.parseScreenshotText(fixture('baraka-ibit'));
assert('Baraka IBIT', baraka.symbol === 'IBIT');
assert('Baraka shares', baraka.buys && near(baraka.buys[0].qty, 27.443425, 0.00001));
assert('Baraka avg 36.4386', near(baraka.avgExact || baraka.summary.avg, 36.4386, 0.0002));
assert('Baraka cost 1000', near(baraka.totalCost || baraka.summary.invested, 1000, 0.05));
assert('Baraka price 45.31', near(baraka.current, 45.31, 0.02));

const ibkr = sandbox.parseScreenshotText(fixture('ibkr-inod'));
assert('IBKR INOD', ibkr.symbol === 'INOD');
assert('IBKR one buy', ibkr.buys && ibkr.buys.length === 1);
assert('IBKR qty 6', ibkr.buys && ibkr.buys[0].qty === 6);
assert('IBKR price 46.10', ibkr.buys && near(ibkr.buys[0].price, 46.10, 0.01));
assert('IBKR date 2026-10-29', ibkr.buys && ibkr.buys[0].date === '2026-10-29');
assert('IBKR commission 0.35', ibkr.buys && near(ibkr.buys[0].commission, 0.35, 0.01));

const tpos = sandbox.parseScreenshotText(fixture('t212-position-btbt'));
assert('T212 pos BTBT', tpos.symbol === 'BTBT');
assert('T212 pos shares', tpos.buys && near(tpos.buys[0].qty, 651.61763911, 0.00001));
assert('T212 pos avg', tpos.buys && near(tpos.buys[0].price, 3.8714, 0.0002));
assert('T212 pos px', near(tpos.current, 0.9483, 0.001));

const tbuy = sandbox.parseScreenshotText(fixture('t212-order-buy-smx'));
assert('T212 buy SMX', tbuy.symbol === 'SMX');
assert('T212 buy qty', tbuy.buys && near(tbuy.buys[0].qty, 46.30812854, 0.00001));
assert('T212 buy px', tbuy.buys && near(tbuy.buys[0].price, 5.29, 0.01));
assert('T212 buy date', tbuy.buys && tbuy.buys[0].date === '2026-04-20');
assert('T212 buy total', tbuy.buys && near(tbuy.buys[0].amount, 244.97, 0.02));

const tsell = sandbox.parseScreenshotText(fixture('t212-order-sell-cprt'));
assert('T212 sell CPRT', tsell.symbol === 'CPRT');
assert('T212 sell qty', tsell.sells && near(tsell.sells[0].qty, 86.95189504, 0.00001));
assert('T212 sell px', tsell.sells && near(tsell.sells[0].price, 31.04, 0.01));
assert('T212 sell date', tsell.sells && tsell.sells[0].date === '2026-06-02');
assert('T212 sell result', tsell.sells && near(tsell.sells[0].realized, -1256.67, 0.02));
assert('T212 derived entry', tsell.sells && near(tsell.sells[0].derivedEntry, 45.4925, 0.001));

const ibkrText = fixture('ibkr-inod');
const ambig = ibkrText.replace('29/10/2026', '03/04/2026');
const ambigNoRange = sandbox.parseScreenshotText(ambig.replace(/\d{1,2} [A-Za-z]{3} \d{4}\s*[-–]\s*\d{1,2} [A-Za-z]{3} \d{4}/g, ''));
assert('IBKR ambiguous date without range asks user', ambigNoRange.buys && ambigNoRange.buys[0].date === null);
const ambigApr = sandbox.parseScreenshotText(ambig.replace(/\d{1,2} [A-Za-z]{3} \d{4}\s*[-–]\s*\d{1,2} [A-Za-z]{3} \d{4}/g, '01 Apr 2026 - 07 Apr 2026'));
assert('IBKR ambiguous date resolved by range as dd/mm', ambigApr.buys && ambigApr.buys[0].date === '2026-04-03');
const ambigMar = sandbox.parseScreenshotText(ambig.replace(/\d{1,2} [A-Za-z]{3} \d{4}\s*[-–]\s*\d{1,2} [A-Za-z]{3} \d{4}/g, '01 Mar 2026 - 07 Mar 2026'));
assert('IBKR ambiguous date resolved by range as mm/dd', ambigMar.buys && ambigMar.buys[0].date === '2026-03-04');
const ibkrDraft = sandbox.screenshotDraftToTrade(ibkr);
assert('IBKR commission saved as $ fees', ibkrDraft.fees_mode === '$' && near(parseFloat(ibkrDraft.fees), 0.35, 0.001));

const merged = sandbox.siMergeBuys(xtb.buys, [xtb.buys[2], { qty: 5, price: 50, date: null, check: true }]);
assert('XTB second screenshot merges without duplicates', merged.length === 4);

const bad = sandbox.parseScreenshotText('random screenshot of a cat');
assert('unsupported screen errors', !!bad.error);
assert('no ORDER id leaked', JSON.stringify(tbuy).toLowerCase().indexOf('order id') < 0 || (tbuy.ignored && tbuy.ignored.indexOf('order id') >= 0));
assert('draft does not auto-save flag', !sandbox.screenshotDraftToTrade(xtb).saved);

console.log('\nPassed: ' + passed);
console.log('Failed: ' + failed);
if (failed) process.exit(1);
