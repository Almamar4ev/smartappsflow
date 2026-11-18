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
  // Leading zeros stay while typing (deleting the 6 of "6,019" must leave "019", ready for a new
  // first digit) but are not grouped, so "00012" never reads "00,012". tidyNumber() drops them on blur.
  const intRaw = (pieces[0] || '').replace(/\D/g, '');
  const typedDecimal = pieces.length > 1;
  const frac = typedDecimal ? pieces.slice(1).join('').replace(/\D/g, '') : '';
  if (!intRaw && !typedDecimal && !neg) return { canonical: '', display: '' };
  const zeros = intRaw.length > 1 ? intRaw.match(/^0*(?=\d)/)[0] : '';
  const body = intRaw.slice(zeros.length);
  const grouped = zeros + body.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  let shown = (neg ? '-' : '') + grouped;
  if (typedDecimal) shown += decimal + frac;
  let canonical = (neg ? '-' : '') + (intRaw || (typedDecimal ? '0' : ''));
  if (typedDecimal) canonical += `.${frac}`;
  if (canonical === '-' || canonical === '-0') canonical = neg && !intRaw && !typedDecimal ? '-' : canonical;
  return { canonical, display: shown };
}

// Canonical number without leading zeros ("00012" → "12", "007.5" → "7.5", "0.5" stays). Used on blur.
export function tidyNumber(canonical) {
  const text = String(canonical ?? '');
  const neg = text.startsWith('-');
  const body = (neg ? text.slice(1) : text).replace(/^0+(?=\d)/, '');
  return (neg ? '-' : '') + body;
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

// Max leverage from the broker: 1 = cash. Older saves used account: 'cash' | 'margin' (margin = no cap).
function leverageCap({ maxLeverage, account }) {
  if (maxLeverage === Infinity) return Infinity;
  const lev = num(maxLeverage);
  if (lev >= 1) return lev;
  return account === 'margin' ? Infinity : 1;
}

// Fee per side (entry and exit) as a fraction: "0.1" → 0.001. Empty or invalid → 0.
function feeRate(fee) {
  const f = num(fee);
  return f > 0 ? f / 100 : 0;
}

// Leverage facts shared by both modes. The account-wipeout move comes from the leverage actually
// used (position ÷ balance), not the broker's maximum: in a normal (cross) margin account the whole
// balance backs the position, so it is gone after a move of 100% ÷ used leverage (before fees).
// Only shown once the position is bigger than the balance; flagged when it is under 10%.
function leverageFacts(position, bal, cap) {
  const finite = Number.isFinite(cap);
  const leverage = position / bal;
  const wipeoutPct = leverage > 1 ? 100 / leverage : null;
  return {
    leverage,
    maxLeverage: cap,
    buyingPower: bal * cap,
    marginRequired: finite && cap > 1 ? position / cap : null,
    wipeoutPct,
    wipeoutNear: wipeoutPct != null && wipeoutPct < 10,
  };
}

/**
 * Size from a stop distance in %. Fees (per side) shrink the position so the total loss at the stop —
 * price move plus entry and exit fees — stays equal to the money the user chose to risk.
 *   lossFraction = s + f × (2 − s)        position = risk / lossFraction, capped at balance × maxLeverage
 *   gain         = position × t − position × f × (2 + t)
 */
export function positionByPercent({ balance, riskMode, riskValue, stopPct, targetPct, account, maxLeverage, fee }) {
  const bal = num(balance);
  const riskVal = num(riskValue);
  const stop = num(stopPct);
  const target = targetPct === '' || targetPct == null ? null : num(targetPct);
  if (!(bal > 0) || !(riskVal > 0)) return { ok: false, reason: 'balance' };
  if (!(stop > 0)) return { ok: false, reason: 'stop' };
  const cap = leverageCap({ maxLeverage, account });
  const f = feeRate(fee);
  const s = stop / 100;
  const requestedRisk = riskAmount(bal, riskMode, riskVal);
  const lossFraction = s + f * (2 - s);
  const ideal = requestedRisk / lossFraction;
  const buyingPower = bal * cap;
  const capped = ideal > buyingPower * (1 + 1e-12);
  const position = capped ? buyingPower : ideal;
  const actualRisk = position * lossFraction;
  let reward = null;
  let rr = null;
  if (target != null && target > 0) {
    const t = target / 100;
    reward = position * t - position * f * (2 + t);
    rr = reward / actualRisk;
  }
  const facts = leverageFacts(position, bal, cap);
  return {
    ok: true,
    position,
    pctOfBalance: (position / bal) * 100,
    actualRisk,
    riskPct: (actualRisk / bal) * 100,
    capped,
    requestedRisk,
    ...facts,
    needsLeverage: facts.leverage > 1.0001,
    margin: cap > 1,
    fees: position * f * (2 - s),
    feeRate: f,
    reward,
    rr,
    stopPct: stop,
    targetPct: target,
    balance: bal,
  };
}

/**
 * Size from entry and stop prices. Direction comes from the stop: below entry = long, above = short.
 * The target must sit on the other side of entry, otherwise there is no reward (wrongTarget).
 *   lossPerShare = |E − S| + f × (E + S)      quantity = floor(risk / lossPerShare), capped at buying power
 *   gainPerShare = |T − E| − f × (E + T)
 */
export function positionByPrice({ balance, riskMode, riskValue, entry, stop, target, fractional, account, maxLeverage, fee }) {
  const bal = num(balance);
  const riskVal = num(riskValue);
  const entryPrice = num(entry);
  const stopPrice = num(stop);
  const targetPrice = target === '' || target == null ? null : num(target);
  if (!(bal > 0) || !(riskVal > 0)) return { ok: false, reason: 'balance' };
  if (!(entryPrice > 0) || !(stopPrice > 0) || stopPrice === entryPrice) {
    return { ok: false, reason: 'prices' };
  }
  const cap = leverageCap({ maxLeverage: maxLeverage ?? (account ? undefined : Infinity), account });
  const f = feeRate(fee);
  const direction = stopPrice < entryPrice ? 'long' : 'short';
  const requestedRisk = riskAmount(bal, riskMode, riskVal);
  const riskPerShare = Math.abs(entryPrice - stopPrice);
  const lossPerShare = riskPerShare + f * (entryPrice + stopPrice);
  const rawQty = requestedRisk / lossPerShare;
  const buyingPower = bal * cap;
  const rawMax = buyingPower / entryPrice;
  const maxQty = fractional ? rawMax : Math.floor(rawMax + 1e-9);
  let quantity = fractional ? rawQty : Math.floor(rawQty + 1e-9);
  const capped = quantity > maxQty;
  if (capped) quantity = maxQty;
  if (!(quantity > 0)) return { ok: false, reason: 'shares' };
  const position = quantity * entryPrice;
  const actualRisk = quantity * lossPerShare;
  const stopPct = (riskPerShare / entryPrice) * 100;
  let rewardPerShare = null;
  let reward = null;
  let rr = null;
  let wrongTarget = false;
  if (targetPrice != null && targetPrice > 0) {
    const rightSide = direction === 'long' ? targetPrice > entryPrice : targetPrice < entryPrice;
    if (rightSide) {
      rewardPerShare = Math.abs(targetPrice - entryPrice) - f * (entryPrice + targetPrice);
      reward = quantity * rewardPerShare;
      rr = reward / actualRisk;
    } else {
      wrongTarget = true;
    }
  }
  const facts = leverageFacts(position, bal, cap);
  return {
    ok: true,
    direction,
    quantity,
    position,
    pctOfBalance: (position / bal) * 100,
    riskPerShare,
    lossPerShare,
    stopPct,
    actualRisk,
    riskPct: (actualRisk / bal) * 100,
    capped,
    requestedRisk,
    ...facts,
    needsLeverage: facts.leverage > 1.0001,
    margin: cap > 1,
    fees: quantity * f * (entryPrice + stopPrice),
    feeRate: f,
    rewardPerShare,
    targetPct: rewardPerShare == null ? null : (Math.abs(targetPrice - entryPrice) / entryPrice) * 100,
    reward,
    rr,
    wrongTarget,
    balance: bal,
    floored: !fractional && !capped && quantity !== rawQty,
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
  if (whole) {
    // Snap float noise first (e.g. 1200.0000000002 → 1200) so large positions are not one share over.
    const snapped = Math.abs(needed - Math.round(needed)) < 1e-6 ? Math.round(needed) : needed;
    needed = Math.ceil(snapped);
  }
  if (!(needed > 0) || !Number.isFinite(needed)) return { ok: false, reason: 'empty' };
  const neededCost = needed * Pb;
  const newQty = Q + needed;
  const newAvg = (Q * A + neededCost) / newQty;
  // Whole-share rounding can land the average a little under the target; the UI explains it.
  const belowTarget = newAvg < T - 0.005;
  return { ok: true, needed, neededCost, newQty, newAvg, belowTarget };
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
    // Asked to sell more than owned: we sell everything, and the UI says how many there are.
    capped: named > 0 && named > (whole ? Math.floor(Q) : Q),
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
