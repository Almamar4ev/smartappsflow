// MATH HELPERS
// ==========================================================================
function calcAvgPrice(t) {
  var totalCost = t.entry * t.original_qty;
  var totalQty  = t.original_qty;
  if (t.add_buys) { t.add_buys.forEach(function(b){ totalCost += b.price * b.qty; totalQty += b.qty; }); }
  var avg = totalQty > 0 ? totalCost / totalQty : t.entry;
  return avg;
}
// ── Chronological cost-basis ledger (average-cost method) ──
// Replays entry buy, add-buys and partial closes in date order so a
// buy that happens AFTER a partial close no longer pollutes history.
function _tradeEvents(t) {
  var ev = [{d: t.entry_date || '0000-01-01', seq: 0, ts: 0, kind: 'buy', qty: t.original_qty || t.qty || 0, price: t.entry || 0}];
  (t.add_buys || []).forEach(function(b){ ev.push({d: b.date || t.entry_date || '0000-01-01', seq: 1, ts: (b.ts != null ? b.ts : null), kind: 'buy', qty: b.qty || 0, price: b.price || 0}); });
  (t.partial_closes || []).forEach(function(pc){ ev.push({d: pc.date || '9999-12-31', seq: 2, ts: (pc.ts != null ? pc.ts : null), kind: 'sell', qty: pc.qty || 0, ref: pc}); });
  // Order: by date; within the same day, by real creation timestamp when
  // both events have one; otherwise fall back to kind priority (seq) so
  // legacy records keep their documented buy-before-sell behaviour.
  ev.sort(function(a,b){
    if (a.d !== b.d) return a.d < b.d ? -1 : 1;
    if (a.ts != null && b.ts != null && a.ts !== b.ts) return a.ts - b.ts;
    return a.seq - b.seq;
  });
  return ev;
}
// Returns remaining position after all recorded events:
// {qty, cost, avg}. During replay it also records the correct basis
// on each sell event object (e.ref._ledgerBasis).
function calcPositionState(t) {
  var qty = 0, cost = 0;
  _tradeEvents(t).forEach(function(e){
    if (e.kind === 'buy') { cost += e.price * e.qty; qty += e.qty; }
    else {
      var avg = qty > 0.0000001 ? cost / qty : (t.entry || 0);
      if (e.ref) e.ref._ledgerBasis = avg;
      var q = Math.min(e.qty, qty);
      cost -= avg * q; qty -= q;
    }
  });
  if (qty < 0.0000001) { qty = 0; cost = 0; }
  return {qty: qty, cost: cost, avg: qty > 0.0000001 ? cost / qty : (t.entry || 0)};
}
// One-time migration: persist chronological basis on legacy partial
// closes that were saved before basis snapshots existed.
function migrateBasis(t) {
  if (!t.partial_closes || !t.partial_closes.length) return;
  var needs = t.partial_closes.some(function(pc){ return pc.basis == null; });
  if (!needs) return;
  calcPositionState(t); // annotates _ledgerBasis chronologically
  t.partial_closes.forEach(function(pc){
    if (pc.basis == null && pc._ledgerBasis != null) pc.basis = pc._ledgerBasis;
  });
}
function calcTotalQty(t) {
  var total = t.original_qty;
  if (t.add_buys) t.add_buys.forEach(function(b){ total += b.qty; });
  if (t.partial_closes) t.partial_closes.forEach(function(pc){ total -= pc.qty; });
  return Math.max(0, total);
}
function calcBoughtQty(t) {
  var total = t.original_qty || 0;
  if (t.add_buys) t.add_buys.forEach(function(b){ total += b.qty; });
  return total;
}
function calcInvestedValue(t) {
  var avg = calcAvgPrice(t);
  var totalBought = t.original_qty;
  if (t.add_buys) t.add_buys.forEach(function(b){ totalBought += b.qty; });
  return avg * totalBought;
}
function calcFeesAmt(fees, feesMode, gross) {
  var f = parseFloat(fees) || 0;
  if (feesMode === '%') return gross > 0 ? gross * f / 100 : 0;
  return f;
}
function calcUnrealizedPnl(t) {
  // Returns unrealized P&L based on current price stored in t.current_price
  if (!t.current_price || t.status !== 'open') return null;
  var st = calcPositionState(t);
  var dir = t.direction === 'Long' ? 1 : -1;
  var gross = (t.current_price - st.avg) * st.qty * dir;
  var realized = calcRealizedPnl(t);
  return gross + realized;
}

