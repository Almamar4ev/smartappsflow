import test from 'node:test';
import assert from 'node:assert/strict';
import { stockAverage, averageSell, profitLoss, positionByPercent, positionByPrice, compoundGrowth, positionMark, whatIfBuy, targetAverage, whatIfSell, sellCompare, parseNumber, liveFormat } from '../js/calc.js';
import { STR } from '../js/i18n.js';

function close(actual, expected, eps = 0.01) {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} vs ${expected}`);
}

test('every language exposes the same phrases', () => {
  const keys = Object.keys(STR.en).sort();
  for (const lang of Object.keys(STR)) {
    assert.deepEqual(Object.keys(STR[lang]).sort(), keys, lang);
  }
});

test('stock average is the weighted cost', () => {
  const result = stockAverage([
    { price: '100', qty: '10' },
    { price: '50', qty: '10' },
    { price: '', qty: '' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.average, 75);
  assert.equal(result.totalShares, 20);
  assert.equal(result.totalCost, 1500);
  assert.equal(result.buys, 2);
  const sold = averageSell(result, '80');
  assert.equal(sold.pnl, 100);
  assert.equal(sold.pct, (100 / 1500) * 100);
});

test('profit and loss respects side', () => {
  const long = profitLoss({ side: 'long', entry: '100', exit: '120', qty: '10' });
  assert.equal(long.pnl, 200);
  assert.equal(long.pct, 20);
  const short = profitLoss({ side: 'short', entry: '100', exit: '80', qty: '10' });
  assert.equal(short.pnl, 200);
  assert.equal(short.pct, 20);
  const loss = profitLoss({ side: 'long', entry: '100', exit: '90', qty: '2' });
  assert.equal(loss.pnl, -20);
});

test('percent position caps cash and shows margin leverage', () => {
  const open = positionByPercent({
    balance: '10000', riskMode: 'percent', riskValue: '1', stopPct: '5', targetPct: '10', account: 'cash',
  });
  assert.equal(open.position, 2000);
  assert.equal(open.actualRisk, 100);
  assert.equal(open.rr, 2);
  assert.equal(open.capped, false);

  const capped = positionByPercent({
    balance: '1000', riskMode: 'percent', riskValue: '50', stopPct: '10', targetPct: '', account: 'cash',
  });
  assert.equal(capped.position, 1000);
  assert.equal(capped.actualRisk, 100);
  assert.equal(capped.capped, true);

  const margin = positionByPercent({
    balance: '1000', riskMode: 'percent', riskValue: '50', stopPct: '10', targetPct: '', account: 'margin',
  });
  assert.equal(margin.position, 5000);
  assert.equal(margin.leverage, 5);
  assert.equal(margin.needsLeverage, true);
});

test('price position counts shares from the stop distance', () => {
  const result = positionByPrice({
    balance: '10000', riskMode: 'percent', riskValue: '1', entry: '100', stop: '95', target: '110',
  });
  assert.equal(result.quantity, 20);
  assert.equal(result.position, 2000);
  assert.equal(result.rr, 2);
  assert.equal(result.reward, 200);
});

test('compound growth matches a monthly 1% factor', () => {
  const plain = compoundGrowth({
    capital: '10000', rate: '12', ratePeriod: 'annual', duration: '12', durationUnit: 'months', deposit: '0', frequency: '12',
  });
  assert.ok(Math.abs(plain.finalBalance - 11268.250301319695) < 1e-6);
  assert.equal(plain.totalDeposited, 0);

  const deposited = compoundGrowth({
    capital: '1000', rate: '12', ratePeriod: 'annual', duration: '2', durationUnit: 'months', deposit: '100', frequency: '12',
  });
  assert.ok(Math.abs(deposited.finalBalance - 1221.1) < 1e-9);
  assert.equal(deposited.totalDeposited, 200);
  assert.ok(Math.abs(deposited.totalGrowth - 21.1) < 1e-9);
});

test('commas in a balance are ignored', () => {
  const result = positionByPercent({
    balance: '10,000', riskMode: 'percent', riskValue: '1', stopPct: '5', targetPct: '', account: 'cash',
  });
  assert.equal(result.position, 2000);
});

test('a blank rate is not treated as zero', () => {
  const result = compoundGrowth({
    capital: '1000', rate: '', ratePeriod: 'annual', duration: '1', durationUnit: 'years', deposit: '', frequency: '12',
  });
  assert.equal(result.ok, false);
});

test('what-if mark, buy, sell, and target match the sheet cases', () => {
  const position = { qty: '391.6978', avg: '58.63', price: '39.98' };
  const mark = positionMark(position);
  close(mark.unrealized, -7305.16);
  close(mark.unrealizedPct, -31.81);
  close(mark.breakEven, 46.65);

  const sell25 = whatIfSell({ ...position, sellPct: '25', sellQty: '', sellPrice: '' });
  close(sell25.sold, 97.9245, 0.0001);
  close(sell25.received, 3915.02);
  close(sell25.realized, -1826.29);
  close(sell25.remaining, 293.7734, 0.0001);
  close(sell25.remainUnrealized, -5478.87);

  const sellAll = whatIfSell({ ...position, sellPct: '100', sellQty: '', sellPrice: '' });
  close(sellAll.received, 15660.08);
  close(sellAll.realized, -7305.16);

  const buy100 = whatIfBuy({ ...position, buyQty: '100', buyAmount: '', buyPrice: '' });
  close(buy100.buyCost, 3998);
  close(buy100.newQty, 491.6978, 0.0001);
  close(buy100.newAvg, 54.84);
  close(buy100.avgChange, -3.79);
  close(buy100.breakEven, 37.16);

  const buyCash = whatIfBuy({ ...position, buyQty: '', buyAmount: '1000', buyPrice: '' });
  close(buyCash.buyQty, 25.0125, 0.0001);

  const hit = targetAverage({ ...position, buyPrice: '', target: '50' });
  close(hit.needed, 337.3605, 0.0001);
  close(hit.neededCost, 13487.67);

  assert.equal(targetAverage({ ...position, target: '30' }).reason, 'impossible');
  assert.equal(targetAverage({ ...position, target: '60' }).reason, 'already');
});

test('number parsing follows locale separators and eastern digits', () => {
  assert.equal(parseNumber('1,5', 'es'), 1.5);
  assert.equal(parseNumber('1.500,50', 'es'), 1500.5);
  assert.equal(parseNumber('1,500', 'en'), 1500);
  assert.equal(parseNumber('1,500.50', 'en'), 1500.5);
  assert.equal(parseNumber('١٠٠', 'ar'), 100);
  assert.equal(parseNumber('۱٬۲۵۰٫۵', 'ar'), 1250.5);
  assert.equal(liveFormat('1250.5', 'en').display, '1,250.5');
  assert.equal(liveFormat('1250,5', 'es').display, '1.250,5');
});

test('compound years keep half years as months', () => {
  const result = compoundGrowth({
    capital: '1000', rate: '0', ratePeriod: 'annual', duration: '1.5', durationUnit: 'years', deposit: '0', frequency: '12',
  });
  assert.equal(result.ok, true);
  assert.equal(result.months.length, 18);
});

test('compound growth allows zero capital with a deposit', () => {
  const result = compoundGrowth({
    capital: '0', rate: '12', ratePeriod: 'annual', duration: '2', durationUnit: 'months', deposit: '100', frequency: '12',
  });
  assert.equal(result.ok, true);
  assert.ok(result.finalBalance > 200);
});

test('price position floors to whole shares unless fractional is on', () => {
  const whole = positionByPrice({
    balance: '10000', riskMode: 'percent', riskValue: '1', entry: '33', stop: '30', target: '', fractional: false,
  });
  assert.equal(whole.quantity, 33);
  const part = positionByPrice({
    balance: '10000', riskMode: 'percent', riskValue: '1', entry: '33', stop: '30', target: '', fractional: true,
  });
  assert.ok(Math.abs(part.quantity - 100 / 3) < 1e-9);
});

test('target average ceils to whole shares and reports the new average', () => {
  const hit = targetAverage({
    qty: '50', avg: '79.6', price: '105', buyPrice: '50', target: '70', whole: true,
  });
  assert.equal(hit.ok, true);
  assert.equal(hit.needed, 24);
  close(hit.newAvg, 70);
  close(hit.neededCost, 1200);
});

test('sell compare uses whole shares and includes 75 percent', () => {
  const rows = sellCompare({
    qty: '50', avg: '79.6', price: '105', sellPrice: '110', whole: true,
  });
  assert.equal(rows.length, 4);
  assert.equal(rows[0].pct, 25);
  assert.equal(rows[0].sold, 12);
  assert.equal(rows[2].pct, 75);
  assert.equal(rows[2].sold, 37);
  assert.equal(rows[3].sold, 50);
  close(rows[0].received, 1320);
});

test('compound growth rejects a span longer than 50 years', () => {
  const result = compoundGrowth({
    capital: '1000', rate: '5', ratePeriod: 'annual', duration: '51', durationUnit: 'years', deposit: '', frequency: '12',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'range');
});

test('typing strips leading zeros but keeps a single zero before the decimal', () => {
  assert.equal(liveFormat('00012', 'en').display, '12');
  assert.equal(liveFormat('00012', 'en').canonical, '12');
  assert.equal(liveFormat('0.', 'en').display, '0.');
  assert.equal(liveFormat('0,', 'es').display, '0,');
  assert.equal(liveFormat('0', 'en').display, '0');
});

test('selling more shares than owned sells all of them and flags it', () => {
  const sold = whatIfSell({ qty: 50, avg: 79.6, price: 105, sellPct: '', sellQty: '80', sellPrice: '110', whole: true });
  assert.equal(sold.ok, true);
  assert.equal(sold.sold, 50);
  assert.equal(sold.capped, true);
  const fine = whatIfSell({ qty: 50, avg: 79.6, price: 105, sellPct: '', sellQty: '20', sellPrice: '110', whole: true });
  assert.equal(fine.capped, false);
});

test('lower-the-average snaps float noise and flags a result under the target', () => {
  // 3000 shares at 30 → target 25 buying at 20 needs exactly 3000 more; float noise must not add one.
  const exact = targetAverage({ qty: 3000, avg: 30, price: '', buyPrice: '20', target: '25', whole: true });
  assert.equal(exact.needed, 3000);
  assert.equal(exact.belowTarget, false);
  const under = targetAverage({ qty: 216, avg: 6470 / 216, price: '', buyPrice: '12', target: '25', whole: true });
  assert.equal(under.needed, 83);
  assert.equal(under.belowTarget, true);
});
