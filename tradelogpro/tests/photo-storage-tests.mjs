// Photo persistence across localStorage and IndexedDB (second audit, R2-04..R2-06):
// the real js/storage.js against a fake IndexedDB whose writes the test completes,
// aborts or leaves hanging (app closed mid-write), then a fresh "reload".
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(__dirname, '..', 'js', f), 'utf8');
const src = read('sanitize.js') + '\n' + read('finance.js') + '\n' + read('storage.js');

let passed = 0, failed = 0;
function assert(name, cond, got) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ ' + name + (got !== undefined ? '  (got ' + JSON.stringify(got) + ')' : '')); }
}

// A device: one localStorage and one IndexedDB that survive "reloads".
function device() { return { ls: {}, idb: {} }; }
// One app session on a device. Pending IndexedDB writes are kept so a test can
// complete or abort them, or drop them (the app was closed before they finished).
function session(dev) {
  const pending = [];
  const db = {
    transaction() {
      const tx = { oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = () => ({
        put(rec) { pending.push({ tx, rec }); },
        get(id) {
          const req = {};
          setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: dev.idb[id] ? { id, data: dev.idb[id] } : undefined } }), 0);
          return req;
        },
      });
      return tx;
    },
  };
  const ctx = {
    console, JSON, Math, Date, Object, String, Array, parseFloat, isNaN, setTimeout,
    localStorage: {
      getItem: (k) => (k in dev.ls ? dev.ls[k] : null),
      setItem: (k, v) => { dev.ls[k] = String(v); },
      removeItem: (k) => { delete dev.ls[k]; },
    },
    indexedDB: {},
    showToast() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext('var state = { accounts: [], trades: [] }; var _db = null;\n' + src, ctx);
  ctx._db = db;
  const s = {
    ctx, pending,
    run: (code) => vm.runInContext(code, ctx),
    complete() { const p = pending.shift(); dev.idb[p.rec.id] = p.rec.data; p.tx.oncomplete && p.tx.oncomplete(); },
    abort() { const p = pending.shift(); p.tx.onabort && p.tx.onabort(); },
    // App start: synchronous localStorage load (initApp), then IndexedDB (loadFromDB).
    async start() {
      const ls = dev.ls.tl_v3;
      if (ls) ctx.applyLoadedState(JSON.parse(ls));
      await new Promise((res) => ctx.loadFromDB(res));
    },
    trade: (id) => ctx.state.trades.find((t) => t.id === id),
  };
  return s;
}
const photo = (tag) => 'data:image/jpeg;base64,' + Buffer.from('photo-' + tag + '-'.repeat(40)).toString('base64');
const baseState = () => ({
  schemaVersion: 3, activeAccountId: 'a1',
  accounts: [{ id: 'a1', name: 'Main', startingCapital: 1000, transactions: [], type: 'cash' }],
  trades: ['X', 'Y'].map((id) => ({ id, accountId: 'a1', ticker: id, direction: 'Long', status: 'open', entry: 10, qty: 1, original_qty: 1,
    entry_date: '2026-01-01', fees: 0, fees_mode: '$', add_buys: [], partial_closes: [], photos: [], notes: '' })),
});

console.log('Edgeory — photo persistence tests\n');

// Set-up shared by the cases: X has photo A, Y has photo C, both confirmed in IndexedDB.
async function seeded() {
  const dev = device();
  const s = session(dev);
  await s.start();                       // empty device
  s.ctx.state = s.ctx.sanitizeState(baseState());
  s.trade('X').photos = [photo('A')];
  s.trade('Y').photos = [photo('C')];
  s.run('save()'); s.complete();         // durable
  return dev;
}

