// ==========================================================================
// NAVIGATION + FILTER
// ==========================================================================
function setView(view, accountId) {
  if (accountId) { state.activeAccountId = accountId; save(); }
  if (view !== 'trades') { window._tradeFilter = 'all'; window._tradeSearch = ''; }
  if (view === 'calendar') { tradeLayout = 'calendar'; view = 'trades'; }
  currentView = view;
  var titles = {dashboard:'Dashboard',trades:'Trade Log',calendar:'Calendar',calculators:'Calculators',analytics:'Analytics',accounts:'Accounts',journal:'Daily Journal',more:'More',formulas:'Formulas & Definitions',import:'Import from screenshot','import-review':'Review import'};
  var titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = titles[view] || '';
  document.querySelectorAll('.nav-item').forEach(function(el){ el.classList.remove('active'); });
  var navKey = view === 'more' ? 'accounts' : view;
  var ni = document.getElementById('nav-' + navKey); if (ni) ni.classList.add('active');
  document.querySelectorAll('.bottom-nav-item').forEach(function(el){ el.classList.remove('active'); });
  var bnavKey = MORE_VIEWS[view] ? 'more' : (view === 'more' ? 'more' : view);
  var bi = document.getElementById('bnav-' + bnavKey); if (bi) bi.classList.add('active');
  var back = document.getElementById('topBackBtn');
  if (back) back.classList.toggle('show', !!MORE_VIEWS[view]);
  var logBtn = document.getElementById('topLogBtn');
  if (logBtn) logBtn.style.display = (view === 'more' || MORE_VIEWS[view]) ? 'none' : '';
  document.body.classList.toggle('no-bnav', view === 'import' || view === 'import-review');
  renderSidebar(); renderMain(); renderFilterBar();
}

function goBackFromMore() {
  setView('more');
}

function renderFilterBar() {
  var badge = document.getElementById('topbarAccountBadge');
  if (!badge) return;
  if (currentView === 'dashboard' || currentView === 'trades' || currentView === 'calendar') {
    if (!state.accounts.length) { badge.innerHTML = ''; return; }
    var allSel = filterAccountId === 'all' ? ' selected' : '';
    var opts = '<option value="all"' + allSel + '>All Accounts</option>';
    state.accounts.forEach(function(a) {
      opts += '<option value="' + esc(a.id) + '"' + (filterAccountId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>';
    });
    badge.innerHTML = '<select class="filter-select" onchange="setAccountFilter(this.value)">' + opts + '</select>';
  } else if (currentView === 'accounts') {
    badge.innerHTML = '<button class="btn btn-primary btn-sm keep-mobile" onclick="openNewAccountModal()">+ New</button>';
  } else {
    badge.innerHTML = '';
  }
}

function setCurrentPrice(tradeId, price) {
  var t = state.trades.find(function(x){ return x.id === tradeId; });
  if (!t) return;
  var p = parseFloat(price);
  if (!p || p <= 0) { t.current_price = null; }
  else { t.current_price = p; }
  save();
  // Update P&L in-place without full page re-render (no flash)
  var pnl = calcPnl(t);
  var invested = calcInvestedValue(t);
  var pnlPct = invested > 0 ? (pnl / invested * 100) : 0;
  // Find the row and update just the P&L cell (3rd td, index 2)
  var rows = document.querySelectorAll('.trade-table tbody tr');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].onclick && rows[i].onclick.toString().indexOf(tradeId) >= 0) {
      var cells = rows[i].querySelectorAll('td');
      if (cells[2]) {
        if (t.current_price) {
          cells[2].innerHTML = '<span class="mono ' + pnlClass(pnl) + '">' + fmtPnl(pnl) + '</span>' +
            '<br><span style="font-size:calc(11px*var(--fz));font-family:var(--mono);color:' + pnlColor(pnl) + ';opacity:0.8">' + fmtPct(pnlPct) + '</span>' +
            '<br><span style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono)">@ ' + fmtPrice(t.current_price) +
            ' <span onclick="event.stopPropagation();clearCurrentPrice(&apos;' + eid(tradeId) + '&apos;)" style="cursor:pointer;color:var(--red)">&#x2715;</span></span>';
        } else {
          cells[2].innerHTML = '<div onclick="event.stopPropagation()">' +
            '<input type="number" placeholder="Price…" step="0.01"' +
            ' style="width:90px;background:var(--surface2);border:1px solid var(--blue);border-radius:8px;color:var(--text);padding:6px 8px;font-size:calc(12px*var(--fz));font-family:var(--mono)"' +
            ' onchange="setCurrentPrice(&apos;' + eid(tradeId) + '&apos;,this.value)">' +
            '</div>';
        }
      }
      break;
    }
  }
}

function clearCurrentPrice(tradeId) {
  var t = state.trades.find(function(x){ return x.id === tradeId; });
  if (!t) return;
  t.current_price = null;
  save();
  // Update cell in-place - no full page re-render
  var rows = document.querySelectorAll('.trade-table tbody tr');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (row.getAttribute('onclick') && row.getAttribute('onclick').indexOf(tradeId) >= 0) {
      var cells = row.querySelectorAll('td');
      if (cells[2]) {
        cells[2].innerHTML = '<div onclick="event.stopPropagation()">' +
          '<input type="number" placeholder="Price…" step="0.01"' +
          ' style="width:90px;background:var(--surface2);border:1px solid var(--blue);border-radius:8px;color:var(--text);padding:6px 8px;font-size:calc(12px*var(--fz));font-family:var(--mono)"' +
          ' onchange="setCurrentPrice(&apos;' + eid(tradeId) + '&apos;,this.value)">' +
          '</div>';
      }
      break;
    }
  }
}

function getAccountScopedTrades() {
  if (filterAccountId === 'all') return state.trades.slice();
  var acc = state.accounts.find(function(a){ return a.id === filterAccountId; }) || getActiveAccount();
  return acc ? getAccountTrades(acc.id).slice() : [];
}

function getVisibleTrades() {
  var trades = getAccountScopedTrades();
  var filterVal = window._tradeFilter || 'all';
  var searchVal = window._tradeSearch || '';
  var sortOrder = window._tradeSort || 'date_desc';
  if (filterVal === 'wins') trades = trades.filter(function(t){ return t.status === 'closed' && isWin(t); });
  else if (filterVal === 'losses') trades = trades.filter(function(t){ return t.status === 'closed' && isLoss(t); });
  else if (filterVal === 'open') trades = trades.filter(function(t){ return t.status === 'open'; });
  else if (filterVal === 'closed') trades = trades.filter(function(t){ return t.status === 'closed'; });
  if (searchVal) {
    var q = searchVal.toUpperCase();
    trades = trades.filter(function(t){ return String(t.ticker || '').toUpperCase().indexOf(q) >= 0; });
  }
  trades.sort(function(a, b) {
    if (sortOrder === 'date_desc') return String(b.entry_date || '').localeCompare(String(a.entry_date || ''));
    if (sortOrder === 'date_asc')  return String(a.entry_date || '').localeCompare(String(b.entry_date || ''));
    if (sortOrder === 'pnl_desc')  return calcPnl(b) - calcPnl(a);
    if (sortOrder === 'pnl_asc')   return calcPnl(a) - calcPnl(b);
    if (sortOrder === 'symbol')    return String(a.ticker || '').localeCompare(String(b.ticker || ''));
    return String(b.entry_date || '').localeCompare(String(a.entry_date || ''));
  });
  return trades;
}

function emptyTradesHtml(filterVal, searchVal) {
  if (searchVal) {
    return '<div class="empty-state"><div class="empty-icon" style="color:var(--text3)">' + cicon('search',40,'currentColor') + '</div><h3>No results for "' + esc(searchVal) + '"</h3><p>Try a different symbol</p></div>';
  }
  return '<div class="empty-state"><div class="empty-icon" style="color:var(--text3)">' + cicon('clipboard',40,'currentColor') + '</div><h3>' + (filterVal === 'all' ? 'No trades yet' : 'No ' + filterVal + ' trades') + '</h3>' +
    (filterVal === 'all' ? '<p>Tap + Log to get started</p>' : '<p>Try a different filter</p>') + '</div>';
}

function setTradeSort(val) {
  window._tradeSort = val;
  window._tradeFilter = window._tradeFilter || 'all';
  if (currentView === 'trades') {
    var twrap = document.getElementById('tradeTableWrap');
    if (twrap) {
      var displayed = getVisibleTrades();
      twrap.innerHTML = displayed.length ? renderTradesTable(displayed) : emptyTradesHtml(window._tradeFilter || 'all', window._tradeSearch || '');
      return;
    }
    var mc = document.getElementById('mainContent');
    if (mc) mc.innerHTML = renderTradeLog();
    return;
  }
  renderMain();
}

function setTradeSearch(val) {
  window._tradeSearch = val || '';
  var displayed = getVisibleTrades();
  var twrap = document.getElementById('tradeTableWrap');
  if (twrap) {
    twrap.innerHTML = displayed.length
      ? renderTradesTable(displayed)
      : emptyTradesHtml(window._tradeFilter || 'all', window._tradeSearch || '');
  }
}
function clearTradeSearch() {
  window._tradeSearch = '';
  var inp = document.getElementById('tradeSearchInput');
  if (inp) inp.value = '';
  setTradeSearch('');
  var mc = document.getElementById('mainContent');
  if (mc && currentView === 'trades') mc.innerHTML = renderTradeLog();
}

function setTradeFilter(val) {
  window._tradeFilter = val;
  var filterVal = val;
  var displayed = getVisibleTrades();
  // Update chips in-place (no full re-render)
  var chipsEl = document.getElementById('tradeFilterChips');
  if (chipsEl) {
    var segItems3 = [{val:'all',label:'All',col:'var(--blue)'},{val:'wins',label:cicon('check',12,'var(--green)')+' Wins',col:'var(--green)'},{val:'losses',label:cicon('cross',12,'var(--red)')+' Losses',col:'var(--red)'},{val:'open',label:'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold);margin-left:2px"></span> Open',col:'var(--gold)'},{val:'closed',label:'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-left:2px"></span> Closed',col:'var(--blue)'}];
    var segInner = segItems3.map(function(c){
      var isActive = filterVal === c.val;
      var btnStyle = 'flex:1;padding:8px 4px;border:none;border-radius:8px;font-size:calc(12px*var(--fz));font-weight:' + (isActive?'700':'500') + ';cursor:pointer;font-family:var(--sans);transition:all .15s;white-space:nowrap;' +
        (isActive ? 'background:var(--surface3);color:' + c.col + ';box-shadow:0 1px 4px rgba(0,0,0,.3);' : 'background:transparent;color:var(--text3);');
      return '<button style="' + btnStyle + '" onclick="setTradeFilter(&apos;' + c.val + '&apos;)">' + c.label + '</button>';
    }).join('');
    chipsEl.innerHTML = '<div style="display:flex;background:var(--surface2);border:1px solid var(--border2);border-radius:12px;padding:3px;gap:2px">' + segInner + '</div>';
  }
  // Update summary bar in-place
  var summaryEl = document.getElementById('tradeFilterSummary');
  if (summaryEl) {
    if (filterVal !== 'all' && displayed.length > 0) {
      var sPnl = displayed.reduce(function(s,t){ return s+calcPnl(t); },0);
      var sInv = displayed.reduce(function(s,t){ return s+calcInvestedValue(t); },0);
      var sAvg = sPnl / displayed.length;
      var sRoi = sInv > 0 ? (sPnl/sInv*100) : 0;
      var sCol = sPnl >= 0 ? 'var(--green)' : 'var(--red)';
      summaryEl.innerHTML =
        '<div style="padding:0 14px 10px">' +
          '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:8px;border-left:3px solid ' + sCol + '">' +
            '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text3)">' + displayed.length + ' trade' + (displayed.length!==1?'s':'') + '</span>' +
            '<span style="font-family:var(--mono);font-size:calc(14px*var(--fz));font-weight:700;color:' + sCol + '">Total: ' + fmtPnl(sPnl) + '</span>' +
            '<span style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text2)">Avg: ' + fmtPnl(sAvg) + '</span>' +
            '<span style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text2)">ROI: ' + fmtPct(sRoi) + '</span>' +
          '</div>' +
        '</div>';
    } else {
      summaryEl.innerHTML = '';
    }
  }
  // Update table in-place
  var twrap = document.getElementById('tradeTableWrap');
  if (twrap) {
    twrap.innerHTML = displayed.length
      ? renderTradesTable(displayed)
      : emptyTradesHtml(filterVal, window._tradeSearch || '');
  }
}

function renderTradeLogContent() {
  var filterVal = window._tradeFilter || 'all';
  var filtered = getVisibleTrades();
  // Update filter chips
  var chips = document.getElementById('tradeFilterChips');
  if (chips) {
    var chipDefs = [
      {val:'all',    label:'All',     color:''},
      {val:'wins',   label:cicon('check',12,'var(--green)')+' Wins',   color:'var(--green)'},
      {val:'losses', label:cicon('cross',12,'var(--red)')+' Losses', color:'var(--red)'},
      {val:'open',   label:'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold);margin-left:2px"></span> Open',   color:'var(--gold)'},
      {val:'closed', label:'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-left:2px"></span> Closed', color:'var(--blue)'}
    ];
    chips.innerHTML = chipDefs.map(function(c){
      var active = filterVal === c.val;
      var style = 'display:inline-flex;align-items:center;padding:5px 12px;border-radius:16px;font-size:calc(13px*var(--fz));cursor:pointer;border:1.5px solid;transition:all .15s;font-family:var(--sans);font-weight:' + (active?'700':'500') + ';' +
        (active
          ? 'background:' + (c.color||'var(--blue)') + ';color:#fff;border-color:' + (c.color||'var(--blue)') + ';'
          : 'background:var(--surface2);color:var(--text2);border-color:var(--border2);');
      return '<button style="' + style + '" onclick="setTradeFilter(&apos;' + c.val + '&apos;)">' + c.label + '</button>';
    }).join('');
  }
  // Update summary bar
  var bar = document.getElementById('tradeFilterSummary');
  if (bar) {
    if (filterVal !== 'all' && filtered.length > 0) {
      var totalPnl = filtered.reduce(function(s,t){ return s+calcPnl(t); },0);
      var totalInv = filtered.reduce(function(s,t){ return s+calcInvestedValue(t); },0);
      var avgPnl   = totalPnl / filtered.length;
      var roi      = totalInv > 0 ? (totalPnl/totalInv*100) : 0;
      var col      = totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
      bar.style.display = '';
      bar.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:8px;border-left:3px solid ' + col + '">' +
          '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text3)">' + filtered.length + ' trade' + (filtered.length!==1?'s':'') + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(13px*var(--fz));font-weight:700;color:' + col + '">Total: ' + fmtPnl(totalPnl) + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text2)">Avg: ' + fmtPnl(avgPnl) + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text2)">ROI: ' + fmtPct(roi) + '</span>' +
        '</div>';
    } else {
      bar.style.display = 'none';
      bar.innerHTML = '';
    }
  }
  // Update table
  var twrap = document.getElementById('tradeTableWrap');
  if (twrap) {
    twrap.innerHTML = filtered.length
      ? renderTradesTable(filtered)
      : emptyTradesHtml(filterVal, window._tradeSearch || '');
  }
}

function setAccountFilter(val) {
  filterAccountId = val;
  renderSidebar();
  if (currentView === 'trades') {
    // Update only the header chips and table - no full page rebuild
    var hdr = document.getElementById('tradeLogHeader');
    var twrap = document.getElementById('tradeTableWrap');
    if (hdr && twrap) {
      var trades2 = getAccountScopedTrades();
      var logTitle2 = 'All Accounts';
      if (filterAccountId !== 'all') {
        var acc2 = state.accounts.find(function(a){ return a.id === filterAccountId; });
        logTitle2 = acc2 ? esc(acc2.name) : 'Account';
      }
      var displayed2 = getVisibleTrades();
      var openCount2  = trades2.filter(function(t){ return t.status==='open'||t.status==='partial'; }).length;
      var closedCount2= trades2.filter(function(t){ return t.status==='closed'; }).length;
      // Update header chips only
      var chipsHtml = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<span style="font-weight:700;font-size:calc(14px*var(--fz));display:inline-flex;align-items:center;gap:6px">' + cicon('clipboard',15,'var(--gold)') + ' ' + logTitle2 + '</span>' +
        '<span class="chip" style="font-size:calc(13px*var(--fz));padding:4px 12px">' + trades2.length + ' total</span>' +
        '<span class="chip" style="font-size:calc(13px*var(--fz));padding:4px 12px;color:var(--gold)">' + openCount2 + ' open</span>' +
        '<span class="chip" style="font-size:calc(13px*var(--fz));padding:4px 12px;color:var(--green)">' + closedCount2 + ' closed</span>' +
        '</div>';
      var firstChild = hdr.firstElementChild;
      if (firstChild) firstChild.innerHTML = chipsHtml.replace(/^<div[^>]*>|<\/div>$/g,'');
      else hdr.innerHTML = chipsHtml;
      // Update table only
      twrap.innerHTML = displayed2.length ? renderTradesTable(displayed2) : emptyTradesHtml(window._tradeFilter || 'all', window._tradeSearch || '');
      return;
    }
    // Fallback if IDs not found
    var mc0 = document.getElementById('mainContent');
    if (mc0) mc0.innerHTML = renderTradeLog();
  } else if (currentView === 'dashboard') {
    var dashEl = document.getElementById('dashContent');
    if (dashEl) {
      // Re-render into temp div, extract dashContent inner HTML
      var tmpDiv = document.createElement('div');
      tmpDiv.innerHTML = renderDashboard();
      var newDash = tmpDiv.querySelector('#dashContent');
      if (newDash) { dashEl.innerHTML = newDash.innerHTML; }
      else { dashEl.innerHTML = tmpDiv.innerHTML; }
      setTimeout(buildCharts, 50);
    } else {
      var mc = document.getElementById('mainContent');
      if (mc) { mc.innerHTML = renderDashboard(); setTimeout(buildCharts, 50); }
    }
  } else if (currentView === 'calendar') {
    // Update only the calendar grid cells
    var calGridEl = document.getElementById('calGrid');
    if (calGridEl) {
      var newCal = renderCalendar();
      var tmp = document.createElement('div');
      tmp.innerHTML = newCal;
      var newGrid = tmp.querySelector('#calGrid');
      if (newGrid) { calGridEl.innerHTML = newGrid.innerHTML; }
      else {
        var mc = document.getElementById('mainContent');
        if (mc) mc.innerHTML = newCal;
      }
    } else {
      var mc = document.getElementById('mainContent');
      if (mc) mc.innerHTML = renderCalendar();
    }
  }
}


// ==========================================================================
// STOCK AVERAGE CALCULATOR
// ==========================================================================
var _avgRows = [{price:'', qty:''}, {price:'', qty:''}];
function padAvgRows() {
  while (_avgRows.length < 2) _avgRows.push({price:'', qty:''});
}

function renderAvgCalc() {
  var rowsHtml = _avgRows.map(function(r, i) {
    return '<div class="prow">' +
      '<div>' + (i === 0 ? '<div class="fl">Price</div>' : '') +
        '<input class="inp" type="text" inputmode="decimal" placeholder="0.00" value="' + esc(groupNum(r.price||'')) + '" aria-label="Price ' + (i+1) + '"' +
        ' oninput="fmtNumInput(this);updateAvgRow(' + i + ',&apos;price&apos;,this.value);calcStockAvg()">' +
      '</div>' +
      '<div>' + (i === 0 ? '<div class="fl">Shares</div>' : '') +
        '<input class="inp" type="text" inputmode="decimal" placeholder="0" value="' + esc(groupNum(r.qty||'')) + '" aria-label="Shares ' + (i+1) + '"' +
        ' oninput="fmtNumInput(this);updateAvgRow(' + i + ',&apos;qty&apos;,this.value);calcStockAvg()">' +
      '</div>' +
      '<button class="xb" onclick="removeAvgRow(' + i + ')" aria-label="Remove purchase ' + (i+1) + '">' + icon('close',16) + '</button>' +
    '</div>';
  }).join('');
  return '<div style="padding:4px 0;display:flex;flex-direction:column;gap:8px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<span class="cap">Purchases</span>' +
      '<button class="pill-btn" onclick="fillAvgFromOpenTrade()">' + icon('clipboard',14) + 'From open trade</button>' +
    '</div>' +
    '<div id="avgFromTradePick"></div>' +
    rowsHtml +
    '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px">' +
      '<button onclick="addAvgRow()" style="height:44px;border-radius:10px;border:1px dashed var(--border2);background:transparent;color:var(--blue);font:600 calc(14px*var(--fz)) var(--sans)">+ Add purchase</button>' +
      '<button class="btn btn-secondary" style="height:44px;border-radius:10px" onclick="saveAvgCalc()">Save</button>' +
    '</div>' +
    '<div id="avg_result" style="display:flex;flex-direction:column;gap:12px;margin-top:6px">' + avgEmptyHtml() + '</div>' +
    '<div id="avgSavedList"></div>' +
  '</div>';
}

function avgEmptyHtml() {
  return '<div class="avg-card" style="color:var(--text3);font-size:calc(14px*var(--fz));text-align:center">Enter at least one price and shares</div>';
}

function updateAvgRow(i, field, val) {
  if (_avgRows[i]) _avgRows[i][field] = numStr(val);
}

function addAvgRow() {
  _avgRows.push({price:'', qty:''});
  var d = document.getElementById('calc_avg');
  if (d) d.innerHTML = renderAvgCalc();
  calcStockAvg();
}

function removeAvgRow(i) {
  _avgRows.splice(i, 1);
  padAvgRows();
  var d = document.getElementById('calc_avg');
  if (d) d.innerHTML = renderAvgCalc();
  calcStockAvg();
}

function fillAvgFromOpenTrade() {
  var open = (typeof getAccountScopedTrades === 'function' ? getAccountScopedTrades() : state.trades).filter(function(t){ return t.status === 'open'; });
  var pick = document.getElementById('avgFromTradePick');
  if (!open.length) { showToast('No open trades', 'info'); if (pick) pick.innerHTML = ''; return; }
  if (open.length === 1) { applyOpenTradeToAvg(open[0]); return; }
  if (pick) {
    pick.innerHTML = '<select class="inp" onchange="if(this.value)applyOpenTradeToAvgById(this.value)"><option value="">Select trade</option>' +
      open.map(function(t){ return '<option value="' + esc(t.id) + '">' + esc(t.ticker) + '</option>'; }).join('') + '</select>';
  }
}
function applyOpenTradeToAvgById(id) {
  var t = state.trades.find(function(x){ return x.id === id; });
  if (t) applyOpenTradeToAvg(t);
}
function applyOpenTradeToAvg(t) {
  _avgRows = [{ price: t.entry || '', qty: t.original_qty || t.qty || '' }];
  (t.add_buys || []).forEach(function(b){ _avgRows.push({ price: b.price || '', qty: b.qty || '' }); });
  padAvgRows();
  var d = document.getElementById('calc_avg');
  if (d) d.innerHTML = renderAvgCalc();
  calcStockAvg();
}

function calcStockAvg() {
  var res = document.getElementById('avg_result');
  if (!res) return;
  var sellEl = document.getElementById('avg_sell_price');
  var savedSell = sellEl ? sellEl.value : '';
  var valid = _avgRows.filter(function(r){ return parseFloat(r.price) > 0 && parseFloat(r.qty) > 0; });
  if (!valid.length) {
    res.innerHTML = avgEmptyHtml();
    return;
  }
  var totalCost   = valid.reduce(function(s,r){ return s + parseFloat(r.price)*parseFloat(r.qty); }, 0);
  var totalShares = valid.reduce(function(s,r){ return s + parseFloat(r.qty); }, 0);
  var avgPrice    = totalCost / totalShares;
  res.innerHTML =
    '<section class="avg-card">' +
      '<div><div class="cap">Average price</div><div class="avg-big n">' + fmtPrice(avgPrice) + '</div></div>' +
      '<div class="avg-sub">' +
        '<div><div class="k">Shares</div><div class="v n">' + fmtQty(totalShares) + '</div></div>' +
        '<div><div class="k">Invested</div><div class="v n">' + fmtMoney(totalCost) + '</div></div>' +
        '<div><div class="k">Buys</div><div class="v n">' + valid.length + '</div></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div class="hint">' + cicon('bulb',16,'var(--gold)') + '<span>Sell above <b class="n pos">' + fmtPrice(avgPrice) + '</b> to profit</span></div>' +
        '<div class="hint">' + cicon('trendDown',16,'var(--green)') + '<span>Buy below <b class="n pos">' + fmtPrice(avgPrice) + '</b> to lower your average</span></div>' +
      '</div>' +
    '</section>' +
    '<section class="avg-card" style="gap:10px;padding:14px 16px" aria-label="Sell calculator">' +
      '<div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center"><label for="avg_sell_price" style="font-size:calc(14px*var(--fz));color:var(--text2)">If I sell at</label>' +
        '<input id="avg_sell_price" class="inp" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" oninput="fmtNumInput(this);calcAvgSell(' + totalShares + ',' + avgPrice + ',' + totalCost + ')"></div>' +
      '<div id="avg_sell_result"></div>' +
    '</section>';
  var sellEl2 = document.getElementById('avg_sell_price');
  if (sellEl2 && savedSell) {
    sellEl2.value = savedSell;
    calcAvgSell(totalShares, avgPrice, totalCost);
  }
}

function calcAvgSell(totalShares, avgPrice, totalCost) {
  var sellPrice = numVal(document.getElementById('avg_sell_price').value) || 0;
  var res = document.getElementById('avg_sell_result');
  if (!res) return;
  if (!sellPrice || sellPrice <= 0) { res.innerHTML = ''; return; }
  var revenue   = sellPrice * totalShares;
  var pnl       = revenue - totalCost;
  var pnlPct    = totalCost > 0 ? (pnl / totalCost * 100) : 0;
  var isProfit  = pnl >= 0;
  var col       = isProfit ? 'var(--green)' : 'var(--red)';
  var sign      = isProfit ? '+' : '';
  res.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">' +
      '<span style="font-size:calc(13px*var(--fz));color:var(--text3)">Net P&amp;L on all shares</span>' +
      '<span class="n pnl-split" style="font-size:calc(18px*var(--fz));font-weight:700;color:' + col + '"><span>' + fmtPnl(pnl) + '</span><span>' + fmtPct(pnlPct) + '</span></span>' +
    '</div>';
}

function saveAvgCalc() {
  var valid = _avgRows.filter(function(r){ return parseFloat(r.price) > 0 && parseFloat(r.qty) > 0; });
  if (!valid.length) { showToast('Enter at least one row first', 'error'); return; }
  promptSheet('Name this calculation', 'e.g. AAPL DCA', '', function(name) {
    if (!name || !name.trim()) return;
    var entry = {
      id: Date.now().toString(),
      name: name.trim(),
      date: localDateStr(new Date()),
      rows: JSON.parse(JSON.stringify(_avgRows))
    };
    var arr = getSavedCalcs('tl_avg_calcs');
    arr.unshift(entry);
    if (arr.length > 20) arr = arr.slice(0, 20);
    setSavedCalcs('tl_avg_calcs', arr);
    renderAvgSaved();
    showToast('Saved: ' + name.trim(), 'success');
  });
}

