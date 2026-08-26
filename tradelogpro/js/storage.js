// ==========================================================================
// STORAGE HELPERS
// ==========================================================================
function openDB(callback) {
  if (_db) { callback(_db); return; }
  try {
    // Legacy DB name — changing it wipes on-device journals. Keep stable.
    var req = indexedDB.open('TradeLogPro', 2);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('state')) db.createObjectStore('state', {keyPath:'id'});
    };
    req.onsuccess = function(e) { _db = e.target.result; callback(_db); };
    req.onerror = function() { callback(null); };
  } catch(err) { callback(null); }
}

function save() {
  state.schemaVersion = 3;
  state.updatedAt = new Date().toISOString();
  var lsOk = true;
  try { localStorage.setItem('tl_v3', JSON.stringify(state)); }
  catch(e) {
    lsOk = false;
    if (!window._storageWarned) {
      window._storageWarned = true;
      showToast('Storage is full — export a backup and remove old trade photos to free space', 'error');
    }
  }
  if (lsOk) window._storageWarned = false;
  openDB(function(db) {
    if (!db) return;
    try {
      var tx = db.transaction('state','readwrite');
      tx.objectStore('state').put({id:'main', data: JSON.stringify(state)});
    } catch(e) {}
  });
}

function applyLoadedState(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  var cleaned = sanitizeState(parsed);
  if (!cleaned.accounts || !cleaned.accounts.length) return false;
  state = cleaned;
  state.trades = state.trades || [];
  state.accounts = state.accounts || [];
  state.activeAccountId = state.activeAccountId || (state.accounts[0] && state.accounts[0].id) || null;
  state.trades.forEach(function(t){
    if (!t.fees_mode) t.fees_mode = '%';
    if (!t.original_qty) t.original_qty = t.qty;
    if (!t.add_buys) t.add_buys = [];
    if (!t.partial_closes) t.partial_closes = [];
    migrateBasis(t);
  });
  return true;
}

function loadFromDB(callback) {
  openDB(function(db) {
    if (!db) {
      try {
        var ls = localStorage.getItem('tl_v3');
        if (ls) applyLoadedState(JSON.parse(ls));
      } catch(e) {}
      callback(); return;
    }
    try {
      var req = db.transaction('state','readonly').objectStore('state').get('main');
      req.onsuccess = function(e) {
        var idb = null, lsv = null;
        if (e.target.result && e.target.result.data) {
          try { var d = JSON.parse(e.target.result.data); if (d && d.accounts) idb = d; } catch(err) {}
        }
        try { var ls2 = localStorage.getItem('tl_v3'); if (ls2) { var p = JSON.parse(ls2); if (p && p.accounts) lsv = p; } } catch(e2) {}
        // Newest-wins: pick the copy with the later updatedAt stamp, then
        // immediately mirror the winner into BOTH stores so they can't
        // drift until the next manual save.
        var needSync = false;
        var winner = null;
        if (idb && lsv) {
          var lsStamp = lsv.updatedAt || '', idbStamp = idb.updatedAt || '';
          winner = (lsStamp > idbStamp) ? lsv : idb;
          if (lsStamp !== idbStamp) needSync = true;
        } else if (idb) { winner = idb; needSync = true; }
        else if (lsv) { winner = lsv; needSync = true; }
        if (winner) applyLoadedState(winner);
        if (needSync) save();
        callback();
      };
      req.onerror = function() { callback(); };
    } catch(e) { callback(); }
  });
}

function getActiveAccount() { return state.accounts.find(function(a){return a.id===state.activeAccountId;})||null; }
function getAccountTrades(aid) { return state.trades.filter(function(t){return t.accountId===aid;}); }
function today() { return new Date().toISOString().split('T')[0]; }

// ==========================================================================
