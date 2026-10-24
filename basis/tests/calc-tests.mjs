import test from 'node:test';
import assert from 'node:assert/strict';
import { stockAverage, averageSell, profitLoss, positionByPercent, positionByPrice, compoundGrowth, positionMark, whatIfBuy, targetAverage, whatIfSell } from '../js/calc.js';
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

test('compound growth rejects a span longer than 50 years', () => {
  const result = compoundGrowth({
    capital: '1000', rate: '5', ratePeriod: 'annual', duration: '51', durationUnit: 'years', deposit: '', frequency: '12',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'range');
});