function renderAvgSaved() {
  var el = document.getElementById('avgSavedList');
  if (!el) return;
  var arr = getSavedCalcs('tl_avg_calcs');
  if (!arr.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Saved Calculations</div>' +
    arr.map(function(e) {
      var rowCount = (e.rows || []).filter(function(r){ return parseFloat(r.price) > 0 && parseFloat(r.qty) > 0; }).length;
      return '<div class="saved-calc-row">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:calc(13px*var(--fz));font-weight:600">' + esc(e.name) + '</div>' +
          '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono)">' + e.date + ' &middot; ' + rowCount + ' purchase' + (rowCount !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="icon-btn" onclick="loadAvgCalc(\'' + eid(e.id) + '\')">' + icon('folder',15) + '</button>' +
          '<button class="icon-btn del" onclick="deleteAvgCalc(\'' + eid(e.id) + '\')">' + icon('trash',15) + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
}

function loadAvgCalc(id) {
  var arr = getSavedCalcs('tl_avg_calcs');
  var e = arr.find(function(x){ return x.id === id; });
  if (!e || !e.rows) return;
  _avgRows = JSON.parse(JSON.stringify(e.rows));
  padAvgRows();
  var d = document.getElementById('calc_avg');
  if (d) d.innerHTML = renderAvgCalc();
  calcStockAvg();
  renderAvgSaved();
  showToast('Loaded: ' + e.name, 'success');
}

function deleteAvgCalc(id) {
  confirmSheet({ title: 'Delete this calculation?', ok: 'Delete', danger: true }, function() { _deleteAvgCalc(id); });
}
function _deleteAvgCalc(id) {
  var list = getSavedCalcs('tl_avg_calcs');
  var idx = list.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var snap = list[idx];
  setSavedCalcs('tl_avg_calcs', list.filter(function(x){ return x.id !== id; }));
  renderAvgSaved();
  haptic('warning');
  showUndoToast('Calculation deleted', function() {
    var cur = getSavedCalcs('tl_avg_calcs');
    cur.splice(idx, 0, snap);
    setSavedCalcs('tl_avg_calcs', cur);
    renderAvgSaved();
  });
}

// ==========================================================================
// SIDEBAR
// ==========================================================================
function renderSidebar() {
  var el = document.getElementById('sidebarAccounts');
  if (!el) return;
  el.innerHTML = state.accounts.map(function(acc, i){
    var trades = getAccountTrades(acc.id);
    var pnl = trades.reduce(function(s,t){ return s + calcRealizedTotal(t); }, 0);
    var col = COLORS[i % COLORS.length];
    var active = acc.id === state.activeAccountId;
    return '<div class="account-item ' + (active ? 'active' : '') + '" onclick="setView(\'dashboard\',\'' + eid(acc.id) + '\')">' +
      '<div class="account-avatar" style="background:' + col + '20;color:' + col + '">' + esc(acc.name[0].toUpperCase()) + '</div>' +
      '<div class="account-info">' +
        '<div class="account-name" style="color:' + (active ? col : '') + '">' + esc(acc.name) + '</div>' +
        '<div class="account-pnl" style="color:' + pnlColor(pnl) + '">' + fmtPnl(pnl) + '</div>' +
      '</div></div>';
  }).join('');
}

// ==========================================================================
// MAIN RENDER
// ==========================================================================
function renderMain() {
  var mc = document.getElementById('mainContent');
  if (!mc) return;
  if (currentView === 'dashboard')   { mc.innerHTML = renderDashboard(); setTimeout(buildCharts, 50); }
  else if (currentView === 'trades')      mc.innerHTML = renderTradeLog();
  else if (currentView === 'calendar')    mc.innerHTML = renderCalendar();
  else if (currentView === 'calculators') mc.innerHTML = renderCalculators();
  else if (currentView === 'analytics')   { mc.innerHTML = renderAnalytics(); setTimeout(buildAnalyticsCharts, 50); }
  else if (currentView === 'accounts')    mc.innerHTML = renderAccountsView();
  else if (currentView === 'journal')     mc.innerHTML = renderJournal();
  else if (currentView === 'more')        mc.innerHTML = renderMore();
  else if (currentView === 'formulas')    mc.innerHTML = renderFormulasPage();
  else if (currentView === 'import')      mc.innerHTML = renderImportGuide();
  else if (currentView === 'import-review') mc.innerHTML = renderImportReview();
  if (currentView === 'calculators') {
    setTimeout(function(){ switchCalc('pos'); renderPosSaved(); renderCompoundSaved(); renderAvgSaved(); }, 60);
  }
}

// ==========================================================================
// DASHBOARD
// ==========================================================================
function renderDashboard() {
  if (!state.accounts.length) return '<div class="no-account-msg"><div style="color:var(--text3);display:flex;justify-content:center"><svg class="ic" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg></div><p>Select or create an account</p><button class="btn btn-primary" onclick="openNewAccountModal()">+ Create Account</button></div>';
  var trades, capital;
  if (filterAccountId === 'all') {
    trades = state.trades;
    capital = state.accounts.reduce(function(s,a){ return s + (parseFloat(a.startingCapital)||0); }, 0);
  } else {
    var acc = state.accounts.find(function(a){ return a.id === filterAccountId; }) || getActiveAccount();
    if (!acc) return '<div class="no-account-msg"><p>Select an account</p></div>';
    trades = getAccountTrades(acc.id);
    capital = parseFloat(acc.startingCapital) || 0;
  }
  var closed = trades.filter(function(t){ return t.status === 'closed'; });
  var netPnl = trades.reduce(function(s,t){ return s + calcRealizedTotal(t); }, 0);
  var balance = capital + netPnl;
  var wins = closed.filter(isWin).length;
  var losses = closed.filter(isLoss).length;
  var wr = closed.length ? fmtWinRate(wins / closed.length * 100) : '—';
  var openCount = trades.filter(function(t){ return t.status === 'open'; }).length;
  var avgWin = wins ? closed.filter(isWin).reduce(function(s,t){ return s+calcPnl(t); },0)/wins : 0;
  var avgLoss = losses ? Math.abs(closed.filter(isLoss).reduce(function(s,t){ return s+calcPnl(t); },0)/losses) : 0;
  var avgRr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';
  var recent = trades.slice().sort(function(a,b){ return String(b.entry_date||'').localeCompare(String(a.entry_date||'')); }).slice(0,5);
  var pnlSub = (closed.length || Math.abs(netPnl) > BE_EPS)
    ? (capital > 0 ? fmtPct(netPnl/capital*100) + ' of capital' : (netPnl >= 0 ? 'Profitable' : 'In drawdown'))
    : 'No closed trades';
  var eqLast = realizedEquityEvents(trades);
  var eqLastVal = eqLast.length ? eqLast[eqLast.length - 1].pnlRun : 0;
  return '<div id="dashContent"><div class="stats-row" id="dashStatsRow">' +
    statCard('Total Balance', fmtMoney(balance), 'Capital ' + (capital ? fmtMoney(capital) : 'not set'), balance < 0 ? 'var(--red)' : 'var(--purple)') +
    statCard('Net P&L', fmtPnl(netPnl), pnlSub, pnlColor(netPnl)) +
    statCard('Win Rate', wr, closed.length ? plural(closed.length, 'closed trade', 'closed trades') : 'No closed trades', 'var(--blue)') +
    statCard('Total Trades', String(trades.length), plural(wins,'win','wins') + ' · ' + plural(losses,'loss','losses') + ' · ' + openCount + ' open', 'var(--blue)') +
    statCard('Avg Win/Loss', avgRr, 'Realized · closed trades', 'var(--gold)') +
    statCard('Brokerage Fees', fmtMoney(calcTotalFees(trades)), plural(closed.length, 'closed trade', 'closed trades'), 'var(--red)') +
  '</div>' +
  '<div class="charts-row">' +
    '<div class="panel"><div class="panel-header"><div class="panel-title">Equity Curve</div>' +
      (eqLast.length ? '<span class="eq-last" style="color:' + pnlColor(eqLastVal) + '">' + fmtPnl(eqLastVal) + '</span>' : '') +
    '</div>' +
    (eqLast.length ? '<div class="chart-wrap"><canvas id="equityChart"></canvas></div>' : '<div class="empty-state" style="padding:28px 12px"><p>Close a trade to start your curve</p></div>') +
    '</div>' +
    winLossPanel(wins, losses, closed.length) +
  '</div>' +
  '<div class="bottom-row dash-extra">' +
    '<div class="panel"><div class="panel-header" style="flex-direction:column;align-items:flex-start;gap:2px"><div class="panel-title" style="display:inline-flex;align-items:center;gap:6px">' + cicon('barChart',15,'var(--blue)') + ' P&L by Symbol</div><div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text3)" id="symbolChartNote"></div></div><div class="chart-wrap"><canvas id="symbolChart"></canvas></div></div>' +
    '<div class="panel"><div class="panel-header"><div class="panel-title">P&L by Type</div></div><div class="chart-wrap"><canvas id="typeChart"></canvas></div></div>' +
  '</div>' +
  '<div class="panel dash-extra"><div class="panel-header"><div class="panel-title">Recent Trades</div><button class="btn btn-secondary btn-sm" onclick="setView(\'trades\')">View All</button></div>' +
  (recent.length ? '<div class="table-wrap">' + renderTradesTable(recent) + '</div>' : '<div class="empty-state"><p>No trades yet</p></div>') +
  '</div>';
}

function winLossPanel(wins, losses, closedCount) {
  var C = 238.8;
  var be = Math.max(0, closedCount - wins - losses);
  var winLen = closedCount ? wins / closedCount * C : 0;
  var beLen = closedCount ? be / closedCount * C : 0;
  var center = closedCount ? Math.round(wins / closedCount * 100) + '%' : '—';
  var ring = closedCount ? (losses ? '#ff4d6d' : '#8a94b0') : 'var(--surface3)';
  var svg = '<svg width="80" height="80" viewBox="0 0 100 100" role="img" aria-label="' + plural(wins,'win','wins') + ', ' + plural(losses,'loss','losses') + '">' +
    '<circle cx="50" cy="50" r="38" fill="none" stroke="' + ring + '" stroke-width="14"/>' +
    (beLen ? '<circle cx="50" cy="50" r="38" fill="none" stroke="#8a94b0" stroke-width="14" stroke-dasharray="' + (winLen + beLen).toFixed(1) + ' ' + C + '" transform="rotate(-90 50 50)"/>' : '') +
    (winLen ? '<circle cx="50" cy="50" r="38" fill="none" stroke="#00d68f" stroke-width="14" stroke-dasharray="' + winLen.toFixed(1) + ' ' + (C - winLen).toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '') +
    '<text x="50" y="56" text-anchor="middle" fill="var(--text)" font-family="Roboto,sans-serif" font-size="17" font-weight="700">' + center + '</text></svg>';
  var dot = function(c){ return '<span style="width:9px;height:9px;border-radius:3px;background:' + c + '"></span>'; };
  return '<div class="panel"><div class="panel-header"><div class="panel-title">Win / Loss</div><span class="cap">' + closedCount + ' closed</span></div>' +
    '<div style="display:flex;align-items:center;gap:18px;padding:12px 14px">' + svg +
      '<div style="display:flex;flex-direction:column;gap:6px;font-size:calc(13px*var(--fz))">' +
        '<span style="display:flex;align-items:center;gap:8px">' + dot('var(--green)') + plural(wins,'win','wins') + '</span>' +
        '<span style="display:flex;align-items:center;gap:8px">' + dot('var(--red)') + plural(losses,'loss','losses') + '</span>' +
      '</div>' +
    '</div></div>';
}

function accentBg(color) {
  if (color === 'var(--purple)') return 'rgba(167,139,250,.07)';
  if (color === 'var(--green)') return 'rgba(0,214,143,.07)';
  if (color === 'var(--blue)') return 'rgba(77,159,255,.07)';
  if (color === 'var(--gold)') return 'rgba(255,194,71,.07)';
  if (color === 'var(--red)') return 'rgba(255,77,109,.07)';
  return 'transparent';
}

function statCard(label, value, sub, color) {
  return '<div class="stat-card" style="--accent:' + color + ';--accent-bg:' + accentBg(color) + '">' +
    '<div class="stat-label">' + label + '</div>' +
    '<div class="stat-value" style="color:' + color + '">' + value + '</div>' +
    '<div class="stat-sub">' + sub + '</div></div>';
}

function realizedEquityEvents(trades) {
  var ev = [];
  (trades || []).forEach(function(t) {
    var realized = 0;
    (t.partial_closes || []).forEach(function(pc) {
      var pcBasis = (pc.basis != null) ? pc.basis : calcPositionState(t).avg;
      var pcGross = (pc.price - pcBasis) * pc.qty * (t.direction === 'Short' ? -1 : 1);
      var pcFee = calcFeesAmt(pc.fees, pc.fees_mode, pcGross);
      var pcNet = pcGross - pcFee;
      realized += pcNet;
      ev.push({ d: pc.date || t.exit_date || t.entry_date, pnl: pcNet });
    });
    if (t.status === 'closed') {
      var rest = calcPnl(t) - realized;
      ev.push({ d: t.exit_date || t.entry_date, pnl: rest });
    }
  });
  ev.sort(function(a, b){ return String(a.d || '').localeCompare(String(b.d || '')); });
  var run = 0;
  return ev.map(function(e){ run += e.pnl; return { d: e.d, pnl: e.pnl, pnlRun: run }; });
}

function buildCharts() {
  if (typeof Chart === 'undefined') return;
  if (!state.accounts.length) return;
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else {
    var acc = state.accounts.find(function(a){ return a.id === filterAccountId; }) || getActiveAccount();
    if (!acc) return;
    trades = getAccountTrades(acc.id);
  }
  var closed = trades.filter(function(t){ return t.status==='closed'; }).sort(function(a,b){ return String(a.exit_date||'').localeCompare(String(b.exit_date||'')); });
  var eqEv = realizedEquityEvents(trades);
  var eqLabels = eqEv.map(function(e){ return e.d; });
  var eqData = eqEv.map(function(e){ return +e.pnlRun.toFixed(2); });
  var run = eqData.length ? eqData[eqData.length - 1] : 0;
  var radii = eqData.map(function(_, i){ return i === eqData.length - 1 ? 5 : 3; });
  var cd = {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1e2438',borderColor:'#252b3d',borderWidth:1,titleColor:'#9aa3be',bodyColor:'#e8ecf5'}}};
  var gc = 'rgba(90,99,128,0.15)', tc = '#5a6380';
  function ax(){ return {ticks:{color:tc,font:{family:'Roboto',size:chartFontSize(11)}},grid:{color:gc}}; }
  var el = document.getElementById('equityChart');
  if (el && eqData.length) { if (equityChart) equityChart.destroy(); var col = run>=0?'#00d68f':'#ff4d6d'; equityChart = new Chart(el,{type:'line',data:{labels:eqLabels,datasets:[{data:eqData,borderColor:col,backgroundColor:col+'20',tension:.3,fill:true,pointRadius:radii,pointHoverRadius:6}]},options:Object.assign({},cd,{scales:{x:Object.assign(ax(),{ticks:Object.assign(ax().ticks,{maxTicksLimit:6})}),y:ax()}})}); }
  var bySymbol = {}, byType = {};
  closed.forEach(function(t){ var p=calcPnl(t); bySymbol[t.ticker]=(bySymbol[t.ticker]||0)+p; byType[t.type||'Other']=(byType[t.type||'Other']||0)+p; });

  // Symbol chart — Top 10 by absolute P&L value
  var ss = document.getElementById('symbolChart');
  if (ss) {
    if (symbolChart) symbolChart.destroy();
    var skAll = Object.keys(bySymbol);
    skAll.sort(function(a,b){ return Math.abs(bySymbol[b]) - Math.abs(bySymbol[a]); });
    var sk = skAll.slice(0, 10);
    var symNote = document.getElementById('symbolChartNote');
    if (symNote) symNote.textContent = skAll.length > 10 ? 'Top 10 of ' + skAll.length + ' symbols · sorted by P&L' : skAll.length + ' symbols · sorted by P&L';
    symbolChart = new Chart(ss,{type:'bar',data:{labels:sk,datasets:[{data:sk.map(function(k){ return +bySymbol[k].toFixed(2); }),backgroundColor:sk.map(function(k){ return bySymbol[k]>=0?'#00d68f40':'#ff4d6d40'; }),borderColor:sk.map(function(k){ return bySymbol[k]>=0?'#00d68f':'#ff4d6d'; }),borderWidth:1}]},options:Object.assign({},cd,{scales:{x:ax(),y:ax()}})});
  }

  // Type chart — all types (rarely more than 7-8), still sorted by absolute P&L
  var ts = document.getElementById('typeChart');
  if (ts) {
    if (typeChart) typeChart.destroy();
    var tkAll = Object.keys(byType);
    tkAll.sort(function(a,b){ return Math.abs(byType[b]) - Math.abs(byType[a]); });
    var tk = tkAll.slice(0, 10);
    typeChart = new Chart(ts,{type:'bar',data:{labels:tk,datasets:[{data:tk.map(function(k){ return +byType[k].toFixed(2); }),backgroundColor:tk.map(function(k){ return byType[k]>=0?'#4d9fff40':'#ff4d6d40'; }),borderColor:tk.map(function(k){ return byType[k]>=0?'#4d9fff':'#ff4d6d'; }),borderWidth:1}]},options:Object.assign({},cd,{scales:{x:ax(),y:ax()}})});
  }
}

// ==========================================================================
// TRADE LOG
// ==========================================================================
function renderTradeLog() {
  if (!state.accounts.length) return '<div class="no-account-msg"><p>Create an account first</p></div>';
  var trades = getAccountScopedTrades();
  var logTitle;
  var sortOrder = window._tradeSort || 'date_desc';
  var filterVal = window._tradeFilter || 'all';
  if (filterAccountId === 'all') {
    logTitle = 'All Accounts';
  } else {
    var acc = state.accounts.find(function(a){ return a.id === filterAccountId; }) || getActiveAccount();
    if (!acc) return '<div class="no-account-msg"><p>Select an account first</p></div>';
    logTitle = acc.name;
  }
  var openCount   = trades.filter(function(t){ return t.status==='open'; }).length;
  var closedCount = trades.filter(function(t){ return t.status==='closed'; }).length;
  var searchVal = window._tradeSearch || '';
  var displayed = getVisibleTrades();
  // Build filter chips HTML
  var winCount = trades.filter(function(t){ return t.status === 'closed' && isWin(t); }).length;
  var lossCount = trades.filter(function(t){ return t.status === 'closed' && isLoss(t); }).length;
  var segItems2 = [
    {val:'all',label:'All',col:'',n:trades.length},
    {val:'wins',label:'Wins',col:'var(--green)',n:winCount},
    {val:'losses',label:'Losses',col:'var(--red)',n:lossCount},
    {val:'open',label:'Open',col:'var(--gold)',n:openCount},
    {val:'closed',label:'Closed',col:'',n:closedCount}
  ];
  var chipsHtml = segItems2.map(function(c){
    var isActive = filterVal === c.val;
    return '<button class="fl-tab' + (isActive ? ' on' : '') + '"' + (c.col && !isActive ? ' style="color:' + c.col + '"' : '') + ' onclick="setTradeFilter(&apos;' + c.val + '&apos;)" aria-label="' + c.label + ', ' + c.n + '">' + c.label + '<small>' + c.n + '</small></button>';
  }).join('');
  // Build summary bar HTML (only when filter active and has results)
  var summaryHtml = '';
  if (filterVal !== 'all' && displayed.length > 0) {
    var sPnl = displayed.reduce(function(s,t){ return s + calcPnl(t); }, 0);
    var sInv = displayed.reduce(function(s,t){ return s + calcInvestedValue(t); }, 0);
    var sAvg = sPnl / displayed.length;
    var sRoi = sInv > 0 ? (sPnl / sInv * 100) : 0;
    var sCol = sPnl >= 0 ? 'var(--green)' : 'var(--red)';
    summaryHtml =
      '<div style="padding:0 14px 10px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:8px;border-left:3px solid ' + sCol + '">' +
          '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text3)">' + displayed.length + ' trade' + (displayed.length !== 1 ? 's' : '') + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(14px*var(--fz));font-weight:700;color:' + sCol + '">Total: ' + fmtPnl(sPnl) + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text2)">Avg: ' + fmtPnl(sAvg) + '</span>' +
          '<span style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text2)">ROI: ' + fmtPct(sRoi) + '</span>' +
        '</div>' +
      '</div>';
  }
  var isCal = tradeLayout === 'calendar';
  var sortLabel = sortOrder === 'date_asc' ? 'Oldest' : sortOrder === 'pnl_desc' ? 'P&amp;L high' : sortOrder === 'pnl_asc' ? 'P&amp;L low' : sortOrder === 'symbol' ? 'A–Z' : 'Newest';
  return '<div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
      '<button class="' + (!isCal ? 'on' : '') + '" onclick="setTradeLayout(\'list\')">List</button>' +
      '<button class="' + (isCal ? 'on' : '') + '" onclick="setTradeLayout(\'calendar\')">Calendar</button>' +
    '</div>' +
    (isCal ? renderCalendar() : (
  '<div id="tradeLogPanel">' +
    '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px">' +
      '<div style="position:relative">' +
        '<span style="position:absolute;left:13px;top:12px;color:var(--text3);pointer-events:none">' + cicon('search',15,'var(--text3)') + '</span>' +
        '<input id="tradeSearchInput" type="text" placeholder="Search symbol" value="' + esc(window._tradeSearch||'') + '" oninput="setTradeSearch(this.value)" style="width:100%;height:40px;border-radius:20px;border:1px solid var(--border2);background:var(--surface2);padding:0 12px 0 38px;font:calc(14px*var(--fz)) var(--sans);color:var(--text)">' +
      '</div>' +
      '<select class="sort-pill" onchange="setTradeSort(this.value)" aria-label="Sort">' +
        '<option value="date_desc"' + (sortOrder==='date_desc'?' selected':'') + '>Newest</option>' +
        '<option value="date_asc"'  + (sortOrder==='date_asc' ?' selected':'') + '>Oldest</option>' +
        '<option value="pnl_desc"'  + (sortOrder==='pnl_desc'?' selected':'') + '>P&amp;L High</option>' +
        '<option value="pnl_asc"'   + (sortOrder==='pnl_asc' ?' selected':'') + '>P&amp;L Low</option>' +
        '<option value="symbol"'    + (sortOrder==='symbol'  ?' selected':'') + '>A–Z</option>' +
      '</select>' +
    '</div>' +
  '</div>' +
  '<div class="seg" style="grid-template-columns:repeat(5,minmax(0,1fr))">' + chipsHtml + '</div>' +
  '<div id="tradeFilterSummary">' + summaryHtml + '</div>' +
  '<div class="panel" id="tradeTableWrap">' +
    (displayed.length
      ? renderTradesTable(displayed)
      : emptyTradesHtml(filterVal, searchVal)) +
  '</div>'));
}

function setTradeLayout(mode) {
  tradeLayout = mode === 'calendar' ? 'calendar' : 'list';
  if (currentView !== 'trades') currentView = 'trades';
  renderMain();
}

function renderTradesTable(trades) {
  if (!trades.length) return '<div class="empty-state"><div class="empty-icon" style="color:var(--text3)"><svg class="ic" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div><h3>No trades</h3></div>';
  var rows = trades.map(function(t){
    var isOpen = t.status === 'open';
    var pnl = calcPnl(t);
    var invested = calcInvestedValue(t);
    var remQty = calcTotalQty(t);
    var hasActivePartial = t.partial_closes && t.partial_closes.length > 0 && remQty > 0;
    var pnlPct = invested > 0 ? (pnl / invested * 100) : 0;
    var hasLivePrice = isOpen && t.current_price;
    var badgeCls = isOpen ? (hasActivePartial ? 'b-part' : 'b-open') : 'b-closed';
    var statusLabel = isOpen ? (hasActivePartial ? 'Partial' : 'Open') : 'Closed';
    var badge = '<span class="badge ' + badgeCls + '">' + (hasActivePartial ? '' : '<span class="dotc"></span>') + statusLabel + '</span>';
    var pnlCell;
    if (isOpen && !hasLivePrice && !hasActivePartial) {
      pnlCell = '<button class="setp" onclick="event.stopPropagation();promptLivePrice(\'' + eid(t.id) + '\')">+ Price</button>';
    } else if (isOpen) {
      pnlCell = '<div class="pl ' + pnlClass(pnl) + '">' + fmtPnl(pnl) + '</div><div class="sub">' + (!hasLivePrice ? 'realized' : (hasActivePartial ? 'total' : 'unrealized')) + '</div>';
    } else {
      pnlCell = '<div class="pl ' + pnlClass(pnl) + '">' + fmtPnl(pnl) + '</div>' +
        (invested > 0 ? '<div class="sub n ' + pnlClass(pnl) + '">' + fmtPct(pnlPct) + '</div>' : '');
    }
    return '<tr onclick="openTradeDetail(\'' + eid(t.id) + '\')" class="' + (isOpen ? 'open' : '') + '">' +
      '<td><div class="sym">' + esc(t.ticker) + '</div></td>' +
      '<td class="st">' + badge + '</td>' +
      '<td>' + pnlCell + '</td>' +
      '<td class="n">' + fmtMoney(invested) + '</td>' +
      '</tr>';
  }).join('');
  return '<table class="trade-table tt"><thead><tr>' +
    '<th colspan="2">Symbol</th><th>Net P&amp;L</th><th>Invested</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function promptLivePrice(tradeId) {
  promptSheet('Current price', 'Enter the live price for this open trade', '', function(val) {
    if (!val) return;
    setCurrentPrice(tradeId, val);
    renderMain();
  });
}

// ==========================================================================
// CALENDAR
// ==========================================================================
var CAL_CHEV_L = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
var CAL_CHEV_R = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
function renderCalendar() {
  if (!state.accounts.length) return '<div class="no-account-msg"><p>Create an account first</p></div>';
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else {
    var acc = state.accounts.find(function(a){ return a.id === filterAccountId; }) || getActiveAccount();
    if (!acc) return '<div class="no-account-msg"><p>Select an account</p></div>';
    trades = getAccountTrades(acc.id);
  }
  var year = calendarDate.getFullYear(), month = calendarDate.getMonth();
  var monthName = calendarDate.toLocaleString('default',{month:'long',year:'numeric'});
  var dayMap = {};
  trades.filter(function(t){ return t.status==='closed'; }).forEach(function(t){
    if (!dayMap[t.exit_date]) dayMap[t.exit_date] = {pnl:0, count:0};
    dayMap[t.exit_date].pnl += calcPnl(t);
    dayMap[t.exit_date].count++;
  });
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month+1, 0).getDate();
  var todayStr = today();
  var cells = '';
  for (var i = 0; i < firstDay; i++) cells += '<div class="cal-cell empty"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var day = dayMap[ds];
    var dayCls = day ? (day.pnl > 0.005 ? ' win' : (day.pnl < -0.005 ? ' loss' : ' breakeven')) : '';
    var cls = 'cal-cell' + (ds === todayStr ? ' today' : '') + dayCls;
    cells += '<div class="' + cls + '" onclick="openCalendarDay(\'' + eid(ds) + '\')">' +
      '<div class="cal-date">' + d + '</div>' +
      (day ? '<div class="cal-pnl" style="color:' + pnlColor(day.pnl) + '">' + fmtPnlCompact(day.pnl) + '</div>' : '') +
    '</div>';
  }
  var tradingDays = 0, greenDays = 0, monthPnl = 0;
  Object.keys(dayMap).forEach(function(k) {
    tradingDays++;
    monthPnl += dayMap[k].pnl;
    if (dayMap[k].pnl > 0.005) greenDays++;
  });
  return '<div class="panel"><div class="panel-header">' +
    '<button class="btn btn-secondary cal-nav" onclick="changeMonth(-1)" aria-label="Previous month">' + CAL_CHEV_L + '</button>' +
    '<div class="panel-title">' + monthName + '</div>' +
    '<button class="btn btn-secondary cal-nav" onclick="changeMonth(1)" aria-label="Next month">' + CAL_CHEV_R + '</button>' +
  '</div>' +
  '<div class="cal-grid" id="calGrid"><div class="cal-header">Su</div><div class="cal-header">Mo</div><div class="cal-header">Tu</div><div class="cal-header">We</div><div class="cal-header">Th</div><div class="cal-header">Fr</div><div class="cal-header">Sa</div>' +
  cells + '</div>' +
  '<div style="display:flex;justify-content:space-between;padding:8px 14px 12px;font-size:calc(12px*var(--fz));color:var(--text3);border-top:1px solid var(--border)">' +
    '<span>' + plural(tradingDays, 'trading day', 'trading days') + ' · ' + greenDays + ' green</span>' +
    '<span class="n" style="font-weight:700;color:' + pnlColor(monthPnl) + '">' + fmtPnl(monthPnl) + '</span>' +
  '</div></div>';
}

function changeMonth(d) { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth()+d, 1); renderMain(); }

function openCalendarDay(dateStr) {
  var trades = getAccountScopedTrades().filter(function(t){ return t.exit_date === dateStr && t.status === 'closed'; });
  if (!trades.length) return;
  var pnl = trades.reduce(function(s,t){ return s + calcPnl(t); }, 0);
  var titleEl = document.getElementById('detailModalTitle');
  if (titleEl) titleEl.textContent = 'Trades on ' + dateStr;
  var body = document.getElementById('tradeDetailBody');
  if (body) body.innerHTML =
    '<div style="display:flex;gap:14px;margin-bottom:16px">' +
      '<span class="chip">' + trades.length + ' trades</span>' +
      '<span class="chip" style="color:' + pnlColor(pnl) + '">Day P&L: ' + fmtPnl(pnl) + '</span>' +
    '</div><div class="table-wrap">' + renderTradesTable(trades) + '</div>';
  var footer = document.getElementById('tradeDetailFooter');
  if (footer) { footer.className = 'modal-footer'; } if (footer) footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(\'tradeDetailModal\')">Close</button>';
  openModal('tradeDetailModal');
}

// ==========================================================================
// ACCOUNTS VIEW
// ==========================================================================

function renderAccountsList() {
  var html = '';
  if (!state.accounts.length) {
    return html + '<div class="empty-state"><div style="color:var(--text3);display:flex;justify-content:center"><svg class="ic" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg></div><h3>No accounts yet</h3><p>Create your first trading account to get started.</p></div>';
  }
  html += '<div style="display:grid;gap:10px">';
  state.accounts.forEach(function(acc, accIdx) {
    var trades = state.trades.filter(function(t){ return t.accountId === acc.id; });
    var closed = trades.filter(function(t){ return t.status === 'closed'; });
    var netPnl = trades.reduce(function(s,t){ return s + calcRealizedTotal(t); }, 0);
    var wins = closed.filter(isWin).length;
    var wr = closed.length ? fmtWinRate(wins / closed.length * 100) : '—';
    var isActive = (acc.id === state.activeAccountId);
    var upBtn = accIdx === 0
      ? '<button disabled style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text3);opacity:0.4">&#9650;</button>'
      : '<button onclick="event.stopPropagation();moveAccount(\'' + eid(acc.id) + '\',-1)" style="padding:5px 10px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer">&#9650;</button>';
    var dnBtn = accIdx === state.accounts.length - 1
      ? '<button disabled style="padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text3);opacity:0.4">&#9660;</button>'
      : '<button onclick="event.stopPropagation();moveAccount(\'' + eid(acc.id) + '\',1)" style="padding:5px 10px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer">&#9660;</button>';
    var activeBadge = '';
    var isFirst = (accIdx === 0);
    var isLast  = (accIdx === state.accounts.length - 1);
    html += '<div class="panel" id="acc-card-' + eid(acc.id) + '" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">' +
        '<div style="min-width:0">' +
          '<div style="font-size:calc(15px*var(--fz));font-weight:700">' + esc(acc.name) + activeBadge + '</div>' +
          '<div class="n" style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:3px">' + plural(trades.length,'trade','trades') + ' · Win rate ' + wr + '</div>' +
          '<div class="n" style="font-size:calc(11px*var(--fz));color:var(--red);margin-top:1px">Fees ' + fmtMoney(calcTotalFees(trades)) + '</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div class="n" style="font-size:calc(16px*var(--fz));font-weight:700;color:' + pnlColor(netPnl) + '">' + fmtPnl(netPnl) + '</div>' +
          '<div style="font-size:calc(12px*var(--fz));color:var(--text3)">Net P&amp;L</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
        '<button class="btn btn-secondary" style="height:32px" onclick="event.stopPropagation();editAccount(\'' + eid(acc.id) + '\')">Edit</button>' +
        '<button class="btn btn-secondary" style="height:32px" onclick="event.stopPropagation();openAccountMoney(\'' + eid(acc.id) + '\')">Deposit / Withdraw</button>' +
        (state.accounts.length > 1
          ? '<div style="margin-left:auto;display:flex;gap:4px">' +
              (isFirst ? '<button disabled style="padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text3);opacity:0.35;font-size:calc(13px*var(--fz))">&#9650;</button>'
                       : '<button onclick="event.stopPropagation();moveAccount(\'' + eid(acc.id) + '\',-1)" style="padding:5px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;font-size:calc(13px*var(--fz))">&#9650;</button>') +
              (isLast  ? '<button disabled style="padding:5px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text3);opacity:0.35;font-size:calc(13px*var(--fz))">&#9660;</button>'
                       : '<button onclick="event.stopPropagation();moveAccount(\'' + eid(acc.id) + '\',1)" style="padding:5px 12px;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);cursor:pointer;font-size:calc(13px*var(--fz))">&#9660;</button>') +
            '</div>'
          : '') +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  
  return html;
}


// ==========================================================================
// DAILY JOURNAL
// ==========================================================================
var _journalDate = today();

function getJournals() {
  try { return sanitizeJournals(JSON.parse(localStorage.getItem('tl_journals') || '{}')); } catch(e) { return {}; }
}
function saveJournals(obj) {
  localStorage.setItem('tl_journals', JSON.stringify(obj));
}
function getJournalEntry(date) {
  var journals = getJournals();
  return journals[date] || {date:date, mood:'', wentWell:'', improve:'', tags:[], notes:''};
}
function saveJournalEntry(date, data) {
  var journals = getJournals();
  journals[date] = data;
  saveJournals(journals);
}
function changeJournalDate(dir) {
  var d = parseLocalDate(_journalDate);
  d.setDate(d.getDate() + dir);
  _journalDate = localDateStr(d);
  var mc = document.getElementById('mainContent');
  if (mc) mc.innerHTML = renderJournal();
}
function renderJournal() {
  var entry = getJournalEntry(_journalDate);
  var journals = getJournals();
  var allDates = Object.keys(journals).sort().reverse();
  var todayStr = today();
  var isToday = _journalDate === todayStr;
  var dateObj = new Date(_journalDate + 'T12:00:00');
  var dayName = dateObj.toLocaleDateString('en-US',{weekday:'short'});
  var dateLabel = dateObj.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  var moods = [
    {key:'stressed',  icon:cicon('trendDown',18,'currentColor'), label:'Stressed'},
    {key:'neutral',   icon:icon('user',18), label:'Neutral'},
    {key:'focused',   icon:cicon('target',18,'currentColor'), label:'Focused'},
    {key:'confident', icon:icon('trophy',18), label:'Confident'},
    {key:'fearful',   icon:cicon('stop',18,'currentColor'), label:'Fearful'}
  ];
  var moodHtml = moods.map(function(m){
    var isActive = entry.mood === m.key;
    var style = isActive
      ? 'flex:1;padding:8px 2px;border-radius:8px;border:2px solid var(--gold);background:var(--gold-bg);cursor:pointer;text-align:center;font-family:var(--sans)'
      : 'flex:1;padding:8px 2px;border-radius:8px;border:1px solid var(--border2);background:none;cursor:pointer;text-align:center;color:var(--text3);font-family:var(--sans)';
    return '<button style="' + style + '" onclick="setJournalMood(&apos;' + m.key + '&apos;)">' +
      '<div style="font-size:calc(20px*var(--fz))">' + m.icon + '</div>' +
      '<div style="font-size:calc(11px*var(--fz));margin-top:3px;color:var(--text3)">' + m.label + '</div>' +
    '</button>';
  }).join('');
  var quickTags = ['Followed plan','Broke rules','Revenge trade','Missed entry','Early exit','News day','Overtraded','Best day'];
  var tagsHtml = quickTags.map(function(t){
    var isActive = entry.tags && entry.tags.indexOf(t) >= 0;
    var style = isActive
      ? 'padding:5px 12px;border-radius:16px;font-size:calc(11px*var(--fz));font-family:var(--mono);cursor:pointer;border:1.5px solid var(--blue);background:var(--blue-bg);color:var(--blue);font-weight:600'
      : 'padding:5px 12px;border-radius:16px;font-size:calc(11px*var(--fz));font-family:var(--mono);cursor:pointer;border:1px solid var(--border2);background:var(--surface2);color:var(--text3)';
    return '<button style="' + style + '" onclick="toggleJournalTag(&apos;' + t + '&apos;)">' + t + '</button>';
  }).join('');
  // Stats
  var totalEntries = allDates.length;
  var planDays = allDates.filter(function(d){ return journals[d].tags && journals[d].tags.indexOf('Followed plan') >= 0; }).length;
  var goodMoods = allDates.filter(function(d){ return journals[d].mood === 'focused' || journals[d].mood === 'confident'; }).length;
  // Recent entries
  var recentHtml = allDates.slice(0,5).map(function(d){
    var e = journals[d];
    var moodIcon = ({stressed:cicon('trendDown',14),neutral:icon('user',14),focused:cicon('target',14),confident:icon('trophy',14),fearful:cicon('stop',14)})[e.mood] || '—';
    var preview = e.wentWell || e.improve || e.notes || '...';
    if (preview.length > 55) preview = preview.substring(0,55) + '...';
    var dotColor = (e.mood==='focused'||e.mood==='confident') ? 'var(--green)' : (e.mood==='stressed'||e.mood==='fearful') ? 'var(--red)' : 'var(--text3)';
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="goToJournalDate(&apos;' + eid(d) + '&apos;)">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:' + dotColor + ';margin-top:5px;flex-shrink:0"></div>' +
      '<div style="flex:1">' +
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
          '<span style="font-family:var(--mono);font-size:calc(11px*var(--fz));color:var(--text3)">' + fmtDate(d) + '</span>' +
          '<span style="font-size:calc(13px*var(--fz))">' + moodIcon + '</span>' +
          (e.tags && e.tags.length ? '<span style="font-size:calc(12px*var(--fz));color:var(--blue);font-family:var(--mono)">' + esc(e.tags.slice(0,2).join(' · ')) + '</span>' : '') +
        '</div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text2);line-height:1.4">' + esc(preview) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  return '<div style="display:flex;flex-direction:column;gap:14px">' +
    // Date navigation
    '<div class="panel">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px">' +
        '<button class="icon-btn" onclick="changeJournalDate(-1)" style="width:36px;height:36px;font-size:calc(16px*var(--fz))">&#9664;</button>' +
        '<div style="text-align:center">' +
          '<div style="font-size:calc(16px*var(--fz));font-weight:700;color:var(--text)">' + dayName + ', ' + dateLabel + '</div>' +
          (isToday ? '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--green);margin-top:2px">&#9679; Today</div>' : '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text3);margin-top:2px">tap &#9664; &#9654; to navigate</div>') +
        '</div>' +
        '<button class="icon-btn" onclick="changeJournalDate(1)" style="width:36px;height:36px;font-size:calc(16px*var(--fz))" ' + (isToday?'disabled style="width:36px;height:36px;font-size:calc(16px*var(--fz));opacity:0.3"':'') + '>&#9654;</button>' +
      '</div>' +
      // Mood
      '<div style="padding:0 16px 14px">' +
        '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);text-transform:uppercase;margin-bottom:8px">How was your trading today?</div>' +
        '<div style="display:flex;gap:6px">' + moodHtml + '</div>' +
      '</div>' +
      // Went well
      '<div style="padding:0 16px 12px">' +
        '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--green);text-transform:uppercase;margin-bottom:6px;display:inline-flex;align-items:center;gap:6px">' + cicon('check',12,'var(--green)') + ' What went well</div>' +
        '<textarea id="journal_well" rows="3" placeholder="e.g. Followed my entry rules, waited for confirmation..." style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:calc(13px*var(--fz));padding:10px 12px;resize:vertical;line-height:1.6" oninput="autoSaveJournal()">' + esc(entry.wentWell||'') + '</textarea>' +
      '</div>' +
      // Improve
      '<div style="padding:0 16px 12px">' +
        '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--gold);text-transform:uppercase;margin-bottom:6px">&#9888;&#65039; What to improve</div>' +
        '<textarea id="journal_improve" rows="3" placeholder="e.g. Exited too early, need to trust the setup..." style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:calc(13px*var(--fz));padding:10px 12px;resize:vertical;line-height:1.6" oninput="autoSaveJournal()">' + esc(entry.improve||'') + '</textarea>' +
      '</div>' +
      // Quick tags
      '<div style="padding:0 16px 12px">' +
        '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);text-transform:uppercase;margin-bottom:8px">Quick Tags</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px" id="journalTagsRow">' + tagsHtml + '</div>' +
      '</div>' +
      // Notes
      '<div style="padding:0 16px 14px">' +
        '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);text-transform:uppercase;margin-bottom:6px;display:inline-flex;align-items:center;gap:6px">' + cicon('notes',12,'var(--purple)') + ' Additional Notes</div>' +
        '<textarea id="journal_notes" rows="2" placeholder="Any other thoughts..." style="width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:calc(13px*var(--fz));padding:10px 12px;resize:vertical;line-height:1.6" oninput="autoSaveJournal()">' + esc(entry.notes||'') + '</textarea>' +
      '</div>' +
      // Save indicator
      '<div style="padding:0 16px 14px;text-align:right">' +
        '<span id="journalSaveIndicator" style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text3);display:inline-flex;align-items:center;gap:5px">' + cicon('save',11,'currentColor') + ' Auto-saved</span>' +
      '</div>' +
    '</div>' +
    // Stats row
    '<div class="stats-row" style="grid-template-columns:1fr 1fr 1fr">' +
      '<div class="stat-card" style="--accent:var(--blue)"><div class="stat-label">Total Entries</div><div class="stat-value" style="color:var(--blue)">' + totalEntries + '</div><div class="stat-sub">days logged</div></div>' +
      '<div class="stat-card" style="--accent:var(--green)"><div class="stat-label">Plan Followed</div><div class="stat-value" style="color:var(--green)">' + planDays + '</div><div class="stat-sub">days</div></div>' +
      '<div class="stat-card" style="--accent:var(--gold)"><div class="stat-label">Good Mindset</div><div class="stat-value" style="color:var(--gold)">' + goodMoods + '</div><div class="stat-sub">focused / confident</div></div>' +
    '</div>' +
    // Recent entries
    (allDates.length > 0 ? '<div class="panel"><div class="panel-header"><div class="panel-title" style="display:inline-flex;align-items:center;gap:6px">' + cicon('clipboard',15,'var(--gold)') + ' Recent Entries</div></div><div style="padding:0 16px">' + recentHtml + '</div></div>' : '') +
  '</div>';
}

function setJournalMood(mood) {
  var entry = getJournalEntry(_journalDate);
  entry.mood = entry.mood === mood ? '' : mood;
  saveJournalEntry(_journalDate, entry);
  // Re-render mood buttons only
  var mc = document.getElementById('mainContent');
  if (mc) mc.innerHTML = renderJournal();
}

function toggleJournalTag(tag) {
  var entry = getJournalEntry(_journalDate);
  if (!entry.tags) entry.tags = [];
  var idx = entry.tags.indexOf(tag);
  if (idx >= 0) { entry.tags.splice(idx, 1); }
  else { entry.tags.push(tag); }
  // Save text fields before re-render
  var well = document.getElementById('journal_well');
  var improve = document.getElementById('journal_improve');
  var notes = document.getElementById('journal_notes');
  if (well) entry.wentWell = well.value;
  if (improve) entry.improve = improve.value;
  if (notes) entry.notes = notes.value;
  saveJournalEntry(_journalDate, entry);
  var mc = document.getElementById('mainContent');
  if (mc) mc.innerHTML = renderJournal();
}

var _journalSaveTimer = null;
function autoSaveJournal() {
  var ind = document.getElementById('journalSaveIndicator');
  if (ind) ind.textContent = 'Saving...';
  if (_journalSaveTimer) clearTimeout(_journalSaveTimer);
  _journalSaveTimer = setTimeout(function() {
    var entry = getJournalEntry(_journalDate);
    var well = document.getElementById('journal_well');
    var improve = document.getElementById('journal_improve');
    var notes = document.getElementById('journal_notes');
    if (well) entry.wentWell = well.value;
    if (improve) entry.improve = improve.value;
    if (notes) entry.notes = notes.value;
    saveJournalEntry(_journalDate, entry);
    var ind2 = document.getElementById('journalSaveIndicator');
    if (ind2) ind2.textContent = '\u2713 Saved';
  }, 800);
}

function goToJournalDate(date) {
  _journalDate = date;
  var mc = document.getElementById('mainContent');
  if (mc) mc.innerHTML = renderJournal();
}

function renderAccountsView() {
  var totalTrades = state.trades.length;
  // Overall summary stats
  var allTrades = state.trades;
  var allClosed = allTrades.filter(function(t){ return t.status==='closed'; });
  var totalCapital = state.accounts.reduce(function(s,a){ return s+(parseFloat(a.startingCapital)||0); },0);
  var totalPnl = allTrades.reduce(function(s,t){ return s+calcPnl(t); },0);
  var totalFees = calcTotalFees(allTrades);
  var totalDeposits = 0, totalWithdrawals = 0;
  state.accounts.forEach(function(a){
    if (a.transactions) a.transactions.forEach(function(tx){
      if (tx.type==='deposit') totalDeposits += parseFloat(tx.amount)||0;
      else totalWithdrawals += parseFloat(tx.amount)||0;
    });
  });
  var lastBackup = '';
  try { lastBackup = localStorage.getItem('tl_last_backup') || ''; } catch(e) {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastBackup)) lastBackup = '';
  var html = '<div class="stats-row">' +
    statCard('Total Deposits', fmtMoney(totalDeposits), totalDeposits ? '' : 'None recorded', totalDeposits ? 'var(--green)' : 'var(--text2)') +
    statCard('Total Withdrawals', fmtMoney(totalWithdrawals), totalWithdrawals ? '' : 'None recorded', totalWithdrawals ? 'var(--red)' : 'var(--text2)') +
  '</div>' +
  '<div class="stats-row">' +
    '<button class="tile" onclick="backupData()">' +
      '<span style="color:var(--green)">' + icon('save', 22) + '</span>' +
      '<span class="t" style="color:var(--green)">Backup Data</span>' +
      '<span class="d">' + plural(totalTrades,'trade','trades') + (lastBackup ? ' · last ' + esc(fmtDateLong(lastBackup).replace(/ \d{4}$/, '')) : '') + '</span>' +
    '</button>' +
    '<button class="tile" onclick="restoreData()">' +
      '<span style="color:var(--blue)">' + icon('folder', 22) + '</span>' +
      '<span class="t" style="color:var(--blue)">Restore Backup</span>' +
      '<span class="d">Load from a saved file</span>' +
    '</button>' +
  '</div>' +
  '<div class="cap" style="padding:2px 2px 0">Import trades</div>' +
  '<button class="wide-row" onclick="setView(\'import\')">' +
    '<span style="color:var(--blue)">' + icon('camera', 24) + '</span>' +
    '<span style="min-width:0"><span style="display:block;font-size:calc(14px*var(--fz));font-weight:700;color:var(--blue)">From screenshot</span><span style="display:block;font-size:calc(11px*var(--fz));color:var(--text3);margin-top:1px">' + (isNativeApp() ? 'An open position, read on this phone' : 'Available in the Android app') + '</span></span>' +
    '<span class="tag" style="color:var(--green);border-color:rgba(0,214,143,.5)">XTB · Baraka · IBKR · T212</span>' +
  '</button>' +
  '<button class="wide-row" onclick="importCSV()">' +
    '<span style="color:var(--blue)">' + icon('doc', 24) + '</span>' +
    '<span style="min-width:0"><span style="display:block;font-size:calc(14px*var(--fz));font-weight:700;color:var(--blue)">From CSV file</span><span style="display:block;font-size:calc(11px*var(--fz));color:var(--text3);margin-top:1px">Closed trades history</span></span>' +
    '<span class="tag" style="color:var(--gold);border-color:rgba(255,194,71,.6)">Trading 212</span>' +
  '</button>' +
  '<button class="wide-row" onclick="openReportModal()">' +
    '<span style="color:var(--purple)">' + icon('doc', 24) + '</span>' +
    '<span style="min-width:0"><span style="display:block;font-size:calc(14px*var(--fz));font-weight:700">Export Report</span><span style="display:block;font-size:calc(11px*var(--fz));color:var(--text3);margin-top:1px">' + plural(totalTrades,'trade','trades') + ' ready · Excel or PDF</span></span>' +
    '<span></span>' +
  '</button>' +
  '<div class="cap" style="padding:2px 2px 0">Your accounts</div>' +
  '<div id="accountsListSection">' + renderAccountsList() + '</div>';
  return html;
}

// ==========================================================================
// ACCOUNT MODAL
// ==========================================================================
function openNewAccountModal() {
  var titleEl = document.getElementById('accountModalTitle');
  if (titleEl) titleEl.textContent = 'New Account';
  var n = document.getElementById('f_acc_name'); if (n) n.value = '';
  var cap = document.getElementById('f_acc_capital'); if (cap) cap.value = '';
  var broker = document.getElementById('acc_broker'); if (broker) broker.value = '';
  var txSection = document.getElementById('accTransactionSection');
  if (txSection) txSection.style.display = 'none';
  var txForm = document.getElementById('accTransactionForm');
  if (txForm) txForm.style.display = 'none';
  var saveBtn = document.getElementById('accSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Create Account';
  var delBtn = document.getElementById('accDeleteBtn');
  if (delBtn) delBtn.style.display = 'none';
  editingAccountId = null;
  openModal('accountModal');
}

function openAccountMoney(id) {
  editAccount(id);
  accTransaction('deposit');
}

function editAccount(id) {
  var acc = state.accounts.find(function(a){ return a.id === id; });
  if (!acc) return;
  var titleEl = document.getElementById('accountModalTitle');
  if (titleEl) titleEl.textContent = 'Edit Account';
  var n = document.getElementById('f_acc_name'); if (n) n.value = acc.name || '';
  var cap = document.getElementById('f_acc_capital'); if (cap) cap.value = acc.startingCapital ? parseFloat(acc.startingCapital).toFixed(2) : '';
  var broker = document.getElementById('acc_broker'); if (broker) broker.value = acc.broker || '';

  var txSection = document.getElementById('accTransactionSection');
  if (txSection) txSection.style.display = 'block';
  var txForm = document.getElementById('accTransactionForm');
  if (txForm) txForm.style.display = 'none';
  var saveBtn = document.getElementById('accSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Save Changes';
  var delBtn = document.getElementById('accDeleteBtn');
  if (delBtn) delBtn.style.display = state.accounts.length > 1 ? '' : 'none';
  editingAccountId = id;
  renderTransactionHistory(acc);
  openModal('accountModal');
}

function accTransaction(type) {
  accTransactionType = type;
  var form = document.getElementById('accTransactionForm');
  var lbl = document.getElementById('accTransactionLabel');
  if (form) form.style.display = 'block';
  if (lbl) lbl.textContent = type === 'deposit' ? 'Deposit Amount' : 'Withdraw Amount';
  var inp = document.getElementById('f_acc_transaction');
  if (inp) { inp.value = ''; inp.focus(); }
  var dateInp = document.getElementById('f_acc_tx_date');
  if (dateInp && !dateInp.value) dateInp.value = today();
}

function confirmTransaction() {
  var acc = state.accounts.find(function(a){ return a.id === editingAccountId; });
  if (!acc) return;
  var amt = parseFloat(document.getElementById('f_acc_transaction').value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!acc.transactions) acc.transactions = [];
  var txDateEl = document.getElementById('f_acc_tx_date');
  var txDate = (txDateEl && txDateEl.value) ? txDateEl.value : today();
  acc.transactions.push({id: Date.now().toString(), type: accTransactionType, amount: amt, date: txDate});
  acc.startingCapital = (acc.startingCapital || 0) + (accTransactionType === 'deposit' ? amt : -amt);
  var capEl = document.getElementById('f_acc_capital');
  if (capEl) capEl.value = acc.startingCapital;
  var txForm = document.getElementById('accTransactionForm');
  if (txForm) txForm.style.display = 'none';
  save();
  renderTransactionHistory(acc);
  showToast((accTransactionType === 'deposit' ? 'Deposited' : 'Withdrawn') + ' ' + fmtMoney(amt), 'success');
}

function renderTransactionHistory(acc, showAll) {
  var el = document.getElementById('accTransactionHistory');
  if (!el || !acc.transactions || !acc.transactions.length) {
    if (el) el.innerHTML = '';
    return;
  }
  var sorted = acc.transactions.slice().sort(function(a,b){ return b.date.localeCompare(a.date); });
  var limit = showAll ? sorted.length : 10;
  var visible = sorted.slice(0, limit);
  var hasMore = sorted.length > 10 && !showAll;
  var rows = visible.map(function(tx){
    var color = tx.type === 'deposit' ? 'var(--green)' : 'var(--red)';
    var sign = tx.type === 'deposit' ? '+' : '-';
    var typeLabel = tx.type === 'deposit' ? 'Deposit' : 'Withdraw';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">' +
      '<div style="flex:1">' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text2);font-weight:500">' + typeLabel + '</div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono);margin-top:1px">' + fmtDate(tx.date) + '</div>' +
      '</div>' +
      '<span style="color:' + color + ';font-family:var(--mono);font-weight:700;font-size:calc(13px*var(--fz));margin-right:10px">' + sign + fmtMoney(tx.amount) + '</span>' +
      '<div style="display:flex;gap:4px">' +
        '<button class="icon-btn edit" onclick="editTransaction(&apos;' + eid(tx.id) + '&apos;)" title="Edit" style="width:26px;height:26px">' + icon('edit',13) + '</button>' +
        '<button class="icon-btn del" onclick="deleteTransaction(&apos;' + eid(tx.id) + '&apos;)" title="Delete" style="width:26px;height:26px">' + icon('trash',13) + '</button>' +
      '</div>' +
    '</div>';
  }).join('');
  var seeAllBtn = hasMore
    ? '<button onclick="renderTransactionHistory(state.accounts.find(function(a){return a.id===editingAccountId;}),true)" style="width:100%;margin-top:8px;padding:8px;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;color:var(--blue);font-size:calc(12px*var(--fz));font-weight:600;cursor:pointer">See all ' + sorted.length + ' transactions</button>'
    : (sorted.length > 10 ? '<div style="font-size:calc(12px*var(--fz));color:var(--text3);text-align:center;margin-top:6px;font-family:var(--mono)">Showing all ' + sorted.length + ' transactions</div>' : '');
  el.innerHTML =
    '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);margin-top:12px;margin-bottom:6px">RECENT TRANSACTIONS</div>' +
    rows + seeAllBtn;
}

function deleteTransaction(txId) {
  var acc = state.accounts.find(function(a){ return a.id === editingAccountId; });
  if (!acc || !acc.transactions) return;
  var tx = acc.transactions.find(function(t){ return t.id === txId; });
  if (!tx) return;
  confirmSheet({ title: 'Delete this ' + tx.type + ' of ' + fmtMoney(tx.amount) + '?', ok: 'Delete', danger: true }, function() {
    acc.startingCapital = (acc.startingCapital || 0) + (tx.type === 'deposit' ? -tx.amount : tx.amount);
    acc.transactions = acc.transactions.filter(function(t){ return t.id !== txId; });
    var capEl = document.getElementById('f_acc_capital');
    if (capEl) capEl.value = acc.startingCapital;
    save();
    renderTransactionHistory(acc, false);
    showToast('Transaction deleted', 'success');
  });
}

function editTransaction(txId) {
  var acc = state.accounts.find(function(a){ return a.id === editingAccountId; });
  if (!acc || !acc.transactions) return;
  var tx = acc.transactions.find(function(t){ return t.id === txId; });
  if (!tx) return;
  // Show edit form inline
  var el = document.getElementById('accTransactionHistory');
  if (!el) return;
  // Find the row and replace with edit form
  var editHtml =
    '<div id="txEditForm_' + eid(txId) + '" style="background:var(--surface2);border-radius:8px;padding:12px;margin-top:8px">' +
      '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);margin-bottom:10px">EDIT TRANSACTION</div>' +
      '<div class="field" style="margin-bottom:8px">' +
        '<label style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text2)">Amount</label>' +
        '<input id="txEdit_amt_' + eid(txId) + '" type="number" step="0.01" value="' + parseFloat(tx.amount).toFixed(2) + '" style="background:var(--surface);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:8px;font-size:calc(13px*var(--fz));width:100%">' +
      '</div>' +
      '<div class="field" style="margin-bottom:10px">' +
        '<label style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text2)">Date</label>' +
        '<input id="txEdit_date_' + eid(txId) + '" type="date" value="' + tx.date + '" style="background:var(--surface);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:8px;font-size:calc(13px*var(--fz));width:100%">' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button onclick="saveEditTransaction(&apos;' + eid(txId) + '&apos;)" style="flex:1;padding:8px;background:var(--blue);color:#fff;border:none;border-radius:8px;font-size:calc(13px*var(--fz));font-weight:700;cursor:pointer">Save</button>' +
        '<button onclick="renderTransactionHistory(state.accounts.find(function(a){return a.id===editingAccountId;}),false)" style="flex:1;padding:8px;background:var(--surface3);border:1px solid var(--border2);color:var(--text2);border-radius:8px;font-size:calc(13px*var(--fz));cursor:pointer">Cancel</button>' +
      '</div>' +
    '</div>';
  // Append edit form at bottom of history
  var existing = document.getElementById('txEditForm_' + txId);
  if (existing) { existing.remove(); return; }
  el.insertAdjacentHTML('beforeend', editHtml);
}

function saveEditTransaction(txId) {
  var acc = state.accounts.find(function(a){ return a.id === editingAccountId; });
  if (!acc || !acc.transactions) return;
  var tx = acc.transactions.find(function(t){ return t.id === txId; });
  if (!tx) return;
  var newAmt = parseFloat(document.getElementById('txEdit_amt_' + txId).value);
  var newDate = document.getElementById('txEdit_date_' + txId).value;
  if (!newAmt || newAmt <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!newDate) { showToast('Enter a valid date', 'error'); return; }
  // Adjust capital: remove old effect, apply new
  var oldEffect = tx.type === 'deposit' ? tx.amount : -tx.amount;
  var newEffect = tx.type === 'deposit' ? newAmt : -newAmt;
  acc.startingCapital = (acc.startingCapital || 0) - oldEffect + newEffect;
  tx.amount = newAmt;
  tx.date = newDate;
  var capEl = document.getElementById('f_acc_capital');
  if (capEl) capEl.value = acc.startingCapital;
  save();
  renderTransactionHistory(acc, false);
  showToast('Transaction updated', 'success');
}

function saveAccount() {
  var name = _sname(document.getElementById('f_acc_name').value.trim(), 60);
  if (!name) { showToast('Please enter an account name', 'error'); return; }
  var capital = parseFloat(document.getElementById('f_acc_capital').value) || 0;
  if (editingAccountId) {
    var acc = state.accounts.find(function(a){ return a.id === editingAccountId; });
    if (acc) {
      acc.name = name; acc.startingCapital = capital;
      acc.broker = document.getElementById('acc_broker').value;
    }
  } else {
    var newAcc = {id: 'acc_' + Date.now(), name: name, startingCapital: capital,
      broker: document.getElementById('acc_broker').value,
      transactions: [], createdAt: new Date().toISOString()};
    state.accounts.push(newAcc);
    if (!state.activeAccountId) state.activeAccountId = newAcc.id;
  }
  save(); closeModal('accountModal'); renderSidebar(); renderMain();
  showToast((editingAccountId ? 'Account updated' : 'Account created') + ': ' + name, 'success');
  editingAccountId = null;
}

function deleteAccount(id) {
  if (state.accounts.length <= 1) { showToast('Cannot delete your only account', 'error'); return; }
  confirmSheet({
    title: 'Delete this account and all its trades?',
    body: 'This cannot be undone from the toast. Back up first if you might need this data.',
    ok: 'Delete',
    danger: true,
    extra: '<button class="btn btn-secondary" onclick="closeModal(\'confirmSheet\');backupData()">Back up first</button>'
  }, function() {
    state.accounts = state.accounts.filter(function(a){ return a.id !== id; });
    state.trades = state.trades.filter(function(t){ return t.accountId !== id; });
    if (state.activeAccountId === id) state.activeAccountId = state.accounts[0].id;
    closeModal('accountModal');
    save(); renderSidebar(); renderMain();
    haptic('warning');
    showToast('Account deleted', 'success');
  });
}

function moveAccount(id, dir) {
  var idx = state.accounts.findIndex(function(a){ return a.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.accounts.length) return;

  // Swap in state
  var tmp = state.accounts[idx];
  state.accounts[idx] = state.accounts[newIdx];
  state.accounts[newIdx] = tmp;
  save();
  renderSidebar();

  // Swap DOM elements directly - zero flash, no rebuild
  var list = document.getElementById('accountsListSection');
  if (!list) { renderMain(); return; }
  var cards = list.querySelectorAll('.account-card');
  if (!cards[idx] || !cards[newIdx]) { list.innerHTML = renderAccountsList(); return; }

  var cardA = cards[idx];
  var cardB = cards[newIdx];
  var parent = cardA.parentNode;

  // Animate with CSS transition
  var rectA = cardA.getBoundingClientRect();
  var rectB = cardB.getBoundingClientRect();
  var diff = rectB.top - rectA.top;

  cardA.style.transition = 'transform 0.18s ease';
  cardB.style.transition = 'transform 0.18s ease';
  cardA.style.transform = 'translateY(' + diff + 'px)';
  cardB.style.transform = 'translateY(' + (-diff) + 'px)';

  setTimeout(function() {
    cardA.style.transition = '';
    cardA.style.transform = '';
    cardB.style.transition = '';
    cardB.style.transform = '';
    // Do the actual DOM swap
    if (dir > 0) {
      parent.insertBefore(cardB, cardA);
    } else {
      parent.insertBefore(cardA, cardB);
    }
    // Refresh button states (disabled state for first/last)
    list.innerHTML = renderAccountsList();
  }, 180);
}


// ==========================================================================
// MODAL HELPERS
// ==========================================================================
function fromDetailOpen(action, tradeId) {
  // Store the tradeId so sub-modal cancel can reopen detail
  window._detailReturnId = tradeId;
  closeModal('tradeDetailModal');
  if (action === 'partial') {
    openPartialClose(tradeId);
  } else if (action === 'addbuy') {
    openAddBuy(tradeId);
  } else if (action === 'edit') {
    openTradeModal(tradeId, true);
  }
}

function cancelSubModal(modalId) {
  closeModal(modalId);
  if (window._detailReturnId) {
    var rid = window._detailReturnId;
    window._detailReturnId = null;
    openTradeDetail(rid);
  }
}





function cancelTradeModal() {
  closeModal("tradeModal");
  var wasFromDetail = openedFromDetail;
  var returnId = window._detailReturnId || null;
  editingTradeId = null;
  openedFromDetail = false;
  window._detailReturnId = null;
  if (wasFromDetail && returnId) {
    openTradeDetail(returnId);
  }
}







var _modalStack = [];
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
  if (id && _modalStack.indexOf(id) === -1) _modalStack.push(id);
}
function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
  _modalStack = _modalStack.filter(function(x){ return x !== id; });
}
function openLightboxByRef(tradeId, idx) {
  var t = state.trades.find(function(x){ return x.id === tradeId; });
  var src = t && t.photos && safePhoto(t.photos[idx]);
  if (src) openLightbox(src);
}
function openLightbox(src) { var img = document.getElementById('lightboxImg'); if (img) img.src = src; openModal('lightbox'); }
function closeLightbox() { closeModal('lightbox'); }

var _toastTimer = null;
function showToast(msg, type) {
  var t = document.getElementById('toast');
  var icon = document.getElementById('toastIcon');
  var msgEl = document.getElementById('toastMsg');
  if (!t) return;
  if (icon) icon.innerHTML = type === 'error' ? icon_svg('error') : type === 'success' ? icon_svg('ok') : icon_svg('info');
  if (msgEl) msgEl.textContent = msg;
  t.className = 'toast show ' + (type || '');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ if (t.parentNode) t.classList.remove('show'); }, 2800);
}

// ==========================================================================
// TRADE MODAL
// ==========================================================================
function populateAccountSelector(selectedId) {
  var sel = document.getElementById('f_account');
  if (!sel) return;
  // For new trades: pre-select currently filtered account if viewing a specific one.
  // If viewing "All accounts" or no filter, force user to pick manually (no default).
  var defaultId = selectedId || null;
  if (!defaultId) {
    if (filterAccountId && filterAccountId !== 'all') {
      defaultId = filterAccountId;
    }
  }
  var blankOpt = defaultId ? '' : '<option value="" disabled selected>Select account...</option>';
  sel.innerHTML = blankOpt + state.accounts.map(function(a){
    var isSelected = (defaultId && a.id === defaultId) ? ' selected' : '';
    return '<option value="' + esc(a.id) + '"' + isSelected + '>' + esc(a.name) + '</option>';
  }).join('');
}

var _tickerNames = [];
var _tickerMatches = [];
function populateTickerSuggestions() {
  var seen = {};
  _tickerNames = [];
  state.trades.forEach(function(t){ if (t.ticker && !seen[t.ticker]) { seen[t.ticker] = true; _tickerNames.push(t.ticker); }});
}
function onTickerInput(input) {
  input.value = input.value.toUpperCase();
  var q = input.value.trim();
  var box = document.getElementById('tickerSuggest');
  if (!box) return;
  if (!q) { hideTickerSuggest(); return; }
  var pre = [], inc = [];
  _tickerNames.forEach(function(s){
    if (s === q) return;
    var idx = s.indexOf(q);
    if (idx === 0) pre.push(s); else if (idx > 0) inc.push(s);
  });
  _tickerMatches = pre.concat(inc).slice(0, 8);
  var dym = document.getElementById('didYouMean');
  if (!_tickerMatches.length) {
    hideTickerSuggest();
    var known = _tickerNames.filter(function(s){ return s !== q; });
    var best = null, bestD = 99;
    known.forEach(function(s) {
      var d = tickerDistance(q, s);
      if (d < bestD) { bestD = d; best = s; }
    });
    if (dym) {
      if (best && bestD > 0 && bestD <= 2) {
        dym.style.display = 'block';
        dym.innerHTML = 'Did you mean <a onclick="pickDidYouMean(\'' + esc(best) + '\')">' + esc(best) + '</a>?';
      } else {
        dym.style.display = 'none'; dym.innerHTML = '';
      }
    }
    return;
  }
  if (dym) { dym.style.display = 'none'; dym.innerHTML = ''; }
  var html = '';
  _tickerMatches.forEach(function(s, i){
    html += '<div class="ticker-chip" onmousedown="event.preventDefault()" onclick="pickTickerSuggest(' + i + ')">' + esc(s) + '</div>';
  });
  box.innerHTML = html;
  box.style.display = 'flex';
}
function pickDidYouMean(sym) {
  var el = document.getElementById('f_ticker');
  if (el) el.value = sym;
  var dym = document.getElementById('didYouMean');
  if (dym) { dym.style.display = 'none'; dym.innerHTML = ''; }
}
function pickTickerSuggest(i) {
  var el = document.getElementById('f_ticker');
  if (el && _tickerMatches[i] != null) el.value = _tickerMatches[i];
  hideTickerSuggest();
}
function hideTickerSuggest() {
  var box = document.getElementById('tickerSuggest');
  if (box) { box.style.display = 'none'; box.innerHTML = ''; }
}

function openTradeModal(tradeId, fromDetail) {
  editingTradeId = tradeId || null;
  openedFromDetail = fromDetail === true;
  var _editT = tradeId ? state.trades.find(function(t){ return t.id===tradeId; }) : null;
  pendingPhotos = (_editT && _editT.photos) ? _editT.photos.slice() : [];
  renderPhotoPreviews();
  var ipf = document.getElementById('investedPreviewField'); if (ipf) ipf.style.display = 'none';
  var titleEl = document.getElementById('tradeModalTitle'); if (titleEl) titleEl.textContent = tradeId ? 'Edit Trade' : 'Log New Trade';
  populateAccountSelector(tradeId ? (state.trades.find(function(t){ return t.id===tradeId; })||{}).accountId : null);
  populateTickerSuggestions();
  hideTickerSuggest();
  var f = {ticker:'',type:'',direction:'Long',status:'open',entry_date:today(),exit_date:'',entry:'',exit:'',qty:'',fees:'',fees_mode:'%',risk:'',notes:''};
  if (tradeId) {
    var t = state.trades.find(function(x){ return x.id === tradeId; });
    if (t) { f.ticker=t.ticker||''; f.type=t.type||''; f.direction=t.direction||'Long'; f.status=t.status||'open'; f.entry_date=t.entry_date||today(); f.exit_date=t.exit_date||''; f.entry=t.entry||''; f.exit=t.exit||''; f.qty=t.original_qty||t.qty||''; f.fees=t.fees||''; f.fees_mode=t.fees_mode||'%'; f.risk=t.risk||''; f.notes=t.notes||''; }
  }
  var fields = {f_ticker:'ticker',f_type:'type',f_direction:'direction',f_status:'status',f_entry_date:'entry_date',f_exit_date:'exit_date',f_entry:'entry',f_exit:'exit',f_qty:'qty',f_fees:'fees',f_fees_mode:'fees_mode',f_risk:'risk',f_notes:'notes',f_target:'target',f_stoploss:'stoploss'};
  Object.keys(fields).forEach(function(id){ var el = document.getElementById(id); if (el) el.value = f[fields[id]]; });
  var _td = today();
  var _ed = document.getElementById('f_entry_date'); if (_ed) _ed.max = _td;
  var _xd = document.getElementById('f_exit_date'); if (_xd) _xd.max = _td;
  toggleExitFields(); updateInvestedPreview();
  setTimeout(function(){ renderTemplateButtons(); }, 50);
  openModal('tradeModal');
}

function toggleExitFields() {
  var status = document.getElementById('f_status') ? document.getElementById('f_status').value : 'open';
  var show = status === 'closed' ? '' : 'none';
  var edf = document.getElementById('exitDateField'); if (edf) edf.style.display = show;
  var epf = document.getElementById('exitPriceField'); if (epf) epf.style.display = show;
  var erf = document.getElementById('exitFieldsRow'); if (erf) erf.style.display = show;
}

function updateInvestedPreview() {
  var entry = parseFloat(document.getElementById('f_entry') ? document.getElementById('f_entry').value : 0);
  var qty = parseFloat(document.getElementById('f_qty') ? document.getElementById('f_qty').value : 0);
  var field = document.getElementById('investedPreviewField');
  var val = document.getElementById('investedPreviewVal');
  if (entry > 0 && qty > 0) {
    if (field) field.style.display = '';
    if (val) val.textContent = fmtMoney(entry * qty);
  } else {
    if (field) field.style.display = 'none';
  }
}
function calcInvestedPreview() { updateInvestedPreview(); }

function compressPhoto(file, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX = 1600; var w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
      else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL('image/jpeg', 0.92);
      if (compressed.length > 1100000) compressed = canvas.toDataURL('image/jpeg', 0.85);
      if (compressed.length > 680000) compressed = canvas.toDataURL('image/jpeg', 0.78);
      callback(compressed);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handlePhotoUpload(input) {
  var files = input.files;
  if (!files || !files.length) return;
  for (var i = 0; i < files.length && pendingPhotos.length < 5; i++) {
    (function(file) {
      if (file.size > 5 * 1024 * 1024) { showToast(file.name + ' is larger than 5MB', 'error'); return; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { showToast('Only JPG, PNG, WEBP or GIF images', 'error'); return; }
      compressPhoto(file, function(compressed) {
        if (pendingPhotos.length >= 5) { showToast('Max 5 screenshots', 'error'); return; }
        pendingPhotos.push(compressed);
        renderPhotoPreviews();
      });
    })(files[i]);
  }
  input.value = '';
}
function renderPhotoPreviews() {
  var preview = document.getElementById('photoPreviews');
  if (!preview) return;
  preview.innerHTML = '';
  pendingPhotos.forEach(function(src, idx) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;margin:4px 8px 4px 0';
    var img = document.createElement('img');
    img.src = src;
    img.style.cssText = 'width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid var(--border)';
    var kb = Math.round(src.length * 0.75 / 1024);
    var lbl = document.createElement('div');
    lbl.style.cssText = 'position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:calc(11px*var(--fz));background:rgba(0,0,0,0.6);color:#fff;border-radius:0 0 8px 8px';
    lbl.textContent = kb + 'KB';
    var del = document.createElement('div');
    del.textContent = '\u00D7';
    del.setAttribute('title', 'Remove');
    del.style.cssText = 'position:absolute;top:-7px;right:-7px;width:20px;height:20px;line-height:17px;text-align:center;background:var(--red);color:#fff;border-radius:50%;font-size:calc(15px*var(--fz));font-weight:700;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4);border:1.5px solid #fff';
    del.onclick = function(e){ e.stopPropagation(); removePendingPhoto(idx); };
    wrap.appendChild(img); wrap.appendChild(lbl); wrap.appendChild(del);
    preview.appendChild(wrap);
  });
}
function removePendingPhoto(idx) {
  pendingPhotos.splice(idx, 1);
  renderPhotoPreviews();
}

function saveTradeModal() {
  var ticker = safeTicker(document.getElementById('f_ticker').value);
  var entry = parseFloat(document.getElementById('f_entry').value);
  var qty = parseFloat(document.getElementById('f_qty').value);
  if (!ticker) { showToast('Please enter a symbol/ticker', 'error'); return; }
  if (isNaN(entry) || entry <= 0) { showToast('Please enter a valid entry price', 'error'); return; }
  if (isNaN(qty) || qty <= 0) { showToast('Please enter a valid quantity', 'error'); return; }
  var status = document.getElementById('f_status').value;
  var exit_val = parseFloat(document.getElementById('f_exit').value) || null;
  var fees = parseFloat(document.getElementById('f_fees').value) || 0;
  var fees_mode = document.getElementById('f_fees_mode').value;
  if (status === 'closed' && (!exit_val || exit_val <= 0)) { showToast('Please enter an exit price for closed trade', 'error'); return; }
  var accSel = document.getElementById('f_account');
  var accId = accSel ? accSel.value : "";
  if (!accId) { showToast("Please select an account", "error"); return; }
  var _entryD = document.getElementById('f_entry_date').value;
  var _exitD  = (status === 'closed') ? (document.getElementById('f_exit_date').value || '') : '';
  var _td = today();
  if (_entryD && _entryD > _td) { showToast('Entry date cannot be in the future', 'error'); return; }
  if (_exitD && _exitD > _td) { showToast('Exit date cannot be in the future', 'error'); return; }
  if (_entryD && _exitD && _exitD < _entryD) { showToast('Exit date cannot be before the entry date', 'error'); return; }
  if (editingTradeId) {
    var t = state.trades.find(function(x){ return x.id === editingTradeId; });
    if (t) {
      t.ticker=ticker; t.type=document.getElementById('f_type').value; t.direction=document.getElementById('f_direction').value;
      t.entry_date=document.getElementById('f_entry_date').value; t.entry=entry;
      var _hasHist = (t.add_buys && t.add_buys.length) || (t.partial_closes && t.partial_closes.length);
      if (!_hasHist) { t.original_qty=qty; t.qty=qty; }
      else if (Math.abs((t.original_qty || 0) - qty) > 0.0000001) { showToast('Quantity is locked because this trade has add-buys or partial closes', 'error'); }
      t.fees=fees; t.fees_mode=fees_mode; t.risk=parseFloat(document.getElementById('f_risk').value)||null;
      t.notes=document.getElementById('f_notes').value.trim();
      t.target=parseFloat(document.getElementById('f_target').value)||null;
      t.stoploss=parseFloat(document.getElementById('f_stoploss').value)||null;
      t.photos = pendingPhotos.slice();
      if (status === 'open') { t.status='open'; t.exit=null; t.exit_date=null; }
      else { t.status=status; t.exit=exit_val; t.exit_date=document.getElementById('f_exit_date').value||null; }
      // Auto-fix history dates to stay within entry/exit range
      var newEntryDate = t.entry_date;
      var newExitDate  = t.exit_date;
      if (t.add_buys) {
        t.add_buys.forEach(function(b){
          if (newEntryDate && b.date && b.date < newEntryDate) b.date = newEntryDate;
          if (newExitDate  && b.date && b.date > newExitDate)  b.date = newExitDate;
        });
      }
      if (t.partial_closes) {
        t.partial_closes.forEach(function(pc){
          if (newEntryDate && pc.date && pc.date < newEntryDate) pc.date = newEntryDate;
          if (newExitDate  && pc.date && pc.date > newExitDate)  pc.date = newExitDate;
        });
      }
    }
  } else {
    var newTrade = {
      id: 'tr_' + Date.now(), accountId: accId, ticker: ticker, type: document.getElementById('f_type').value,
      direction: document.getElementById('f_direction').value, status: status,
      entry_date: document.getElementById('f_entry_date').value, exit_date: document.getElementById('f_exit_date').value || null,
      entry: entry, exit: exit_val, qty: qty, original_qty: qty, fees: fees, fees_mode: fees_mode,
      risk: parseFloat(document.getElementById('f_risk').value) || null, notes: document.getElementById('f_notes').value.trim(),
      target: parseFloat(document.getElementById('f_target').value) || null,
      stoploss: parseFloat(document.getElementById('f_stoploss').value) || null,
      photos: pendingPhotos.slice(), add_buys: [], partial_closes: [], createdAt: new Date().toISOString()
    };
    state.trades.unshift(newTrade);
  }
  var wasEditing = editingTradeId;
  var wasFromDetail = openedFromDetail;
  save(); closeModal('tradeModal'); renderSidebar(); renderMain();
  haptic('success');
  showToast((wasEditing ? 'Trade updated' : 'Trade logged') + ': ' + ticker, 'success');
  if (wasEditing && wasFromDetail) {
    var savedId = wasEditing;
    openTradeDetail(savedId);
  }
  editingTradeId = null; openedFromDetail = false; pendingPhotos = [];
}

function deleteTrade(id) {
  var t = state.trades.find(function(x){ return x.id === id; });
  if (!t) return;
  confirmSheet({ title: 'Delete this trade?', body: (t.ticker || 'This trade') + ' and its buys and sells will be removed.', ok: 'Delete', danger: true }, function() { _deleteTrade(id); });
}
function _deleteTrade(id) {
  var idx = state.trades.findIndex(function(t){ return t.id === id; });
  if (idx < 0) return;
  var snap = JSON.parse(JSON.stringify(state.trades[idx]));
  state.trades.splice(idx, 1);
  save(); closeModal('tradeDetailModal'); closeModal('tradeModal');
  renderSidebar(); renderMain();
  haptic('warning');
  showUndoToast('Trade deleted', function() {
    state.trades.splice(idx, 0, snap);
    save(); renderSidebar(); renderMain();
  });
}

// ==========================================================================
// TRADE DETAIL
// ==========================================================================
function openTradeDetail(id) {
  var t = state.trades.find(function(x){ return x.id === id; });
  if (!t) return;
  var pnl = calcPnl(t);
  var st = calcPositionState(t);
  var avg = st.avg;
  var totalBought = calcBoughtQty(t);
  var remainingQty = calcTotalQty(t);
  var invested = calcInvestedValue(t);
  var isOpen = t.status === 'open';
  var dir = t.direction === 'Short' ? -1 : 1;
  var hasPartial = remainingQty > 0 && t.partial_closes && t.partial_closes.length;
  var remStatus = isOpen ? (hasPartial ? 'Partial' : 'Open') : 'Closed';
  var statusCls = remStatus === 'Partial' ? 'b-part' : (remStatus === 'Open' ? 'b-open' : 'b-closed');
  var titleEl = document.getElementById('detailModalTitle');
  if (titleEl) {
    titleEl.innerHTML = '<span class="dt-sym">' + esc(t.ticker) + '</span>' +
      '<span class="badge dt-dir' + (dir < 0 ? ' short' : '') + '">' + (dir < 0 ? 'Short' : 'Long') + '</span>' +
      '<span class="badge ' + statusCls + '">' + remStatus + '</span>';
  }
  var body = document.getElementById('tradeDetailBody');
  if (!body) return;
  var tradeDays = calcTradeDuration(t);
  var dca = calcDcaSummary(t);
  var feeTxt = isOpen
    ? (t.fees_mode === '%' && (parseFloat(t.fees) || 0) > 0 ? fmtPctPlain(t.fees) : fmtMoney(parseFloat(t.fees) || 0))
    : fmtMoney(calcTradeFees(t));
  var priceLink = function(label) {
    return '<button type="button" class="dt-link" onclick="promptDetailPrice(\'' + eid(id) + '\')">' + label + '</button>';
  };

  // Hero: the one number that matters, labelled by what it really is.
  var heroLbl, heroVal = pnl, heroNote = '';
  var realized = calcRealizedPnl(t);
  if (!isOpen) {
    heroLbl = 'Net P&amp;L';
    heroNote = 'Closed' + (t.exit_date ? ' ' + fmtDateLong(t.exit_date) : '') + ' · ' + sharesTxt(totalBought) + ' sold';
  } else if (t.current_price) {
    if (hasPartial) {
      heroLbl = 'Total P&amp;L';
      heroNote = 'Realized ' + fmtPnl(realized) + ' · unrealized ' + fmtPnl(pnl - realized) + ' at ' + fmtPrice(t.current_price) + ' · ' + priceLink('Update price');
    } else {
      heroLbl = 'Unrealized P&amp;L';
      heroNote = sharesTxt(remainingQty) + ' open at ' + fmtPrice(t.current_price) + ' · ' + priceLink('Update price');
    }
  } else if (hasPartial) {
    heroLbl = 'Realized P&amp;L';
    heroNote = sharesTxt(remainingQty) + ' still open · ' + priceLink('Add today’s price') + ' to see unrealized';
  } else {
    heroLbl = 'Unrealized P&amp;L';
    heroVal = null;
    heroNote = priceLink('Add today’s price') + ' to see your P&amp;L';
  }
  var heroColor = heroVal == null ? 'var(--text3)' : pnlColor(heroVal);
  var html = '<div class="dt-hero">' +
    '<div class="dt-lbl">' + heroLbl + '</div>' +
    '<div class="dt-row"><span class="dt-pnl n" style="color:' + heroColor + '">' + (heroVal == null ? '—' : fmtPnl(heroVal)) + '</span>' +
      (heroVal != null && invested > 0 ? '<span class="dt-pct n" style="color:' + heroColor + '">' + fmtPct(heroVal / invested * 100) + '</span>' : '') + '</div>' +
    '<div class="dt-note">' + heroNote + '</div>' +
  '</div>';

  function fact(k, v) {
    var long = String(v).replace(/<[^>]+>/g, '').length > 10;
    return '<div class="fact"><span class="k">' + k + '</span><span class="v' + (long ? ' long' : '') + '">' + v + '</span></div>';
  }
  var heldTxt = tradeDays == null ? '—' : (tradeDays === 0 ? 'Same day' : plural(tradeDays, 'day', 'days'));
  var factsHtml = fact('Avg entry', fmtPrice(avg || dca.avg));
  if (isOpen) {
    factsHtml += fact('Shares left', fmtQty(remainingQty) + ' <small>/ ' + fmtQty(totalBought) + '</small>') +
      fact('Invested', fmtMoney(invested)) +
      fact('Break-even', fmtPrice(dca.breakEven)) +
      fact('Open for', heldTxt) +
      fact('Fees', feeTxt);
  } else {
    factsHtml += fact('Exit price', t.exit ? fmtPrice(t.exit) : '—') +
      fact('Invested', fmtMoney(invested)) +
      fact('Shares', fmtQty(totalBought)) +
      fact('Held for', heldTxt) +
      fact('Fees', feeTxt);
  }
  html += '<div class="facts">' + factsHtml + '</div>';
  if (isOpen) {
    var ts = (t.target || t.stoploss)
      ? '<span class="n">' + (t.target ? fmtPrice(t.target) : '—') + ' / ' + (t.stoploss ? fmtPrice(t.stoploss) : '—') + '</span>'
      : '<button class="setp" onclick="fromDetailOpen(\'edit\',\'' + eid(id) + '\')">+ Add</button>';
    html += '<div class="dt-ts"><span>Target / Stop</span>' + ts + '</div>';
  }

  // History: every buy and sell in date order, with the average after each buy.
  var evs = [{ kind: 'buy', first: true, qty: t.original_qty || t.qty || 0, price: t.entry || 0, date: t.entry_date, ts: 0, seq: 0 }];
  (t.add_buys || []).forEach(function(b){ evs.push({ kind: 'buy', id: b.id, qty: b.qty || 0, price: b.price || 0, date: b.date || t.entry_date, ts: b.ts, seq: 1 }); });
  (t.partial_closes || []).forEach(function(pc){ evs.push({ kind: 'sell', id: pc.id, pc: pc, qty: pc.qty || 0, price: pc.price || 0, date: pc.date, ts: pc.ts, seq: 2 }); });
  evs.sort(function(a, b){
    var ad = a.date || '', bd = b.date || '';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.ts != null && b.ts != null && a.ts !== b.ts) return a.ts - b.ts;
    return a.seq - b.seq;
  });
  var runQty = 0, runCost = 0;
  var rows = evs.map(function(ev){
    var title, meta, amt, amtCls = '';
    if (ev.kind === 'buy') {
      runQty += ev.qty; runCost += ev.qty * ev.price;
      title = fmtQty(ev.qty) + ' @ ' + fmtPrice(ev.price);
      meta = ev.first ? 'entry' : 'avg now ' + fmtPrice(runQty ? runCost / runQty : 0);
      amt = fmtMoney(ev.qty * ev.price);
    } else {
      var basis = ev.pc.basis != null ? ev.pc.basis : (ev.pc._ledgerBasis != null ? ev.pc._ledgerBasis : (runQty ? runCost / runQty : avg));
      var gross = (ev.price - basis) * ev.qty * dir;
      var net = gross - calcFeesAmt(ev.pc.fees, ev.pc.fees_mode, gross);
      var q = Math.min(ev.qty, runQty);
      runCost -= basis * q; runQty -= q;
      title = fmtQty(ev.qty) + ' @ ' + fmtPrice(ev.price);
      meta = runQty > 0.0001 ? 'partial close · ' + fmtQty(runQty) + ' left' : 'all shares sold';
      amt = fmtPnl(net); amtCls = ' style="color:' + pnlColor(net) + ';font-weight:600"';
    }
    return tlRow(ev.kind, title, (ev.date ? fmtDateLong(ev.date) + ' · ' : '') + meta, amt, amtCls, ev.id ? evDelBtn(ev.kind === 'buy' ? 'deleteAddBuy' : 'deletePartialClose', id, ev.id) : '');
  });
  if (!isOpen && st.qty > 0.0001 && t.exit) {
    var fGross = (t.exit - st.avg) * st.qty * dir;
    var fNet = fGross - calcFeesAmt(t.fees, t.fees_mode, fGross);
    rows.push(tlRow('sell', fmtQty(st.qty) + ' @ ' + fmtPrice(t.exit), (t.exit_date ? fmtDateLong(t.exit_date) + ' · ' : '') + 'closed', fmtPnl(fNet), ' style="color:' + pnlColor(fNet) + ';font-weight:600"', ''));
  }
  html += '<div><div class="cap" style="margin-bottom:12px">History</div><div class="tl">' + rows.join('') + '</div></div>';

  if (remainingQty > 0 && evs.length > 1) {
    var feeVal = parseFloat(t.fees) || 0;
    var hint;
    if (t.fees_mode === '$' && feeVal > 0) {
      hint = 'Break-even <b class="n">' + fmtPrice(dca.breakEven) + '</b> with fees. Sell above it to profit' + (hasPartial ? ' on the ' + fmtQty(remainingQty) + ' shares left' : '');
    } else {
      hint = 'Sell above <b class="n">' + fmtPrice(dca.avg) + '</b> to profit' + (hasPartial ? ' on the ' + fmtQty(remainingQty) + ' shares left' : '');
    }
    html += '<div class="hint">' + cicon('bulb',16,'var(--gold)') + '<span>' + hint + '</span></div>';
  }
  if (t.notes) html += '<div class="dt-notes">' + esc(t.notes) + '</div>';
  if (t.photos && t.photos.length) {
    html += '<div><div class="cap" style="margin-bottom:8px">Screenshots</div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      t.photos.map(function(p, _pi){ var sp = safePhoto(p); return sp ? '<img src="' + sp + '" style="width:100px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border2);cursor:pointer" onclick="openLightboxByRef(\'' + esc(t.id) + '\',' + _pi + ')">' : ''; }).join('') +
      '</div></div>';
  }
  body.innerHTML = html;
  var footer = document.getElementById('tradeDetailFooter');
  if (footer) {
    footer.className = 'modal-footer acts';
    footer.innerHTML =
      (isOpen ? '<button class="act g" onclick="fromDetailOpen(\'partial\',\'' + eid(id) + '\')">' + icon('check',16) + 'Close</button>' : '') +
      (isOpen ? '<button class="act" onclick="fromDetailOpen(\'addbuy\',\'' + eid(id) + '\')">' + icon('plus',16) + 'Buy more</button>' : '') +
      '<button class="act" onclick="fromDetailOpen(\'edit\',\'' + eid(id) + '\')">' + icon('edit',16) + 'Edit</button>' +
      '<button class="act del" aria-label="Delete trade" onclick="deleteTrade(\'' + eid(id) + '\')">' + icon('trash',18) + '</button>';
  }
  openModal('tradeDetailModal');
}

function sharesTxt(n) {
  return fmtQty(n) + (n === 1 ? ' share' : ' shares');
}

function tlRow(kind, title, meta, amt, amtAttr, delBtn) {
  return '<div class="tl-ev">' +
    '<span class="tl-dot' + (kind === 'sell' ? ' sell' : '') + '"></span>' +
    '<div class="tl-main"><div class="tl-t"><span class="badge tl-b ' + kind + '">' + (kind === 'sell' ? 'SELL' : 'BUY') + '</span><span class="n">' + title + '</span></div><div class="tl-m n">' + meta + '</div></div>' +
    '<span class="tl-amt n"' + (amtAttr || '') + '>' + amt + delBtn + '</span>' +
  '</div>';
}

function promptDetailPrice(id) {
  var t = state.trades.find(function(x){ return x.id === id; });
  promptSheet('Current price', 'Today’s price for ' + (t ? t.ticker : 'this trade'), t && t.current_price ? String(t.current_price) : '', function(val) {
    if (val == null) return;
    setCurrentPrice(id, val);
    renderMain();
    openTradeDetail(id);
  });
}

function evDelBtn(fn, tradeId, rowId) {
  if (!rowId) return '';
  return '<button type="button" aria-label="Remove" onclick="' + fn + '(\'' + esc(tradeId) + '\',\'' + esc(rowId) + '\')" style="width:22px;height:22px;border:none;background:none;color:var(--text3);display:inline-flex;align-items:center;justify-content:center;padding:0">' + icon('trash',12) + '</button>';
}

function deleteAddBuy(tradeId, buyId) {
  confirmSheet({ title: 'Remove this added position?', ok: 'Remove', danger: true }, function() {
    var t = state.trades.find(function(x){ return x.id === tradeId; });
    if (!t || !t.add_buys) return;
    t.add_buys = t.add_buys.filter(function(b){ return b.id !== buyId; });
    save(); closeModal('tradeDetailModal'); renderSidebar(); renderMain();
    showToast('Position removed', 'success');
    openTradeDetail(tradeId);
  });
}

function deletePartialClose(tradeId, pcId) {
  confirmSheet({ title: 'Remove this partial close?', ok: 'Remove', danger: true }, function() {
    _doDeletePartialClose(tradeId, pcId);
  });
}
function _doDeletePartialClose(tradeId, pcId) {
  var t = state.trades.find(function(x){ return x.id === tradeId; });
  if (!t || !t.partial_closes) return;
  t.partial_closes = t.partial_closes.filter(function(pc){ return pc.id !== pcId; });
  var remQty = calcTotalQty(t);
  if (remQty > 0) { t.status = 'open'; t.exit = null; t.exit_date = null; }
  save(); closeModal('tradeDetailModal'); renderSidebar(); renderMain();
  showToast('Partial close removed', 'success');
}

// ==========================================================================
// PARTIAL CLOSE
// ==========================================================================
function openPartialClose(id) {
  partialCloseTargetId = id;
  var t = state.trades.find(function(x){ return x.id === id; });
  if (!t) return;
  var remQty = calcTotalQty(t);
  var avg = calcPositionState(t).avg;
  var titleEl = document.getElementById('partialCloseTitle');
  if (titleEl) titleEl.textContent = 'Close / Partial Close — ' + t.ticker;
  var infoEl = document.getElementById('partialCloseInfo');
  if (infoEl) infoEl.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<div style="display:flex;gap:20px">' +
        '<span><div style="color:var(--text3);font-size:calc(12px*var(--fz));font-family:var(--mono)">REMAINING</div><strong style="font-family:var(--mono);font-size:calc(16px*var(--fz))">' + fmtQty(remQty) + '</strong></span>' +
        '<span><div style="color:var(--text3);font-size:calc(12px*var(--fz));font-family:var(--mono)">AVG ENTRY</div><strong style="font-family:var(--mono);font-size:calc(16px*var(--fz))">' + fmtPrice(avg) + '</strong></span>' +
      '</div>' +
      '<button onclick="fillAllShares(' + remQty + ')" style="padding:6px 12px;background:var(--surface3);color:var(--text2);border:1px solid var(--border2);border-radius:8px;font-size:calc(12px*var(--fz));font-weight:600;cursor:pointer;white-space:nowrap">Select All</button>' +
    '</div>';
  ['pc_qty','pc_price','pc_date','pc_fees'].forEach(function(fid){
    var el = document.getElementById(fid);
    if (el) el.value = fid === 'pc_date' ? today() : '';
  });
  var _pcd = document.getElementById('pc_date');
  if (_pcd) { _pcd.max = today(); var _t = state.trades.find(function(x){ return x.id === partialCloseTargetId; }); if (_t && _t.entry_date) _pcd.min = _t.entry_date; }
  var pcFees = document.getElementById('pc_fees_mode'); if (pcFees) pcFees.value = '%';
  openModal('partialCloseModal');
}

function fillAllShares(qty) {
  var el = document.getElementById('pc_qty');
  if (el) { el.value = qty; el.focus(); updatePartialPreview(); }
}

function updatePartialPreview() {
  var qty   = parseFloat(document.getElementById('pc_qty') ? document.getElementById('pc_qty').value : 0) || 0;
  var price = parseFloat(document.getElementById('pc_price') ? document.getElementById('pc_price').value : 0) || 0;
  var prev  = document.getElementById('partialPreview');
  if (!prev || !qty || !price || !partialCloseTargetId) { if (prev) prev.innerHTML = ''; return; }
  var t = state.trades.find(function(x){ return x.id === partialCloseTargetId; });
  if (!t) return;
  var avg = calcPositionState(t).avg;
  var dir = t.direction === 'Long' ? 1 : -1;
  var gross = (price - avg) * qty * dir;
  var fees = parseFloat(document.getElementById('pc_fees') ? document.getElementById('pc_fees').value : 0) || 0;
  var fmode = document.getElementById('pc_fees_mode') ? document.getElementById('pc_fees_mode').value : '%';
  var feeAmt = calcFeesAmt(fees, fmode, gross);
  var net = gross - feeAmt;
  prev.innerHTML = '<div class="calc-result-box" style="padding:10px 14px;margin-top:0">' +
    '<div class="calc-result-row" style="padding:3px 0"><span class="calc-result-label">Gross P&L</span><span class="calc-result-value" style="color:' + pnlColor(gross) + '">' + fmtPnl(gross) + '</span></div>' +
    '<div class="calc-result-row" style="padding:3px 0"><span class="calc-result-label">Fees</span><span class="calc-result-value" style="color:var(--red)">-' + fmtMoney(Math.abs(feeAmt)) + '</span></div>' +
    '<div class="calc-result-row" style="padding:3px 0"><span class="calc-result-label">Net P&L</span><span class="calc-result-value" style="color:' + pnlColor(net) + ';font-size:calc(16px*var(--fz));font-weight:700">' + fmtPnl(net) + '</span></div>' +
  '</div>';
}

function savePartialClose() {
  var t = state.trades.find(function(x){ return x.id === partialCloseTargetId; });
  if (!t) return;
  var qty   = parseFloat(document.getElementById('pc_qty').value);
  var price = parseFloat(document.getElementById('pc_price').value);
  var date  = document.getElementById('pc_date').value;
  var fees  = document.getElementById('pc_fees').value;
  var fmode = document.getElementById('pc_fees_mode') ? document.getElementById('pc_fees_mode').value : '%';
  if (!qty || !price || qty <= 0) { showToast('Enter valid qty and price', 'error'); return; }
  if (!date) { showToast('Select an exit date', 'error'); return; }
  if (date > today()) { showToast('Exit date cannot be in the future', 'error'); return; }
  if (t.entry_date && date < t.entry_date) { showToast('Exit date cannot be before the entry date', 'error'); return; }
  var remQty = calcTotalQty(t);
  if (qty > remQty + 0.0001) { showToast('Qty exceeds remaining ' + remQty, 'error'); return; }
  if (!t.partial_closes) t.partial_closes = [];
  t.partial_closes.push({id: Date.now().toString(), ts: Date.now(), qty: qty, price: price, date: date, fees: fees||'0', fees_mode: fmode, basis: calcPositionState(t).avg});
  var newRem = calcTotalQty(t);
  var fullyClosed = newRem <= 0.0001;
  if (fullyClosed) { t.status = 'closed'; t.exit = price; t.exit_date = date; t.qty = 0; }
  else { t.status = 'open'; t.qty = newRem; }
  save(); closeModal('partialCloseModal'); closeModal('tradeDetailModal'); window._detailReturnId = null;
  renderSidebar(); renderMain();
  var pcId = partialCloseTargetId;
  if (pcId) { openTradeDetail(pcId); }
  haptic('success');
  showToast(fullyClosed ? 'Trade closed' : 'Partial close saved', 'success');
}

// ==========================================================================
// ADD POSITION
// ==========================================================================
function updateAddBuyPreview() {
  var box = document.getElementById('addBuyPreview');
  if (!box) return;
  var t = state.trades.find(function(x){ return x.id === addBuyTargetId; });
  var qty = parseFloat(document.getElementById('ab_qty').value);
  var price = parseFloat(document.getElementById('ab_price').value);
  if (!t || !qty || !price || qty <= 0 || price <= 0) { box.innerHTML = ''; return; }
  var st = calcPositionState(t);
  var curCost = st.cost, curQty = st.qty;
  var newQty = curQty + qty;
  var newAvg = (curCost + price * qty) / newQty;
  var oldAvg = curQty > 0 ? curCost / curQty : t.entry;
  var arrow = newAvg < oldAvg ? '▼' : (newAvg > oldAvg ? '▲' : '=');
  var col = newAvg < oldAvg ? 'var(--green)' : (newAvg > oldAvg ? 'var(--red)' : 'var(--text2)');
  box.innerHTML = '<div style="background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;font-size:calc(12px*var(--fz));color:var(--text2)">' +
    'New avg: <b style="color:' + col + ';font-family:var(--mono)">' + fmtPrice(newAvg) + ' ' + arrow + '</b>' +
    ' &nbsp;·&nbsp; Total: <b style="font-family:var(--mono);color:var(--text)">' + fmtQty(newQty) + '</b> shares</div>';
}
function openAddBuy(id) {
  addBuyTargetId = id;
  var t = state.trades.find(function(x){ return x.id === id; });
  if (!t) return;
  var avg = calcPositionState(t).avg;
  var totalQty = calcTotalQty(t);
  var titleEl = document.getElementById('addBuyTitle');
  if (titleEl) titleEl.textContent = 'Add Position — ' + t.ticker;
  var infoEl = document.getElementById('addBuyInfo');
  if (infoEl) infoEl.innerHTML =
    '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<span><span style="color:var(--text3);font-size:calc(12px*var(--fz))">Current Qty</span><br><strong style="font-family:var(--mono)">' + totalQty + '</strong></span>' +
      '<span><span style="color:var(--text3);font-size:calc(12px*var(--fz))">Avg Entry</span><br><strong style="font-family:var(--mono)">' + fmtPrice(avg) + '</strong></span>' +
    '</div>';
  ['ab_qty','ab_price','ab_fees'].forEach(function(fid){ var el = document.getElementById(fid); if (el) el.value = ''; });
  var _abp = document.getElementById('addBuyPreview'); if (_abp) _abp.innerHTML = '';
  var abd = document.getElementById('ab_date'); if (abd) abd.value = today();
  openModal('addBuyModal');
}

function saveAddBuy() {
  var t = state.trades.find(function(x){ return x.id === addBuyTargetId; });
  if (!t) return;
  var qty   = parseFloat(document.getElementById('ab_qty').value);
  var price = parseFloat(document.getElementById('ab_price').value);
  var date  = document.getElementById('ab_date') ? document.getElementById('ab_date').value : today();
  var fees  = document.getElementById('ab_fees') ? document.getElementById('ab_fees').value : '0';
  if (!qty || !price || qty <= 0) { showToast('Enter valid qty and price', 'error'); return; }
  if (!t.add_buys) t.add_buys = [];
  t.add_buys.push({id: Date.now().toString(), ts: Date.now(), qty: qty, price: price, date: date, fees: fees||'0', fees_mode: '$'});
  save(); closeModal('addBuyModal'); closeModal('tradeDetailModal'); window._detailReturnId = null;
  renderSidebar(); renderMain();
  var abId = addBuyTargetId;
  if (abId) { openTradeDetail(abId); }
  haptic('success');
  showToast('Position updated', 'success');
}

// ==========================================================================
// EXPORT / REPORT
// ==========================================================================
function openReportModal() {
  // Populate account select
  var sel = document.getElementById('rep_account');
  if (sel) {
    sel.innerHTML = '<option value="all">All Accounts</option>';
    state.accounts.forEach(function(a){
      var opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.name;
      if (filterAccountId === a.id) opt.selected = true;
      sel.appendChild(opt);
    });
  }
  // Set default date range - last 30 days to today
  var to = today();
  var from = new Date(); from.setDate(from.getDate() - 30);
  var fromStr = localDateStr(from);
  var fromEl = document.getElementById('rep_from');
  var toEl = document.getElementById('rep_to');
  if (fromEl) fromEl.value = fromStr;
  if (toEl) toEl.value = to;
  updateReportPreview();
  openModal('reportModal');
}

function getReportTrades() {
  var accId = document.getElementById('rep_account') ? document.getElementById('rep_account').value : 'all';
  var from  = document.getElementById('rep_from')    ? document.getElementById('rep_from').value    : '';
  var to    = document.getElementById('rep_to')      ? document.getElementById('rep_to').value      : '';
  var trades = accId === 'all' ? state.trades : state.trades.filter(function(t){ return t.accountId === accId; });
  if (from) trades = trades.filter(function(t){ return t.entry_date >= from; });
  if (to)   trades = trades.filter(function(t){ return t.entry_date <= to; });
  return trades;
}

function updateReportPreview() {
  var trades  = getReportTrades();
  var closed  = trades.filter(function(t){ return t.status === 'closed'; });
  var netPnl  = trades.reduce(function(s,t){ return s + calcRealizedTotal(t); }, 0);
  var wins    = closed.filter(isWin).length;
  var wr      = closed.length ? fmtWinRate(wins / closed.length * 100) : '—';
  var invested = trades.reduce(function(s,t){ return s + calcInvestedValue(t); }, 0);
  var realCost = trades.reduce(function(s,t){ return s + calcRealizedCost(t); }, 0);
  var pct     = realCost > 0 ? fmtPct(netPnl / realCost * 100) + ' on closed' : 'Nothing closed yet';
  var el = document.getElementById('reportPreviewStats');
  if (!el) return;
  el.innerHTML =
    '<div class="stat-card" style="--accent:var(--blue)"><div class="stat-label">Trades</div><div class="stat-value" style="color:var(--blue);font-size:calc(17px*var(--fz))">' + trades.length + '</div></div>' +
    '<div class="stat-card" style="--accent:' + pnlColor(netPnl) + '"><div class="stat-label">Net P&L</div><div class="stat-value" style="color:' + pnlColor(netPnl) + ';font-size:calc(16px*var(--fz))">' + fmtPnl(netPnl) + '</div><div class="stat-sub" style="color:' + pnlColor(netPnl) + '">' + pct + '</div></div>' +
    '<div class="stat-card" style="--accent:var(--blue)"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:var(--blue);font-size:calc(17px*var(--fz))">' + wr + '</div><div class="stat-sub">' + closed.length + ' closed</div></div>' +
    '<div class="stat-card" style="--accent:var(--purple)"><div class="stat-label">Invested</div><div class="stat-value" style="color:var(--purple);font-size:calc(14px*var(--fz))">' + fmtMoney(invested) + '</div></div>';
}

function _b64ToBlob(b64, mime) {
  var bin = atob(b64); var len = bin.length; var bytes = new Uint8Array(len);
  for (var i=0;i<len;i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], {type: mime || 'application/octet-stream'});
}
function saveFileSmart(filename, base64, mime) {
  var Cap = window.Capacitor;
  var native = Cap && Cap.Plugins && Cap.Plugins.Filesystem;
  if (native) {
    var FS = Cap.Plugins.Filesystem;
    var Sh = Cap.Plugins.Share;
    FS.writeFile({ path: filename, data: base64, directory: 'CACHE' })
      .then(function(res){
        if (Sh) { return Sh.share({ title: filename, url: res.uri, dialogTitle: 'Save or share ' + filename }); }
        showToast('Saved to app storage', 'success');
      })
      .catch(function(e){
        var msg = (e && e.message) ? String(e.message).toLowerCase() : '';
        if (msg.indexOf('cancel') === -1 && msg.indexOf('abort') === -1 && msg.indexOf('dismiss') === -1) {
          showToast('Save failed: ' + (e && e.message ? e.message : 'unknown'), 'error');
        }
      });
  } else {
    try {
      var url = URL.createObjectURL(_b64ToBlob(base64, mime));
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Saved: ' + filename, 'success');
    } catch(e){ showToast('Download failed: ' + e.message, 'error'); }
  }
}
function exportExcel() {
  if (typeof XLSX === 'undefined') { showToast('Excel library not loaded — connect to internet first', 'error'); return; }
  var pnlHdr = 'Net P&L' + (currCode() === 'NONE' ? '' : ' (' + currCode() + ')');
  var trades = getReportTrades ? getReportTrades() : state.trades;
  if (!trades.length) { showToast('No trades to export', 'error'); return; }
  var rows = trades.map(function(t){
    var pnl = calcRealizedTotal(t);
    var inv = calcInvestedValue(t);
    var pct = inv > 0 ? parseFloat((pnl/inv*100).toFixed(2)) : 0;
    return {
      Symbol: t.ticker,
      Direction: t.direction,
      Type: t.type||'',
      Status: t.status,
      'Entry Date': t.entry_date||'',
      'Exit Date': t.exit_date||'',
      'Entry Price': parseFloat((t.entry||0).toFixed(4)),
      'Exit Price': t.exit ? parseFloat(parseFloat(t.exit).toFixed(4)) : '',
      'Avg Entry': parseFloat(calcAvgPrice(t).toFixed(4)),
      Qty: calcBoughtQty(t),
      Invested: parseFloat(calcInvestedValue(t).toFixed(2)),
      Fees: t.fees_mode === '%' ? (t.fees||0) + '%' : currSym() + (t.fees||0),
      [pnlHdr]: parseFloat(pnl.toFixed(2)),
      'P&L (%)': pct,
      Notes: t.notes||''
    };
  });
  // Summary row
  var totalPnl = trades.reduce(function(s,t){ return s+calcRealizedTotal(t); },0);
  var totalInv = trades.reduce(function(s,t){ return s+calcInvestedValue(t); },0);
  var totalRealCost = trades.reduce(function(s,t){ return s+calcRealizedCost(t); },0);
  var closed = trades.filter(function(t){ return t.status==='closed'; });
  var wins = closed.filter(isWin).length;

  var ws = XLSX.utils.json_to_sheet(rows);
  // Add summary below trades
  var summaryStart = trades.length + 3;
  XLSX.utils.sheet_add_aoa(ws, [
    ['SUMMARY'],
    ['Total Trades', trades.length],
    ['Closed Trades', closed.length],
    ['Winning Trades', wins],
    ['Win Rate', closed.length ? (wins/closed.length*100).toFixed(1)+'%' : '—'],
    ['Total Invested', parseFloat(totalInv.toFixed(2))],
    [pnlHdr, parseFloat(totalPnl.toFixed(2))],
    ['Net P&L (%) on closed', totalRealCost > 0 ? parseFloat((totalPnl/totalRealCost*100).toFixed(2)) : 0]
  ], {origin: {r: summaryStart, c: 0}});

  // Style header row
  var range = XLSX.utils.decode_range(ws['!ref']);
  ws['!cols'] = [{wch:10},{wch:10},{wch:12},{wch:8},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:8},{wch:12},{wch:10},{wch:12},{wch:10},{wch:20}];

  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trades');
  var date = today();
  var b64 = XLSX.write(wb, {type:'base64', bookType:'xlsx'});
  saveFileSmart('edgeory-report-' + date + '.xlsx', b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  closeModal('reportModal');
}

function exportPDF() {
  var jsPDFLib = (window.jspdf || window.jsPDF);
  if (!jsPDFLib) { showToast('PDF library not loaded — open from GitHub Pages', 'error'); return; }
  var jsPDF = jsPDFLib.jsPDF;
  var trades = getReportTrades ? getReportTrades() : state.trades;
  if (!trades.length) { showToast('No trades to export', 'error'); return; }

  var doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
  var pageW = 297; var margin = 10;

  // Account and date info
  var accName = (function(){
    var sel = document.getElementById('rep_account');
    if (!sel || sel.value === 'all') return 'All Accounts';
    var acc = state.accounts.find(function(a){ return a.id === sel.value; });
    return acc ? acc.name : 'All Accounts';
  })();
  var from = document.getElementById('rep_from') ? document.getElementById('rep_from').value : '';
  var to   = document.getElementById('rep_to')   ? document.getElementById('rep_to').value   : '';
  var dateRange = (from && to) ? from + ' to ' + to : today();

  // Summary stats
  var totalPnl = trades.reduce(function(s,t){ return s + calcRealizedTotal(t); }, 0);
  var totalInv = trades.reduce(function(s,t){ return s + calcInvestedValue(t); }, 0);
  var closed   = trades.filter(function(t){ return t.status === 'closed'; });
  var wins     = closed.filter(isWin).length;
  var wr       = closed.length ? (wins / closed.length * 100).toFixed(1) : '0.0';
  var totalRealCost = trades.reduce(function(s, t){ return s + calcRealizedCost(t); }, 0);
  var pct      = totalRealCost > 0 ? (totalPnl / totalRealCost * 100).toFixed(2) : '0.00';

  // ── Title ──
  doc.setFontSize(16); doc.setFont(undefined, 'bold');
  doc.text(APP_NAME + ' — Trading Report', margin, 14);
  doc.setFontSize(8); doc.setFont(undefined, 'normal');
  doc.text('Account: ' + accName + '   |   Period: ' + dateRange + '   |   Generated: ' + today(), margin, 20);

  // ── Summary row ──
  doc.setFontSize(8);
  var summaryItems = [
    'Total Trades: ' + trades.length,
    'Closed: ' + closed.length,
    'Win Rate: ' + wr + '%',
    'Net P&L: ' + (totalPnl >= 0 ? '+' : '') + currSym() + fmtReportNum(totalPnl),
    'P&L % on closed: ' + (totalPnl >= 0 ? '+' : '') + pct + '%',
    'Invested: ' + currSym() + fmtReportNum(totalInv)
  ];
  summaryItems.forEach(function(s, i) {
    doc.text(s, margin + (i % 3) * 90, 28 + Math.floor(i / 3) * 6);
  });

  // ── Table ──
  var cs = currSym();
  var cols = ['Symbol','Dir','Status','Entry Date','Exit Date','Entry' + (cs ? ' $' : ''), 'Exit' + (cs ? ' $' : ''),'Qty','Invested','Fees','Net P&L','P&L%'];
  var colW  = [22, 14, 16, 24, 24, 20, 20, 20, 22, 16, 22, 16];
  var startY = 44;
  var rowH = 7;

  // Header — draw all rects first, then all text on top to prevent overdraw
  doc.setFontSize(7); doc.setFont(undefined, 'bold');
  var x = margin;
  // Pass 1: fill all header cell backgrounds
  doc.setFillColor(77, 159, 255);
  for (var hi = 0; hi < cols.length; hi++) {
    doc.rect(x, startY, colW[hi], rowH, 'F');
    x += colW[hi];
  }
  // Pass 2: draw header text on top of all fills
  doc.setTextColor(255, 255, 255);
  x = margin;
  for (var hi2 = 0; hi2 < cols.length; hi2++) {
    doc.text(cols[hi2], x + 1.5, startY + 4.5);
    x += colW[hi2];
  }

  // Rows
  doc.setFont(undefined, 'normal');
  var y = startY + rowH;
  trades.forEach(function(t, ri) {
    var pnl = calcRealizedTotal(t);
    var inv = calcInvestedValue(t);
    var pctRow = inv > 0 ? (pnl >= 0 ? '+' : '') + (pnl / inv * 100).toFixed(2) + '%' : '—';
    var rowData = [
      t.ticker,
      t.direction,
      t.status,
      t.entry_date || '',
      t.exit_date || '—',
      currSym() + fmtReportNum(parseFloat(t.entry || 0)),
      t.exit ? currSym() + fmtReportNum(parseFloat(t.exit)) : '—',
      fmtReportQty(calcBoughtQty(t)),
      currSym() + fmtReportNum(calcInvestedValue(t)),
      t.fees_mode === '%' ? (t.fees || 0) + '%' : currSym() + (t.fees || 0),
      (pnl >= 0 ? '+' : '-') + currSym() + fmtReportNum(Math.abs(pnl)),
      pctRow
    ];

    // Alternate row background
    if (ri % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(margin, y, colW.reduce(function(a,b){ return a+b; }, 0), rowH, 'F');
    }

    x = margin;
    rowData.forEach(function(cell, i) {
      // Color P&L column
      if (i === 10 || i === 11) {
        if (cell.indexOf('+') === 0) { doc.setTextColor(0, 150, 80); }
        else if (cell.indexOf('-') === 0) { doc.setTextColor(200, 50, 50); }
        else { doc.setTextColor(60, 60, 60); }
      } else {
        doc.setTextColor(60, 60, 60);
      }
      doc.setFontSize(7);
      doc.text(String(cell), x + 1.5, y + 4.5);
      x += colW[i];
    });

    // Draw row border
    doc.setDrawColor(220, 220, 220);
    doc.setTextColor(60, 60, 60);
    y += rowH;

    // New page if needed — repeat header on new page
    if (y > 190) {
      doc.addPage();
      y = 14;
      // Redraw column headers on new page
      doc.setFontSize(7); doc.setFont(undefined, 'bold');
      var nx = margin;
      doc.setFillColor(77, 159, 255);
      for (var nhi = 0; nhi < cols.length; nhi++) {
        doc.rect(nx, y, colW[nhi], rowH, 'F');
        nx += colW[nhi];
      }
      doc.setTextColor(255, 255, 255);
      nx = margin;
      for (var nhi2 = 0; nhi2 < cols.length; nhi2++) {
        doc.text(cols[nhi2], nx + 1.5, y + 4.5);
        nx += colW[nhi2];
      }
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      y += rowH;
    }
  });

  // ── Footer branding on every page ──
  var totalPages = doc.internal.getNumberOfPages();
  doc.setFont(undefined, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  for (var p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.text('Generated by ' + APP_NAME, pageW / 2, 203, {align: 'center'});
    doc.text('Page ' + p + ' of ' + totalPages, pageW - margin, 203, {align: 'right'});
  }

  var date = today();
  var b64 = doc.output('datauristring').split('base64,').pop();
  saveFileSmart('edgeory-report-' + date + '.pdf', b64, 'application/pdf');
  closeModal('reportModal');
}


// ==========================================================================
// BACKUP & RESTORE
// ==========================================================================
function getBackupSizeKB(includePhotos) {
  try {
    var st = includePhotos ? state : stripPhotos(state);
    return Math.round(JSON.stringify(st).length * 0.75 / 1024);
  } catch(e) { return 0; }
}
function stripPhotos(stateObj) {
  var copy = JSON.parse(JSON.stringify(stateObj));
  copy.trades.forEach(function(t){ t.photos = []; });
  return copy;
}
function downloadBackup(includePhotos) {
  try {
    var stateToSave = includePhotos ? state : stripPhotos(state);
    var lsGet = function(k){ try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch(e){ return localStorage.getItem(k); } };
    var backup = {version:'tl_v3', schemaVersion:3, date:new Date().toISOString(), includesPhotos:includePhotos, state:stateToSave,
      savedCalcs:{pos:JSON.parse(localStorage.getItem('tl_pos_calcs')||'[]'),comp:JSON.parse(localStorage.getItem('tl_comp_calcs')||'[]'),avg:JSON.parse(localStorage.getItem('tl_avg_calcs')||'[]')},
      journals: lsGet('tl_journals'), templates: lsGet('tl_templates'), profile: lsGet('tl_profile'),
      benchmark: lsGet('tl_benchmark'), prefs: {theme: localStorage.getItem('tl_theme'), font: normalizeFontSize(localStorage.getItem('tl_font')), showCurrency: localStorage.getItem('tl_show_currency'), currency: currCode()}};
    var json = JSON.stringify(backup, null, 2);
    var date = localDateStr(new Date());
    var b64 = btoa(unescape(encodeURIComponent(json)));
    saveFileSmart('edgeory-backup-' + (includePhotos?'full':'trades') + '-' + date + '.json', b64, 'application/json');
    try { localStorage.setItem('tl_last_backup', date); } catch(e2) {}
  } catch(e) { showToast('Backup failed: ' + e.message, 'error'); }
}
function backupData() {
  var fullKB = getBackupSizeKB(true); var tradesKB = getBackupSizeKB(false);
  var fullMB = fullKB > 1024 ? (fullKB/1024).toFixed(1)+' MB' : fullKB+' KB';
  var tradesMB = tradesKB > 1024 ? (tradesKB/1024).toFixed(1)+' MB' : tradesKB+' KB';
  var modal = document.getElementById('backupModal');
  if (!modal) {
    modal = document.createElement('div'); modal.id = 'backupModal'; modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal" style="max-width:340px"><div class="modal-header"><div class="modal-title">Backup Data</div><button class="icon-btn" onclick="closeModal(\'backupModal\')"><svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div><div class="modal-body" id="backupModalBody"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById('backupModalBody').innerHTML =
    '<p style="color:var(--text2);font-size:calc(13px*var(--fz));margin-bottom:16px">Choose what to include in your backup:</p>' +
    '<div style="display:grid;gap:10px">' +
      '<div style="background:var(--surface2);border-radius:12px;padding:16px;cursor:pointer;border:1px solid var(--border2)" onclick="downloadBackup(true);closeModal(\'backupModal\')">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-weight:700;font-size:calc(14px*var(--fz))">Full Backup</div><div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--gold)">' + fullMB + '</div></div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text3)">All trades + photos + calculator saves</div>' +
      '</div>' +
      '<div style="background:var(--surface2);border-radius:12px;padding:16px;cursor:pointer;border:1px solid var(--border2)" onclick="downloadBackup(false);closeModal(\'backupModal\')">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><div style="font-weight:700;font-size:calc(14px*var(--fz))">Trades Only</div><div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--green)">' + tradesMB + '</div></div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text3)">All trade data, no photos — small file</div>' +
      '</div>' +
    '</div><p style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:14px;text-align:center">Save to Google Drive or send via WhatsApp</p>';
  openModal('backupModal');
}
function _readErrText(e) {
  if (!e) return 'unknown';
  if (e.message) return String(e.message);
  if (e.name) return String(e.name);
  return String(e);
}

// Android's system picker hands back content:// URIs that one reader can reject
// while another succeeds, so every available path is tried before failing and
// the collected errors are reported instead of a generic message.
function readTextFromFile(file, onDone, onFail) {
  var errors = [];
  var step = 0;
  var next = function() { step++; run(); };
  var decode = function(res) {
    return (typeof res === 'string') ? res : new TextDecoder('utf-8').decode(res);
  };
  var run = function() {
    var current = step;
    try {
      if (current === 0) {
        if (!file.arrayBuffer) return next();
        file.arrayBuffer().then(function(buf) { onDone(decode(buf)); })
          .catch(function(err) { errors.push('buffer: ' + _readErrText(err)); next(); });
        return;
      }
      if (current === 1 || current === 2) {
        var reader = new FileReader();
        reader.onerror = function() {
          errors.push((current === 1 ? 'text: ' : 'bytes: ') + _readErrText(reader.error));
          next();
        };
        reader.onload = function(ev) { onDone(decode(ev.target.result)); };
        if (current === 1) reader.readAsText(file); else reader.readAsArrayBuffer(file);
        return;
      }
      if (current === 3) {
        var url = URL.createObjectURL(file);
        fetch(url).then(function(resp) { return resp.text(); })
          .then(function(text) { URL.revokeObjectURL(url); onDone(text); })
          .catch(function(err) { URL.revokeObjectURL(url); errors.push('blob: ' + _readErrText(err)); next(); });
        return;
      }
      onFail(errors.join(' | ') || 'unknown');
    } catch (err) {
      errors.push('throw: ' + _readErrText(err));
      if (current >= 3) onFail(errors.join(' | ')); else next();
    }
  };
  run();
}

function restoreData() {
  // Android WebView/Capacitor: (1) do not detach <input> before click returns a file,
  // (2) do not detach before the File bytes are copied — removing early makes FileReader fail.
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json,text/json,text/plain,*/*';
  input.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
  var cleanup = function() {
    if (input.parentNode) input.parentNode.removeChild(input);
  };
  var applyBackupText = function(text) {
    try {
      var backup = JSON.parse(text);
      var raw = backup.state || backup;
      if (!raw || !Array.isArray(raw.accounts) || !Array.isArray(raw.trades)) { showToast('Invalid backup file', 'error'); return; }
      var loaded = sanitizeState(raw);
      confirmSheet({ title: 'This will replace ALL current data. Continue?', ok: 'Replace', danger: true,
        extra: '<button class="btn btn-secondary" onclick="closeModal(\'confirmSheet\');backupData()">Back up first</button>' }, function() {
      if (!applyLoadedState(loaded)) { showToast('Invalid backup file', 'error'); return; }
      if (backup.savedCalcs) {
        var cleanCalcs = sanitizeSavedCalcs(backup.savedCalcs);
        try { localStorage.setItem('tl_pos_calcs', JSON.stringify(cleanCalcs.pos)); } catch(e) {}
        try { localStorage.setItem('tl_comp_calcs', JSON.stringify(cleanCalcs.comp)); } catch(e) {}
        try { localStorage.setItem('tl_avg_calcs', JSON.stringify(cleanCalcs.avg)); } catch(e) {}
      }
      var lsPutJson = function(k,v){ if (v == null) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };
      if (backup.journals != null)  lsPutJson('tl_journals', sanitizeJournals(backup.journals));
      if (backup.templates != null) lsPutJson('tl_templates', sanitizeTemplates(backup.templates));
      if (backup.profile != null)   lsPutJson('tl_profile', sanitizeProfile(backup.profile));
      if (backup.benchmark != null) {
        var cleanBenchmark = sanitizeBenchmark(backup.benchmark);
        if (cleanBenchmark) lsPutJson('tl_benchmark', cleanBenchmark);
        else localStorage.removeItem('tl_benchmark');
      }
      if (backup.prefs) {
        var cleanPrefs = sanitizePrefs(backup.prefs);
        localStorage.setItem('tl_theme', cleanPrefs.theme);
        if (backup.prefs.font != null) applyFontSize(cleanPrefs.font);
        localStorage.setItem('tl_show_currency', cleanPrefs.showCurrency);
        localStorage.setItem('tl_currency', cleanPrefs.currency);
      }
      save(); renderSidebar(); renderMain();
      showToast('Backup restored successfully!', 'success');
      });
    } catch(err) { showToast('Restore failed: ' + err.message, 'error'); }
  };
  input.onchange = function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) { cleanup(); showToast('No backup file selected', 'error'); return; }
    if (file.size > 60 * 1024 * 1024) { cleanup(); showToast('Backup file too large (max 60MB)', 'error'); return; }
    if (file.size === 0) { cleanup(); showToast('That file is empty (0 KB) — re-save the backup and try again', 'error'); return; }
    showToast('Reading backup… (' + Math.round(file.size / 1024) + ' KB)', 'info');
    readTextFromFile(file, function(text) {
      cleanup();
      applyBackupText(text);
    }, function(details) {
      cleanup();
      showToast('Could not read backup file — ' + details, 'error');
    });
  };
  document.body.appendChild(input);
  setTimeout(function(){ try { input.click(); } catch(err) { cleanup(); showToast('Could not open file picker', 'error'); } }, 0);
}

// ==========================================================================
// CALCULATORS
// ==========================================================================
function renderCalculators() {
  return '<div class="tabs calc-tab-grid">' +
      '<button id="ctab_pos" class="tab on" onclick="switchCalc(\'pos\')">' + icon('ruler', 16) + ' Position Size</button>' +
      '<button id="ctab_avg" class="tab" onclick="switchCalc(\'avg\')">' + icon('chart', 16) + ' Stock Average</button>' +
      '<button id="ctab_pnl" class="tab" onclick="switchCalc(\'pnl\')">' + icon('money', 16) + ' P&amp;L</button>' +
      '<button id="ctab_compound" class="tab" onclick="switchCalc(\'compound\')">' + icon('trending', 16) + ' Compound</button>' +
    '</div>' +
    '<div>' +
    '<div id="calc_pos">' + renderPosCalc() + '</div>' +
    '<div id="calc_avg" style="display:none">' + renderAvgCalc() + '</div>' +
    '<div id="calc_pnl" style="display:none">' + renderPnlCalc() + '</div>' +
    '<div id="calc_compound" style="display:none">' + renderCompoundCalc() + '</div>' +
  '</div>';
}

function switchCalc(tab) {
  ['pnl','pos','compound','avg'].forEach(function(t){
    var el = document.getElementById('calc_' + t); if (el) el.style.display = t === tab ? '' : 'none';
    var btn = document.getElementById('ctab_' + t); if (btn) btn.className = 'tab' + (t === tab ? ' on' : '');
  });
  if (tab === 'pos') { calcPositionSize(); setTimeout(function(){ renderPosSaved(); }, 50); }
  if (tab === 'compound') { setTimeout(function(){ renderCompoundSaved(); }, 50); }
  if (tab === 'avg') { setTimeout(function(){ renderAvgSaved(); }, 50); }
}

function calcResultRow(label, value, style) {
  return '<div class="calc-result-row"><span class="calc-result-label">' + label + '</span><span class="calc-result-value"' + (style ? ' style="' + style + '"' : '') + '>' + value + '</span></div>';
}

function numStr(v) { return String(v == null ? '' : v).replace(/,/g, '').trim(); }
function numVal(v) { return parseFloat(numStr(v)); }
function groupNum(raw) {
  var s = String(raw == null ? '' : raw).replace(/[^\d.\-]/g, '');
  var neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  var dot = s.indexOf('.');
  var intPart = (dot >= 0 ? s.slice(0, dot) : s).replace(/^0+(?=\d)/, '');
  var decPart = dot >= 0 ? '.' + s.slice(dot + 1).replace(/\./g, '') : '';
  return (neg ? '-' : '') + intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + decPart;
}
function fmtNumInput(el) {
  var caret = el.selectionStart == null ? el.value.length : el.selectionStart;
  var digitsBefore = el.value.slice(0, caret).replace(/[^\d.\-]/g, '').length;
  var out = groupNum(el.value);
  if (out === el.value) return;
  el.value = out;
  var i = 0, seen = 0;
  while (i < out.length && seen < digitsBefore) { if (out[i] !== ',') seen++; i++; }
  try { el.setSelectionRange(i, i); } catch (e) {}
}

function calcEmpty(text) { return '<div class="res-empty">' + text + '</div>'; }
function resTile(k, v, d, color) {
  return '<div class="res-tile"><div class="k">' + k + '</div><div class="v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div>' + (d ? '<div class="d">' + d + '</div>' : '') + '</div>';
}
function resRow(k, v, color) {
  return '<div class="res-row"><span>' + k + '</span><b' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</b></div>';
}
function calcSaveBtn(fn) {
  return '<button type="button" class="pill-btn" onclick="' + fn + '()">' + icon('save', 15) + ' Save</button>';
}
function segBtns(id, items, cur, fn) {
  return '<div class="seg calc-seg" id="' + eid(id) + '" style="grid-template-columns:repeat(' + items.length + ',minmax(0,1fr))">' +
    items.map(function(it) {
      return '<button type="button" data-v="' + it.v + '" class="' + (it.v === cur ? 'on' : '') + '" onclick="' + fn + '(\'' + it.v + '\')">' + it.label + '</button>';
    }).join('') + '</div>';
}
function segSet(id, v) {
  var s = document.getElementById(id);
  if (s) s.querySelectorAll('button').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
}
function trimNum(n, dp) { return String(parseFloat(n.toFixed(dp))); }

// P&L Calculator
var _pnlCalcSide = 'Long';

function setPnlCalcSide(side) {
  _pnlCalcSide = side === 'Short' ? 'Short' : 'Long';
  segSet('pnl_side_seg', _pnlCalcSide);
  calcPnlCalc();
}

function renderPnlCalc() {
  var num = ' type="text" inputmode="decimal" autocomplete="off" oninput="fmtNumInput(this);calcPnlCalc()"';
  return '<div class="calc-stack"><section class="calc-card">' +
    segBtns('pnl_side_seg', [{v:'Long', label:'Long · bought first'}, {v:'Short', label:'Short · sold first'}], _pnlCalcSide, 'setPnlCalcSide') +
    '<div class="calc-grid2">' +
      '<div class="field"><label>Entry price' + currLbl() + '</label><input id="cl_entry"' + num + ' step="0.0001" placeholder="100.00"></div>' +
      '<div class="field"><label>Exit price' + currLbl() + '</label><input id="cl_exit"' + num + ' step="0.0001" placeholder="120.00"></div>' +
      '<div class="field"><label>Shares</label><input id="cl_qty"' + num + ' step="0.0001" placeholder="10"></div>' +
      '<div class="field"><label>Total fees' + currLbl() + '</label><input id="cl_fees"' + num + ' step="0.01" placeholder="Optional"></div>' +
    '</div>' +
  '</section>' +
  '<div id="pnlCalcResult">' + calcEmpty('Enter entry, exit and shares') + '</div></div>';
}

function calcPnlCalc() {
  var el = document.getElementById('pnlCalcResult'); if (!el) return;
  var entry = numVal(document.getElementById('cl_entry').value);
  var exit  = numVal(document.getElementById('cl_exit').value);
  var qty   = numVal(document.getElementById('cl_qty').value);
  var fees  = Math.max(0, numVal(document.getElementById('cl_fees').value) || 0);
  if (isNaN(entry) || isNaN(exit) || isNaN(qty) || qty <= 0 || entry <= 0 || exit < 0) {
    el.innerHTML = calcEmpty('Enter entry, exit and shares'); return;
  }
  var dir = _pnlCalcSide === 'Short' ? -1 : 1;
  var delta = (exit - entry) * dir;
  var cost = entry * qty;
  var net = delta * qty - fees;
  var pct = net / cost * 100;
  el.innerHTML = '<section class="avg-card res-card">' +
    '<span class="cap">' + (fees > 0 ? 'Net P&amp;L' : 'Estimated P&amp;L') + '</span>' +
    '<div class="res-hero-row"><span class="avg-big" style="color:' + pnlColor(net) + '">' + fmtPnl(net) + '</span>' +
      '<span class="res-pct" style="color:' + pnlColor(net) + '">' + fmtPct(pct) + '</span></div>' +
    '<div class="res-sub">' + _pnlCalcSide + ' · ' + sharesTxt(qty) + ' · ' + (fees > 0 ? 'after ' + fmtMoney(fees) + ' fees' : 'before fees') + '</div>' +
    '<div class="res-tiles">' +
      resTile('Per share', (delta >= 0 ? '+' : '-') + fmtPrice(Math.abs(delta)), 'Price moved ' + fmtPct((exit - entry) / entry * 100), pnlColor(delta)) +
      resTile('Value at exit', fmtMoney(exit * qty), 'Cost ' + fmtMoney(cost), '') +
    '</div>' +
    (fees > 0 ? resRow('Break-even exit', fmtPrice(entry + dir * fees / qty)) : '') +
  '</section>';
}

// Position Size Calculator
var _psPriceMode = true, _psRiskMode = '%', _psAcctType2 = 'cash';

function psMini(id, items, cur, fn) {
  return '<div class="ps-mini" id="' + eid(id) + '">' + items.map(function(it) {
    return '<button type="button" data-v="' + it.v + '" class="' + (it.v === cur ? 'on' : '') + '" onclick="' + fn + '(\'' + it.v + '\')">' + it.label + '</button>';
  }).join('') + '</div>';
}

function renderPosCalc() {
  var cs = currSym().trim() || '$';
  var pm = _psPriceMode;
  var inp = function(id, ph, label, off) {
    return '<input id="' + eid(id) + '" class="inp' + (off ? ' ps-off' : '') + '" type="text" inputmode="decimal" autocomplete="off" placeholder="' + ph + '" aria-label="' + label + '" oninput="fmtNumInput(this);calcPositionSize()">';
  };
  var lvl = function(k, name, inner) {
    return '<div class="ps-lvl ' + k + '" id="ps_row_' + k + '"><div><div class="ps-lvl-n" id="ps_name_' + k + '">' + name + '</div>' + inner + '</div>' +
      '<div class="ps-out"><div class="a" id="ps_a_' + k + '"></div><div class="p" id="ps_p_' + k + '"></div></div></div>';
  };
  return '<div class="calc-stack ps-b">' +
  '<div class="ps-live" id="posCalcResult"></div>' +
  '<section class="calc-card">' +
    '<div class="calc-card-h"><span class="calc-card-t">Your account</span></div>' +
    '<div class="calc-grid2">' +
      '<div class="field"><label for="ps_balance">Balance' + currLbl() + '</label>' + inp('ps_balance', '10,000', 'Balance') + '</div>' +
      '<div class="field"><label for="ps_risk_val">Risk per trade</label><div class="ps-unit-wrap">' + inp('ps_risk_val', '1', 'Risk per trade') +
        psMini('ps_risk_seg', [{v:'%', label:'%'}, {v:'$', label:esc(cs)}], _psRiskMode, 'setPsRiskMode') + '</div></div>' +
    '</div>' +
    '<div class="calc-conv" id="ps_risk_conv"></div>' +
    '<div class="ps-row"><span>Account type</span>' + psMini('ps_acct_seg', [{v:'cash', label:'Cash'}, {v:'margin', label:'Margin'}], _psAcctType2, 'setPsAcctType2') + '</div>' +
  '</section>' +
  '<section class="calc-card">' +
    '<div class="calc-card-h ps-plan-h"><span class="calc-card-t">Trade plan</span>' +
      psMini('ps_mode_seg', [{v:'price', label:'Prices'}, {v:'pct', label:'Distance %'}], pm ? 'price' : 'pct', 'setPosMode') + '</div>' +
    '<div class="ps-ladder" id="ps_ladder">' +
      '<div class="ps-rail" aria-hidden="true"><div class="g" id="ps_rail_g"></div><div class="r" id="ps_rail_r"></div></div>' +
      lvl('tp', psLevelName('tp'), inp('ps_tp_price', 'Optional', 'Target price', !pm) + inp('ps_tp_pct', 'Optional', 'Target distance in %', pm)) +
      '<div class="ps-gap g" id="ps_gap_g"></div>' +
      lvl('en', 'Entry', inp('ps_entry', '100.00', 'Entry price', !pm) + '<div class="ps-en-note' + (pm ? ' ps-off' : '') + '" id="ps_en_note">Long or short. Sized by distance</div>') +
      '<div class="ps-gap r" id="ps_gap_r"></div>' +
      lvl('sl', psLevelName('sl'), inp('ps_stop_price', '95.00', 'Stop price', !pm) + inp('ps_stop_pct', '5', 'Stop distance in %', pm)) +
    '</div>' +
    '<div class="ps-after">' +
      '<div><div class="k">Account if target hits</div><div class="v" id="ps_af_tp" style="color:var(--green)">—</div></div>' +
      '<div><div class="k">Account if stop hits</div><div class="v" id="ps_af_sl" style="color:var(--red)">—</div></div>' +
    '</div>' +
    '<div class="res-note">Before fees and slippage. A price gap can fill a stop below its level.</div>' +
  '</section>' +
  '<button type="button" class="btn btn-secondary ps-save" onclick="savePosCalc()">' + icon('save', 16) + ' Save calculation</button>' +
  '</div>' +
  '<div id="posSavedList" style="margin-top:12px"></div>';
}

function psLevelName(k) {
  if (k === 'tp') return _psPriceMode ? 'Target' + currLbl() : 'Target · % away';
  return _psPriceMode ? 'Stop' + currLbl() : 'Stop · % away';
}
function setPosMode(mode) {
  _psPriceMode = (mode === 'price');
  segSet('ps_mode_seg', _psPriceMode ? 'price' : 'pct');
  var off = function(id, hide) { var e = document.getElementById(id); if (e) e.classList.toggle('ps-off', hide); };
  off('ps_tp_price', !_psPriceMode); off('ps_entry', !_psPriceMode); off('ps_stop_price', !_psPriceMode);
  off('ps_tp_pct', _psPriceMode); off('ps_en_note', _psPriceMode); off('ps_stop_pct', _psPriceMode);
  ['tp', 'sl'].forEach(function(k) { var e = document.getElementById('ps_name_' + k); if (e) e.textContent = psLevelName(k); });
  calcPositionSize();
}
function setPsRiskMode(m, keepValue) {
  m = m === '$' ? '$' : '%';
  var inp = document.getElementById('ps_risk_val');
  if (!keepValue && m !== _psRiskMode && inp && inp.value !== '') {
    var conv = convertRiskValue(numStr(inp.value), numStr((document.getElementById('ps_balance') || {}).value), m);
    inp.value = conv === null ? '' : groupNum(String(conv));
  }
  _psRiskMode = m;
  segSet('ps_risk_seg', m);
  if (inp) inp.placeholder = m === '$' ? '100' : '1';
  calcPositionSize();
}
function setPsAcctType2(t) {
  _psAcctType2 = t === 'margin' ? 'margin' : 'cash';
  segSet('ps_acct_seg', _psAcctType2);
  calcPositionSize();
}
function psUpdateConv(bal, riskVal) {
  var el = document.getElementById('ps_risk_conv'); if (!el) return;
  if (!(bal > 0) || !(riskVal > 0)) { el.textContent = 'The most you’d lose if the stop is hit'; return; }
  var amt = _psRiskMode === '$' ? riskVal : bal * riskVal / 100;
  var tiny = _psRiskMode === '$' && riskVal <= 100 && amt / bal * 100 < 0.1;
  el.innerHTML = '= <b>' + fmtMoney(amt) + '</b> at risk · ' + fmtPctPlain(amt / bal * 100) + ' of your account' +
    (tiny ? ' <button type="button" class="ps-fix" onclick="setPsRiskMode(\'%\', true)">Use ' + esc(trimNum(riskVal, 2)) + '% instead</button>' : '');
}
function psCapNotes(r) {
  if (r.capped) return '<div class="res-alert warn"><b>Limited by your cash balance.</b> You’d risk ' + fmtMoney(r.actualRisk) + ' instead of ' + fmtMoney(r.idealRisk) + '.</div>';
  if (r.needsLeverage) return '<div class="res-alert info"><b>Margin: ' + trimNum(r.leverage, 2) + 'x leverage.</b> ' + fmtMoney(r.balance) + ' of your cash + ' +
    fmtMoney(r.posVal - r.balance) + ' borrowed. Your broker can close it early if margin runs low.</div>';
  return '';
}
// Places each level dot on its input and draws the rail between the dots.
function psLayoutLadder(slD, tpD) {
  var gg = document.getElementById('ps_gap_g'), gr = document.getElementById('ps_gap_r');
  if (!gg || !gr) return;
  var maxD = Math.max(slD, tpD);
  gg.style.height = (tpD > 0 ? Math.max(18, Math.round(tpD / maxD * 70)) : 24) + 'px';
  gr.style.height = (slD > 0 ? Math.max(18, Math.round(slD / maxD * 70)) : 24) + 'px';
  var y = {};
  ['tp', 'en', 'sl'].forEach(function(k) {
    var row = document.getElementById('ps_row_' + k); if (!row) return;
    var box = row.querySelector('input:not(.ps-off), .ps-en-note:not(.ps-off)');
    var dot = box ? box.offsetTop + box.offsetHeight / 2 : 40;
    row.style.setProperty('--dot', dot + 'px');
    row.classList.toggle('empty', !!box && box.tagName === 'INPUT' && !numStr(box.value));
    y[k] = row.offsetTop + dot;
  });
  var seg = function(id, a, b, on) {
    var e = document.getElementById(id); if (!e) return;
    e.style.top = Math.min(a, b) + 'px'; e.style.height = Math.abs(b - a) + 'px';
    e.classList.toggle('off', !on);
  };
  seg('ps_rail_g', y.en, y.tp, tpD > 0);
  seg('ps_rail_r', y.en, y.sl, slD > 0);
}

var PS_ERRORS = {
  risk: 'Enter your balance and risk per trade',
  riskTooHigh: 'Risk can’t be more than your balance',
  prices: 'Enter an entry and a stop price that are different',
  targetSide: 'The target must be on the other side of the entry from the stop',
  stopPct: 'Enter how far your stop is, in %',
  stopTooBig: 'The stop must be under 100% away'
};
function calcPositionSize() {
  var el = document.getElementById('posCalcResult'); if (!el) return;
  var v = function(id) { var e = document.getElementById(id); return e ? numStr(e.value) : ''; };
  var set = function(id, t) { var e = document.getElementById(id); if (e) e.textContent = t; };
  var bal = parseFloat(v('ps_balance'));
  psUpdateConv(bal, parseFloat(v('ps_risk_val')));
  var r = calcPositionPlan({ balance: v('ps_balance'), risk: v('ps_risk_val'), riskMode: _psRiskMode, priceMode: _psPriceMode, margin: _psAcctType2 === 'margin',
    slPct: v('ps_stop_pct'), tpPct: v('ps_tp_pct'), entry: v('ps_entry'), stop: v('ps_stop_price'), target: v('ps_tp_price') });
  ['ps_a_tp', 'ps_p_tp', 'ps_a_en', 'ps_p_en', 'ps_a_sl', 'ps_p_sl'].forEach(function(id) { set(id, ''); });
  set('ps_af_tp', '—'); set('ps_af_sl', '—');
  var lad = document.getElementById('ps_ladder');
  if (r.error) {
    el.innerHTML = '<div class="ps-live-h"><span class="ps-side">Position size</span></div><div class="ps-live-empty">' + PS_ERRORS[r.error] + '</div>';
    if (lad) lad.classList.remove('short');
    psLayoutLadder(0, 0);
    return;
  }
  var pm = _psPriceMode;
  var ofBal = fmtPctPlain(r.posVal / bal * 100) + ' of account';
  var big = r.qty !== null ? fmtQty(r.qty) + '<small>' + (r.qty === 1 ? 'share' : 'shares') + '</small>' : fmtMoney(r.posVal);
  el.innerHTML =
    '<div class="ps-live-h"><span class="ps-side' + (r.qty === null ? '' : (r.short ? ' short' : ' buy')) + '">' + (r.qty === null ? 'Position size' : (r.short ? 'Sell short' : 'Buy')) + '</span>' +
      '<span class="ps-rr">' + (r.rr !== null ? 'R:R <b>1 : ' + trimNum(r.rr, 2) + '</b>' : 'No target') + '</span></div>' +
    '<div class="ps-big">' + big + '</div>' +
    '<div class="ps-big-sub">' + (r.qty !== null ? '<b>' + fmtMoney(r.posVal) + '</b> position · ' : 'Position value · ') + ofBal + '</div>' +
    '<div class="ps-duo"><div><span class="k">You risk</span><b style="color:var(--red)">' + fmtPnl(-r.actualRisk) + '</b></div>' +
      '<div><span class="k">You could make</span><b style="color:var(--green)">' + (r.reward !== null ? fmtPnl(r.reward) : '—') + '</b></div></div>' +
    psCapNotes(r);
  if (r.reward !== null) {
    set('ps_a_tp', fmtPnl(r.reward));
    set('ps_p_tp', pm ? fmtPrice(parseFloat(v('ps_tp_price'))) + ' · ' + fmtPctPlain(r.tpPct) + ' away' : '+' + fmtPctPlain(r.reward / bal * 100) + ' of account');
  } else set('ps_p_tp', 'Add one to see reward');
  set('ps_a_en', fmtMoney(r.posVal));
  set('ps_p_en', r.qty !== null ? sharesTxt(r.qty) + ' × ' + fmtPrice(r.entry) : 'Position value');
  set('ps_a_sl', fmtPnl(-r.actualRisk));
  set('ps_p_sl', pm ? fmtPrice(parseFloat(v('ps_stop_price'))) + ' · ' + fmtPctPlain(r.slPct) + ' away' : '-' + fmtPctPlain(r.actualRisk / bal * 100) + ' of account');
  if (r.balanceIfTarget !== null) set('ps_af_tp', fmtMoney(r.balanceIfTarget));
  set('ps_af_sl', fmtMoney(r.balanceIfStop));
  if (lad) lad.classList.toggle('short', !!r.short);
  psLayoutLadder(r.slPct, r.tpPct || 0);
}

// ==========================================================================
// SAVED CALCULATIONS
// ==========================================================================
function getSavedCalcs(key) {
  try {
    var raw = JSON.parse(localStorage.getItem(key) || '[]');
    var wrapped = {pos:[], comp:[], avg:[]};
    if (key === 'tl_pos_calcs') wrapped.pos = raw;
    else if (key === 'tl_comp_calcs') wrapped.comp = raw;
    else wrapped.avg = raw;
    var clean = sanitizeSavedCalcs(wrapped);
    return key === 'tl_pos_calcs' ? clean.pos : (key === 'tl_comp_calcs' ? clean.comp : clean.avg);
  } catch(e) { return []; }
}
function setSavedCalcs(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }

function savePosCalc() {
  promptSheet('Name this calculation', '', '', function(name) {
  if (!name) return;
  var v = function(id) { var e = document.getElementById(id); return e ? numStr(e.value) : ''; };
  var entry = {id:Date.now().toString(), name:name, date:localDateStr(new Date()),
    mode:_psPriceMode?'price':'pct', riskMode:_psRiskMode,
    balance:v('ps_balance'), risk:v('ps_risk_val'),
    entry:_psPriceMode?v('ps_entry'):'',
    sl:_psPriceMode?v('ps_stop_price'):v('ps_stop_pct'),
    tp:_psPriceMode?v('ps_tp_price'):v('ps_tp_pct')};
  var arr = getSavedCalcs('tl_pos_calcs'); arr.unshift(entry);
  if (arr.length > 20) arr = arr.slice(0,20);
  setSavedCalcs('tl_pos_calcs', arr); renderPosSaved();
  showToast('Calculation saved', 'success');
  });
}

function renderPosSaved() {
  var el = document.getElementById('posSavedList'); if (!el) return;
  var arr = getSavedCalcs('tl_pos_calcs');
  if (!arr.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Saved Calculations</div>' +
    arr.map(function(e){
      return '<div class="saved-calc-row">' +
        '<div style="flex:1;min-width:0"><div style="font-size:calc(13px*var(--fz));font-weight:600">' + esc(e.name) + '</div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono)">' + (e.date || '—') + '</div></div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="icon-btn" onclick="loadPosCalc(\'' + eid(e.id) + '\')">' + icon('folder',15) + '</button>' +
          '<button class="icon-btn del" onclick="deletePosCalc(\'' + eid(e.id) + '\')">' + icon('trash',15) + '</button>' +
        '</div></div>';
    }).join('');
}

function loadPosCalc(id) {
  var arr = getSavedCalcs('tl_pos_calcs');
  var e = arr.find(function(x){ return x.id === id; }); if (!e) return;
  var set = function(eid, val) { var el = document.getElementById(eid); if (el) el.value = val == null ? '' : groupNum(val); };
  setPosMode(e.mode === 'price' ? 'price' : 'pct');
  setPsRiskMode(e.riskMode || '%', true);
  set('ps_balance', e.balance);
  set('ps_risk_val', e.risk);
  if (e.mode === 'price') {
    set('ps_entry', e.entry); set('ps_stop_price', e.sl); set('ps_tp_price', e.tp);
  } else {
    set('ps_stop_pct', e.sl); set('ps_tp_pct', e.tp);
  }
  calcPositionSize(); showToast('Loaded: ' + e.name, 'success');
}

function deletePosCalc(id) {
  confirmSheet({ title: 'Delete this calculation?', ok: 'Delete', danger: true }, function() { _deletePosCalc(id); });
}
function _deletePosCalc(id) {
  var list = getSavedCalcs('tl_pos_calcs');
  var idx = list.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var snap = list[idx];
  setSavedCalcs('tl_pos_calcs', list.filter(function(x){ return x.id !== id; }));
  renderPosSaved();
  haptic('warning');
  showUndoToast('Calculation deleted', function() {
    var cur = getSavedCalcs('tl_pos_calcs');
    cur.splice(idx, 0, snap);
    setSavedCalcs('tl_pos_calcs', cur);
    renderPosSaved();
  });
}

// ==========================================================================
// COMPOUND GROWTH CALCULATOR
// ==========================================================================
var _cgView = 'year';

function renderCompoundCalc() {
  var num = ' type="text" inputmode="decimal" autocomplete="off" oninput="fmtNumInput(this);calcCompound()"';
  return '<div class="calc-stack"><section class="calc-card">' +
    '<div class="calc-grid2">' +
      '<div class="field"><label>Starting capital' + currLbl() + '</label><input id="cg_capital"' + num + ' step="0.01" placeholder="10,000"></div>' +
      '<div class="field"><label>Monthly deposit</label><input id="cg_deposit"' + num + ' step="0.01" placeholder="Optional"></div>' +
      '<div class="field"><label>Return (%)</label><input id="cg_rate"' + num + ' step="0.01" placeholder="10"></div>' +
      '<div class="field"><label>Return period</label><select id="cg_rate_period" onchange="calcCompound()"><option value="annual">Per year</option><option value="monthly">Per month</option><option value="weekly">Per week</option></select></div>' +
      '<div class="field"><label>Duration</label><input id="cg_duration" type="number" inputmode="numeric" step="1" placeholder="10" oninput="calcCompound()"></div>' +
      '<div class="field"><label>Duration unit</label><select id="cg_dur_unit" onchange="calcCompound()"><option value="years" selected>Years</option><option value="months">Months</option></select></div>' +
    '</div>' +
    '<div class="field"><label>Compounding</label><select id="cg_freq" onchange="calcCompound()"><option value="12">Monthly</option><option value="4">Quarterly</option><option value="52">Weekly</option><option value="365">Daily</option><option value="1">Yearly</option></select></div>' +
  '</section>' +
  '<div id="cgResult">' + calcEmpty('Enter capital, return and duration') + '</div>' +
  '<div id="cgTable"></div>' +
  '</div>' +
  '<div id="compoundSavedList" style="margin-top:12px"></div>';
}

function setCgView(v) { _cgView = v === 'month' ? 'month' : 'year'; calcCompound(); }

function calcCompound() {
  var P = numVal(document.getElementById('cg_capital').value);
  var rate = numVal(document.getElementById('cg_rate').value);
  var ratePer = document.getElementById('cg_rate_period').value;
  var duration = parseInt(document.getElementById('cg_duration').value);
  var durUnit = document.getElementById('cg_dur_unit').value;
  var deposit = numVal(document.getElementById('cg_deposit').value) || 0;
  var freq = parseInt(document.getElementById('cg_freq').value);
  var el = document.getElementById('cgResult');
  var tbl = document.getElementById('cgTable');
  if (isNaN(P) || isNaN(rate) || isNaN(duration) || P <= 0 || duration <= 0) {
    el.innerHTML = calcEmpty('Enter capital, return and duration');
    if (tbl) tbl.innerHTML = ''; return;
  }
  var plan = calcCompoundPlan({ capital: P, rate: rate, ratePer: ratePer, duration: duration, durUnit: durUnit, deposit: deposit, freq: freq });
  var bal = plan.finalBalance, totalMonths = plan.totalMonths, totalDeposited = plan.totalDeposited;
  var totalInvested = plan.totalInvested, totalGrowth = plan.totalGrowth, roi = plan.roi, rows = plan.rows;
  var yrs = Math.floor(totalMonths / 12), mos = totalMonths % 12;
  var horizon = durUnit === 'years'
    ? plural(duration, 'year', 'years') + ' (' + totalMonths + ' months)'
    : plural(totalMonths, 'month', 'months') + (yrs ? ' (' + plural(yrs, 'year', 'years') + (mos ? ' ' + plural(mos, 'month', 'months') : '') + ')' : '');
  var perLbl = ratePer === 'monthly' ? 'a month' : (ratePer === 'weekly' ? 'a week' : 'a year');
  var freqLbl = {12:'monthly', 4:'quarterly', 52:'weekly', 365:'daily', 1:'yearly'}[freq] || 'monthly';
  var assume = fmtPctPlain(rate) + ' ' + perLbl + ', compounded ' + freqLbl + (deposit > 0 ? ', plus ' + fmtMoney(deposit) + ' each month' : '');
  var mine = bal > 0 ? Math.max(0, Math.min(100, totalInvested / bal * 100)) : 100;
  var mix = totalGrowth > 0
    ? '<div class="mix"><div class="mix-bar" aria-hidden="true"><span style="width:' + mine.toFixed(1) + '%"></span></div>' +
      '<div class="mix-leg"><span><i class="b"></i>Your money ' + Math.round(mine) + '%</span><span><i class="g"></i>Growth ' + (100 - Math.round(mine)) + '%</span></div></div>'
    : '';
  el.innerHTML = '<section class="avg-card res-card">' +
    '<div class="res-top"><span class="cap">Final balance</span>' + calcSaveBtn('saveCompoundCalc') + '</div>' +
    '<div class="avg-big">' + fmtMoney(bal) + '</div>' +
    '<div class="res-sub">After ' + horizon + '</div>' +
    mix +
    '<div class="res-tiles">' +
      resTile('You put in', fmtMoney(totalInvested), deposit > 0 ? fmtMoney(P) + ' + ' + fmtMoney(totalDeposited) + ' deposits' : 'Starting capital', '') +
      resTile('Estimated growth', fmtPnl(totalGrowth), fmtPct(roi) + ' on what you put in', pnlColor(totalGrowth)) +
    '</div>' +
    '<div class="res-note">' + assume + '. An estimate, not a guarantee.</div>' +
  '</section>';
  if (tbl) {
    var yearly = totalMonths > 12 && _cgView === 'year';
    var list = [];
    if (yearly) {
      for (var i = 0; i < rows.length; i += 12) {
        var chunk = rows.slice(i, i + 12), gsum = 0, dsum = 0;
        chunk.forEach(function(r) { gsum += r[1]; dsum += r[2]; });
        var last = chunk[chunk.length - 1];
        list.push([chunk.length === 12 ? 'Year ' + (i / 12 + 1) : (chunk.length === 1 ? 'Month ' + last[0] : 'Months ' + (i + 1) + '–' + last[0]), gsum, dsum, last[3], false]);
      }
    } else {
      list = rows.map(function(r) { var ye = r[0] % 12 === 0; return [ye ? 'Year ' + r[0] / 12 : 'Month ' + r[0], r[1], r[2], r[3], ye]; });
    }
    var dep = deposit > 0;
    tbl.innerHTML = '<div class="cg-head"><span class="cap">' + (totalMonths > 12 ? 'Breakdown' : 'Month by month') + '</span>' +
        (totalMonths > 12 ? segBtns('cg_view_seg', [{v:'year', label:'Yearly'}, {v:'month', label:'Monthly'}], _cgView, 'setCgView') : '') + '</div>' +
      '<div class="cg-wrap"><table class="cg-tbl"><thead><tr><th>' + (yearly ? 'Period' : 'Month') + '</th><th>Growth</th>' + (dep ? '<th>Deposits</th>' : '') + '<th>Balance</th></tr></thead><tbody>' +
      list.map(function(r) {
        return '<tr' + (r[4] ? ' class="ye"' : '') + '><td>' + r[0] + '</td><td class="g">' + fmtMoney(r[1]) + '</td>' + (dep ? '<td class="d">' + fmtMoney(r[2]) + '</td>' : '') + '<td class="b">' + fmtMoney(r[3]) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
}

function saveCompoundCalc() {
  promptSheet('Name this calculation', '', '', function(name) {
  if (!name) return;
  var entry = {id:Date.now().toString(), name:name, date:localDateStr(new Date()),
    capital:numStr(document.getElementById('cg_capital').value), rate:numStr(document.getElementById('cg_rate').value),
    ratePer:document.getElementById('cg_rate_period').value, duration:document.getElementById('cg_duration').value,
    durUnit:document.getElementById('cg_dur_unit').value, deposit:numStr(document.getElementById('cg_deposit').value),
    freq:document.getElementById('cg_freq').value};
  var arr = getSavedCalcs('tl_comp_calcs'); arr.unshift(entry);
  if (arr.length > 20) arr = arr.slice(0,20);
  setSavedCalcs('tl_comp_calcs', arr); renderCompoundSaved();
  showToast('Calculation saved', 'success');
  });
}

function renderCompoundSaved() {
  var el = document.getElementById('compoundSavedList'); if (!el) return;
  var arr = getSavedCalcs('tl_comp_calcs');
  if (!arr.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text2);text-transform:uppercase;margin-bottom:8px">Saved Calculations</div>' +
    arr.map(function(e){
      return '<div class="saved-calc-row">' +
        '<div style="flex:1;min-width:0"><div style="font-size:calc(13px*var(--fz));font-weight:600">' + esc(e.name) + '</div>' +
        '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono)">' + (e.date || '—') + '</div></div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="icon-btn" onclick="loadCompoundCalc(\'' + eid(e.id) + '\')">' + icon('folder',15) + '</button>' +
          '<button class="icon-btn del" onclick="deleteCompoundCalc(\'' + eid(e.id) + '\')">' + icon('trash',15) + '</button>' +
        '</div></div>';
    }).join('');
}

function loadCompoundCalc(id) {
  var arr = getSavedCalcs('tl_comp_calcs');
  var e = arr.find(function(x){ return x.id === id; }); if (!e) return;
  var map = {cg_capital:'capital',cg_rate:'rate',cg_rate_period:'ratePer',cg_duration:'duration',cg_dur_unit:'durUnit',cg_deposit:'deposit',cg_freq:'freq'};
  Object.keys(map).forEach(function(eid){ var el = document.getElementById(eid); if (el) el.value = el.tagName === 'INPUT' && el.type === 'text' ? groupNum(e[map[eid]]) : e[map[eid]]; });
  calcCompound(); showToast('Loaded: ' + e.name, 'success');
}

function deleteCompoundCalc(id) {
  confirmSheet({ title: 'Delete this calculation?', ok: 'Delete', danger: true }, function() { _deleteCompoundCalc(id); });
}
function _deleteCompoundCalc(id) {
  var list = getSavedCalcs('tl_comp_calcs');
  var idx = list.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var snap = list[idx];
  setSavedCalcs('tl_comp_calcs', list.filter(function(x){ return x.id !== id; }));
  renderCompoundSaved();
  haptic('warning');
  showUndoToast('Calculation deleted', function() {
    var cur = getSavedCalcs('tl_comp_calcs');
    cur.splice(idx, 0, snap);
    setSavedCalcs('tl_comp_calcs', cur);
    renderCompoundSaved();
  });
}

// ==========================================================================
// INIT
// ==========================================================================

// ==========================================================================
// ANALYTICS
// ==========================================================================
function renderAnalytics() {
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else { trades = state.trades.filter(function(t){ return t.accountId === filterAccountId; }); }
  var closed = trades.filter(function(t){ return t.status === 'closed'; });
  if (!closed.length) {
    return '<div class="no-account-msg"><div style="font-size:calc(48px*var(--fzh))"></div><h3>No closed trades yet</h3><p>Close some trades to see your analytics.</p></div>';
  }
  var pnls = closed.map(function(t){ return calcPnl(t); });
  var totalPnl = pnls.reduce(function(s,v){ return s+v; },0);
  var wins = pnls.filter(function(v){ return v > 0.005; });
  var losses = pnls.filter(function(v){ return v < -0.005; });
  var wr = fmtWinRate(wins.length / closed.length * 100);
  var avgWin  = wins.length   ? wins.reduce(function(s,v){return s+v;},0)/wins.length : 0;
  var avgLoss = losses.length ? Math.abs(losses.reduce(function(s,v){return s+v;},0)/losses.length) : 0;
  var rr = avgLoss > 0 ? (avgWin/avgLoss).toFixed(2) : '—';
  var totalInv = closed.reduce(function(s,t){ return s+calcInvestedValue(t); },0);
  var roi = fmtPct(totalInv > 0 ? totalPnl/totalInv*100 : 0);

  // Best/worst
  var bestPnl  = Math.max.apply(null, pnls);
  var worstPnl = Math.min.apply(null, pnls);
  var bestTrade  = closed[pnls.indexOf(bestPnl)];
  var worstTrade = closed[pnls.indexOf(worstPnl)];

  // Streak
  var streak = 0, maxStreak = 0, curStreak = 0, streakType = '';
  // Streaks ignore break-even trades entirely: a break-even neither
  // counts toward a run nor breaks one.
  var sortedClosed = closed.slice().sort(function(a,b){ return a.exit_date.localeCompare(b.exit_date); });
  var streakSeq = sortedClosed.filter(function(t){ return !isBreakeven(t); });
  streakSeq.forEach(function(t){
    if (isWin(t)) {
      curStreak = curStreak > 0 ? curStreak + 1 : 1;
      if (curStreak > maxStreak) { maxStreak = curStreak; streakType = 'win'; }
    } else {
      curStreak = curStreak < 0 ? curStreak - 1 : -1;
    }
  });
  // Current streak
  var curStreakVal = 0, curStreakColor = 'var(--text3)';
  for (var i = streakSeq.length-1; i >= 0; i--) {
    var win2 = isWin(streakSeq[i]);
    if (i === streakSeq.length-1) { curStreakVal = win2 ? 1 : -1; }
    else {
      if ((win2 && curStreakVal > 0) || (!win2 && curStreakVal < 0)) {
        curStreakVal += (curStreakVal > 0 ? 1 : -1);
      } else break;
    }
  }
  if (curStreakVal > 0) curStreakColor = 'var(--green)';
  else if (curStreakVal < 0) curStreakColor = 'var(--red)';

  // P&L by day of week
  var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var dayPnl = [0,0,0,0,0,0,0], dayCnt = [0,0,0,0,0,0,0];
  closed.forEach(function(t){
    if (!t.exit_date) return;
    var d = parseLocalDate(t.exit_date).getDay();
    dayPnl[d] += calcPnl(t); dayCnt[d]++;
  });

  // Monthly P&L
  var monthPnl = {};
  closed.forEach(function(t){
    if (!t.exit_date) return;
    var m = t.exit_date.substring(0,7);
    monthPnl[m] = (monthPnl[m]||0) + calcPnl(t);
  });
  var months = Object.keys(monthPnl).sort();

  // Profit factor
  var grossWin  = wins.reduce(function(s,v){return s+v;},0);
  var grossLoss = Math.abs(losses.reduce(function(s,v){return s+v;},0));
  var pf = grossLoss > 0 ? (grossWin/grossLoss).toFixed(2) : '∞';

  return '<div style="display:flex;flex-direction:column;gap:14px">' +
    // Summary stats
    '<div class="stats-row">' +
      statCard('Win Rate', wr, plural(wins.length,'win','wins') + ' · ' + plural(losses.length,'loss','losses'), 'var(--blue)') +
      statCard('Avg Win/Loss', rr, 'Realized · closed trades', 'var(--gold)') +
      statCard('ROI', roi, 'On invested trade value', pnlColor(totalPnl)) +
      statCard('Profit Factor', pf, pf === '\u221e' ? 'No losses · closed only' : (pf >= 1 ? 'Closed trades · above 1.0 is good' : 'Closed trades · below 1.0'), pf === '\u221e' ? 'var(--green)' : (pf >= 1 ? 'var(--green)' : 'var(--red)')) +
      statCard('Avg Win', fmtPnl(avgWin), 'Per winning trade', 'var(--green)') +
      statCard('Avg Loss', (avgLoss > 0 ? '-' : '') + fmtMoney(avgLoss), 'Per losing trade', avgLoss > 0 ? 'var(--red)' : 'var(--text3)') +
      statCard('Brokerage Fees', fmtMoney(calcTotalFees(closed)), 'Total fees paid', 'var(--red)') +
    '</div>' +
    // Current streak + best/worst
    '<div class="stats-row">' +
      '<div class="stat-card" style="--accent:' + curStreakColor + '">' +
        '<div class="stat-label">Current Streak</div>' +
        '<div class="stat-value" style="color:' + curStreakColor + '">' +
          (curStreakVal > 0 ? '' + curStreakVal + ' Wins' : curStreakVal < 0 ? '' + Math.abs(curStreakVal) + ' Losses' : '—') +
        '</div>' +
      '</div>' +
      '<div class="stat-card" style="--accent:var(--green)">' +
        '<div class="stat-label">Best Trade</div>' +
        '<div class="stat-value" style="color:var(--green);font-size:calc(16px*var(--fz))">' + (bestTrade ? esc(bestTrade.ticker) + ' ' + fmtPnl(bestPnl) : '—') + '</div>' +
      '</div>' +
      '<div class="stat-card" style="--accent:var(--red)">' +
        '<div class="stat-label">Worst Trade</div>' +
        '<div class="stat-value" style="color:' + (worstTrade && worstPnl < 0 ? 'var(--red)' : 'var(--text3)') + ';font-size:calc(16px*var(--fz))">' +
          (worstTrade && worstPnl < 0 ? esc(worstTrade.ticker) + ' ' + fmtPnl(worstPnl) : 'No losses') +
        '</div>' +
      '</div>' +
    '</div>' +
    // Charts
    '<div class="panel"><div class="panel-header"><div class="panel-title">P&L by Day of Week</div></div>' +
      '<div class="chart-wrap"><canvas id="dayChart"></canvas></div></div>' +
    '<div class="panel" id="monthlyPanel">' +
      '<div class="panel-header"><div class="panel-title" style="display:inline-flex;align-items:center;gap:6px">' + cicon('calendar',15,'var(--blue)') + ' Monthly P&L</div></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px 4px">' +
        '<button class="icon-btn" onclick="changeMonthYear(-1)" id="monthYearPrev" style="width:34px;height:34px;font-size:calc(16px*var(--fz))">&#9664;</button>' +
        '<div style="text-align:center">' +
          '<div style="font-family:var(--mono);font-size:calc(18px*var(--fz));font-weight:700;color:var(--text)" id="monthYearLabel">&#8212;</div>' +
          '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));color:var(--text3);margin-top:2px" id="monthYearSummary"></div>' +
        '</div>' +
        '<button class="icon-btn" onclick="changeMonthYear(1)" id="monthYearNext" style="width:34px;height:34px;font-size:calc(16px*var(--fz))">&#9654;</button>' +
      '</div>' +
      '<div class="chart-wrap"><canvas id="monthChart"></canvas></div>' +
      '<div style="font-size:calc(12px*var(--fz));color:var(--text3);text-align:center;padding:4px 0 10px;font-family:var(--mono)">Tap a bar to see that month trades</div>' +
    '</div>' +
    // Trade log summary table
    '<div class="panel"><div class="panel-header"><div class="panel-title">Top Performers</div></div>' +
      '<div class="table-wrap">' + renderTradesTable(closed.slice().sort(function(a,b){ return calcPnl(b)-calcPnl(a); }).slice(0,5)) + '</div></div>' +
    renderDurationStats(closed) +
  '</div>';
}

var dayChart, monthChart;
var _monthChartYear = null;

function buildAnalyticsCharts() {
  if (typeof Chart === 'undefined') return;
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else { trades = state.trades.filter(function(t){ return t.accountId === filterAccountId; }); }
  var closed = trades.filter(function(t){ return t.status==='closed'; });

  var cd = {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5a6380',font:{size:chartFontSize(11)}}},y:{ticks:{color:'#5a6380',font:{size:chartFontSize(11)}}}}};

  // Day of week chart
  var dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var dayPnl = [0,0,0,0,0,0,0];
  closed.forEach(function(t){ if (!t.exit_date) return; var d = parseLocalDate(t.exit_date).getDay(); dayPnl[d] += calcPnl(t); });
  var dc = document.getElementById('dayChart');
  if (dc) {
    if (dayChart) dayChart.destroy();
    dayChart = new Chart(dc, {type:'bar', data:{labels:dayNames, datasets:[{data:dayPnl.map(function(v){return parseFloat(v.toFixed(2));}), backgroundColor:dayPnl.map(function(v){return v>=0?'#00d68f40':'#ff4d6d40';}), borderColor:dayPnl.map(function(v){return v>=0?'#00d68f':'#ff4d6d';}), borderWidth:1}]}, options:cd});
  }

  // Build full monthPnl map for all years
  var allMonthPnl = {};
  closed.forEach(function(t){ if (!t.exit_date) return; var m = t.exit_date.substring(0,7); allMonthPnl[m]=(allMonthPnl[m]||0)+calcPnl(t); });
  var allYears = [];
  Object.keys(allMonthPnl).forEach(function(m){ var y = parseInt(m.substring(0,4)); if (allYears.indexOf(y)<0) allYears.push(y); });
  allYears.sort();
  if (!allYears.length) return;
  // Default to current year, fallback to latest year with data
  var curYear = new Date().getFullYear();
  if (!_monthChartYear || allYears.indexOf(_monthChartYear) < 0) {
    _monthChartYear = allYears.indexOf(curYear) >= 0 ? curYear : allYears[allYears.length-1];
  }
  buildMonthChart(allMonthPnl, allYears, closed);
}

function buildMonthChart(allMonthPnl, allYears, closed) {
  if (typeof Chart === 'undefined') return;
  var yr = _monthChartYear;
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var mLabels = [], mVals = [], mKeys = [];
  for (var mo = 1; mo <= 12; mo++) {
    var key = yr + '-' + (mo < 10 ? '0'+mo : ''+mo);
    mLabels.push(monthNames[mo-1]);
    mVals.push(allMonthPnl[key] ? parseFloat(allMonthPnl[key].toFixed(2)) : 0);
    mKeys.push(key);
  }
  // Year summary
  var yearTotal = mVals.reduce(function(s,v){ return s+v; },0);
  var winMonths = mVals.filter(function(v){ return v>0; }).length;
  var lossMonths = mVals.filter(function(v){ return v<0; }).length;
  var lbl = document.getElementById('monthYearLabel');
  var sum = document.getElementById('monthYearSummary');
  if (lbl) lbl.textContent = String(yr);
  if (sum) sum.innerHTML = fmtPnl(yearTotal) + ' &middot; ' + winMonths + ' up &middot; ' + lossMonths + ' down';
  // Prev/next button states
  var prevBtn = document.getElementById('monthYearPrev');
  var nextBtn = document.getElementById('monthYearNext');
  if (prevBtn) prevBtn.style.opacity = allYears.indexOf(yr) <= 0 ? '0.3' : '1';
  if (nextBtn) nextBtn.style.opacity = allYears.indexOf(yr) >= allYears.length-1 ? '0.3' : '1';
  // Build chart
  var mc = document.getElementById('monthChart');
  if (!mc) return;
  if (monthChart) monthChart.destroy();
  var cd = {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#5a6380',font:{size:chartFontSize(11)}}},y:{ticks:{color:'#5a6380',font:{size:chartFontSize(11)}}}}};
  monthChart = new Chart(mc, {
    type:'bar',
    data:{labels:mLabels, datasets:[{data:mVals, backgroundColor:mVals.map(function(v){return v>0?'#4d9fff40':v<0?'#ff4d6d40':'#5a638020';}), borderColor:mVals.map(function(v){return v>0?'#4d9fff':v<0?'#ff4d6d':'#5a6380';}), borderWidth:1}]},
    options:Object.assign({},cd,{onClick:function(evt,els){
      if (!els||!els.length) return;
      var idx = els[0].index;
      openMonthTradesModal(mKeys[idx]);
    }})
  });
}

function changeMonthYear(dir) {
  // Get all years from closed trades
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else { trades = state.trades.filter(function(t){ return t.accountId === filterAccountId; }); }
  var closed = trades.filter(function(t){ return t.status==='closed'; });
  var allMonthPnl = {};
  closed.forEach(function(t){ if (!t.exit_date) return; var m = t.exit_date.substring(0,7); allMonthPnl[m]=(allMonthPnl[m]||0)+calcPnl(t); });
  var allYears = [];
  Object.keys(allMonthPnl).forEach(function(m){ var y = parseInt(m.substring(0,4)); if (allYears.indexOf(y)<0) allYears.push(y); });
  allYears.sort();
  var curIdx = allYears.indexOf(_monthChartYear);
  var newIdx = curIdx + dir;
  if (newIdx < 0 || newIdx >= allYears.length) return;
  _monthChartYear = allYears[newIdx];
  buildMonthChart(allMonthPnl, allYears, closed);
}

function openMonthTradesModal(monthKey) {
  // monthKey = 'YYYY-MM'
  var trades;
  if (filterAccountId === 'all') { trades = state.trades; }
  else { trades = state.trades.filter(function(t){ return t.accountId === filterAccountId; }); }
  var monthTrades = trades.filter(function(t){ return t.status==='closed' && t.exit_date && t.exit_date.substring(0,7)===monthKey; });
  if (!monthTrades.length) { showToast('No closed trades in ' + monthKey, 'info'); return; }
  var monthNames = {
    '01':'January','02':'February','03':'March','04':'April','05':'May','06':'June',
    '07':'July','08':'August','09':'September','10':'October','11':'November','12':'December'
  };
  var parts = monthKey.split('-');
  var label = (monthNames[parts[1]] || parts[1]) + ' ' + parts[0];
  var totalPnl = monthTrades.reduce(function(s,t){ return s+calcPnl(t); },0);
  var wins = monthTrades.filter(isWin).length;
  var wr = fmtWinRate(wins/monthTrades.length*100);
  var titleEl = document.getElementById('detailModalTitle');
  if (titleEl) { titleEl.textContent = ''; titleEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px">' + cicon('calendar',15,'var(--blue)') + ' ' + label + '</span>'; }
  var body = document.getElementById('tradeDetailBody');
  if (!body) return;
  var sCol = totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
  var html =
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">' +
      '<div class="stat-card" style="--accent:' + sCol + '"><div class="stat-label">Total P&L</div><div class="stat-value" style="color:' + sCol + ';font-size:calc(16px*var(--fz))">' + fmtPnl(totalPnl) + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Trades</div><div class="stat-value" style="color:var(--blue);font-size:calc(16px*var(--fz))">' + monthTrades.length + '</div></div>' +
      '<div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-value" style="color:var(--blue);font-size:calc(16px*var(--fz))">' + wr + '</div></div>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">';
  monthTrades.sort(function(a,b){ return b.exit_date.localeCompare(a.exit_date); });
  monthTrades.forEach(function(t){
    var pnl = calcPnl(t);
    var pnlCol = pnl >= 0 ? 'var(--green)' : 'var(--red)';
    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border-radius:8px;padding:10px 14px;cursor:pointer" onclick="closeModal(&apos;tradeDetailModal&apos;);setTimeout(function(){ openTradeDetail(&apos;' + eid(t.id) + '&apos;); },100)">' +
        '<div>' +
          '<div style="font-family:var(--mono);font-size:calc(14px*var(--fz));font-weight:700">' + esc(t.ticker) + '</div>' +
          '<div style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:2px">' + fmtDate(t.entry_date) + ' &#8594; ' + fmtDate(t.exit_date) + '</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-family:var(--mono);font-size:calc(14px*var(--fz));font-weight:700;color:' + pnlCol + '">' + fmtPnl(pnl) + '</div>' +
          '<div style="font-size:calc(11px*var(--fz));color:' + pnlCol + ';font-family:var(--mono)">' + (calcInvestedValue(t)>0 ? fmtPct(pnl/calcInvestedValue(t)*100) : '') + '</div>' +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  body.innerHTML = html;
  var footer = document.getElementById('tradeDetailFooter');
  if (footer) { footer.className = 'modal-footer'; } if (footer) footer.innerHTML = '<button class="btn btn-secondary" onclick="closeModal(&apos;tradeDetailModal&apos;)">Close</button>';
  openModal('tradeDetailModal');
}

// ==========================================================================
// DURATION STATS FOR ANALYTICS
// ==========================================================================
function renderDurationStats(closed) {
  if (!closed.length) return '';
  var durations = closed.map(function(t){ return calcTradeDuration(t); }).filter(function(d){ return d !== null; });
  if (!durations.length) return '';
  var avgDays = Math.round(durations.reduce(function(s,d){ return s+d; },0) / durations.length);
  var maxDays = Math.max.apply(null, durations);
  var minDays = Math.min.apply(null, durations);
  var longestTrade = closed[durations.indexOf(maxDays)];
  var shortestTrade = closed[durations.indexOf(minDays)];
  return '<div class="panel"><div class="panel-header"><div class="panel-title">&#9203; Trade Duration</div></div>' +
    '<div class="panel-body">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;display:flex;flex-direction:column;align-items:center">' +
          '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono);margin-bottom:6px;white-space:nowrap">AVG HOLD</div>' +
          '<div style="font-family:var(--mono);font-size:calc(17px*var(--fz));font-weight:700;color:var(--blue)">' + fmtDuration(avgDays) + '</div>' +
          '<div style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:2px">' + avgDays + ' days</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;display:flex;flex-direction:column;align-items:center">' +
          '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono);margin-bottom:6px;white-space:nowrap">LONGEST</div>' +
          '<div style="font-family:var(--mono);font-size:calc(17px*var(--fz));font-weight:700;color:var(--gold)">' + fmtDuration(maxDays) + '</div>' +
          '<div style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:2px">' + (longestTrade ? esc(longestTrade.ticker) : '') + '</div>' +
        '</div>' +
        '<div style="background:var(--surface2);border-radius:8px;padding:12px;text-align:center;display:flex;flex-direction:column;align-items:center">' +
          '<div style="font-size:calc(12px*var(--fz));color:var(--text3);font-family:var(--mono);margin-bottom:6px;white-space:nowrap">SHORTEST</div>' +
          '<div style="font-family:var(--mono);font-size:calc(17px*var(--fz));font-weight:700;color:var(--green)">' + fmtDuration(minDays) + '</div>' +
          '<div style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:2px">' + (shortestTrade ? esc(shortestTrade.ticker) : '') + '</div>' +
        '</div>' +
      '</div>' +
    '</div></div>';
}

function importCSV() {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = '.csv';
  input.onchange = function(e) {
    var file = e.target.files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) { showToast('CSV file too large (max 8MB)', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var lines = ev.target.result.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
        if (lines.length < 2) { showToast('CSV appears empty', 'error'); return; }
        if (lines.length > 20001) { showToast('CSV too many rows (max 20,000 trades)', 'error'); return; }

        function parseCSVLine(line) {
          var result = [], cur = '', inQ = false;
          for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
          result.push(cur.trim());
          return result;
        }

        var headers = parseCSVLine(lines[0]).map(function(h){
          return h.toLowerCase().replace(/"/g,'').trim();
        });

        function getCol(row, names) {
          for (var ni = 0; ni < names.length; ni++) {
            var ix = headers.indexOf(names[ni]);
            if (ix >= 0 && row[ix] !== undefined) return row[ix].replace(/"/g,'').trim();
          }
          return '';
        }

        function normDate(d) {
          if (!d) return today();
          d = d.split(' ')[0].split('T')[0];
          if (d.indexOf('/') >= 0) {
            var p = d.split('/');
            if (p.length === 3) {
              var yr = p[2].length === 2 ? '20' + p[2] : p[2];
              return yr + '-' + p[0].padStart(2,'0') + '-' + p[1].padStart(2,'0');
            }
          }
          return d;
        }

        // Detect Trading 212 format
        var hasAction  = headers.indexOf('action') >= 0;
        var hasTicker  = headers.indexOf('ticker') >= 0;
        var hasShares  = headers.indexOf('no. of shares') >= 0;
        var isT212 = hasAction && hasTicker && hasShares;

        var parsed = [];
        var _unmatchedSells = 0;

        if (isT212) {
          // Trading 212: pair buys with sells by ticker
          var buyMap = {};
          for (var i = 1; i < lines.length; i++) {
            var row = parseCSVLine(lines[i]);
            if (!row || row.length < 4) continue;
            var action  = getCol(row, ['action']).toLowerCase();
            var ticker  = safeTicker(getCol(row, ['ticker']));
            var shares  = parseFloat(getCol(row, ['no. of shares']));
            var price   = parseFloat(getCol(row, ['price / share', 'price/share', 'price per share']));
            var dateStr = normDate(getCol(row, ['time', 'date', 'datetime']));
            if (!ticker || !shares || !price) continue;
            var isBuy  = action.indexOf('buy') >= 0;
            var isSell = action.indexOf('sell') >= 0;
            if (isBuy) {
              if (!buyMap[ticker]) buyMap[ticker] = [];
              buyMap[ticker].push({ticker:ticker, shares:shares, price:price, date:dateStr});
            } else if (isSell) {
              var remaining = shares;
              while (remaining > 0.0000001 && buyMap[ticker] && buyMap[ticker].length) {
                var lot = buyMap[ticker][0];
                var matchQty = Math.min(lot.shares, remaining);
                parsed.push({
                  ticker:ticker, dir:'Long',
                  entryDate:lot.date, exitDate:dateStr,
                  entry:lot.price, exit:price,
                  qty:matchQty, fees:0, status:'closed'
                });
                lot.shares -= matchQty;
                remaining -= matchQty;
                if (lot.shares <= 0.0000001) buyMap[ticker].shift();
              }
              if (remaining > 0.0000001) {
                // Sell with no matching buy lot: don't fabricate a fake trade
                _unmatchedSells++;
              }
            }
          }
          // Remaining unmatched buys = open trades
          var tickers = Object.keys(buyMap);
          for (var ti = 0; ti < tickers.length; ti++) {
            var tkr = tickers[ti];
            for (var bi = 0; bi < buyMap[tkr].length; bi++) {
              var bx = buyMap[tkr][bi];
              parsed.push({ticker:bx.ticker, dir:'Long', entryDate:bx.date, exitDate:null, entry:bx.price, exit:null, qty:bx.shares, fees:0, status:'open'});
            }
          }
        } else {
          // Unsupported platform — reject clearly
          showToast('This file is not a Trading 212 CSV. Currently only Trading 212 exports are supported.', 'error');
          return;
        }

        if (!parsed.length) {
          showToast('No valid trades found. Check CSV format.', 'error');
          return;
        }
        if (_unmatchedSells > 0) {
          showToast(_unmatchedSells + ' sell row(s) had no matching buy and were skipped', 'error');
        }
        showCSVPreview(parsed);
      } catch(err) { showToast('Import failed: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  };
  input.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
  document.body.appendChild(input);
  setTimeout(function(){
    try { input.click(); }
    catch(err) {
      if (input.parentNode) input.parentNode.removeChild(input);
      showToast('Could not open file picker', 'error');
    }
  }, 0);
  // Do not removeChild here — Android WebView cancels the picker if input is detached early.
  input.addEventListener('change', function once() {
    input.removeEventListener('change', once);
    setTimeout(function(){ if (input.parentNode) input.parentNode.removeChild(input); }, 0);
  });
}

function showCSVPreview(parsed) {
  var modal = document.getElementById('csvPreviewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'csvPreviewModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal wide">' +
      '<div class="modal-header">' +
        '<div class="modal-title" style="display:flex;align-items:center;gap:8px">' + cicon('download',18,'var(--blue)') + ' Import CSV Preview</div>' +
        '<button class="modal-close" onclick="closeModal(&apos;csvPreviewModal&apos;)">&#x2715;</button>' +
      '</div>' +
      '<div class="modal-body" id="csvPreviewBody"></div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" onclick="closeModal(&apos;csvPreviewModal&apos;)">Cancel</button>' +
        '<button class="btn btn-primary" onclick="confirmCSVImport()">&#x2705; Import</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(modal);
  }
  window._csvParsed = parsed;
  var accOpts = state.accounts.map(function(a){
    return '<option value="' + esc(a.id) + '"' + (a.id===state.activeAccountId?' selected':'') + '>' + esc(a.name) + '</option>';
  }).join('');
  var preview = parsed.slice(0,5).map(function(t){
    return '<tr>' +
      '<td style="padding:5px 8px;font-family:var(--mono);font-size:calc(12px*var(--fz))">' + esc(t.ticker) + '</td>' +
      '<td style="padding:5px 8px;font-size:calc(12px*var(--fz))">' + t.dir + '</td>' +
      '<td style="padding:5px 8px;font-family:var(--mono);font-size:calc(12px*var(--fz))">' + currSym() + t.entry + '</td>' +
      '<td style="padding:5px 8px;font-family:var(--mono);font-size:calc(12px*var(--fz))">' + t.qty + '</td>' +
      '<td style="padding:5px 8px;font-size:calc(12px*var(--fz))">' + (t.entryDate||'--') + '</td>' +
      '<td style="padding:5px 8px"><span class="badge ' + (t.status==='closed'?'badge-closed':'badge-open') + '">' + t.status + '</span></td>' +
    '</tr>';
  }).join('');
  document.getElementById('csvPreviewBody').innerHTML =
    '<div class="field" style="margin-bottom:16px">' +
      '<label style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3)">IMPORT INTO ACCOUNT</label>' +
      '<select id="csvTargetAccount" style="width:100%;margin-top:6px;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:8px;padding:10px;font-size:calc(14px*var(--fz))">' +
        accOpts +
      '</select>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-bottom:14px">' +
      '<div class="stat-card" style="flex:1;--accent:var(--blue)"><div class="stat-label">Total</div><div class="stat-value" style="color:var(--blue);font-size:calc(17px*var(--fz))">' + parsed.length + '</div></div>' +
      '<div class="stat-card" style="flex:1;--accent:var(--green)"><div class="stat-label">Closed</div><div class="stat-value" style="color:var(--green);font-size:calc(17px*var(--fz))">' + parsed.filter(function(t){return t.status==='closed';}).length + '</div></div>' +
      '<div class="stat-card" style="flex:1;--accent:var(--gold)"><div class="stat-label">Open</div><div class="stat-value" style="color:var(--gold);font-size:calc(17px*var(--fz))">' + parsed.filter(function(t){return t.status==='open';}).length + '</div></div>' +
    '</div>' +
    '<div style="font-family:var(--mono);font-size:calc(12px*var(--fz));letter-spacing:.6px;color:var(--text3);margin-bottom:8px">PREVIEW (FIRST 5 ROWS)</div>' +
    '<div class="table-wrap"><table class="trade-table"><thead><tr>' +
      '<th>Symbol</th><th>Dir</th><th>Entry $</th><th>Qty</th><th>Date</th><th>Status</th>' +
    '</tr></thead><tbody>' + preview + '</tbody></table></div>' +
    (parsed.length > 5 ? '<div style="font-size:calc(11px*var(--fz));color:var(--text3);margin-top:8px;text-align:center">+ ' + (parsed.length-5) + ' more trades not shown</div>' : '');
  openModal('csvPreviewModal');
}


function confirmCSVImport() {
  var accId = document.getElementById('csvTargetAccount') ? document.getElementById('csvTargetAccount').value : null;
  if (!accId) { showToast('Select an account', 'error'); return; }
  var parsed = window._csvParsed || [];
  if (!parsed.length) { showToast('No trades to import', 'error'); return; }
  parsed.forEach(function(t, i) {
    state.trades.unshift({
      id:'tr_csv_'+Date.now()+'_'+i, accountId:accId,
      ticker:safeTicker(t.ticker), direction:t.dir, type:'', status:t.status,
      entry_date:t.entryDate, exit_date:t.exitDate,
      entry:t.entry, exit:t.exit, qty:t.qty, original_qty:t.qty,
      fees:t.fees, fees_mode:'$', notes:'Imported from CSV',
      photos:[], add_buys:[], partial_closes:[],
      createdAt:new Date().toISOString()
    });
  });
  save(); renderSidebar(); renderMain();
  closeModal('csvPreviewModal');
  showToast('Imported ' + parsed.length + ' trades into account!', 'success');
  window._csvParsed = null;
}



// ==========================================================================
// TRADE TEMPLATES
// ==========================================================================
function getTemplates() {
  try { return sanitizeTemplates(JSON.parse(localStorage.getItem('tl_templates') || '[]')); } catch(e) { return []; }
}
function saveTemplates(arr) { localStorage.setItem('tl_templates', JSON.stringify(arr)); }

function saveAsTemplate() {
  promptSheet('Template name', 'e.g. COIN Long 5%', '', function(name) {
  if (!name || !name.trim()) return;
  var template = {
    id: 'tpl_' + Date.now(),
    name: name.trim(),
    ticker:    document.getElementById('f_ticker')    ? document.getElementById('f_ticker').value    : '',
    type:      document.getElementById('f_type')      ? document.getElementById('f_type').value      : '',
    direction: document.getElementById('f_direction') ? document.getElementById('f_direction').value : 'Long',
    fees:      document.getElementById('f_fees')      ? document.getElementById('f_fees').value      : '',
    fees_mode: document.getElementById('f_fees_mode') ? document.getElementById('f_fees_mode').value : '%',
    risk:      document.getElementById('f_risk')      ? document.getElementById('f_risk').value      : ''
  };
  var arr = getTemplates();
  arr.unshift(template);
  if (arr.length > 20) arr = arr.slice(0,20);
  saveTemplates(arr);
  renderTemplateButtons();
  showToast('Template saved: ' + name.trim(), 'success');
  });
}

function loadTemplate(id) {
  var arr = getTemplates();
  var tpl = arr.find(function(t){ return t.id === id; });
  if (!tpl) return;
  if (document.getElementById('f_ticker'))    document.getElementById('f_ticker').value    = tpl.ticker;
  if (document.getElementById('f_type'))      document.getElementById('f_type').value      = tpl.type;
  if (document.getElementById('f_direction')) document.getElementById('f_direction').value = tpl.direction;
  if (document.getElementById('f_fees'))      document.getElementById('f_fees').value      = tpl.fees;
  if (document.getElementById('f_fees_mode')) document.getElementById('f_fees_mode').value = tpl.fees_mode;
  if (document.getElementById('f_risk'))      document.getElementById('f_risk').value      = tpl.risk;
  document.getElementById('f_entry_date').value = today();
  updateInvestedPreview();
  showToast('Template loaded: ' + tpl.name, 'success');
}

function deleteTemplate(id) {
  confirmSheet({ title: 'Delete this template?', ok: 'Delete', danger: true }, function() { _deleteTemplate(id); });
}
function _deleteTemplate(id) {
  var list = getTemplates();
  var idx = list.findIndex(function(t){ return t.id === id; });
  if (idx < 0) return;
  var snap = list[idx];
  saveTemplates(list.filter(function(t){ return t.id !== id; }));
  renderTemplateButtons();
  haptic('warning');
  showUndoToast('Template deleted', function() {
    var cur = getTemplates();
    cur.splice(idx, 0, snap);
    saveTemplates(cur);
    renderTemplateButtons();
  });
}

function renderTemplateButtons() {
  var el = document.getElementById('templateButtons');
  if (!el) return;
  var arr = getTemplates();
  if (!arr.length) { el.innerHTML = '<span style="font-size:calc(11px*var(--fz));color:var(--text3)">No templates yet. Fill the form and tap Save as Template.</span>'; return; }
  el.innerHTML = arr.map(function(tpl){
    return '<div style="display:inline-flex;align-items:center;gap:4px;background:var(--surface3);border:1px solid var(--border2);border-radius:16px;padding:4px 10px;margin:3px">' +
      '<span style="font-size:calc(12px*var(--fz));cursor:pointer;color:var(--text)" onclick="loadTemplate(&apos;' + eid(tpl.id) + '&apos;)">' + esc(tpl.name) + '</span>' +
      '<span style="font-size:calc(12px*var(--fz));color:var(--red);cursor:pointer;margin-left:4px" onclick="deleteTemplate(&apos;' + eid(tpl.id) + '&apos;)">&#x2715;</span>' +
    '</div>';
  }).join('');
}


// ==========================================================================
// SIDE DRAWER
// ==========================================================================
function openDrawer() {
  var overlay = document.getElementById('drawerOverlay');
  var drawer  = document.getElementById('sideDrawer');
  if (overlay) { overlay.style.display = 'block'; setTimeout(function(){ overlay.classList.add('open'); }, 10); }
  if (drawer)  { setTimeout(function(){ drawer.classList.add('open'); }, 10); }
  // Update theme label
  updateDrawerThemeLabel();
  updateDrawerCurrencyLabel();
  // Load profile
  var profile = getProfile();
  var nameEl  = document.getElementById('drawerName');
  var emailEl = document.getElementById('drawerEmail');
  var avEl    = document.getElementById('drawerAvatar');
  if (nameEl)  nameEl.textContent  = profile.name  || APP_NAME;
  if (emailEl) emailEl.textContent = profile.email || APP_TAGLINE;
  if (avEl)    avEl.textContent    = (profile.name  || 'T')[0].toUpperCase();
}

function closeDrawer() {
  var overlay = document.getElementById('drawerOverlay');
  var drawer  = document.getElementById('sideDrawer');
  if (overlay) { overlay.classList.remove('open'); setTimeout(function(){ overlay.style.display='none'; }, 260); }
  if (drawer)  { drawer.classList.remove('open'); }
}

// ==========================================================================
// PROFILE
// ==========================================================================
function getProfile() {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem('tl_profile') || '{}')); } catch(e) { return {}; }
}
function saveProfile() {
  var profile = {
    name:   document.getElementById('prof_name')   ? document.getElementById('prof_name').value.trim()   : '',
    email:  document.getElementById('prof_email')  ? document.getElementById('prof_email').value.trim()  : '',
    since:  document.getElementById('prof_since')  ? document.getElementById('prof_since').value.trim()  : '',
    market: document.getElementById('prof_market') ? document.getElementById('prof_market').value.trim() : ''
  };
  localStorage.setItem('tl_profile', JSON.stringify(profile));
  // Update avatar
  var bigAv = document.getElementById('profileAvatarBig');
  if (bigAv) bigAv.textContent = (profile.name || 'T')[0].toUpperCase();
  closeModal('profileModal');
  showToast('Profile saved!', 'success');
}

function openProfileModal() {
  var profile = getProfile();
  if (document.getElementById('prof_name'))   document.getElementById('prof_name').value   = profile.name   || '';
  if (document.getElementById('prof_email'))  document.getElementById('prof_email').value  = profile.email  || '';
  if (document.getElementById('prof_since'))  document.getElementById('prof_since').value  = profile.since  || '';
  if (document.getElementById('prof_market')) document.getElementById('prof_market').value = profile.market || '';
  var bigAv = document.getElementById('profileAvatarBig');
  if (bigAv) bigAv.textContent = (profile.name || 'T')[0].toUpperCase();
  openModal('profileModal');
}

// ==========================================================================
// FEEDBACK
// ==========================================================================
function openFeedbackModal() { openModal('feedbackModal'); }

function submitFeedback() {
  var typeSel = document.getElementById('fb_type');
  var typeLabel = (typeSel && typeSel.options[typeSel.selectedIndex]) ? typeSel.options[typeSel.selectedIndex].text : 'Feedback';
  var msg  = document.getElementById('fb_message') ? document.getElementById('fb_message').value.trim() : '';
  if (!msg) { showToast('Please enter your feedback', 'error'); return; }
  var subject = encodeURIComponent(APP_NAME + ' - ' + typeLabel);
  var body = encodeURIComponent(msg + '\n\n---\nSent from ' + APP_NAME);
  var a = document.createElement('a');
  a.href = 'mailto:smartappsflow@gmail.com?subject=' + subject + '&body=' + body;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if (document.getElementById('fb_message')) document.getElementById('fb_message').value = '';
  closeModal('feedbackModal');
}

// ==========================================================================
// SHARE APP
// ==========================================================================
// Both links live inside the text. A separate `url` field makes Android share
// a link card and drop the rest of the message (emiGo does the same).
var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=' + APP_PACKAGE_ID;
var WEB_APP_URL = 'https://smartappsflow.net/tradelogpro/';

function shareAppText() {
  return 'Try ' + APP_NAME + ' to log trades and track your P&L.\n\n'
    + 'Android — Google Play:\n' + PLAY_STORE_URL + '\n\n'
    + 'iPhone & browser:\n' + WEB_APP_URL;
}

function copyShareText(text) {
  var copied = function() { showToast('Share message copied', 'success'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(copied).catch(function() { showToast(text, 'success'); });
    return;
  }
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copied();
  } catch (e) {
    showToast(text, 'success');
  }
}

function shareApp() {
  closeDrawer();
  var title = APP_STORE_TITLE;
  var text = shareAppText();
  var Cap = window.Capacitor;
  var native = !!(Cap && (
    (typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform()) ||
    Cap.isNative
  ));
  var onFail = function(err) {
    var msg = String((err && (err.message || err.name)) || '').toLowerCase();
    if (msg.indexOf('cancel') !== -1 || msg.indexOf('abort') !== -1 || msg.indexOf('dismiss') !== -1) return;
    copyShareText(text);
  };
  if (native && Cap.Plugins && Cap.Plugins.Share) {
    Cap.Plugins.Share.share({ title: title, text: text, dialogTitle: 'Share app' }).catch(onFail);
    return;
  }
  if (navigator.share) {
    navigator.share({ title: title, text: text }).catch(onFail);
    return;
  }
  copyShareText(text);
}

function isNativeApp() {
  var Cap = window.Capacitor;
  return !!(Cap && ((typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform()) || Cap.isNative));
}

function haptic(kind) {
  try {
    var H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (!H) return;
    if (kind === 'success' && H.notification) H.notification({ type: 'SUCCESS' });
    else if (kind === 'warning' && H.notification) H.notification({ type: 'WARNING' });
    else if (kind === 'error' && H.notification) H.notification({ type: 'ERROR' });
    else if (H.impact) H.impact({ style: 'Light' });
  } catch (e) {}
}

var _confirmSheetCb = null;
var _promptSheetCb = null;

function confirmSheet(opts, cb) {
  opts = opts || {};
  _confirmSheetCb = cb;
  var title = document.getElementById('confirmSheetTitle');
  var body = document.getElementById('confirmSheetBody');
  var ok = document.getElementById('confirmSheetOk');
  var cancel = document.getElementById('confirmSheetCancel');
  if (title) title.textContent = opts.title || 'Confirm';
  if (body) body.innerHTML = (opts.body ? '<p style="font-size:calc(14px*var(--fz));color:var(--text2);margin-bottom:10px">' + esc(opts.body) + '</p>' : '') + (opts.extra || '');
  if (ok) {
    ok.textContent = opts.ok || 'OK';
    ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
    ok.onclick = function() {
      closeModal('confirmSheet');
      var fn = _confirmSheetCb; _confirmSheetCb = null;
      if (fn) fn();
    };
  }
  if (cancel) cancel.onclick = function() { _confirmSheetCb = null; closeModal('confirmSheet'); };
  openModal('confirmSheet');
}

function promptSheet(title, hint, value, cb) {
  _promptSheetCb = cb;
  var t = document.getElementById('promptSheetTitle');
  var h = document.getElementById('promptSheetHint');
  var inp = document.getElementById('promptSheetInput');
  if (t) t.textContent = title || 'Name';
  if (h) h.textContent = hint || '';
  if (inp) inp.value = value || '';
  openModal('promptSheet');
  setTimeout(function(){ if (inp) inp.focus(); }, 40);
}

function closePromptSheet(ok) {
  var cb = _promptSheetCb; _promptSheetCb = null;
  var inp = document.getElementById('promptSheetInput');
  var val = inp ? inp.value : '';
  closeModal('promptSheet');
  if (ok && cb) cb(val);
}

function showUndoToast(msg, undoFn) {
  _undoAction = undoFn;
  if (_undoTimer) clearTimeout(_undoTimer);
  var t = document.getElementById('toast');
  var msgEl = document.getElementById('toastMsg');
  var iconEl = document.getElementById('toastIcon');
  if (!t) return;
  if (iconEl) iconEl.innerHTML = icon_svg('ok');
  if (msgEl) msgEl.innerHTML = esc(msg) + ' <button type="button" onclick="runUndo()" style="margin-left:8px;background:none;border:none;color:var(--blue);font-weight:800;cursor:pointer;font-family:var(--sans)">UNDO</button>';
  t.className = 'toast show';
  _undoTimer = setTimeout(function() {
    _undoAction = null;
    if (t.parentNode) t.classList.remove('show');
  }, 5000);
}

function runUndo() {
  if (_undoTimer) clearTimeout(_undoTimer);
  var fn = _undoAction; _undoAction = null;
  var t = document.getElementById('toast');
  if (t) t.classList.remove('show');
  if (fn) fn();
}

function moreItem(onclick, ico, label, sub, color) {
  return '<button class="it" onclick="' + onclick + '"><span style="color:' + (color || 'var(--text2)') + '">' + ico + '</span><span>' + label + '</span><span class="s">' + (sub || '›') + '</span></button>';
}

function renderMore() {
  var theme = localStorage.getItem('tl_theme') || 'dark';
  var cur = currCode();
  var profile = getProfile();
  var lastBackup = '';
  try { lastBackup = localStorage.getItem('tl_last_backup') || ''; } catch(e) {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastBackup)) lastBackup = '';
  var themeBtn = function(id, label) {
    return '<button class="' + (theme === id ? 'on' : '') + '" role="radio" aria-checked="' + (theme === id) + '" onclick="applyTheme(\'' + eid(id) + '\');renderMain()">' + label + '</button>';
  };
  var font = normalizeFontSize(localStorage.getItem('tl_font'));
  var fontBtn = function(id, label) {
    return '<button class="' + (font === id ? 'on' : '') + '" role="radio" aria-checked="' + (font === id) + '" onclick="applyFontSize(\'' + eid(id) + '\');renderMain()">' + label + '</button>';
  };
  var curOpts = CURRENCIES.map(function(c){
    var label = c.code === 'NONE' ? 'No symbol' : c.code + (c.sym.trim() !== c.code ? ' (' + c.sym.trim() + ')' : '');
    return '<option value="' + c.code + '"' + (c.code === cur ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
  return '<div class="cap" style="padding:2px 4px 0">Tools</div>' +
    '<div class="grp">' +
      moreItem("setView('journal')", icon('book',18), 'Daily journal', 'Today ›', 'var(--blue)') +
      moreItem("setView('accounts')", icon('user',18), 'Accounts', state.accounts.length + ' ›', 'var(--blue)') +
      moreItem("setView('formulas')", icon('ruler',18), 'Formulas &amp; definitions', '›', 'var(--blue)') +
    '</div>' +
    '<div class="cap" style="padding:2px 4px 0">Your data</div>' +
    '<div class="grp">' +
      moreItem("backupData()", icon('save',18), 'Back up data' + (lastBackup ? '<span class="it-cap">Last backup ' + esc(fmtDateLong(lastBackup)) + '</span>' : '<span class="it-cap warn">No backup yet. Save a copy of your trades</span>'), '›', 'var(--green)') +
      moreItem("restoreData()", icon('folder',18), 'Restore backup', '›', 'var(--green)') +
      moreItem("setView('import')", icon('camera',18), 'Import from screenshot', (isNativeApp() ? '4 brokers' : 'Android app') + ' ›', 'var(--green)') +
      moreItem("importCSV()", icon('doc',18), 'Import from Trading 212', 'CSV ›', 'var(--green)') +
      moreItem("openReportModal()", icon('trending',18), 'Export report', 'Excel · PDF ›', 'var(--green)') +
    '</div>' +
    '<div class="cap" style="padding:2px 4px 0">Preferences</div>' +
    '<div class="grp" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">' +
      '<span style="font-size:calc(15px*var(--fz));font-weight:500">Theme</span>' +
      '<div class="seg" role="radiogroup" aria-label="Theme" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
        themeBtn('system', 'System') + themeBtn('dark', 'Dark') + themeBtn('light', 'Light') + themeBtn('green', 'Green') +
      '</div>' +
      '<span style="font-size:calc(15px*var(--fz));font-weight:500">Text size</span>' +
      '<div class="seg" role="radiogroup" aria-label="Text size" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
        fontBtn('default', 'Default') + fontBtn('large', 'Large') + fontBtn('xlarge', 'Extra large') +
      '</div>' +
      '<label class="more-row"><span>Currency</span><select class="more-sel" aria-label="Currency" onchange="setCurrency(this.value)">' + curOpts + '</select></label>' +
      '<button class="more-row" onclick="openProfileModal()"><span>Your name</span><span class="s">' + esc(profile.name || 'Not set') + ' ›</span></button>' +
    '</div>' +
    '<div class="cap" style="padding:2px 4px 0">App</div>' +
    '<div class="grp">' +
      moreItem("openFeedbackModal()", icon('message',18), 'Send feedback') +
      moreItem("shareApp()", icon('link',18), 'Share app') +
      moreItem("rateApp()", icon('trophy',18), 'Rate Edgeory', '›', 'var(--gold)') +
    '</div>' +
    '<div style="text-align:center;font-size:calc(12px*var(--fz));color:var(--text3);padding:4px 0">Edgeory ' + esc(APP_VERSION) + ' · data stays on this device</div>';
}
function renderFormulasPage() {
  var cards = document.querySelectorAll('#formulasModal .formula-card');
  var html = '';
  if (cards.length) {
    for (var i = 0; i < cards.length; i++) html += cards[i].outerHTML;
  } else {
    html = '<p style="color:var(--text3)">Open formulas from the menu.</p>';
  }
  return html;
}

function setImportGuideBroker(id) {
  _importGuideBroker = id;
  document.querySelectorAll('[data-gseg]').forEach(function(el){ el.classList.toggle('on', el.getAttribute('data-gseg') === id); });
  document.querySelectorAll('[data-gp]').forEach(function(el){ el.hidden = el.getAttribute('data-gp') !== id; });
}
function setImportT212Kind(kind) {
  _importT212Kind = kind === 'ord' ? 'ord' : 'pos';
  document.querySelectorAll('[data-tseg]').forEach(function(el){ el.classList.toggle('on', el.getAttribute('data-tseg') === _importT212Kind); });
  document.querySelectorAll('[data-tp]').forEach(function(el){ el.hidden = el.getAttribute('data-tp') !== _importT212Kind; });
}
function importGuidePanel(id, html) {
  var on = (_importGuideBroker || 'xtb') === id;
  return '<div class="panel guide-box" data-gp="' + eid(id) + '"' + (on ? '' : ' hidden') + '>' + html + '</div>';
}
function renderImportGuide() {
  var b = _importGuideBroker || 'xtb';
  var t212 = _importT212Kind || 'pos';
  var native = isNativeApp();
  function segBtn(id, label) {
    return '<button class="' + (b === id ? 'on' : '') + '" data-gseg="' + eid(id) + '" onclick="setImportGuideBroker(\'' + eid(id) + '\')">' + label + '</button>';
  }
  var boxes = {
    xtb: '<ol class="chk"><li>Open the stock, then tap your open position</li><li>Take a screenshot</li></ol>' +
      '<div class="cap">Make sure you can see</div><div class="lbls"><span class="lbl">Buy</span><span class="lbl">Volume</span><span class="lbl">@ price</span></div>' +
      '<div class="miss">You’ll add the ticker and buy dates next.</div>' +
      '<div class="tip">More buys than fit on the screen? Add a second screenshot.</div>',
    baraka: '<ol class="chk"><li>Open the stock and scroll down to your position</li><li>Take a screenshot</li></ol>' +
      '<div class="cap">Make sure you can see</div><div class="lbls"><span class="lbl">Shares</span><span class="lbl">Average Cost</span><span class="lbl">Total Cost</span></div>' +
      '<div class="miss">You’ll add the buy date next.</div>',
    ibkr: '<ol class="chk"><li>Open the stock, then tap Trades</li><li>Take a screenshot</li></ol>' +
      '<div class="cap">Make sure you can see</div><div class="lbls"><span class="lbl">Date</span><span class="lbl">Bought / Sold</span><span class="lbl">Price</span><span class="lbl">Amount</span></div>' +
      '<div class="tip">Your account number is ignored and never saved.</div>',
    t212: '<div class="seg" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<button class="' + (t212==='pos'?'on':'') + '" data-tseg="pos" onclick="setImportT212Kind(\'pos\')">Open trade</button>' +
        '<button class="' + (t212==='ord'?'on':'') + '" data-tseg="ord" onclick="setImportT212Kind(\'ord\')">One order</button></div>' +
      '<div data-tp="ord" style="display:flex;flex-direction:column;gap:10px"' + (t212 === 'ord' ? '' : ' hidden') + '>' +
          '<ol class="chk"><li>History → Orders → tap the order</li><li>Take a screenshot</li></ol>' +
          '<div class="cap">Make sure you can see</div><div class="lbls"><span class="lbl">Filled quantity</span><span class="lbl">Fill price</span><span class="lbl">Total</span></div>' +
          '<div class="tip">Works for a buy or a sell. A sell on its own saves a whole closed trade.</div></div>' +
      '<div data-tp="pos" style="display:flex;flex-direction:column;gap:10px"' + (t212 === 'pos' ? '' : ' hidden') + '>' +
          '<ol class="chk"><li>Open the stock and scroll to Your investment</li><li>Take a screenshot</li></ol>' +
          '<div class="cap">Make sure you can see</div><div class="lbls"><span class="lbl">Shares</span><span class="lbl">Average price</span><span class="lbl">Value</span></div>' +
          '<div class="miss">You’ll add the buy date next.</div></div>'
  };
  return '<div style="font-size:calc(13px*var(--fz));color:var(--text2);line-height:1.5">Take one screenshot in your broker app. Edgeory reads it on this phone, and nothing is saved until you check it.</div>' +
    '<div class="seg" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      segBtn('xtb','XTB') + segBtn('baraka','Baraka') + segBtn('ibkr','IBKR') + segBtn('t212','Trading 212') +
    '</div>' +
    ['xtb','baraka','ibkr','t212'].map(function(id){ return importGuidePanel(id, boxes[id]); }).join('') +
    '<div style="font-size:calc(12px*var(--fz));color:var(--text3);line-height:1.5;text-align:center">One stock per screenshot · Broker app in English · Don’t crop the numbers</div>' +
    '<div class="import-foot"><button class="log" style="width:100%;height:44px;justify-content:center;border:none;border-radius:8px;background:var(--green);color:#04140d;font:800 calc(15px*var(--fz)) var(--sans)" onclick="startScreenshotImport()">' +
      (native ? 'Choose screenshot' : 'Available in the Android app') +
    '</button></div>';
}

function renderImportReview() {
  var d = _importDraft;
  if (!d) return '<p style="color:var(--text3)">No draft to review.</p><button class="btn btn-secondary" onclick="setView(\'import\')">Back</button>';
  var actions = function(saveOk) {
    return '<div class="import-foot import-actions">' +
      '<button class="btn btn-secondary" style="height:44px" onclick="cancelScreenshotImport()">Cancel</button>' +
      (saveOk === null ? '<span></span>' :
        '<button class="log" id="imp_save_btn" ' + (saveOk ? '' : 'disabled ') + 'style="height:44px;justify-content:center;border:none;border-radius:8px;background:var(--green);color:#04140d;font:800 calc(14px*var(--fz)) var(--sans)" onclick="confirmScreenshotImport()">Confirm &amp; save</button>') +
    '</div>';
  };
  if (d.pickTargets) {
    return '<div class="cap" style="padding:2px 2px 0">Close part of an open trade</div>' +
      d.pickTargets.map(function(id) {
        var t = state.trades.find(function(x){ return x.id === id; });
        if (!t) return '';
        var acc = state.accounts.find(function(a){ return a.id === t.accountId; });
        return '<button class="wide-row" onclick="applyImportPartial(\'' + eid(id) + '\')"><span style="color:var(--gold)">' + icon('check', 20) + '</span>' +
          '<span style="min-width:0"><span class="n" style="display:block;font-size:calc(14px*var(--fz));font-weight:700">' + esc(t.ticker) + '</span>' +
          '<span class="n" style="display:block;font-size:calc(11px*var(--fz));color:var(--text3);margin-top:1px">' + fmtQty(calcTotalQty(t)) + ' shares left · ' + esc(acc ? acc.name : '') + '</span></span><span></span></button>';
      }).join('') + actions(null);
  }
  var found = function(what) {
    return '<div class="ok">' + icon('check',14) + 'Found ' + esc(d.platform || '') + ' · ' + what + ' · read on this phone</div>';
  };
  if (d.needsSellChoice) {
    var s0 = (d.sells && d.sells[0]) || {};
    return found('1 sell') +
      '<div class="panel" style="padding:10px 12px"><div class="ev"><span class="badge" style="background:rgba(0,214,143,.12);color:var(--green)">SELL</span><div><div class="n" style="font-size:calc(13px*var(--fz));font-weight:500">' + esc(d.ticker || '') + ' · ' + fmtQty(s0.qty) + ' @ ' + fmtPrice(s0.price) + '</div><div class="sub n">' + (s0.date ? fmtDateLong(s0.date) : '') + '</div></div><span class="n" style="color:var(--text2)">' + fmtMoney(s0.amount || 0) + '</span></div></div>' +
      '<button class="wide-row" onclick="chooseImportSell(\'partial\')"><span style="color:var(--gold)">' + icon('check', 20) + '</span><span style="min-width:0"><span style="display:block;font-size:calc(14px*var(--fz));font-weight:700">Close part of an open trade</span></span><span></span></button>' +
      '<button class="wide-row" onclick="chooseImportSell(\'closed\')"><span style="color:var(--green)">' + icon('save', 20) + '</span><span style="min-width:0"><span style="display:block;font-size:calc(14px*var(--fz));font-weight:700">Save as a closed trade</span></span><span></span></button>' +
      actions(null);
  }
  var accOpts = state.accounts.map(function(a){
    return '<option value="' + esc(a.id) + '"' + (d.accountId === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  }).join('');
  var buys = d.buys || [];
  var sum = importLotsSummary(buys);
  var scr = d.screen;
  var oneLot = scr === 'baraka' || scr === 't212-position';
  var foundWhat = scr === 'baraka' ? '1 position'
    : scr === 't212-position' ? 'open position'
    : scr === 'ibkr' ? plural(buys.length + (d.sells || []).length, 'fill', 'fills')
    : d.sellOnly ? '1 sell'
    : plural(buys.length, 'buy', 'buys');
  var third;
  if (scr === 'ibkr') third = statCard('Fees', fmtMoney(d.feesRead || 0), '', 'var(--red)');
  else if (d.sellOnly) third = statCard('Net P&L', fmtPnl(d.realized || 0), '', pnlColor(d.realized || 0));
  else if (d.current_price) {
    var unreal = scr === 't212-position' && d.returnRead != null ? d.returnRead : (d.current_price - sum.avg) * sum.qty;
    third = statCard('At ' + fmtPrice(d.current_price), fmtPnl(unreal), '', pnlColor(unreal));
  } else third = statCard('Fees', fmtMoney(parseFloat(d.fees) || 0), '', 'var(--red)');
  var avgTxt = fmtPrice(sum.avg);
  if (scr === 't212-position' && buys[0] && parseFloat(buys[0].price) > 0) {
    var avgDp = Math.min(4, Math.max(2, (String(buys[0].price).split('.')[1] || '').length));
    avgTxt = currSym() + Number(buys[0].price).toLocaleString('en-US', { minimumFractionDigits: avgDp, maximumFractionDigits: avgDp });
  }
  var goldSym = scr === 'xtb' || !d.ticker;
  var lotHead = function(dateLabel) {
    return '<div class="lot" style="padding-block:6px;background:var(--surface2)"><span class="fl" style="margin:0">SHARES</span><span class="fl" style="margin:0">' + (oneLot ? 'AVG PRICE' : 'PRICE') + '</span><span class="fl" style="margin:0">' + dateLabel + '</span></div>';
  };
  var hasGoldDate = buys.some(function(b){ return !b.date; });
  var miss = '';
  if (scr === 'baraka' && d.totalCost && sum.qty) miss = 'Baraka shows ' + fmtPrice(d.avgShown || 0) + ' rounded. Edgeory uses ' + fmtMoney(d.totalCost) + ' ÷ ' + esc(String(sum.qty)) + ' so your P&amp;L is exact.';
  else if (scr === 't212-position') miss = 'Trading 212 doesn’t show the date here. Add it, or import the buy order from History for the exact date.';
  else if (d.sellOnly) miss = 'Gold fields aren’t on the screenshot.';
  else if (goldSym && scr === 'xtb' || hasGoldDate) miss = 'Gold fields aren’t on the screenshot. Empty dates use today.';
  var html = '<div class="review-warn">' + cicon('bulb',16,'var(--gold)') +
      '<span><b style="color:var(--text)">Check every field before saving.</b> Edgeory filled them from your screenshot. Fix anything that’s wrong, then tap Confirm &amp; save.</span></div>' +
    found(foundWhat) +
    '<div class="stats-row imp-stats" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      statCard('Avg entry', avgTxt, '', 'var(--blue)') +
      statCard('Shares', fmtQty(sum.qty), '', 'var(--purple)') +
      third +
    '</div>' +
    '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px">' +
      '<div><label for="imp_ticker" class="fl" style="display:block">SYMBOL</label><input id="imp_ticker" class="inp' + (goldSym ? ' gold' : '') + '" value="' + esc(d.ticker || '') + '" autocapitalize="characters">' +
        (d.nameHint ? '<div class="sub">from “' + esc(d.nameHint) + '”</div>' : '') + '</div>' +
      '<div><label for="imp_account" class="fl" style="display:block">ACCOUNT</label><select id="imp_account" class="inp" style="font-family:var(--sans)">' + accOpts + '</select></div>' +
    '</div>';
  var ibkrRead = scr === 'ibkr' && buys.concat(d.sells || []).every(function(b) {
    return b.date && b.check !== false && parseFloat(b.qty) > 0 && parseFloat(b.price) > 0;
  });
  if (ibkrRead) {
    var fillRow = function(kind, b) {
      var c = kind === 'BUY' ? 'var(--blue)' : 'var(--green)', bg = kind === 'BUY' ? 'rgba(77,159,255,.12)' : 'rgba(0,214,143,.12)';
      var sub = fmtDateLong(b.date) + (b.time ? ' · ' + esc(String(b.time).slice(0, 5)) : '') + (b.commission != null ? ' · comm ' + fmtMoney(b.commission) : '');
      return '<div class="ev"><span class="badge" style="background:' + bg + ';color:' + c + '">' + kind + '</span><div><div class="n" style="font-size:calc(13px*var(--fz));font-weight:500">' + fmtQty(b.qty) + ' @ ' + fmtPrice(b.price) + '</div><div class="sub n">' + sub + '</div></div><span class="n" style="color:var(--text2)">' + fmtMoney(b.amount || b.qty * b.price) + '</span></div>';
    };
    html += '<div class="panel" style="padding:10px 12px">' +
      buys.map(function(b){ return fillRow('BUY', b); }).join('') +
      (d.sells || []).map(function(b){ return fillRow('SELL', b); }).join('') + '</div>';
  } else {
    html += '<div class="panel">' + lotHead(oneLot ? 'FIRST BUY' : 'BUY DATE') +
      buys.map(function(b, i){ return importLotRow('imp_', i, b); }).join('') +
    '</div>';
  }
  if (d.sells && d.sells.length && !d.sellOnly && !ibkrRead) {
    html += '<div class="panel">' + lotHead('SELL DATE') +
      d.sells.map(function(b, i){ return importLotRow('imps_', i, b); }).join('') + '</div>';
  }
  if (d.sellOnly) {
    html += '<div class="panel" style="padding:10px 12px"><div class="ev"><span class="badge" style="background:rgba(0,214,143,.12);color:var(--green)">SELL</span><div><div class="n" style="font-size:calc(13px*var(--fz));font-weight:500">' + fmtQty(sum.qty) + ' @ ' + fmtPrice(d.exit) + '</div><div class="sub n">' + (d.exit_date ? fmtDateLong(d.exit_date) : '') + '</div></div><span class="n" style="color:' + pnlColor(d.realized || 0) + '">' + fmtPnl(d.realized || 0) + '</span></div></div>';
  }
  if (scr === 'xtb') {
    html += '<button class="setp" style="align-self:flex-start" onclick="addSecondScreenshot()">+ Add a second screenshot</button>';
  }
  if (miss) html += '<div class="miss">' + miss + '</div>';
  if (scr === 'ibkr') html += '<div class="sub" style="font-size:calc(12px*var(--fz))">Your account number on the screenshot was ignored and not saved.</div>';
  var chk = importCheckState(d);
  html += '<div id="imp_check" class="' + (chk.ok ? 'ok' : 'miss') + '"' + (chk.ok ? '' : ' style="color:var(--red)"') + '>' + chk.html + '</div>' +
    '<div style="font-size:calc(12px*var(--fz));color:var(--text3)">Read something wrong? <a href="#" onclick="reportImportIssue();return false" style="color:var(--blue)">Report it</a> and we’ll fix the reader.</div>' +
    actions(chk.ok);
  return html;
}

function importLotRow(prefix, i, b) {
  var bad = b.check === false && !b.edited;
  var val = function(v){ return esc(v == null ? '' : String(v)); };
  var priceVal = function(v) {
    if (v == null || !isFinite(v)) return val(v);
    var dp = (String(v).split('.')[1] || '').length;
    return dp < 2 ? Number(v).toFixed(2) : dp > 4 ? String(+Number(v).toFixed(4)) : String(v);
  };
  return '<div class="lot' + (bad ? ' bad' : '') + '" id="' + prefix + 'lot_' + i + '">' +
    '<input class="inp" id="' + prefix + 'qty_' + i + '" inputmode="decimal" aria-label="Shares" value="' + val(b.qty) + '" oninput="editImportLot(\'' + prefix + '\',' + i + ')">' +
    '<input class="inp" id="' + prefix + 'price_' + i + '" inputmode="decimal" aria-label="Price" value="' + priceVal(b.price) + '" oninput="editImportLot(\'' + prefix + '\',' + i + ')">' +
    '<input class="inp' + (b.date ? '' : ' gold') + '" id="' + prefix + 'date_' + i + '" type="date" aria-label="Date" value="' + val(b.date) + '" max="' + today() + '">' +
  '</div>';
}

function importLotsSummary(lots) {
  var q = 0, c = 0;
  (lots || []).forEach(function(b) {
    var qty = parseFloat(b.qty) || 0, price = parseFloat(b.price) || 0;
    q += qty; c += qty * price;
  });
  return { qty: q, avg: q ? c / q : 0 };
}

function importOkText(d) {
  var buys = d.buys || [];
  var b0 = buys[0] || {};
  if (d.screen === 'xtb') return 'Shares × price matches XTB’s market value' + (buys.length > 1 ? ' on all ' + buys.length + ' buys' : '');
  if (d.screen === 'baraka') return 'Shares × average matches Baraka’s total cost';
  if (d.screen === 'ibkr') {
    var all = buys.concat(d.sells || []);
    if (all.length === 1) return esc(fmtQty(all[0].qty)) + ' × ' + fmtPrice(all[0].price) + ' matches IBKR’s amount ' + fmtMoney(all[0].amount || 0);
    return 'Shares × price matches IBKR’s amount on all ' + all.length + ' fills';
  }
  if (d.screen === 't212-position') return 'Shares × average + return matches the ' + fmtMoney((d.current_price || 0) * (parseFloat(b0.qty) || 0)) + ' value';
  var row = d.sellOnly ? ((d.sells || [])[0] || {}) : b0;
  return 'Shares × fill price matches the total ' + fmtMoney(row.amount || 0);
}

function importCheckState(d) {
  var rows = (d.buys || []).concat(d.sellOnly ? [] : (d.sells || []));
  var valid = rows.length > 0 && rows.every(function(b){ return parseFloat(b.qty) > 0 && parseFloat(b.price) > 0; });
  var pending = rows.some(function(b){ return b.check === false && !b.edited; });
  if (!valid || pending) return { ok: false, html: 'These numbers don’t add up. Please check them.' };
  var allPassed = (d.buys || []).concat(d.sells || []).every(function(b){ return b.check !== false; });
  return { ok: true, html: allPassed ? icon('check',14) + importOkText(d) : '' };
}

function syncImportInputs() {
  var d = _importDraft;
  if (!d) return;
  var tk = document.getElementById('imp_ticker');
  if (tk) d.ticker = tk.value.trim().toUpperCase();
  var acc = document.getElementById('imp_account');
  if (acc) d.accountId = acc.value;
  [['imp_', d.buys], ['imps_', d.sellOnly ? null : d.sells]].forEach(function(pair) {
    (pair[1] || []).forEach(function(b, i) {
      var q = document.getElementById(pair[0] + 'qty_' + i);
      var p = document.getElementById(pair[0] + 'price_' + i);
      var dt = document.getElementById(pair[0] + 'date_' + i);
      if (q) b.qty = q.value.trim() === '' ? null : parseFloat(q.value);
      if (p) {
        var pv = p.value.trim() === '' ? null : parseFloat(p.value);
        if (!(b.price != null && pv === +Number(b.price).toFixed(4))) b.price = pv;
      }
      if (dt) b.date = dt.value || null;
    });
  });
}

function editImportLot(prefix, i) {
  var d = _importDraft;
  if (!d) return;
  var list = prefix === 'imps_' ? d.sells : d.buys;
  if (list && list[i]) list[i].edited = true;
  var row = document.getElementById(prefix + 'lot_' + i);
  if (row) row.classList.remove('bad');
  recheckImportLots();
}

function startScreenshotImport(merge) {
  if (!isNativeApp()) {
    showToast('Available in the Android app', 'info');
    return;
  }
  _importMerge = !!merge;
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
      var data = String(reader.result || '');
      var b64 = data.indexOf(',') >= 0 ? data.split(',')[1] : data;
      runMlkitOcr(b64);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function ocrTextFromResult(res) {
  var lines = [];
  ((res && res.blocks) || []).forEach(function(b) {
    (b.lines || []).forEach(function(l) {
      var box = l.boundingBox || {};
      var h = (box.bottom || 0) - (box.top || 0);
      lines.push({ text: l.text || '', top: box.top || 0, left: box.left || 0, height: h || 12 });
    });
  });
  if (!lines.length) return (res && (res.text || res.fullText)) || '';
  lines.sort(function(a, b) { return a.top - b.top || a.left - b.left; });
  var rows = [];
  lines.forEach(function(l) {
    var last = rows[rows.length - 1];
    var mid = l.top + l.height / 2;
    if (last && Math.abs(mid - (last.top + last.height / 2)) < Math.max(last.height, l.height) / 2) {
      last.parts.push(l);
      return;
    }
    rows.push({ top: l.top, height: l.height, parts: [l] });
  });
  return rows.map(function(r) {
    r.parts.sort(function(a, b) { return a.left - b.left; });
    return r.parts.map(function(p) { return p.text; }).join(' ');
  }).join('\n');
}

function runMlkitOcr(base64) {
  var Cap = window.Capacitor;
  var plugin = Cap && Cap.Plugins && (Cap.Plugins.CapacitorMlkitTextRecognition || Cap.Plugins.MlKitTextRecognition);
  if (!plugin || typeof plugin.detectText !== 'function') {
    showToast('Available in the Android app', 'info');
    return;
  }
  plugin.detectText({ base64Image: base64, rotation: 0 }).then(function(res) {
    applyOcrText(ocrTextFromResult(res));
  }).catch(function() {
    showToast('Could not read that screenshot', 'error');
  });
}

function getNameTickers() {
  var out = {};
  try {
    var raw = JSON.parse(localStorage.getItem('tl_name_tickers') || '{}');
    Object.keys(raw || {}).forEach(function(k) {
      var v = String(raw[k] || '');
      if (k.length <= 60 && /^[A-Z0-9.\-]{1,12}$/.test(v)) out[k] = v;
    });
  } catch (e) {}
  return out;
}

function rememberNameTicker(name, ticker) {
  if (!name || !/^[A-Z0-9.\-]{1,12}$/.test(ticker) || name.length > 60) return;
  var map = getNameTickers();
  map[name] = ticker;
  try { localStorage.setItem('tl_name_tickers', JSON.stringify(map)); } catch (e) {}
}

function applyOcrText(text) {
  var parsed = parseScreenshotText(text);
  var merge = _importMerge && _importDraft;
  _importMerge = false;
  if (merge) {
    if (parsed.error || parsed.screen !== 'xtb') {
      showToast(parsed.error || 'This screen isn’t supported yet', 'error');
      return;
    }
    _importDraft.buys = siMergeBuys(_importDraft.buys, parsed.buys);
    if (!_importDraft.current_price && parsed.current) _importDraft.current_price = parsed.current;
    renderMain();
    return;
  }
  if (parsed.error) {
    showToast(parsed.error, 'error');
    setView('import');
    return;
  }
  var accId = filterAccountId !== 'all' ? filterAccountId : (state.activeAccountId || (state.accounts[0] && state.accounts[0].id));
  _importDraft = screenshotDraftToTrade(parsed, accId);
  if (parsed.screen === 'xtb' && parsed.name) {
    var known = getNameTickers()[parsed.name];
    if (known) _importDraft.ticker = known;
  }
  setView('import-review');
}

function addSecondScreenshot() {
  syncImportInputs();
  startScreenshotImport(true);
}

function cancelScreenshotImport() {
  _importDraft = null;
  _importMerge = false;
  setView('import');
}

function recheckImportLots() {
  if (!_importDraft) return;
  syncImportInputs();
  var chk = importCheckState(_importDraft);
  var el = document.getElementById('imp_check');
  if (el) {
    el.className = chk.ok ? 'ok' : 'miss';
    el.style.color = chk.ok ? '' : 'var(--red)';
    el.innerHTML = chk.html;
  }
  var btn = document.getElementById('imp_save_btn');
  if (btn) btn.disabled = !chk.ok;
}

function reportImportIssue() {
  var d = _importDraft || {};
  var line = function(kind, b) { return kind + ': ' + (b.qty == null ? '' : b.qty) + ' @ ' + (b.price == null ? '' : b.price) + (b.date ? ' · ' + b.date : ''); };
  var nums = (d.read && d.read.buys || []).map(function(b){ return line('buy', b); })
    .concat((d.read && d.read.sells || []).map(function(b){ return line('sell', b); }));
  var body = 'Platform: ' + (d.platform || '') + '\nScreen: ' + (d.screen || '') +
    '\nSymbol read: ' + (d.read ? d.read.symbol || '' : '') +
    (d.read && d.read.name ? '\nName read: ' + d.read.name : '') +
    (d.current_price ? '\nCurrent price read: ' + d.current_price : '') +
    '\n' + nums.join('\n');
  window.location.href = 'mailto:smartappsflow@gmail.com?subject=' + encodeURIComponent('Edgeory - Screenshot import issue') + '&body=' + encodeURIComponent(body);
}

function chooseImportSell(mode) {
  var d = _importDraft;
  if (!d) return;
  var sell = (d.sells && d.sells[0]) || {};
  if (mode === 'closed') {
    d.needsSellChoice = false;
    d.sellOnly = true;
    d.status = 'closed';
    d.exit = sell.price;
    d.exit_date = sell.date || '';
    d.realized = sell.realized || 0;
    d.buys = [{ qty: sell.qty, price: sell.derivedEntry || null, date: null, check: sell.derivedEntry ? sell.check : true }];
    renderMain();
    return;
  }
  var sym = String(d.ticker || '').toUpperCase();
  var openSame = state.trades.filter(function(t){ return t.status === 'open' && String(t.ticker).toUpperCase() === sym; });
  if (!openSame.length) { showToast('No open trade with that symbol', 'error'); return; }
  if (openSame.length === 1) { applyImportPartial(openSame[0].id); return; }
  d.needsSellChoice = false;
  d.pickTargets = openSame.map(function(t){ return t.id; });
  renderMain();
}

function applyImportPartial(tradeId) {
  var d = _importDraft;
  if (!d) return;
  var sell = (d.sells && d.sells[0]) || {};
  _importDraft = null;
  setView('trades');
  openPartialClose(tradeId);
  var q = document.getElementById('pc_qty'); if (q) q.value = sell.qty || '';
  var p = document.getElementById('pc_price'); if (p) p.value = sell.price || '';
  var dt = document.getElementById('pc_date'); if (dt && sell.date) dt.value = sell.date;
  var fm = document.getElementById('pc_fees_mode'); if (fm) fm.value = '$';
  updatePartialPreview();
}

function confirmScreenshotImport() {
  var d = _importDraft;
  if (!d) return;
  syncImportInputs();
  if (!importCheckState(d).ok) return;
  var ticker = String(d.ticker || '').toUpperCase().trim();
  var accId = d.accountId;
  var lots = (d.buys || []).map(function(b) {
    return { qty: parseFloat(b.qty), price: parseFloat(b.price), date: b.date || '' };
  });
  var first = lots[0];
  if (!ticker || !accId || !first || !(first.qty > 0) || !(first.price > 0)) { showToast('Fill account, symbol, shares, and entry first', 'error'); return; }
  if (d.sellOnly && !first.date) { showToast('Enter the buy date', 'error'); return; }
  var td = today();
  lots.forEach(function(b){ if (!b.date) b.date = td; });
  if (lots.some(function(b){ return b.date > td; })) { showToast('Entry date cannot be in the future', 'error'); return; }
  if (d.sellOnly && d.exit_date && d.exit_date < first.date) { showToast('Exit date cannot be before the entry date', 'error'); return; }
  var now = Date.now();
  var trade = {
    id: 'tr_' + now,
    accountId: accId,
    ticker: ticker,
    type: '',
    direction: 'Long',
    status: 'open',
    entry: first.price,
    exit: null,
    qty: lots.reduce(function(s, b){ return s + b.qty; }, 0),
    original_qty: first.qty,
    entry_date: first.date,
    exit_date: null,
    fees: d.fees || '',
    fees_mode: '$',
    risk: null, target: null, stoploss: null,
    current_price: d.current_price || null,
    notes: '',
    createdAt: new Date().toISOString(),
    photos: [],
    add_buys: lots.slice(1).map(function(b, n) {
      return { id: String(now + n + 1), ts: now + n + 1, qty: b.qty, price: b.price, date: b.date, fees: '0', fees_mode: '$' };
    }),
    partial_closes: []
  };
  if (d.sellOnly) {
    trade.status = 'closed';
    trade.exit = d.exit;
    trade.exit_date = d.exit_date || td;
    trade.current_price = null;
  } else if (d.sells && d.sells.length) {
    d.sells.forEach(function(s, n) {
      var q = parseFloat(s.qty), p = parseFloat(s.price);
      if (!(q > 0 && p > 0)) return;
      trade.partial_closes.push({ id: String(now + 100 + n), ts: now + 100 + n, qty: q, price: p, date: s.date || td,
        fees: String(s.commission || 0), fees_mode: '$', basis: calcPositionState(trade).avg });
    });
    var rem = calcTotalQty(trade);
    if (rem <= 0.0001) {
      var lastPc = trade.partial_closes[trade.partial_closes.length - 1];
      trade.status = 'closed'; trade.exit = lastPc.price; trade.exit_date = lastPc.date; trade.qty = 0; trade.current_price = null;
    } else {
      trade.qty = rem;
    }
  }
  if (d.screen === 'xtb' && d.nameHint) rememberNameTicker(d.nameHint, ticker);
  state.trades.unshift(trade);
  _importDraft = null;
  save();
  renderSidebar();
  haptic('success');
  setView('trades');
  showToast('Trade saved from screenshot', 'success');
}

function tickerDistance(a, b) {
  a = String(a || '').toUpperCase(); b = String(b || '').toUpperCase();
  var m = [];
  var i, j;
  for (i = 0; i <= a.length; i++) m[i] = [i];
  for (j = 0; j <= b.length; j++) m[0][j] = j;
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

function rateApp() {
  closeDrawer();
  var url = PLAY_STORE_URL;
  var Cap = window.Capacitor;
  var native = isNativeApp();
  if (native && Cap.Plugins && Cap.Plugins.InAppReview && typeof Cap.Plugins.InAppReview.requestReview === 'function') {
    Cap.Plugins.InAppReview.requestReview().catch(function() { openPlayStorePage(url); });
    return;
  }
  openPlayStorePage(url);
}

function openPlayStorePage(url) {
  var Cap = window.Capacitor;
  if (isNativeApp() && Cap.Plugins && Cap.Plugins.Browser) {
    Cap.Plugins.Browser.open({ url: url }).catch(function() {
      window.open(url, '_blank', 'noopener');
    });
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function openFormulasModal() { setView('formulas'); }

function dismissModal(id) {
  if (id === 'tradeModal') cancelTradeModal();
  else if (id === 'partialCloseModal' || id === 'addBuyModal') cancelSubModal(id);
  else if (id === 'confirmSheet') { _confirmSheetCb = null; closeModal(id); }
  else if (id === 'promptSheet') closePromptSheet(false);
  else closeModal(id);
}

function initSheetSwipe() {
  var sheet = null, startY = 0, dy = 0;
  document.addEventListener('touchstart', function(e) {
    if (window.innerWidth > 768 || !e.target.closest) return;
    if (e.target.closest('button,input,select,textarea,a')) return;
    var grab = e.target.closest('.sheet-handle,.modal-header');
    var m = grab && grab.closest('.modal');
    if (!m || !m.querySelector('.sheet-handle')) return;
    sheet = m; startY = e.touches[0].clientY; dy = 0;
    sheet.style.transition = 'none';
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!sheet) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  var end = function() {
    if (!sheet) return;
    var m = sheet, overlay = m.closest('.modal-overlay');
    sheet = null;
    m.style.transition = 'transform .18s ease';
    m.style.transform = '';
    if (dy > 80 && overlay) dismissModal(overlay.id);
    setTimeout(function(){ m.style.transition = ''; }, 200);
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
}

var _backExitAt = 0;
function handleAndroidBack() {
  var lightbox = document.getElementById('lightbox');
  if (lightbox && lightbox.classList.contains('open')) { closeLightbox(); return; }
  if (_modalStack.length) {
    dismissModal(_modalStack[_modalStack.length - 1]);
    return;
  }
  var drawer = document.getElementById('sideDrawer');
  if (drawer && drawer.classList.contains('open')) { closeDrawer(); return; }
  if (MORE_VIEWS[currentView]) { setView('more'); return; }
  if (currentView !== 'dashboard') { setView('dashboard'); return; }
  if (Date.now() - _backExitAt > 2000) {
    _backExitAt = Date.now();
    showToast('Press back again to exit', 'info');
    return;
  }
  _backExitAt = 0;
  var Cap = window.Capacitor;
  if (Cap && Cap.Plugins && Cap.Plugins.App && typeof Cap.Plugins.App.minimizeApp === 'function') {
    Cap.Plugins.App.minimizeApp();
  }
}

function initApp() {
  // Must run before anything saves state, so a first-time visitor is not mistaken for a returning one.
  var returningUser = false;
  try { returningUser = !!(localStorage.getItem('tl_v3') || localStorage.getItem('tl_state_v2') || localStorage.getItem('tl_state')); } catch(e) {}
  try { localStorage.removeItem('tl_sp500_cache'); } catch(e) {}
  initSheetSwipe();
  var verEl = document.getElementById('appVersionLabel');
  if (verEl) verEl.textContent = APP_VERSION;

  // Apply theme
  try { applyTheme(localStorage.getItem('tl_theme') || 'dark'); } catch(e) {}
  try { updateCurrencyLabels(); } catch(e) {}

  // Load state from localStorage synchronously (always sanitize — IDs flow into onclick).
  try {
    var keys = ['tl_v3', 'tl_state_v2', 'tl_state'];
    for (var k = 0; k < keys.length; k++) {
      var saved = localStorage.getItem(keys[k]);
      if (saved) {
        var parsed = JSON.parse(saved);
        if (applyLoadedState(parsed)) break;
      }
    }
  } catch(e) {}

  // Render app
  try { renderSidebar(); } catch(e) {}
  try { renderMain(); } catch(e) {}
  try { renderFilterBar(); } catch(e) {}

  // Background: try IndexedDB for GitHub Pages
  try {
    if (window.location.protocol === 'https:') {
      loadFromDB(function() {
        try { renderSidebar(); renderMain(); } catch(e) {}
      });
    }
  } catch(e) {}

  // Service worker — web only. Inside the native app the assets already ship
  // with the APK, and a cached copy keeps serving the previous version's JS
  // after an update, so any existing registration is removed there instead.
  var isNativeApp = !!(window.Capacitor && (
    (typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) ||
    window.Capacitor.isNative
  ));
  if ('serviceWorker' in navigator) {
    if (isNativeApp) {
      try { purgeServiceWorkerInNativeApp(); } catch(e) {}
    } else if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
      try { watchWebUpdates(); } catch(e) {}
    }
  }
  if (isNativeApp && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    try { window.Capacitor.Plugins.App.addListener('backButton', handleAndroidBack); } catch(e) {}
  }
  try { maybeShowWhatsNew(returningUser); } catch(e) {}
}

// Shown once after an update, only to people who had data from an older version.
// Older web releases had no update banner, so this is how they learn what changed.
function maybeShowWhatsNew(returningUser) {
  var seen = null;
  try { seen = localStorage.getItem('tl_whats_new'); } catch(e) { return; }
  if (seen === WHATS_NEW_ID) return;
  try { localStorage.setItem('tl_whats_new', WHATS_NEW_ID); } catch(e) {}
  if (!returningUser || document.getElementById('updateBanner')) return;
  var bar = document.createElement('div');
  bar.id = 'whatsNewBanner';
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<div class="ub-text"><b>Edgeory updated</b><span>' + esc(WHATS_NEW_TEXT) + '</span></div>' +
    '<button type="button" class="ub-now" onclick="dismissWhatsNew()">Got it</button>';
  document.body.appendChild(bar);
}
function dismissWhatsNew() {
  var b = document.getElementById('whatsNewBanner');
  if (b) b.remove();
}

// Web only. A new release waits in the service worker until the user taps Update,
// then the page reloads once on the new files.
var _swWaiting = null, _swUpdateAsked = false;
function watchWebUpdates() {
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function(reg) {
    var check = function() { if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting); };
    check();
    reg.addEventListener('updatefound', function() {
      var nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', function() {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
      });
    });
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') reg.update().then(check).catch(function(){});
    });
  }).catch(function(){});
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if ((!hadController && !_swUpdateAsked) || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
function showUpdateBanner(worker) {
  _swWaiting = worker;
  if (document.getElementById('updateBanner')) return;
  var bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  bar.innerHTML = '<div class="ub-text"><b>Update available</b><span id="updateNote">A new version of Edgeory is ready.</span></div>' +
    '<button type="button" class="ub-later" onclick="dismissUpdateBanner()">Later</button>' +
    '<button type="button" class="ub-now" onclick="applyWebUpdate(this)">Update</button>';
  document.body.appendChild(bar);
  var onMsg = function(e) {
    if (!e.data || e.data.type !== 'VERSION_INFO') return;
    navigator.serviceWorker.removeEventListener('message', onMsg);
    var n = document.getElementById('updateNote');
    if (n && typeof e.data.note === 'string' && e.data.note) n.textContent = e.data.note;
  };
  navigator.serviceWorker.addEventListener('message', onMsg);
  try { worker.postMessage('GET_VERSION_INFO'); } catch(e) {}
}
function dismissUpdateBanner() {
  var b = document.getElementById('updateBanner');
  if (b) b.remove();
}
function applyWebUpdate(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }
  _swUpdateAsked = true;
  if (_swWaiting) _swWaiting.postMessage('SKIP_WAITING');
  else window.location.reload();
}

// Unregisters the web service worker and drops its caches inside the native
// app, then reloads once so the current session stops running cached JS.
function purgeServiceWorkerInNativeApp() {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    var had = regs.length > 0;
    return Promise.all(regs.map(function(r){ return r.unregister(); })).then(function() {
      if (!window.caches || !caches.keys) return had;
      return caches.keys().then(function(keys) {
        var ours = keys.filter(function(k) {
          return k.indexOf('edgeory-') === 0 || k.indexOf('trademory-') === 0 || k.indexOf('tradelogpro-') === 0;
        });
        return Promise.all(ours.map(function(k){ return caches.delete(k); })).then(function() {
          return had || ours.length > 0;
        });
      });
    });
  }).then(function(purged) {
    if (!purged) return;
    if (localStorage.getItem('tl_sw_purged') === '1') return;
    localStorage.setItem('tl_sw_purged', '1');
    window.location.reload();
  }).catch(function(){});
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  setTimeout(initApp, 0);
}
