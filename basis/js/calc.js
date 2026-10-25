/**
 * Pure trading-calculator math. Display code rounds; these functions do not.
 * Compounding matches the Edgeory month loop:
 *   annualRate from the chosen rate period
 *   monthlyFactor = (1 + annualRate / frequency) ^ (frequency / 12)
 *   balance = previous + interest + deposit
 */

const MAX_MONTHS = 600;
const FREQUENCIES = new Set([1, 4, 12, 52, 365]);
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function numberStyle(lang) {
  return lang === 'es' || lang === 'pt' ? 'es' : 'en';
}

export function separators(lang) {
  return numberStyle(lang) === 'es'
    ? { group: '.', decimal: ',' }
    : { group: ',', decimal: '.' };
}

function mapDigits(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const ar = ARABIC_DIGITS.indexOf(ch);
    if (ar >= 0) { out += String(ar); continue; }
    const fa = PERSIAN_DIGITS.indexOf(ch);
    if (fa >= 0) { out += String(fa); continue; }
    out += ch;
  }
  return out;
}

export function parseNumber(value, lang = 'en') {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let text = mapDigits(value).trim().replace(/\s/g, '');
  if (!text || text === '+' || text === '-') return NaN;
  text = text.replaceAll('٬', 'GRP').replaceAll('٫', 'DEC');
  const { group, decimal } = separators(lang);
  if (group) text = text.split(group).join('');
  text = text.replaceAll('GRP', '');
  text = text.replaceAll('DEC', '.').split(decimal).join('.');
  if (!/^[+-]?\d*\.?\d+$/.test(text)) return NaN;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

export function liveFormat(display, lang = 'en') {
  const { group, decimal } = separators(lang);
  let text = mapDigits(display).replace(/\s/g, '');
  const neg = text.startsWith('-');
  if (neg) text = text.slice(1);
  text = text.replaceAll('٬', '').replaceAll(group, '');
  text = text.replaceAll('٫', decimal);
  const pieces = text.split(decimal);
  const intRaw = (pieces[0] || '').replace(/\D/g, '');
  const typedDecimal = pieces.length > 1;
  const frac = typedDecimal ? pieces.slice(1).join('').replace(/\D/g, '') : '';
  if (!intRaw && !typedDecimal && !neg) return { canonical: '', display: '' };
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  let shown = (neg ? '-' : '') + grouped;
  if (typedDecimal) shown += decimal + frac;
  let canonical = (neg ? '-' : '') + (intRaw || (typedDecimal ? '0' : ''));
  if (typedDecimal) canonical += `.${frac}`;
  if (canonical === '-' || canonical === '-0') canonical = neg && !intRaw && !typedDecimal ? '-' : canonical;
  return { canonical, display: shown };
}

export function formatInputValue(canonical, lang = 'en') {
  return liveFormat(String(canonical ?? '').replace('.', separators(lang).decimal), lang).display;
}

function num(value) {
  return parseNumber(value, 'en');
}

function riskAmount(balance, mode, value) {
  return mode === 'amount' ? value : balance * value / 100;
}

export function stockAverage(rows) {
  const valid = [];
  for (const row of rows || []) {
    const price = num(row.price);
    const qty = num(row.qty);
    if (price > 0 && qty > 0) valid.push({ price, qty });
  }
  if (!valid.length) return { ok: false, reason: 'empty' };
  const totalCost = valid.reduce((sum, row) => sum + row.price * row.qty, 0);
  const totalShares = valid.reduce((sum, row) => sum + row.qty, 0);
  return {
    ok: true,
    average: totalCost / totalShares,
    totalCost,
    totalShares,
    buys: valid.length,
  };
}

export function averageSell(summary, sellPrice) {
  const sell = num(sellPrice);
  if (!summary || !summary.ok || !(sell > 0)) return { ok: false, reason: 'empty' };
  const revenue = sell * summary.totalShares;
  const pnl = revenue - summary.totalCost;
  const pct = summary.totalCost > 0 ? (pnl / summary.totalCost) * 100 : 0;
  return { ok: true, revenue, pnl, pct };
}

export function profitLoss({ side, entry, exit, qty }) {
  const entryPrice = num(entry);
  const exitPrice = num(exit);
  const quantity = num(qty);
  if (!(entryPrice > 0) || !Number.isFinite(exitPrice) || exitPrice < 0 || !(quantity > 0)) {
    return { ok: false, reason: 'empty' };
  }
  const dir = side === 'short' ? -1 : 1;
  const delta = (exitPrice - entryPrice) * dir;
  return {
    ok: true,
    side: dir === -1 ? 'short' : 'long',
    delta,
    pct: (delta / entryPrice) * 100,
    pnl: delta * quantity,
  };
}

export function positionByPercent({ balance, riskMode, riskValue, stopPct, targetPct, account }) {
  const bal = num(balance);
  const riskVal = num(riskValue);
  const stop = num(stopPct);
  const target = targetPct === '' || targetPct == null ? null : num(targetPct);
  if (!(bal > 0) || !(riskVal > 0)) return { ok: false, reason: 'balance' };
  if (!(stop > 0)) return { ok: false, reason: 'stop' };
  const requestedRisk = riskAmount(bal, riskMode, riskVal);
  const ideal = requestedRisk / (stop / 100);
  const margin = account === 'margin';
  const capped = !margin && ideal > bal;
  const position = capped ? bal : ideal;
  const actualRisk = position * (stop / 100);
  const leverage = position / bal;
  let reward = null;
  let rr = null;
  if (target != null && target > 0) {
    reward = position * target / 100;
    rr = target / stop;
  }
  return {
    ok: true,
    position,
    pctOfBalance: (position / bal) * 100,
    actualRisk,
    riskPct: (actualRisk / bal) * 100,
    capped,
    requestedRisk,
    leverage,
    needsLeverage: margin && leverage > 1.0001,
    margin,
    reward,
    rr,
    stopPct: stop,
    targetPct: target,
    balance: bal,
  };
}

export function positionByPrice({ balance, riskMode, riskValue, entry, stop, target, fractional }) {
  const bal = num(balance);
  const riskVal = num(riskValue);
  const entryPrice = num(entry);
  const stopPrice = num(stop);
  const targetPrice = target === '' || target == null ? null : num(target);
  if (!(bal > 0) || !(riskVal > 0)) return { ok: false, reason: 'balance' };
  if (!(entryPrice > 0) || !(stopPrice > 0) || stopPrice === entryPrice) {
    return { ok: false, reason: 'prices' };
  }
  const requestedRisk = riskAmount(bal, riskMode, riskVal);
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const rawQty = requestedRisk / riskPerShare;
  const quantity = fractional ? rawQty : Math.floor(rawQty);
  if (!(quantity > 0)) return { ok: false, reason: 'shares' };
  const position = quantity * entryPrice;
  const actualRisk = quantity * riskPerShare;
  const rewardPerShare = targetPrice != null && targetPrice > 0 ? Math.abs(targetPrice - entryPrice) : null;
  const reward = rewardPerShare == null ? null : quantity * rewardPerShare;
  const rr = rewardPerShare == null ? null : rewardPerShare / riskPerShare;
  return {
    ok: true,
    quantity,
    position,
    pctOfBalance: (position / bal) * 100,
    riskPerShare,
    stopPct: (riskPerShare / entryPrice) * 100,
    actualRisk,
    riskPct: (actualRisk / bal) * 100,
    requestedRisk,
    rewardPerShare,
    targetPct: rewardPerShare == null ? null : (rewardPerShare / entryPrice) * 100,
    reward,
    rr,
    balance: bal,
    floored: !fractional && quantity !== rawQty,
  };
}

export function compoundGrowth({ capital, rate, ratePeriod, duration, durationUnit, deposit, frequency }) {
  const principal = num(capital);
  const rateValue = num(rate);
  const span = num(duration);
  const contribution = deposit === '' || deposit == null ? 0 : num(deposit);
  const freq = num(frequency);
  if (!Number.isFinite(principal) || principal < 0 || !Number.isFinite(rateValue) || !(span > 0)) {
    return { ok: false, reason: 'empty' };
  }
  if (!Number.isFinite(contribution) || contribution < 0) return { ok: false, reason: 'deposit' };
  if (!(principal > 0) && !(contribution > 0)) return { ok: false, reason: 'empty' };
  if (!FREQUENCIES.has(freq)) return { ok: false, reason: 'frequency' };
  const months = durationUnit === 'years' ? Math.round(span * 12) : Math.round(span);
  if (!(months > 0)) return { ok: false, reason: 'empty' };
  if (months > MAX_MONTHS) return { ok: false, reason: 'range' };

  const annualRate = ratePeriod === 'monthly'
    ? rateValue / 100 * 12
    : ratePeriod === 'weekly'
      ? rateValue / 100 * 52
      : rateValue / 100;
  const base = 1 + annualRate / freq;
  const monthlyFactor = base > 0 ? Math.pow(base, freq / 12) : 1;

  let balance = principal;
  let totalDeposited = 0;
  let totalGrowth = 0;
  const schedule = [];
  for (let month = 1; month <= months; month += 1) {
    const interest = balance * (monthlyFactor - 1);
    balance = balance + interest + contribution;
    totalDeposited += contribution;
    totalGrowth += interest;
    schedule.push({ month, interest, deposit: contribution, balance });
  }
  const totalInvested = principal + totalDeposited;
  const roi = totalInvested !== 0 ? (totalGrowth / totalInvested) * 100 : 0;
  return {
    ok: true,
    capital: principal,
    totalDeposited,
    totalInvested,
    totalGrowth,
    roi,
    finalBalance: balance,
    months: schedule,
  };
}

export function positionMark({ qty, avg, price }) {
  const Q = num(qty);
  const A = num(avg);
  const P = num(price);
  if (!(Q > 0) || !(A > 0) || !(P > 0)) return { ok: false, reason: 'empty' };
  const cost = Q * A;
  const value = Q * P;
  const unrealized = (P - A) * Q;
  const rise = A / P - 1;
  return {
    ok: true,
    cost,
    value,
    unrealized,
    unrealizedPct: ((P - A) / A) * 100,
    breakEven: rise * 100,
    inProfit: rise <= 0,
  };
}

function buyPriceOf({ price, buyPrice }) {
  const Pb = num(buyPrice);
  if (Pb > 0) return Pb;
  const P = num(price);
  return P > 0 ? P : NaN;
}

export function whatIfBuy({ qty, avg, price, buyQty, buyAmount, buyPrice }) {
  const Q = num(qty);
  const A = num(avg);
  if (!(Q > 0) || !(A > 0)) return { ok: false, reason: 'position' };
  const Pb = buyPriceOf({ price, buyPrice });
  if (!(Pb > 0)) return { ok: false, reason: 'price' };
  let b = num(buyQty);
  if (!(b > 0)) {
    const M = num(buyAmount);
    if (!(M > 0)) return { ok: false, reason: 'buy' };
    b = M / Pb;
  }
  const buyCost = b * Pb;
  const newQty = Q + b;
  const newAvg = (Q * A + buyCost) / newQty;
  const markPrice = num(price);
  return {
    ok: true,
    buyQty: b,
    buyCost,
    newQty,
    newAvg,
    avgChange: newAvg - A,
    totalCost: Q * A + buyCost,
    breakEven: markPrice > 0 ? (newAvg / markPrice - 1) * 100 : null,
  };
}

export function targetAverage({ qty, avg, price, buyPrice, target, whole }) {
  const Q = num(qty);
  const A = num(avg);
  const T = num(target);
  const Pb = buyPriceOf({ price, buyPrice });
  if (!(Q > 0) || !(A > 0) || !(T > 0) || !(Pb > 0)) return { ok: false, reason: 'empty' };
  if (T >= A) return { ok: false, reason: 'already' };
  if (T <= Pb) return { ok: false, reason: 'impossible' };
  let needed = Q * (A - T) / (T - Pb);
  if (whole) needed = Math.ceil(needed - 1e-12);
  if (!(needed > 0) || !Number.isFinite(needed)) return { ok: false, reason: 'empty' };
  const neededCost = needed * Pb;
  const newQty = Q + needed;
  const newAvg = (Q * A + neededCost) / newQty;
  return { ok: true, needed, neededCost, newQty, newAvg };
}

export function whatIfSell({ qty, avg, price, sellPct, sellQty, sellPrice, whole }) {
  const Q = num(qty);
  const A = num(avg);
  if (!(Q > 0) || !(A > 0)) return { ok: false, reason: 'position' };
  const Ps = buyPriceOf({ price, buyPrice: sellPrice });
  if (!(Ps > 0)) return { ok: false, reason: 'price' };
  const named = num(sellQty);
  const percent = num(sellPct);
  let sold;
  if (whole) {
    if (named > 0) sold = Math.min(Math.floor(named), Math.floor(Q));
    else if (percent > 0) sold = Math.floor(Q * Math.min(percent, 100) / 100);
    else sold = NaN;
    if (!(sold >= 1)) return { ok: false, reason: 'shares' };
  } else {
    sold = Math.min(Q, named > 0 ? named : percent > 0 ? Q * percent / 100 : NaN);
    if (!(sold > 0)) return { ok: false, reason: 'sell' };
  }
  const remaining = Q - sold;
  return {
    ok: true,
    sold,
    received: sold * Ps,
    realized: (Ps - A) * sold,
    returnPct: ((Ps - A) / A) * 100,
    remaining,
    remainUnrealized: (Ps - A) * remaining,
  };
}

export function sellCompare({ qty, avg, price, sellPrice, whole }) {
  return [25, 50, 75, 100].map((pct) => ({
    pct,
    ...whatIfSell({ qty, avg, price, sellPct: pct, sellQty: '', sellPrice, whole }),
  }));
}
