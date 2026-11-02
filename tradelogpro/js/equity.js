// Equity chart on the dashboard: broker-style (Baraka / Trading 212 pattern).
// Classic script, loaded after app.js. Draw with drawEquity(trades, accounts).
//
// - Big value on top; drag along the line and it shows that day's value, date and
//   change since the start of the range. Let go and it returns to today.
// - Balance = starting capital + deposits − withdrawals + realized P&L, each on
//   its own date. P&L = realized P&L only. Balance is offered once cash is tracked.
// - The change shown is always trading P&L, so a deposit never looks like a gain.
// - Ranges 1M 3M 6M YTD 1Y All; green when the range is up, red when down; a dashed
//   line marks where the range started. No grid or axes, as in broker apps.

var EQ_RANGES = [['1M', 'Past month'], ['3M', 'Past 3 months'], ['6M', 'Past 6 months'], ['YTD', 'Year to date'], ['1Y', 'Past year'], ['ALL', 'All time']];
var _eq = null; // { pts, canBal, range, mode, view, start }

function _eqPref(key, fallback, allowed) {
  var v = null;
  try { v = localStorage.getItem(key); } catch (e) {}
  return allowed.indexOf(v) >= 0 ? v : fallback;
}
function _eqSetPref(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }
function _eqDay(t) { var d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// One point per day that changed P&L or cash, plus a start point and today.
function equitySeries(trades, accounts) {
  var days = {};
  realizedEquityEvents(trades).forEach(function (e) {
    if (!e.d) return;
    (days[e.d] = days[e.d] || { pnl: 0, flow: 0 }).pnl += e.pnl;
  });
  var initial = 0;
  (accounts || []).forEach(function (a) {
    var net = 0, first = '';
    var seen = function (d) { if (d && (!first || d < first)) first = d; };
    (a.transactions || []).forEach(function (tx) {
      var amt = (tx.type === 'deposit' ? 1 : -1) * (parseFloat(tx.amount) || 0);
      net += amt;
      seen(tx.date);
      if (tx.date) (days[tx.date] = days[tx.date] || { pnl: 0, flow: 0 }).flow += amt;
    });
    // Capital before any recorded deposit joins the curve when the account starts
    // (its creation day, or its first trade or deposit if earlier, e.g. imported
    // history), not at the first day of every account together.
    var open = (parseFloat(a.startingCapital) || 0) - net;
    if (Math.abs(open) < 0.005) return;
    (trades || []).forEach(function (t) { if (t.accountId === a.id) seen(t.entry_date); });
    seen(a.createdAt ? String(a.createdAt).slice(0, 10) : '');
    if (first) (days[first] = days[first] || { pnl: 0, flow: 0 }).flow += open;
    else initial += open;
  });
  var keys = Object.keys(days).sort();
  if (!keys.length) return [];
  var pnl = 0, flow = 0, pts = [];
  var first = Date.parse(keys[0] + 'T12:00:00');
  pts.push({ t: first - 86400000, pnl: 0, bal: initial });
  keys.forEach(function (k) {
    pnl += days[k].pnl; flow += days[k].flow;
    pts.push({ t: Date.parse(k + 'T12:00:00'), pnl: pnl, bal: initial + flow + pnl });
  });
  var now = Date.parse(today() + 'T12:00:00'), last = pts[pts.length - 1];
  if (now > last.t) pts.push({ t: now, pnl: last.pnl, bal: last.bal });
  return pts;
}

function _eqCutoff(range, lastT) {
  var d = new Date(lastT);
  if (range === 'ALL') return -Infinity;
  if (range === 'YTD') return Date.parse(d.getFullYear() + '-01-01T00:00:00');
  var months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[range] || 0;
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}
// Points inside the range, starting with the value carried in at its first day.
function _eqView(pts, range) {
  var cut = _eqCutoff(range, pts[pts.length - 1].t);
  var before = null, inside = [];
  pts.forEach(function (p) { if (p.t <= cut) before = p; else inside.push(p); });
  if (before && cut > -Infinity) inside.unshift({ t: cut, pnl: before.pnl, bal: before.bal });
  if (inside.length === 1) inside.unshift({ t: inside[0].t - 86400000, pnl: inside[0].pnl, bal: inside[0].bal });
  return inside;
}

function equityPanelHtml(hasData) {
  if (!hasData) return '<div class="panel"><div class="panel-header"><div class="panel-title">Equity</div></div>' +
    '<div class="empty-state" style="padding:28px 12px"><p>Close a trade to start your curve</p></div></div>';
  var range = _eqPref('tl_eq_range', 'ALL', EQ_RANGES.map(function (r) { return r[0]; }));
  return '<div class="panel eq-panel">' +
    '<div class="eq-head">' +
      '<div class="eq-top"><span class="eq-label" id="eqLabel">Realized P&amp;L</span><div class="eq-mode" id="eqMode"></div></div>' +
      '<div class="eq-value n" id="eqValue">—</div>' +
      '<div class="eq-change n" id="eqChange"></div>' +
    '</div>' +
    '<div class="eq-chart"><canvas id="equityChart" aria-label="Equity chart. Drag to see a day."></canvas></div>' +
    '<div class="eq-ranges" role="tablist">' + EQ_RANGES.map(function (r) {
      return '<button type="button" role="tab" data-r="' + r[0] + '" class="' + (r[0] === range ? 'on' : '') + '" onclick="setEquityRange(\'' + r[0] + '\')">' + (r[0] === 'ALL' ? 'All' : r[0]) + '</button>';
    }).join('') + '</div>' +
    '<div class="eq-note" id="eqNote"></div>' +
  '</div>';
}

function drawEquity(trades, accounts) {
  var el = document.getElementById('equityChart');
  if (!el || typeof Chart === 'undefined') return;
  var pts = equitySeries(trades, accounts);
  if (pts.length < 2) return;
  var canBal = (accounts || []).some(accountTracksCash);
  _eq = { pts: pts, canBal: canBal,
    range: _eqPref('tl_eq_range', 'ALL', EQ_RANGES.map(function (r) { return r[0]; })),
    // The chart shows realized P&L only (owner's decision): the account balance is on
    // the Total Balance card, and a balance line looked the same apart from deposits.
    mode: 'pnl' };
  _eqRenderMode();
  _eqPaint();
}

function setEquityRange(r) {
  if (!_eq) return;
  _eq.range = r; _eqSetPref('tl_eq_range', r);
  document.querySelectorAll('.eq-ranges button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-r') === r); });
  if (typeof haptic === 'function') haptic('light');
  _eqPaint();
}
function setEquityMode(m) {
  if (!_eq) return;
  _eq.mode = m; _eqSetPref('tl_eq_mode', m);
  _eqRenderMode();
  _eqPaint();
}
function _eqRenderMode() {
  var box = document.getElementById('eqMode');
  var lbl = document.getElementById('eqLabel');
  if (lbl) lbl.textContent = _eq.mode === 'bal' ? 'Balance' : 'Realized P&L';
  if (!box) return;
  box.innerHTML = ''; // no Balance / P&L switch: the chart is P&L only
}
// Realized P&L made inside the selected range, up to p: the line starts at 0 on the
// range's first day, so for YTD the chart and the big number read "this year".
function _eqY(p) { return p.pnl - (_eq.view && _eq.range !== 'ALL' ? _eq.view[0].pnl : 0); }
function _eqColor(name) { return getComputedStyle(document.body).getPropertyValue(name).trim() || (name === '--red' ? '#e5484d' : '#00b37a'); }

