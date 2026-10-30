// ==========================================================================
// BRAND (single source — keep in sync with manifest / Capacitor appName)
// ==========================================================================
var APP_NAME = 'Edgeory';
var APP_TAGLINE = 'Your Trading Journal';
var APP_VERSION = '1.2.0';
var APP_STORE_TITLE = 'Edgeory: Trading Journal';
var APP_PACKAGE_ID = 'com.tradelog.pro'; // Play package — never rename

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
