// ==========================================================================
// STATE + INDEXEDDB STORAGE
// ==========================================================================
var state = {accounts:[],trades:[],activeAccountId:null};
var currentView = 'dashboard';
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
