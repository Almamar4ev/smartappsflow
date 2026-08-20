// NUMBER FORMATTING
// ==========================================================================
// Currency display toggle: '$' or '' (no symbol)
function currSym() {
  return localStorage.getItem('tl_show_currency') === 'off' ? '' : '$';
}
function toggleCurrencyDisplay() {
  var curr = localStorage.getItem('tl_show_currency') || 'on';
  localStorage.setItem('tl_show_currency', curr === 'on' ? 'off' : 'on');
  renderSidebar();
  renderMain();
  updateDrawerCurrencyLabel();
}
function updateDrawerCurrencyLabel() {
  var el = document.getElementById('drawerCurrencyLabel');
  if (el) el.textContent = localStorage.getItem('tl_show_currency') === 'off' ? 'Show Currency ($)' : 'Hide Currency Symbol';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
// ==========================================================================
// RESTORE SCHEMA SANITIZER
// Hardens data coming from an imported backup file. Whitelists fields,
// clamps string lengths, coerces types, and forces every id to a safe
// pattern (ids flow into onclick handlers, so a tampered id must never
// contain quotes or markup).
// ==========================================================================
var ID_RE = /^[A-Za-z0-9_.-]+$/;
function _sid(v, prefix) {
  var s = String(v == null ? '' : v);
  if (s && ID_RE.test(s) && s.length <= 64) return s;
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function _sstr(v, max) {
  if (v == null) return '';
  var s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}
function _snum(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}
function _sdate(v) {
  var s = String(v == null ? '' : v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function _siso(v) {
  var s = _sstr(v, 40);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s : '';
}
function _schoice(v, allowed, fallback) {
  var s = String(v == null ? '' : v);
  return allowed.indexOf(s) >= 0 ? s : fallback;
}
function _parseMaybeJson(v, fallback) {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch (e) { return fallback; }
}
function _sanEvent(e, prefix) {
  return {
    id: _sid(e && e.id, prefix),
    ts: (e && typeof e.ts === 'number' && isFinite(e.ts)) ? e.ts : null,
    qty: _snum(e && e.qty),
    price: _snum(e && e.price),
    date: _sdate(e && e.date),
    fees: _sstr(e && e.fees, 20),
    fees_mode: (e && (e.fees_mode === '%' || e.fees_mode === '$')) ? e.fees_mode : '$',
    basis: (e && e.basis != null && isFinite(parseFloat(e.basis))) ? parseFloat(e.basis) : null
  };
}
function _sanTrade(t) {
  t = t || {};
  return {
    id: _sid(t.id, 'tr_'),
    accountId: _sid(t.accountId, 'acc_'),
    ticker: _sstr(t.ticker, 20),
    type: _schoice(t.type, ['', 'Day Trade', 'Swing Trade', 'Scalp', 'Position', 'Options', 'Futures', 'Crypto'], ''),
    direction: (t.direction === 'Short') ? 'Short' : 'Long',
    status: (t.status === 'closed') ? 'closed' : 'open',
    entry: _snum(t.entry),
    exit: (t.exit === '' || t.exit == null) ? null : _snum(t.exit),
    qty: _snum(t.qty),
    original_qty: _snum(t.original_qty || t.qty),
    entry_date: _sdate(t.entry_date),
    exit_date: t.exit_date ? _sdate(t.exit_date) : null,
    fees: _sstr(t.fees, 20),
    fees_mode: (t.fees_mode === '$') ? '$' : '%',
    risk: (t.risk == null || t.risk === '') ? null : _snum(t.risk),
    target: (t.target == null || t.target === '') ? null : _snum(t.target),
    stoploss: (t.stoploss == null || t.stoploss === '') ? null : _snum(t.stoploss),
    current_price: (t.current_price != null && isFinite(parseFloat(t.current_price))) ? parseFloat(t.current_price) : null,
    notes: _sstr(t.notes, 5000),
    createdAt: _siso(t.createdAt),
    photos: Array.isArray(t.photos) ? t.photos.map(safePhoto).filter(Boolean).slice(0, 20) : [],
    add_buys: Array.isArray(t.add_buys) ? t.add_buys.map(function(b){ return _sanEvent(b, 'ab_'); }).slice(0, 5000) : [],
    partial_closes: Array.isArray(t.partial_closes) ? t.partial_closes.map(function(pc){ return _sanEvent(pc, 'pc_'); }).slice(0, 5000) : []
  };
}
function _sanAccount(a) {
  a = a || {};
  return {
    id: _sid(a.id, 'acc_'),
    name: _sstr(a.name, 60),
    startingCapital: _snum(a.startingCapital != null ? a.startingCapital : a.capital),
    broker: _sstr(a.broker, 80),
    currency: _sstr(a.currency, 8),
    createdAt: _siso(a.createdAt),
    transactions: Array.isArray(a.transactions) ? a.transactions.map(function(tx){
      // Runtime writes `withdraw`; accept the old `withdrawal` spelling only
      // as a legacy input and normalize it. Unknown types are dropped instead
      // of being silently converted into a deposit or withdrawal.
      var rawType = String(tx && tx.type != null ? tx.type : '');
      var safeType = rawType === 'deposit' ? 'deposit' :
        ((rawType === 'withdraw' || rawType === 'withdrawal') ? 'withdraw' : '');
      if (!safeType) return null;
      return {
        id: _sid(tx && tx.id, 'tx_'),
        type: safeType,
        amount: Math.abs(_snum(tx && tx.amount)),
        date: _sdate(tx && tx.date)
      };
    }).filter(Boolean).slice(0, 5000) : []
  };
}
function sanitizeState(loaded) {
  loaded = loaded || {};
  var rawActiveId = _sstr(loaded.activeAccountId, 64);
  var out = {
    accounts: (Array.isArray(loaded.accounts) ? loaded.accounts : []).map(_sanAccount).slice(0, 1000),
    trades: (Array.isArray(loaded.trades) ? loaded.trades : []).map(_sanTrade).slice(0, 100000),
    activeAccountId: (ID_RE.test(rawActiveId) ? rawActiveId : ''),
    updatedAt: _siso(loaded.updatedAt)
  };
  if (loaded.schemaVersion != null) out.schemaVersion = _sstr(loaded.schemaVersion, 20);
  // Keep activeAccountId valid; fall back to the first account.
  var ids = {}; out.accounts.forEach(function(a){ ids[a.id] = 1; });
  if (!ids[out.activeAccountId]) out.activeAccountId = out.accounts.length ? out.accounts[0].id : '';
  return out;
}

function _sanPosCalc(e) {
  e = e || {};
  return {
    id: _sid(e.id, 'pos_'), name: _sstr(e.name, 100), date: _sdate(e.date),
    mode: _schoice(e.mode, ['price', 'pct'], 'price'),
    riskMode: _schoice(e.riskMode, ['%', '$'], '%'),
    balance: _sstr(e.balance, 40), risk: _sstr(e.risk, 40), entry: _sstr(e.entry, 40),
    sl: _sstr(e.sl, 40), tp: _sstr(e.tp, 40)
  };
}
function _sanCompCalc(e) {
  e = e || {};
  return {
    id: _sid(e.id, 'comp_'), name: _sstr(e.name, 100), date: _sdate(e.date),
    capital: _sstr(e.capital, 40), rate: _sstr(e.rate, 40), ratePer: _sstr(e.ratePer, 20),
    duration: _sstr(e.duration, 40), durUnit: _sstr(e.durUnit, 20),
    deposit: _sstr(e.deposit, 40), freq: _sstr(e.freq, 20)
  };
}
function _sanAvgCalc(e) {
  e = e || {};
  return {
    id: _sid(e.id, 'avg_'), name: _sstr(e.name, 100), date: _sdate(e.date),
    rows: Array.isArray(e.rows) ? e.rows.map(function(r){
      return {price:_sstr(r && r.price, 40), qty:_sstr(r && r.qty, 40)};
    }).slice(0, 100) : []
  };
}
function sanitizeSavedCalcs(value) {
  var src = _parseMaybeJson(value, {}) || {};
  return {
    pos: (Array.isArray(src.pos) ? src.pos : []).map(_sanPosCalc).slice(0, 20),
    comp: (Array.isArray(src.comp) ? src.comp : []).map(_sanCompCalc).slice(0, 20),
    avg: (Array.isArray(src.avg) ? src.avg : []).map(_sanAvgCalc).slice(0, 20)
  };
}
function sanitizeTemplates(value) {
  var arr = _parseMaybeJson(value, []);
  if (!Array.isArray(arr)) arr = [];
  return arr.map(function(t){
    t = t || {};
    return {
      id: _sid(t.id, 'tpl_'), name: _sstr(t.name, 100), ticker: _sstr(t.ticker, 20),
      type: _schoice(t.type, ['', 'Day Trade', 'Swing Trade', 'Scalp', 'Position', 'Options', 'Futures', 'Crypto'], ''),
      direction: (t.direction === 'Short') ? 'Short' : 'Long',
      fees: _sstr(t.fees, 20), fees_mode: (t.fees_mode === '$') ? '$' : '%', risk: _sstr(t.risk, 20)
    };
  }).slice(0, 20);
}
function sanitizeJournals(value) {
  var src = _parseMaybeJson(value, {});
  if (!src || typeof src !== 'object' || Array.isArray(src)) src = {};
  var out = {}, count = 0;
  Object.keys(src).sort().forEach(function(date){
    if (count >= 5000 || !_sdate(date)) return;
    var e = src[date] || {};
    out[date] = {
      date: date,
      mood: _schoice(e.mood, ['', 'stressed', 'neutral', 'focused', 'confident', 'fearful'], ''),
      wentWell: _sstr(e.wentWell, 10000), improve: _sstr(e.improve, 10000), notes: _sstr(e.notes, 20000),
      tags: Array.isArray(e.tags) ? e.tags.map(function(t){ return _sstr(t, 40); }).filter(Boolean).slice(0, 20) : []
    };
    count++;
  });
  return out;
}
function sanitizeProfile(value) {
  var p = _parseMaybeJson(value, {}) || {};
  return {name:_sstr(p.name, 80), email:_sstr(p.email, 254), since:_sstr(p.since, 40), market:_sstr(p.market, 80)};
}
function sanitizeBenchmark(value) {
  var b = _parseMaybeJson(value, null);
  if (!b || typeof b !== 'object') return null;
  var base = parseFloat(b.basePrice);
  if (!isFinite(base) || base <= 0) return null;
  return {basePrice:base, savedAt:_siso(b.savedAt)};
}
function sanitizePrefs(value) {
  var p = _parseMaybeJson(value, {}) || {};
  return {
    theme: _schoice(p.theme, ['dark', 'light', 'green'], 'dark'),
    showCurrency: p.showCurrency === 'off' ? 'off' : 'on'
  };
}

// Only allow app-generated data-URI images (blocks javascript:/http injections via tampered backups)
function safePhoto(src) {
  return (typeof src === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,/.test(src)) ? src : '';
}
function fmtMoney(n) {
  var abs = Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return (n < 0 ? '-' : '') + currSym() + abs;
}
function fmtPnl(n) {
  var v = Math.abs(n);
  var decimals = v % 1 === 0 ? 0 : 2;
  var abs = v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  if (v < 0.005) return currSym() + '0.00';
  return (n >= 0 ? '+' : '-') + currSym() + abs;
}
function fmtNum(n, d) { return parseFloat(n).toFixed(d !== undefined ? d : 4); }
function fmtPrice(n) {
  var v = parseFloat(n) || 0;
  return currSym() + v.toFixed(2);
}
function fmtN(n, prefix) {
  var p = (prefix === undefined) ? currSym() : prefix;
  var v = parseFloat(n) || 0;
  if (v % 1 === 0) return p + v.toLocaleString('en-US');
  return p + v.toFixed(2);
}
function fmtQty(n) {
  var v = parseFloat(n) || 0;
  if (v % 1 === 0) return v.toString();
  return v.toFixed(2);
}
function fmtDate(d) {
  if (!d || d === '—') return d || '—';
  var parts = d.split('-');
  if (parts.length !== 3) return d;
  return parts[2] + '-' + parts[1] + '-' + parts[0];
}
// Report (PDF) number formatting — same thousands separators as the UI.
// fmtReportNum keeps the sign of n and always shows 2 decimals (e.g. 100000
// -> "100,000.00", -5778.01 -> "-5,778.01"). fmtReportQty adds separators but
// trims trailing zeros for share counts (e.g. 1500 -> "1,500", 12.5 -> "12.5").
function fmtReportNum(n) { return Number(n || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtReportQty(n) { return Number(n || 0).toLocaleString('en-US',{maximumFractionDigits:4}); }
// Label for a sell event in a trade's history: "CLOSE" when it is the final
// sell that leaves the trade fully closed, otherwise "PARTIAL CLOSE".
function closeEventLabel(t, idx) {
  var pcs = (t && t.partial_closes) || [];
  var isLast = idx === pcs.length - 1;
  return (t && t.status === 'closed' && isLast) ? 'CLOSE' : 'PARTIAL CLOSE';
}
function pnlClass(n) { return n >= 0 ? 'pnl-pos' : 'pnl-neg'; }
function pnlColor(n) { return (n > 0.005) ? 'var(--green)' : (n < -0.005 ? 'var(--red)' : 'var(--text3)'); }
function fmtPnlCompact(n) {
  var sign = n >= 0 ? '+' : '-';
  var v = Math.abs(n);
  var s;
  if (v >= 1000000) s = (v/1000000).toFixed(v >= 10000000 ? 0 : 1).replace(/\.0$/,'') + 'M';
  else if (v >= 10000) s = (v/1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/,'') + 'k';
  else s = Math.round(v).toLocaleString('en-US');
  return sign + currSym() + s;
}
function plural(n, one, many) {
  return n + ' ' + (n === 1 ? one : many);
}

// ==========================================================================
