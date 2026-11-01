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

// ── Photos across the two stores ──────────────────────────────────────────────
// IndexedDB holds the full state, photos included. localStorage (about 5MB) holds a
// copy that leaves out only the photos already confirmed in IndexedDB: a trade's
// photos are stripped there, with a reference (photoRefs[tradeId] = signature), only
// when the last *completed* IndexedDB write held exactly those photos (_photoDurable).
// New, changed or not-yet-confirmed photos stay inline in localStorage, so closing
// the app mid-write, or a failed or aborted IndexedDB write, never loses them; a
// trade whose photos were removed has no reference, so nothing brings them back.
function photoSig(photos) {
  if (!photos || !photos.length) return '';
  return photos.length + ':' + photos.map(function(p){ p = String(p || ''); return p.length + '.' + p.slice(-24); }).join('|');
}
function photoSigs(trades) {
  var out = {};
  (trades || []).forEach(function(t){ if (t && t.id && t.photos && t.photos.length) out[t.id] = photoSig(t.photos); });
  return out;
}
window._photoDurable = window._photoDurable || {};
function lsSnapshot(st) {
  var refs = {}, any = false;
  var canStrip = !!window._dbReady && !!_db && window._idbOk !== false;
  var pending = window._pendingPhotoRefs || null; // loaded stripped, IndexedDB not read yet
  var trades = st.trades.map(function(t){
    var sig = photoSig(t.photos);
    if (sig && canStrip && window._photoDurable[t.id] === sig) { refs[t.id] = sig; any = true; return Object.assign({}, t, { photos: [] }); }
    if (!sig && pending && pending[t.id]) { refs[t.id] = pending[t.id]; any = true; } // keep the pointer until merged
    return t;
  });
  var out = Object.assign({}, st, { trades: trades });
  delete out.photoRefs; delete out.photosInDb;
  if (any) { out.photoRefs = refs; out.photosInDb = true; }
  if (window._pendingLegacyPhotos) out.photosInDb = true; // v30/v31 copy not merged yet
  return out;
}
function writeLocal(st) {
  try { localStorage.setItem('tl_v3', JSON.stringify(lsSnapshot(st))); return true; }
  catch(e) {
    if (!window._storageWarned) {
      window._storageWarned = true;
      showToast('Storage is full — export a backup and remove old trade photos to free space', 'error');
    }
    return false;
  }
}

function save() {
  state.schemaVersion = 3;
  state.updatedAt = new Date().toISOString();
  // Newest copy even within one millisecond, and above anything this device has stored
  // (a restored older backup carries a smaller counter).
  state.rev = Math.max(parseInt(state.rev, 10) || 0, window._maxRev || 0) + 1;
  window._maxRev = state.rev;
  if (writeLocal(state)) window._storageWarned = false;
  // IndexedDB is never written before it was read this session.
  if (!window._dbReady) return;
  var rev = state.rev, full = JSON.stringify(state), sigs = photoSigs(state.trades);
  openDB(function(db) {
    if (!db) return;
    var failed = function() {
      window._idbOk = false; // keep every photo inline in localStorage from now on
      writeLocal(state);
    };
    try {
      var tx = db.transaction('state','readwrite');
      tx.oncomplete = function(){
        // Writes to one store complete in the order they were made, so the last one
        // to complete is the newest snapshot: its photos are now the durable ones.
        window._idbOk = true;
        window._photoDurable = sigs;
        if (state.rev === rev) writeLocal(state); // nothing newer: slim the local copy
      };
      tx.onerror = failed; tx.onabort = failed;
      tx.objectStore('state').put({id:'main', data: full});
    } catch(e) { failed(); }
  });
}

function applyLoadedState(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  // A localStorage copy saved without some photos: keep its pointers so a save made
  // before IndexedDB is read does not drop them (see lsSnapshot).
  window._pendingPhotoRefs = (parsed.photoRefs && typeof parsed.photoRefs === 'object') ? parsed.photoRefs : null;
  window._pendingLegacyPhotos = !!(parsed.photosInDb && !parsed.photoRefs);
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
    // The history is the source of truth: re-derive every sell's cost from it, so an
    // entry corrected after a sale (or an older backup) never keeps a stale profit.
    if (typeof rebuildBasis === 'function') rebuildBasis(t);
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
          var lsRev = parseInt(lsv.rev, 10) || 0, idbRev = parseInt(idb.rev, 10) || 0;
          window._maxRev = Math.max(window._maxRev || 0, lsRev, idbRev);
          // Newer save counter wins; copies from before the counter compare by time.
          var lsNewer = (lsRev || idbRev) ? lsRev > idbRev : lsStamp > idbStamp;
          winner = lsNewer ? lsv : idb;
          if (lsStamp !== idbStamp || lsRev !== idbRev) needSync = true;
          // The localStorage copy may be newer but saved without some photos: take those
          // from IndexedDB. With photoRefs only the referenced trades are filled, so a
          // trade whose photos were deleted stays empty; older copies (v30/v31, no
          // photoRefs) fill every empty trade as they did then.
          if (winner === lsv && lsv.photosInDb && Array.isArray(lsv.trades) && Array.isArray(idb.trades)) {
            var pics = {};
            idb.trades.forEach(function(t){ if (t && t.id && t.photos && t.photos.length) pics[t.id] = t.photos; });
            var refs = (lsv.photoRefs && typeof lsv.photoRefs === 'object') ? lsv.photoRefs : null;
            lsv.trades.forEach(function(t){
              if (!t || (t.photos && t.photos.length) || !pics[t.id]) return;
              if (!refs || refs[t.id]) t.photos = pics[t.id];
            });
          }
        } else if (idb) { winner = idb; needSync = true; }
        else if (lsv) { winner = lsv; needSync = true; }
        if (winner) applyLoadedState(winner);
        // Photos merged: nothing pending, and what IndexedDB holds is durable.
        window._pendingPhotoRefs = null; window._pendingLegacyPhotos = false;
        window._photoDurable = idb ? photoSigs(idb.trades) : {};
        window._dbReady = true;
        if (needSync) save();
        callback();
      };
      req.onerror = function() { callback(); }; // unreadable: never written this session
    } catch(e) { callback(); }
  });
}

function getActiveAccount() { return state.accounts.find(function(a){return a.id===state.activeAccountId;})||null; }
function getAccountTrades(aid) { return state.trades.filter(function(t){return t.accountId===aid;}); }
function localDateStr(d) {
  d = d || new Date();
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  var day = d.getDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
function parseLocalDate(str) {
  var p = String(str || '').split('-');
  var y = parseInt(p[0], 10) || 0;
  var m = parseInt(p[1], 10) || 1;
  var day = parseInt(p[2], 10) || 1;
  return new Date(y, m - 1, day);
}
function today() { return localDateStr(new Date()); }

// ==========================================================================