// Header for point p (null = latest): value, change since the range start, when.
function _eqHeader(p) {
  var v = _eq.view, start = v[0], end = p || v[v.length - 1];
  var val = document.getElementById('eqValue'), ch = document.getElementById('eqChange');
  if (!val || !ch) return;
  var diff = end.pnl - start.pnl; // trading result only, never deposits
  // Big number = P&L of the selected period (to the touched day); the all-time
  // cumulative total is written next to it, so the two are never confused.
  val.textContent = fmtPnl(diff);
  // Return on the money at work: balance at the range start plus what was deposited
  // (net) during the range, so All time reads as return on your deposits.
  var flowIn = (end.bal - end.pnl) - (start.bal - start.pnl);
  var base = _eq.canBal ? start.bal + Math.max(flowIn, 0) : 0;
  var pct = base > 0 ? ' (' + fmtPct(diff / base * 100) + ')' : '';
  var when = p ? fmtDateLong(_eqDay(p.t)) : EQ_RANGES.filter(function (r) { return r[0] === _eq.range; })[0][1];
  var allTime = _eq.range !== 'ALL' ? ' · All time ' + fmtPnl(end.pnl) : '';
  ch.innerHTML = (pct ? '<span style="color:' + pnlColor(diff) + '">' + (diff > 0.005 ? '▲ ' : (diff < -0.005 ? '▼ ' : '')) + pct.replace(/[()]/g, '').trim() + '</span>' : '') +
    '<span class="eq-when">' + esc(when) + esc(allTime) + '</span>';
  var note = document.getElementById('eqNote');
  if (note) note.textContent = '';
}