function calcRealizedPnl(t) {
  if (!t.partial_closes || !t.partial_closes.length) return 0;
  calcPositionState(t); // annotates _ledgerBasis on each close
  var avg = calcAvgPrice(t);
  var dir = t.direction === 'Long' ? 1 : -1;
  return t.partial_closes.reduce(function(sum, pc){
    var basis = (pc.basis != null) ? pc.basis : (pc._ledgerBasis != null ? pc._ledgerBasis : avg);
    var gross = (pc.price - basis) * pc.qty * dir;
    return sum + gross - calcFeesAmt(pc.fees, pc.fees_mode, gross);
  }, 0);
}
function calcAddBuyFees(t) {
  var total = 0;
  if (t.add_buys) t.add_buys.forEach(function(b){ total += calcFeesAmt(b.fees, b.fees_mode, 0); });
  return total;
}
function calcPnl(t) {
  var _abFees = calcAddBuyFees(t);
  if (t.status === 'open') {
    var unreal = calcUnrealizedPnl(t);
    return (unreal !== null ? unreal : calcRealizedPnl(t)) - _abFees;
  }
  var dir = t.direction === 'Long' ? 1 : -1;
  var st = calcPositionState(t);
  if (st.qty <= 0.0001) return calcRealizedPnl(t) - _abFees;
  var gross = (t.exit - st.avg) * st.qty * dir;
  return gross - calcFeesAmt(t.fees, t.fees_mode, gross) + calcRealizedPnl(t) - _abFees;
}

// Realized only: closed trades in full, open trades by their partial sells. No unrealized P&L.
function calcRealizedTotal(t) {
  return t.status === 'closed' ? calcPnl(t) : calcRealizedPnl(t);
}
// Cost of the shares behind calcRealizedTotal: the whole trade once closed, only the sold shares while open.
function calcRealizedCost(t) {
  if (t.status === 'closed') return calcInvestedValue(t);
  if (!t.partial_closes || !t.partial_closes.length) return 0;
  calcPositionState(t);
  var avg = calcAvgPrice(t);
  return t.partial_closes.reduce(function(sum, pc){
    var basis = (pc.basis != null) ? pc.basis : (pc._ledgerBasis != null ? pc._ledgerBasis : avg);
    return sum + basis * pc.qty;
  }, 0);
}

// Break-even band: a P&L within +/-0.005 counts as neither win nor loss.
var BE_EPS = 0.005;
function isWin(t)  { return calcPnl(t) >  BE_EPS; }
function isLoss(t) { return calcPnl(t) < -BE_EPS; }
function isBreakeven(t) { var p = calcPnl(t); return p >= -BE_EPS && p <= BE_EPS; }

// ==========================================================================
// FEES CALCULATION
// ==========================================================================
function calcTradeFees(t) {
  // Calculate actual fees paid for a single trade (closed portion only)
  var total = 0;
  calcPositionState(t); // annotates _ledgerBasis
  var avg = calcAvgPrice(t);
  var dir = t.direction === 'Long' ? 1 : -1;
  // Partial closes fees
  if (t.partial_closes) {
    t.partial_closes.forEach(function(pc) {
      var basis = (pc.basis != null) ? pc.basis : (pc._ledgerBasis != null ? pc._ledgerBasis : avg);
      var gross = (pc.price - basis) * pc.qty * dir;
      total += calcFeesAmt(pc.fees, pc.fees_mode, gross);
    });
  }
  // Final close fees (closed trades only)
  if (t.status === 'closed') {
    var st = calcPositionState(t);
    if (st.qty > 0.0001) {
      var gross = (t.exit - st.avg) * st.qty * dir;
      total += calcFeesAmt(t.fees, t.fees_mode, gross);
    }
  }
  // Add-position (buy-side) flat commissions
  total += calcAddBuyFees(t);
  return total;
}
function calcTotalFees(trades) {
  return trades.reduce(function(s, t){ return s + calcTradeFees(t); }, 0);
}
// ==========================================================================
// TRADE DURATION
// ==========================================================================
function calcDcaSummary(t) {
  var firstQty = t.original_qty || t.qty || 0;
  var allBuys = [{qty: firstQty, price: t.entry || 0, date: t.entry_date}];
  (t.add_buys || []).forEach(function(b){ allBuys.push({qty: b.qty || 0, price: b.price || 0, date: b.date}); });
  var totalShares = allBuys.reduce(function(s,b){ return s + b.qty; }, 0);
  var totalCost   = allBuys.reduce(function(s,b){ return s + b.qty * b.price; }, 0);
  var avg         = totalShares > 0 ? totalCost / totalShares : 0;
  var remainingQty = calcTotalQty(t);
  var feeVal = parseFloat(t.fees) || 0;
  var breakEven;
  if (t.fees_mode === '$' && feeVal > 0 && remainingQty > 0) {
    var dir2 = t.direction === 'Long' ? 1 : -1;
    breakEven = avg + dir2 * (feeVal / remainingQty);
  } else {
    breakEven = avg;
  }
  return {avg: avg, totalShares: totalShares, buys: allBuys.length, breakEven: breakEven};
}
function calcTradeDuration(t) {
  if (!t.entry_date) return null;
  var start = parseLocalDate(t.entry_date);
  var end = t.status === 'closed' && t.exit_date ? parseLocalDate(t.exit_date) : new Date();
  var diff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}
