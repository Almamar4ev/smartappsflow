// App tour — a short first-run walkthrough (pattern from emiGo's guide tour).
// Classic script, loaded after app.js. State: localStorage tl_tour = 'done' | 'skipped'.
// Offered once to a new user after their first account exists and before any trade;
// anyone can replay it from More › App tour.

var TOUR_STEPS = [
  { view: 'dashboard', targets: ['#dashStatsRow'],
    title: 'Your overview',
    body: 'Balance, net P&L and win rate. They update every time you close a trade.' },
  { view: 'dashboard', targets: ['#topLogBtn'],
    title: 'Log a trade',
    body: 'Tap + Log for each buy. Later, open the trade to add buys or sell in parts, and your average stays exact.' },
  { view: 'trades', targets: ['#tradeFilterTabs', '#bnav-trades', '#nav-trades'],
    title: 'Your trade log',
    body: 'Filter wins, losses and open trades, or switch to Calendar to see each day’s P&L. Tap a trade for its full history.' },
  { view: 'calculators', targets: ['#bnav-calculators', '#nav-calculators'],
    title: 'Calculators',
    body: 'Size every trade from your stop, average a position, and check P&L or compound growth before you buy.' },
  { view: 'analytics', targets: ['#bnav-analytics', '#nav-analytics'],
    title: 'Analytics',
    body: 'Win rate, profit factor, streaks and monthly P&L. Tap a month to see the trades behind it.' },
  { view: 'more', targets: ['#bnav-more', '#nav-more'],
    title: 'Your data',
    body: 'Your trades stay on this device. Back up here, import from a broker screenshot, and keep a daily journal.' }
];
var _tourStep = -1;

function tourActive() { return _tourStep >= 0; }
function tourState() { try { return localStorage.getItem('tl_tour'); } catch (e) { return 'done'; } }
function setTourState(v) { try { localStorage.setItem('tl_tour', v); } catch (e) {} }

function _tourEl(id, cls) {
  var el = document.getElementById(id);
  if (!el) { el = document.createElement('div'); el.id = id; if (cls) el.className = cls; document.body.appendChild(el); }
  return el;
}
function _tourVisible(el) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}
function _tourTarget(step) {
  for (var i = 0; i < step.targets.length; i++) {
    var el = document.querySelector(step.targets[i]);
    if (_tourVisible(el)) return el;
  }
  return null;
}

// First-run offer: new users only (an account, no trades yet), never over a sheet.
function maybeOfferTour() {
  if (tourActive() || tourState()) return;
  if (!state || !state.accounts || !state.accounts.length || (state.trades && state.trades.length)) return;
  if (typeof _modalStack !== 'undefined' && _modalStack.length) return;
  if (document.getElementById('updateBanner') || document.getElementById('whatsNewBanner')) return;
  if (currentView !== 'dashboard') return;
  var card = _tourEl('tourCard', 'tour-card');
  card.innerHTML = '<div class="tour-meta">Welcome to Edgeory</div>' +
    '<div class="tour-title">Take a 30-second tour?</div>' +
    '<div class="tour-body">See where to log trades, read your stats and keep your data safe.</div>' +
    '<div class="tour-actions"><button type="button" class="tour-skip" onclick="endTour(\'skipped\')">Not now</button>' +
    '<button type="button" class="tour-next" onclick="startTour()">Start tour</button></div>';
  card.classList.remove('top');
  card.classList.add('show');
}

function startTour() {
  _tourStep = 0;
  document.documentElement.classList.add('tour-on');
  _tourEl('tourShield', 'tour-shield').classList.add('show'); // swallows taps on the app
  _tourEl('tourRing', 'tour-ring');
  showTourStep();
  window.addEventListener('resize', _tourReposition);
}

function showTourStep() {
  var step = TOUR_STEPS[_tourStep];
  if (!step) { endTour('done'); return; }
  if (currentView !== step.view) setView(step.view);
  var last = _tourStep === TOUR_STEPS.length - 1;
  var card = _tourEl('tourCard', 'tour-card');
  card.innerHTML = '<div class="tour-meta">Step ' + (_tourStep + 1) + ' of ' + TOUR_STEPS.length + '</div>' +
    '<div class="tour-title">' + esc(step.title) + '</div>' +
    '<div class="tour-body">' + esc(step.body) + '</div>' +
    '<div class="tour-actions"><button type="button" class="tour-skip" onclick="endTour(\'skipped\')">Skip</button>' +
    '<button type="button" class="tour-next" onclick="nextTourStep()">' + (last ? 'Done' : 'Next') + '</button></div>';
  card.classList.add('show');
  // Two frames so a freshly rendered view has its layout before we measure it.
  requestAnimationFrame(function () { requestAnimationFrame(_tourReposition); });
}

function _tourReposition() {
  if (!tourActive()) return;
  var step = TOUR_STEPS[_tourStep];
  var ring = document.getElementById('tourRing');
  var card = document.getElementById('tourCard');
  var el = step && _tourTarget(step);
  if (el && el.closest('#mainContent')) {
    var mc = document.getElementById('mainContent'), r0 = el.getBoundingClientRect(), m = mc.getBoundingClientRect();
    if (r0.top < m.top + 8 || r0.bottom > m.bottom - 8) mc.scrollTop += r0.top - m.top - 16;
  }
  if (!el) { ring.classList.remove('show'); card.classList.remove('top'); return; }
  var r = el.getBoundingClientRect(), pad = 6;
  ring.style.top = (r.top - pad) + 'px';
  ring.style.left = (r.left - pad) + 'px';
  ring.style.width = (r.width + pad * 2) + 'px';
  ring.style.height = (r.height + pad * 2) + 'px';
  ring.classList.add('show');
  // Keep the card on the other half of the screen from what it explains.
  card.classList.toggle('top', r.top + r.height / 2 > window.innerHeight / 2);
}

function nextTourStep() {
  if (!tourActive()) return;
  _tourStep++;
  showTourStep();
}

function endTour(result) {
  var wasActive = tourActive();
  _tourStep = -1;
  setTourState(result === 'done' ? 'done' : 'skipped');
  document.documentElement.classList.remove('tour-on');
  ['tourCard', 'tourRing', 'tourShield'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.classList.remove('show');
  });
  window.removeEventListener('resize', _tourReposition);
  if (wasActive && currentView !== 'dashboard') setView('dashboard');
  if (wasActive && result === 'done') showToast('You’re all set. Replay the tour any time in More.', 'success');
}

// More › App tour
function replayTour() {
  if (typeof _modalStack !== 'undefined' && _modalStack.length) return;
  startTour();
}
