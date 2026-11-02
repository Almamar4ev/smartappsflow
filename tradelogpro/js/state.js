// ==========================================================================
// BRAND (single source — keep in sync with manifest / Capacitor appName)
// ==========================================================================
var APP_NAME = 'Edgeory';
var APP_TAGLINE = 'Your Trading Journal';
var APP_VERSION = '1.2.0';
var APP_STORE_TITLE = 'Edgeory: Trading Journal';
var APP_PACKAGE_ID = 'com.tradelog.pro'; // Play package — never rename
// One-time "What's new" note for people who already used an older version.
// Shown once after each web release, whether the user tapped Update or the new
// version applied by itself after the app was closed (Later). Must equal sw.js
// CACHE / UPDATE_NOTE — tests/pwa-tests.mjs enforces it.
var WHATS_NEW_ID = 'edgeory-v38';
var WHATS_NEW_TEXT = 'Clearer numbers: the chart shows the period P&L with the all-time total beside it, and cash below zero reads plainly.';

// ==========================================================================
// STATE + INDEXEDDB STORAGE
// ==========================================================================
var state = {accounts:[],trades:[],activeAccountId:null};
var currentView = 'dashboard';
var MORE_VIEWS = { accounts: 1, journal: 1, formulas: 1, import: 1, 'import-review': 1 };
var tradeLayout = 'list';
var _importDraft = null;
var _importMerge = false;
var _importGuideBroker = 'xtb';
var _importT212Kind = 'pos';
var _undoTimer = null;
var _undoAction = null;
var filterAccountId = 'all';
var editingTradeId = null;
var openedFromDetail = false;
var editingAccountId = null;
var pendingPhotos = [];
var calendarDate = new Date();
var partialCloseTargetId = null;
var addBuyTargetId = null;
var accTransactionType = null;
var equityChart, wlChart, symbolChart, typeChart;
var COLORS = ['#4d9fff','#00d68f','#a78bfa','#ffc247','#ff4d6d','#34d399'];
var _db = null;