{ // R2-04: photo B added, IndexedDB write aborted, reload -> B kept
  const dev = await seeded();
  let s = session(dev); await s.start();
  assert('setup: after a clean reload both photos load', s.trade('X').photos.length === 1 && s.trade('Y').photos.length === 1);
  const lsBefore = JSON.parse(dev.ls.tl_v3);
  assert('setup: confirmed photos are not duplicated in localStorage', lsBefore.trades.every((t) => t.photos.length === 0) && (lsBefore.photoRefs || {}).X && (lsBefore.photoRefs || {}).Y);
  s.trade('X').photos.push(photo('B'));
  s.run('save()'); s.abort();
  s = session(dev); await s.start();
  assert('R2-04 new photo B survives an aborted IndexedDB write', s.trade('X').photos.length === 2 && s.trade('X').photos[1] === photo('B'), s.trade('X').photos.length);
  assert('R2-04 the other trade keeps its photo', s.trade('Y').photos.length === 1);
}
{ // R2-04b: same, but the app is closed before the write finishes (never completes)
  const dev = await seeded();
  let s = session(dev); await s.start();
  s.trade('X').photos.push(photo('B'));
  s.run('save()');                       // left pending: app closed
  s = session(dev); await s.start();
  assert('R2-04 new photo B survives closing the app mid-write', s.trade('X').photos.length === 2);
}
{ // R2-05: photo A removed while Y keeps its photo, write aborted, reload -> A stays removed
  const dev = await seeded();
  let s = session(dev); await s.start();
  s.trade('X').photos = [];
  s.run('save()'); s.abort();
  s = session(dev); await s.start();
  assert('R2-05 a deleted photo is not brought back from IndexedDB', s.trade('X').photos.length === 0, s.trade('X').photos.length);
  assert('R2-05 the other trade photo is still restored', s.trade('Y').photos.length === 1);
}
{ // R2-06: rapid saves complete in order -> the last snapshot wins, nothing mixed
  const dev = await seeded();
  let s = session(dev); await s.start();
  s.trade('X').notes = 'first'; s.trade('X').photos = [photo('P1')]; s.run('save()');
  s.trade('X').notes = 'second'; s.trade('X').photos = [photo('P2')]; s.run('save()');
  s.complete(); s.complete();
  s = session(dev); await s.start();
  assert('R2-06 last save wins: note and photo from the same snapshot', s.trade('X').notes === 'second' && s.trade('X').photos[0] === photo('P2'), [s.trade('X').notes, s.trade('X').photos.length]);
  // first write lands, second fails: the newer local copy (with P3 inline) must win
  s.trade('X').notes = 'third'; s.trade('X').photos = [photo('P3')]; s.run('save()');
  s.trade('X').notes = 'fourth'; s.trade('X').photos = [photo('P4')]; s.run('save()');
  s.complete(); s.abort();
  s = session(dev); await s.start();
  assert('R2-06 second write fails: the newest note and photo are kept together', s.trade('X').notes === 'fourth' && s.trade('X').photos[0] === photo('P4'), [s.trade('X').notes, s.trade('X').photos.length]);
}
{ // Restoring an older backup must not make the stale copy win later
  const dev = await seeded();
  let s = session(dev); await s.start();
  const restored = s.ctx.sanitizeState(Object.assign(baseState(), { rev: 1 }));
  s.ctx.applyLoadedState(restored); s.trade('X').notes = 'restored'; s.run('save()'); s.abort();
  s = session(dev); await s.start();
  assert('a restored backup with an older counter still wins over the stale copy', s.trade('X').notes === 'restored', s.trade('X').notes);
}
{ // A save made before IndexedDB is read must not drop the pointers
  const dev = await seeded();
  const s = session(dev);
  s.ctx.applyLoadedState(JSON.parse(dev.ls.tl_v3)); // localStorage loaded, IndexedDB not yet
  s.trade('Y').notes = 'edited early'; s.run('save()');
  const s2 = session(dev); await s2.start();
  assert('early save before IndexedDB is read keeps every photo', s2.trade('X').photos.length === 1 && s2.trade('Y').photos.length === 1);
}
{ // Data saved by v30/v31 (photosInDb, no photoRefs) still loads its photos
  const dev = device();
  const full = baseState(); full.trades[0].photos = [photo('OLD')]; full.updatedAt = '2026-11-01T10:00:00.000Z';
  dev.idb.main = JSON.stringify(full);
  const slim = JSON.parse(JSON.stringify(full)); slim.trades[0].photos = []; slim.photosInDb = true; slim.updatedAt = '2026-11-01T10:00:01.000Z';
  dev.ls.tl_v3 = JSON.stringify(slim);
  const s = session(dev); await s.start();
  assert('older v30/v31 local copy: photos come back from IndexedDB', s.trade('X').photos.length === 1);
}

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
if (failed) process.exit(1);