function fmtDuration(days) {
  if (days === null || days === undefined) return '—';
  if (days === 0) return 'Same day';
  if (days === 1) return '1 day';
  if (days < 7) return days + ' days';
  if (days < 30) { var w = Math.floor(days/7); var d = days%7; return w+'w'+(d>0?' '+d+'d':''); }
  if (days < 365) { var mo = Math.floor(days/30); var rd = days%30; return mo+'mo'+(rd>0?' '+rd+'d':''); }
  var yr = Math.floor(days/365); var rm = Math.floor((days%365)/30); return yr+'yr'+(rm>0?' '+rm+'mo':'');
}
// ==========================================================================

// Calculators: pure math shared by the UI and tests
// Converts a risk input when the user switches between % of account and a fixed amount.
function convertRiskValue(value, balance, toMode) {
  var v = parseFloat(value), b = parseFloat(balance);
  if (!(v > 0) || !(b > 0)) return null;
  var out = toMode === '$' ? b * v / 100 : v / b * 100;
  return Math.round(out * 100) / 100;
}

// o: {balance, risk, riskMode '%'|'$', priceMode, margin, slPct, tpPct, entry, stop, target}
function calcPositionPlan(o) {
  var bal = parseFloat(o.balance), riskVal = parseFloat(o.risk);
  if (isNaN(bal) || isNaN(riskVal) || bal <= 0 || riskVal <= 0) return { error: 'risk' };
  if (o.riskMode === '$' ? riskVal > bal : riskVal > 100) return { error: 'riskTooHigh' };
  var riskAmt = o.riskMode === '$' ? riskVal : bal * riskVal / 100;
  var r;
  if (o.priceMode) {
    var entry = parseFloat(o.entry), sl = parseFloat(o.stop), tp = parseFloat(o.target) || null;
    if (isNaN(entry) || isNaN(sl) || entry <= 0 || sl <= 0 || sl === entry) return { error: 'prices' };
    if (tp && (tp - entry) * (sl - entry) >= 0) return { error: 'targetSide' };
    var rps = Math.abs(entry - sl);
    var idealQty = riskAmt / rps;
    var capped = !o.margin && idealQty * entry > bal;
    var qty = capped ? bal / entry : idealQty;
    var rwps = tp ? Math.abs(tp - entry) : null;
    r = { posVal: qty * entry, qty: qty, entry: entry, actualRisk: qty * rps, idealRisk: idealQty * rps,
      slPct: rps / entry * 100, tpPct: rwps ? rwps / entry * 100 : null, rps: rps, rwps: rwps,
      reward: rwps ? qty * rwps : null, rr: rwps ? rwps / rps : null, capped: capped, short: sl > entry };
  } else {
    var slPct = parseFloat(o.slPct), tpPct = parseFloat(o.tpPct) || null;
    if (isNaN(slPct) || slPct <= 0) return { error: 'stopPct' };
    if (slPct >= 100) return { error: 'stopTooBig' };
    var idealPos = riskAmt / (slPct / 100);
    var capped2 = !o.margin && idealPos > bal;
    var posVal = capped2 ? bal : idealPos;
    r = { posVal: posVal, qty: null, actualRisk: posVal * (slPct / 100), idealRisk: riskAmt,
      slPct: slPct, tpPct: tpPct, reward: tpPct ? posVal * tpPct / 100 : null, rr: tpPct ? tpPct / slPct : null, capped: capped2 };
  }
  r.balance = bal;
  r.riskAmt = riskAmt;
  r.leverage = r.posVal / bal;
  r.needsLeverage = !!o.margin && r.leverage > 1.0001;
  r.balanceIfStop = bal - r.actualRisk;
  r.balanceIfTarget = r.reward !== null ? bal + r.reward : null;
  return r;
}

// o: {capital, rate, ratePer 'annual'|'monthly'|'weekly', duration, durUnit 'months'|'years', deposit, freq}
function calcCompoundPlan(o) {
  var P = parseFloat(o.capital), rate = parseFloat(o.rate), duration = parseInt(o.duration, 10);
  var deposit = parseFloat(o.deposit) || 0, freq = parseInt(o.freq, 10) || 12;
  if (isNaN(P) || isNaN(rate) || isNaN(duration) || P <= 0 || duration <= 0) return null;
  var annualRate = o.ratePer === 'monthly' ? rate / 100 * 12 : (o.ratePer === 'weekly' ? rate / 100 * 52 : rate / 100);
  var totalMonths = o.durUnit === 'years' ? duration * 12 : duration;
  var base = 1 + annualRate / freq;
  var monthlyFactor = base > 0 ? Math.pow(base, freq / 12) : 1;
  var bal = P, totalDeposited = 0, totalGrowth = 0, rows = [];
  for (var mo = 1; mo <= totalMonths; mo++) {
    var growth = bal * (monthlyFactor - 1);
    bal = bal + growth + deposit;
    totalDeposited += deposit; totalGrowth += growth;
    rows.push([mo, growth, deposit, bal]);
  }
  var totalInvested = P + totalDeposited;
  return { finalBalance: bal, totalMonths: totalMonths, totalDeposited: totalDeposited, totalInvested: totalInvested,
    totalGrowth: totalGrowth, roi: totalInvested !== 0 ? totalGrowth / totalInvested * 100 : 0, rows: rows };
}