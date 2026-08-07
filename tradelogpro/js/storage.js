// ==========================================================================
// STORAGE HELPERS
// ==========================================================================
function openDB(callback) {
  if (_db) { callback(_db); return; }
  try {
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

function loadFromDB(callback) {
  openDB(function(db) {
    if (!db) {
      try { var ls = localStorage.getItem('tl_v3'); if (ls) state = JSON.parse(ls) || state; } catch(e) {}
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
        if (idb && lsv) {
          var lsStamp = lsv.updatedAt || '', idbStamp = idb.updatedAt || '';
          state = (lsStamp > idbStamp) ? lsv : idb;
          if (lsStamp !== idbStamp) needSync = true;
        } else if (idb) { state = idb; needSync = true; }
        else if (lsv) { state = lsv; needSync = true; }
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