function _eqPaint() {
  var el = document.getElementById('equityChart');
  if (!el) return;
  _eq.view = _eqView(_eq.pts, _eq.range);
  // Balance starts at the first money in; a run of zeros before it only squashes the line.
  if (_eq.mode === 'bal') while (_eq.view.length > 2 && _eq.view[0].bal <= 0.005 && _eq.view[1].bal > 0.005) _eq.view.shift();
  var v = _eq.view, up = v[v.length - 1].pnl - v[0].pnl >= -0.005;
  var col = _eqColor(up ? '--green' : '--red');
  _eqHeader(null);
  if (equityChart) { equityChart.destroy(); equityChart = null; }
  var ctx = el.getContext('2d');
  var fill = function (c) {
    var a = c.chart.chartArea;
    if (!a) return 'transparent';
    var g = ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, col + '38'); g.addColorStop(1, col + '00');
    return g;
  };
  equityChart = new Chart(el, {
    type: 'line',
    data: { datasets: [{ data: v.map(function (p) { return { x: p.t, y: _eqY(p) }; }), borderColor: col, borderWidth: 2.2,
      backgroundColor: fill, fill: true, tension: 0.25, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      layout: { padding: { top: 26, bottom: 4, left: 2, right: 2 } },
      interaction: { mode: 'index', intersect: false, axis: 'x' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { type: 'linear', display: false, min: v[0].t, max: v[v.length - 1].t }, y: { display: false, grace: '6%' } },
      onHover: function (e, els) {
        var i = els && els.length ? els[0].index : -1;
        if (i === _eqActive) return;
        _eqActive = i;
        _eqHeader(i >= 0 ? _eq.view[i] : null);
      }
    },
    plugins: [_eqCrossPlugin(col)]
  });
  el.style.touchAction = 'pan-y';
  if (!el._eqBound) {
    el._eqBound = true;
    ['mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) {
      el.addEventListener(ev, function () {
        _eqActive = -1;
        if (equityChart) { equityChart.setActiveElements([]); equityChart.draw(); }
        if (_eq) _eqHeader(null);
      }, { passive: true });
    });
  }
}
var _eqActive = -1;

// Dashed start line, plus the crosshair, dot and date pill while dragging.
function _eqCrossPlugin(col) {
  return {
    id: 'eqCross',
    afterDatasetsDraw: function (chart) {
      var c = chart.ctx, a = chart.chartArea, ys = chart.scales.y, ds = chart.getDatasetMeta(0);
      if (!a || !ds.data.length) return;
      var y0 = ys.getPixelForValue(chart.data.datasets[0].data[0].y);
      c.save();
      c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = _eqColor('--text3') || '#8a93ad';
      c.globalAlpha = .55; c.beginPath(); c.moveTo(a.left, y0); c.lineTo(a.right, y0); c.stroke();
      c.restore();
      if (_eqActive < 0 || !ds.data[_eqActive]) return;
      var pt = ds.data[_eqActive], x = pt.x, y = pt.y;
      c.save();
      c.strokeStyle = _eqColor('--text3') || '#8a93ad'; c.lineWidth = 1; c.globalAlpha = .7;
      c.beginPath(); c.moveTo(x, a.top - 6); c.lineTo(x, a.bottom); c.stroke();
      c.globalAlpha = 1; c.fillStyle = col; c.strokeStyle = _eqColor('--surface') || '#fff'; c.lineWidth = 2.5;
      c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      var label = fmtDateLong(_eqDay(_eq.view[_eqActive].t));
      c.font = '600 ' + chartFontSize(11) + 'px Roboto, sans-serif';
      var w = c.measureText(label).width + 14, h = 20;
      var lx = Math.min(Math.max(x - w / 2, a.left), a.right - w), ly = a.top - 26;
      c.fillStyle = _eqColor('--surface2') || '#eef2f8';
      c.beginPath(); if (c.roundRect) c.roundRect(lx, ly, w, h, 6); else c.rect(lx, ly, w, h); c.fill();
      c.fillStyle = _eqColor('--text') || '#111'; c.textBaseline = 'middle';
      c.fillText(label, lx + 7, ly + h / 2 + .5);
      c.restore();
    }
  };
}
