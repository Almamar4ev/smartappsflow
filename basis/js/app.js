import { stockAverage, profitLoss, positionByPercent, positionByPrice, compoundGrowth, positionMark, targetAverage, whatIfSell, sellCompare, liveFormat, formatInputValue } from './calc.js';
import { translate } from './i18n.js';

const CURRENCIES = {
  NONE: { symbol: '', after: false, label: '123' },
  USD: { symbol: '$', after: false, label: 'USD' },
  EUR: { symbol: '€', after: false, label: 'EUR' },
  GBP: { symbol: '£', after: false, label: 'GBP' },
  AED: { symbol: 'د.إ', after: true, label: 'AED' },
  SAR: { symbol: 'ر.س', after: true, label: 'SAR' },
  QAR: { symbol: 'ر.ق', after: true, label: 'QAR' },
  KWD: { symbol: 'د.ك', after: true, label: 'KWD' },
};

const STORAGE_KEY = 'basis.v1';
const LANGS = new Set(['en', 'ar', 'es', 'pt']);
const LIBRARY_CAP = 30;
const FEEDBACK_EMAIL = 'smartappsflow@gmail.com';
const WEB_URL = 'https://smartappsflow.net/basis/';
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.smartapps.basis';
const APP_VERSION = (typeof self !== 'undefined' && self.BASIS_VERSION) ? self.BASIS_VERSION : '1.2';
let toastTimer = 0;
let pendingWorker = null;
let pendingInfo = null;
let bannerDismissed = false;

function detectLang() {
  const loc = (navigator.language || '').toLowerCase();
  if (loc.startsWith('ar')) return 'ar';
  if (loc.startsWith('es')) return 'es';
  if (loc.startsWith('pt')) return 'pt';
  return 'en';
}

const state = loadState();

const $ = (sel) => document.querySelector(sel);
const t = (key) => translate(state.lang, key);
const fill = (key, map) => Object.entries(map).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

function defaults() {
  const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return {
    tab: 'avg',
    lang: detectLang(),
    theme,
    currency: 'USD',
    avg: {
      rows: [{ price: '', qty: '' }, { price: '', qty: '' }],
      current: '',
      whatIf: 'sell',
      buyQty: '',
      buyAmount: '',
      buyPrice: '',
      target: '',
      sellPct: '25',
      sellQty: '',
      sellPrice: '',
    },
    pnl: { side: 'long', entry: '', exit: '', qty: '' },
    pos: {
      mode: 'percent', account: 'cash', riskMode: 'percent', fractional: false,
      balance: '', risk: '', stopPct: '', targetPct: '',
      entry: '', stopPrice: '', targetPrice: '',
    },
    growth: {
      capital: '', rate: '', ratePeriod: 'annual', duration: '',
      durationUnit: 'years', deposit: '', frequency: '12',
    },
    library: { avg: [], growth: [] },
  };
}

function loadState() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return base;
    return {
      ...base,
      ...saved,
      avg: { ...base.avg, ...saved.avg, rows: Array.isArray(saved.avg?.rows) && saved.avg.rows.length ? saved.avg.rows.slice(0, 30) : base.avg.rows },
      pnl: { ...base.pnl, ...saved.pnl },
      pos: { ...base.pos, ...saved.pos, fractional: Boolean(saved.pos?.fractional) },
      growth: { ...base.growth, ...saved.growth },
      library: {
        avg: Array.isArray(saved.library?.avg) ? saved.library.avg.slice(0, LIBRARY_CAP) : [],
        growth: Array.isArray(saved.library?.growth) ? saved.library.growth.slice(0, LIBRARY_CAP) : [],
      },
      currency: CURRENCIES[saved.currency] ? saved.currency : 'USD',
      lang: LANGS.has(saved.lang) ? saved.lang : detectLang(),
      theme: saved.theme === 'dark' ? 'dark' : 'light',
      tab: ['avg', 'pnl', 'pos', 'growth'].includes(saved.tab) ? saved.tab : 'avg',
    };
  } catch {
    return base;
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function localeTag() {
  if (state.lang === 'es') return 'es-ES';
  if (state.lang === 'pt') return 'pt-BR';
  return 'en-US';
}

function formatNumber(value, digits) {
  return Number(value).toLocaleString(localeTag(), {
    minimumFractionDigits: digits.min,
    maximumFractionDigits: digits.max,
  });
}

function shown(value) {
  return formatInputValue(value, state.lang);
}

function moneyCore(body) {
  const currency = CURRENCIES[state.currency];
  if (!currency?.symbol) return body;
  return currency.after ? `${body} ${currency.symbol}` : `${currency.symbol}${body}`;
}

function money(value) {
  const negative = value < 0;
  return `${negative ? '−' : ''}${moneyCore(formatNumber(Math.abs(value), { min: 2, max: 2 }))}`;
}

function signedMoney(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${moneyCore(formatNumber(Math.abs(value), { min: 2, max: 2 }))}`;
}

function price(value) {
  return formatNumber(value, { min: 2, max: 4 });
}

function moneyPrice(value) {
  return moneyCore(price(value));
}

function qty(value) {
  return formatNumber(value, { min: 0, max: 4 });
}

function pct(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), { min: 2, max: 2 })}%`;
}

function plainPct(value) {
  return `${formatNumber(value, { min: 2, max: 2 })}%`;
}

function themeColor() {
  return state.theme === 'dark' ? '#12110f' : '#f4f0e7';
}

function applyChrome() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = state.theme;
  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.content = themeColor();
  document.title = `${t('appName')} — ${t('tagline')}`;
  $('#brand-name').textContent = t('appName');
  $('#brand-lead').textContent = t('tagline');
  $('#settings-open').setAttribute('aria-label', t('settings'));
  const shareOpen = $('#share-open');
  if (shareOpen) shareOpen.setAttribute('aria-label', t('shareApp'));
  $('#sheet-title').textContent = t('settings');
  $('#sheet-close').setAttribute('aria-label', t('close'));
  $('#lang-label').textContent = t('language');
  $('#currency-label').textContent = t('currency');
  $('#currency-none').textContent = t('noCurrency');
  $('#theme-label').textContent = t('appearance');
  $('#theme-light').textContent = t('light');
  $('#theme-dark').textContent = t('dark');
  $('#privacy-link').textContent = t('privacy');
  $('#rate-title').textContent = t('rateApp');
  $('#rate-hint').textContent = t('rateHint');
  $('#feedback-title').textContent = t('feedback');
  $('#feedback-hint').textContent = t('feedbackHint');
  $('#save-title').textContent = t('saveCalc');
  $('#save-close').setAttribute('aria-label', t('close'));
  $('#save-name-label').textContent = t('saveName');
  $('#save-name').placeholder = t('saveNamePh');
  $('#save-name-hint').textContent = t('saveNameHint');
  $('#save-confirm').textContent = t('save');
  $('#library-title').textContent = t('savedCalcs');
  $('#library-close').setAttribute('aria-label', t('close'));
  $('#lang').value = state.lang;
  $('#currency').value = state.currency;
  const version = $('#version-label');
  if (version) version.textContent = fill('versionName', { v: APP_VERSION });
  syncThemeButtons();
  renderNav();
  paintUpdateUI();
}

function syncThemeButtons() {
  $('#theme-light').setAttribute('aria-pressed', String(state.theme === 'light'));
  $('#theme-dark').setAttribute('aria-pressed', String(state.theme === 'dark'));
}

function renderNav() {
  const items = [
    ['avg', 'navAvg', iconBars()],
    ['pnl', 'navPnl', iconPnl()],
    ['pos', 'navSize', iconSize()],
    ['growth', 'navGrowth', iconGrowth()],
  ];
  $('#nav').innerHTML = items.map(([id, key, icon]) => `
    <button type="button" data-tab="${id}" ${state.tab === id ? 'aria-current="page"' : ''}>
      ${icon}<span>${t(key)}</span>
    </button>`).join('');
}

function field(id, label, bind, unit, value, placeholder = '0.00') {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <div class="control">
      <input id="${id}" data-bind="${bind}" data-numeric="1" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(shown(value))}">
      ${unit ? `<span class="unit" data-unit="${unit}"></span>` : ''}
    </div>
  </div>`;
}

function segment(press, options) {
  const [group, key] = press.split('.');
  return `<div class="segment" role="group">${options.map((option) => `
    <button type="button" data-press="${press}" data-value="${option.value}" aria-pressed="${state[group][key] === option.value ? 'true' : 'false'}">${option.label}</button>
  `).join('')}</div>`;
}

function screenHead(title, lead) {
  return `<header class="screen"><h1>${title}</h1><p>${lead}</p></header>`;
}

function renderMain() {
  const views = { avg: viewAverage, pnl: viewPnl, pos: viewPosition, growth: viewGrowth };
  $('#main').innerHTML = views[state.tab]();
  $('#main').scrollTop = 0;
  paint();
}

function viewAverage() {
  return `${screenHead(t('avgTitle'), t('avgLead'))}
    <div class="stack">
      <div id="rows"></div>
      <button type="button" class="add-btn" data-act="add-row">${t('addBuy')}</button>
      ${field('current', `${t('currentPrice')} · ${t('optional')}`, 'avg.current', 'currency', state.avg.current)}
      <section class="answer" id="answer"></section>
      <div id="detail"></div>
      <div id="whatif-wrap" class="stack" hidden>
        <span class="section-label">${t('reachTarget')}</span>
        ${field('target-avg', t('targetAvg'), 'avg.target', 'currency', state.avg.target)}
        ${field('buy-price', t('nextBuyPrice'), 'avg.buyPrice', 'currency', state.avg.buyPrice)}
        <p class="hint">${t('priceFallback')}</p>
        <span class="section-label">${t('partialSell')}</span>
        <div class="grid-2">
          ${field('sell-pct', t('sellPct'), 'avg.sellPct', 'percent', state.avg.sellPct, '25')}
          ${field('sell-qty', t('sellQty'), 'avg.sellQty', '', state.avg.sellQty)}
        </div>
        ${field('sell-price', t('sellPrice'), 'avg.sellPrice', 'currency', state.avg.sellPrice)}
        <p class="hint">${t('priceFallback')}</p>
        <div id="whatif-out"></div>
        <p class="hint">${t('journalHint')}</p>
      </div>
      ${saveBar()}
    </div>`;
}

function viewPnl() {
  return `${screenHead(t('pnlTitle'), t('pnlLead'))}
    <div class="stack" id="fields">
      ${segment('pnl.side', [{ value: 'long', label: t('long') }, { value: 'short', label: t('short') }])}
      <div class="grid-2">
        ${field('entry', t('entry'), 'pnl.entry', 'currency', state.pnl.entry)}
        ${field('exit', t('exit'), 'pnl.exit', 'currency', state.pnl.exit)}
      </div>
      ${field('qty', t('qty'), 'pnl.qty', '', state.pnl.qty)}
      <p class="hint">${t('feesNote')}</p>
      <section class="answer" id="answer"></section>
      <div id="detail"></div>
    </div>`;
}

function viewPosition() {
  const byPercent = state.pos.mode === 'percent';
  const fields = byPercent ? `
    ${field('balance', t('balance'), 'pos.balance', 'currency', state.pos.balance)}
    ${field('risk', t('risk'), 'pos.risk', 'risk', state.pos.risk)}
    ${segment('pos.riskMode', [{ value: 'percent', label: '%' }, { value: 'amount', label: CURRENCIES[state.currency].label }])}
    <p class="hint" id="risk-hint"></p>
    ${field('stop', t('stopPct'), 'pos.stopPct', 'percent', state.pos.stopPct)}
    ${field('target', `${t('targetPct')} · ${t('optional')}`, 'pos.targetPct', 'percent', state.pos.targetPct)}
    ${segment('pos.account', [{ value: 'cash', label: t('cash') }, { value: 'margin', label: t('margin') }])}
    <p class="hint">${t('cashHint')}</p>` : `
    ${field('balance', t('balance'), 'pos.balance', 'currency', state.pos.balance)}
    ${field('entry', t('entry'), 'pos.entry', 'currency', state.pos.entry)}
    ${field('risk', t('risk'), 'pos.risk', 'risk', state.pos.risk)}
    ${segment('pos.riskMode', [{ value: 'percent', label: '%' }, { value: 'amount', label: CURRENCIES[state.currency].label }])}
    <p class="hint" id="risk-hint"></p>
    <div class="grid-2">
      ${field('stop', t('stopPrice'), 'pos.stopPrice', 'currency', state.pos.stopPrice)}
      ${field('target', `${t('targetPrice')} · ${t('optional')}`, 'pos.targetPrice', 'currency', state.pos.targetPrice)}
    </div>
    <button type="button" class="toggle-row" data-act="toggle-fractional" aria-pressed="${state.pos.fractional ? 'true' : 'false'}">
      <span>${t('fractionalShares')}</span><i></i>
    </button>`;
  return `${screenHead(t('sizeTitle'), t('sizeLead'))}
    <div class="stack" id="fields">
      ${segment('pos.mode', [{ value: 'percent', label: t('byPercent') }, { value: 'price', label: t('byPrice') }])}
      ${fields}
      <section class="answer" id="answer"></section>
      <div id="detail"></div>
    </div>`;
}

function viewGrowth() {
  return `${screenHead(t('growthTitle'), t('growthLead'))}
    <div class="stack">
      ${field('capital', t('capital'), 'growth.capital', 'currency', state.growth.capital)}
      <div class="grid-2">
        ${field('rate', t('rate'), 'growth.rate', 'percent', state.growth.rate)}
        <div class="field">
          <label for="rate-period">${t('period')}</label>
          <select id="rate-period" data-bind="growth.ratePeriod">
            <option value="annual" ${state.growth.ratePeriod === 'annual' ? 'selected' : ''}>${t('perYear')}</option>
            <option value="monthly" ${state.growth.ratePeriod === 'monthly' ? 'selected' : ''}>${t('perMonth')}</option>
            <option value="weekly" ${state.growth.ratePeriod === 'weekly' ? 'selected' : ''}>${t('perWeek')}</option>
          </select>
        </div>
      </div>
      <div class="grid-2">
        ${field('duration', t('duration'), 'growth.duration', '', state.growth.duration)}
        <div class="field">
          <label for="duration-unit">${t('unit')}</label>
          <select id="duration-unit" data-bind="growth.durationUnit">
            <option value="years" ${state.growth.durationUnit === 'years' ? 'selected' : ''}>${t('years')}</option>
            <option value="months" ${state.growth.durationUnit === 'months' ? 'selected' : ''}>${t('months')}</option>
          </select>
        </div>
      </div>
      ${field('deposit', `${t('deposit')} · ${t('optional')}`, 'growth.deposit', 'currency', state.growth.deposit)}
      <div class="field">
        <label for="frequency">${t('compounding')}</label>
        <select id="frequency" data-bind="growth.frequency">
          ${[['365', 'daily'], ['52', 'weekly'], ['12', 'monthly'], ['4', 'quarterly'], ['1', 'annually']].map(([value, key]) =>
            `<option value="${value}" ${state.growth.frequency === value ? 'selected' : ''}>${t(key)}</option>`).join('')}
        </select>
      </div>
      <section class="answer" id="answer"></section>
      <div id="detail"></div>
      ${saveBar()}
    </div>`;
}

function saveBar() {
  const count = libraryFor(state.tab).length;
  return `<div class="keep">
    <button type="button" class="keep-pin" data-act="open-save">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 4.5h10v15.2l-5-3.1-5 3.1V4.5z"/></svg>
      ${t('saveCalc')}
    </button>
    <button type="button" class="keep-shelf" data-act="open-library">
      ${t('savedCalcs')}${count ? `<i>${count}</i>` : ''}
    </button>
  </div>`;
}

function paintKeep() {
  const host = document.querySelector('.keep');
  if (host) host.outerHTML = saveBar();
}

function namedSummary(tab, data) {
  if (tab === 'avg') {
    const summary = stockAverage(data?.rows || []);
    return summary.ok ? moneyPrice(summary.average) : '—';
  }
  const result = compoundGrowth(data || {});
  return result.ok ? money(result.finalBalance) : '—';
}

function keepPreview(tab = state.saveTab || state.tab) {
  if (tab === 'avg') {
    const summary = stockAverage(state.avg.rows);
    return summary.ok ? `${t('avgPrice')} · ${moneyPrice(summary.average)}` : t('needBuy');
  }
  const result = compoundGrowth(state.growth);
  return result.ok ? `${t('finalBalance')} · ${money(result.finalBalance)}` : t('waiting');
}

function buyRowHtml(row, index) {
  const canRemove = state.avg.rows.length > 1;
  return `
    <div class="buy">
      <div class="buy-head">
        <span>${fill('buyN', { n: index + 1 })}</span>
        ${canRemove ? `<button type="button" class="text-btn" data-act="remove-row" data-index="${index}">${t('remove')}</button>` : ''}
      </div>
      <div class="grid-2">
        ${field(`price-${index}`, t('price'), `avg.row.${index}.price`, 'currency', row.price)}
        ${field(`qty-${index}`, t('shares'), `avg.row.${index}.qty`, '', row.qty)}
      </div>
    </div>`;
}

function paintRows() {
  const host = $('#rows');
  if (!host) return;
  host.innerHTML = state.avg.rows.map((row, index) => buyRowHtml(row, index)).join('');
  syncUnits();
}

function appendBuyRow() {
  const host = $('#rows');
  if (!host) return;
  const index = state.avg.rows.length - 1;
  host.insertAdjacentHTML('beforeend', buyRowHtml(state.avg.rows[index], index));
  reindexBuyRows();
  syncUnits();
}

function reindexBuyRows() {
  const host = $('#rows');
  if (!host) return;
  const canRemove = state.avg.rows.length > 1;
  [...host.children].forEach((buy, index) => {
    const label = buy.querySelector('.buy-head span');
    if (label) label.textContent = fill('buyN', { n: index + 1 });
    let remove = buy.querySelector('[data-act="remove-row"]');
    if (canRemove) {
      if (!remove) {
        buy.querySelector('.buy-head').insertAdjacentHTML('beforeend', `<button type="button" class="text-btn" data-act="remove-row" data-index="${index}">${t('remove')}</button>`);
        remove = buy.querySelector('[data-act="remove-row"]');
      }
      remove.dataset.index = String(index);
    } else if (remove) {
      remove.remove();
    }
    buy.querySelectorAll('[data-bind]').forEach((input) => {
      const key = input.dataset.bind.split('.').pop();
      input.dataset.bind = `avg.row.${index}.${key}`;
      input.id = `${key}-${index}`;
      const tag = input.closest('.field')?.querySelector('label');
      if (tag) tag.setAttribute('for', input.id);
    });
  });
}

function syncUnits() {
  const symbol = CURRENCIES[state.currency].symbol;
  document.querySelectorAll('[data-unit]').forEach((el) => {
    if (el.dataset.unit === 'currency') {
      el.textContent = symbol;
      el.hidden = !symbol;
    } else if (el.dataset.unit === 'percent') {
      el.textContent = '%';
      el.hidden = false;
    } else if (el.dataset.unit === 'risk') {
      const amount = state.pos.riskMode === 'amount';
      el.textContent = amount ? symbol : '%';
      el.hidden = amount && !symbol;
    }
  });
  const hint = $('#risk-hint');
  if (hint) hint.textContent = state.pos.riskMode === 'amount' ? t('riskHintAmount') : t('riskHintPercent');
}

function answer(host, { ready, tone, kicker, value, prompt }) {
  host.className = `answer${ready ? ` ready ${tone || ''}` : ''}`;
  host.innerHTML = ready
    ? `<span class="result-label">${t('result')}</span><span class="kicker">${kicker}</span><span class="value num">${value}</span>`
    : `<span class="result-label">${t('result')}</span><span class="prompt">${prompt}</span>`;
}

function stats(items) {
  return `<div class="stats">${items.map((item, index) => `
    <div class="stat${items.length % 2 && index === items.length - 1 ? ' wide' : ''}"><span>${item.label}</span><strong class="num ${item.tone || ''}">${item.value}</strong></div>
  `).join('')}</div>`;
}

function paint() {
  syncUnits();
  const answerHost = $('#answer');
  const detail = $('#detail');
  if (!answerHost || !detail) return;
  if (state.tab === 'avg') paintAverage(answerHost, detail);
  else if (state.tab === 'pnl') paintPnl(answerHost, detail);
  else if (state.tab === 'pos') paintPosition(answerHost, detail);
  else paintGrowth(answerHost, detail);
}

function paintAverage(answerHost, detail) {
  const summary = stockAverage(state.avg.rows);
  const wrap = $('#whatif-wrap');
  if (!summary.ok) {
    answer(answerHost, { ready: false, prompt: t('needBuy') });
    detail.innerHTML = '';
    if (wrap) wrap.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;
  answer(answerHost, { ready: true, kicker: t('avgPrice'), value: moneyPrice(summary.average) });
  const mark = positionMark({ qty: summary.totalShares, avg: summary.average, price: state.avg.current });
  const snapshot = mark.ok
    ? stats([
      { label: t('marketValue'), value: money(mark.value) },
      { label: t('unrealized'), value: signedMoney(mark.unrealized), tone: mark.unrealized >= 0 ? 'gain' : 'loss' },
      { label: t('returnPct'), value: pct(mark.unrealizedPct), tone: mark.unrealizedPct >= 0 ? 'gain' : 'loss' },
      { label: t('breakEven'), value: mark.inProfit ? t('alreadyProfit') : pct(mark.breakEven), tone: mark.inProfit ? 'gain' : 'warn' },
    ])
    : '';
  detail.innerHTML = `
    ${stats([
      { label: t('totalShares'), value: qty(summary.totalShares) },
      { label: t('invested'), value: money(summary.totalCost) },
      { label: t('buys'), value: String(summary.buys) },
      { label: t('avgPrice'), value: moneyPrice(summary.average) },
    ])}
    ${snapshot}
    <p class="note">${fill('avgInsight', { price: moneyPrice(summary.average) })}</p>`;
  paintWhatIf(summary);
}

function paintWhatIf(summary) {
  const host = $('#whatif-out');
  if (!host) return;
  const position = { qty: summary.totalShares, avg: summary.average, price: state.avg.current };
  const blocks = [];
  const target = targetAverage({
    ...position,
    buyPrice: state.avg.buyPrice,
    target: state.avg.target,
  });
  if (target.ok) {
    blocks.push(stats([
      { label: t('neededShares'), value: qty(target.needed) },
      { label: t('neededCost'), value: money(target.neededCost) },
    ]));
  } else if (state.avg.target && target.reason === 'already') {
    blocks.push(`<p class="note info">${t('targetAlready')}</p>`);
  } else if (state.avg.target && target.reason === 'impossible') {
    blocks.push(`<p class="note warn">${t('targetImpossible')}</p>`);
  }
  const sold = whatIfSell({ ...position, sellPct: state.avg.sellPct, sellQty: state.avg.sellQty, sellPrice: state.avg.sellPrice });
  const rows = sellCompare({ ...position, sellPrice: state.avg.sellPrice });
  if (sold.ok) {
    blocks.push(stats([
      { label: t('sold'), value: qty(sold.sold) },
      { label: t('received'), value: money(sold.received) },
      { label: t('realized'), value: signedMoney(sold.realized), tone: sold.realized >= 0 ? 'gain' : 'loss' },
      { label: t('returnPct'), value: pct(sold.returnPct), tone: sold.returnPct >= 0 ? 'gain' : 'loss' },
      { label: t('remaining'), value: qty(sold.remaining) },
      { label: t('remainUnrealized'), value: signedMoney(sold.remainUnrealized), tone: sold.remainUnrealized >= 0 ? 'gain' : 'loss' },
    ]));
  }
  if (rows.every((row) => row.ok)) {
    blocks.push(`<p class="section-label">${t('quickCompare')}</p>
      <div class="compare" dir="ltr">
        <div class="row head"><span class="sub">%</span><span class="sub">${t('received')}</span><span class="sub">${t('realized')}</span></div>
        ${rows.map((row) => `
          <div class="row">
            <span class="num">${row.pct}%</span>
            <span class="sub num">${money(row.received)}</span>
            <b class="num ${row.realized >= 0 ? 'gain' : 'loss'}">${signedMoney(row.realized)}</b>
          </div>`).join('')}
      </div>`);
  }
  host.innerHTML = blocks.join('');
}

function paintPnl(answerHost, detail) {
  const result = profitLoss(state.pnl);
  if (!result.ok) {
    answer(answerHost, { ready: false, prompt: t('needPnl') });
    detail.innerHTML = '';
    return;
  }
  answer(answerHost, {
    ready: true,
    tone: result.pnl >= 0 ? 'gain' : 'loss',
    kicker: t('netPnl'),
    value: signedMoney(result.pnl),
  });
  detail.innerHTML = stats([
    { label: t('priceChange'), value: signedMoney(result.delta), tone: result.delta >= 0 ? 'gain' : 'loss' },
    { label: t('returnPct'), value: pct(result.pct), tone: result.pct >= 0 ? 'gain' : 'loss' },
  ]);
}

function paintPosition(answerHost, detail) {
  const result = state.pos.mode === 'percent'
    ? positionByPercent({
      balance: state.pos.balance,
      riskMode: state.pos.riskMode,
      riskValue: state.pos.risk,
      stopPct: state.pos.stopPct,
      targetPct: state.pos.targetPct,
      account: state.pos.account,
    })
    : positionByPrice({
      balance: state.pos.balance,
      riskMode: state.pos.riskMode,
      riskValue: state.pos.risk,
      entry: state.pos.entry,
      stop: state.pos.stopPrice,
      target: state.pos.targetPrice,
      fractional: state.pos.fractional,
    });
  if (!result.ok) {
    const prompt = result.reason === 'stop' ? t('needStop') : result.reason === 'prices' ? t('needPrices') : result.reason === 'shares' ? t('needShares') : t('needBalance');
    answer(answerHost, { ready: false, prompt });
    detail.innerHTML = '';
    return;
  }
  const shareMode = state.pos.mode === 'price';
  answer(answerHost, {
    ready: true,
    tone: result.capped ? 'warn' : '',
    kicker: shareMode ? t('quantity') : t('positionValue'),
    value: shareMode ? qty(result.quantity) : money(result.position),
  });
  const blocks = [];
  if (result.riskPct > 10) blocks.push(`<p class="note warn">${t('highRisk')}</p>`);
  if (result.capped) blocks.push(`<p class="note warn">${fill('capped', { risk: money(result.actualRisk), asked: money(result.requestedRisk) })}</p>`);
  if (result.needsLeverage) blocks.push(`<p class="note info">${fill('marginNote', { lev: `${formatNumber(result.leverage, { min: 2, max: 2 })}x` })}</p>`);
  const primary = shareMode
    ? [
      { label: t('positionValue'), value: money(result.position) },
      { label: t('pctOfBalance'), value: plainPct(result.pctOfBalance) },
      { label: t('stopGap'), value: money(result.riskPerShare) },
      { label: t('totalRisk'), value: money(result.actualRisk), tone: 'loss' },
    ]
    : [
      { label: t('positionValue'), value: money(result.position) },
      { label: t('pctOfBalance'), value: plainPct(result.pctOfBalance) },
      { label: t('totalRisk'), value: money(result.actualRisk), tone: 'loss' },
    ];
  if (result.margin) primary.push({ label: t('leverage'), value: `${formatNumber(result.leverage, { min: 2, max: 2 })}x` });
  blocks.push(stats(primary));
  if (shareMode) {
    blocks.push(`<p class="note">${fill('stopNote', { money: `<span class="num">${money(result.riskPerShare)}</span>`, pct: `<span class="num">${plainPct(result.stopPct)}</span>` })}</p>`);
  }
  if (result.rr != null) {
    blocks.push(stats([
      ...(shareMode ? [{ label: t('targetGap'), value: money(result.rewardPerShare) }] : []),
      { label: t('totalReward'), value: money(result.reward), tone: 'gain' },
      { label: t('riskReward'), value: `1 : ${formatNumber(result.rr, { min: 2, max: 2 })}` },
    ]));
    const win = result.balance + result.reward;
    const lose = result.balance - result.actualRisk;
    blocks.push(`<div class="outcome">
      <div><span>${t('ifWin')}</span><b class="num gain">${money(win)}</b></div>
      <div><span>${t('ifLoss')}</span><b class="num loss">${money(lose)}</b></div>
    </div>`);
  }
  detail.innerHTML = blocks.join('');
}

function scheduleRows(months) {
  if (months.length <= 24) {
    return months.map((row) => ({
      label: fill('monthN', { n: row.month }),
      interest: row.interest,
      balance: row.balance,
    }));
  }
  const rows = [];
  for (let index = 0; index < months.length; index += 12) {
    const slice = months.slice(index, index + 12);
    const last = slice[slice.length - 1];
    const label = slice.length === 12
      ? fill('yearN', { n: Math.ceil(last.month / 12) })
      : fill('monthSpan', { a: slice[0].month, b: last.month });
    rows.push({
      label,
      interest: slice.reduce((sum, row) => sum + row.interest, 0),
      balance: last.balance,
    });
  }
  return rows;
}

function growthChart(capital, months) {
  const values = [capital, ...months.map((row) => row.balance)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const w = 320;
  const h = 148;
  const pad = 8;
  const span = max - min || 1;
  const coords = values.map((value, index) => {
    const x = pad + (index / (values.length - 1 || 1)) * (w - pad * 2);
    const y = pad + (1 - (value - min) / span) * (h - pad * 2);
    return [x, y];
  });
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${t('chartTitle')}">
    <path class="area" d="${area}"></path>
    <path class="line" d="${line}"></path>
  </svg>
  <div class="chart-scale"><span class="num">${money(capital)}</span><span class="num">${money(values.at(-1))}</span></div>`;
}

function compositionDonut(result) {
  if (result.totalGrowth < 0) return '';
  const parts = [{ key: 'capital', label: t('capital'), value: result.capital, slice: 'slice-capital', swatch: 'capital' }];
  if (result.totalDeposited > 0) {
    parts.push({ key: 'deposits', label: t('totalDeposited'), value: result.totalDeposited, slice: 'slice-deposit', swatch: 'deposit' });
  }
  if (result.totalGrowth > 0) {
    parts.push({ key: 'growth', label: t('interest'), value: result.totalGrowth, slice: 'slice-growth', swatch: 'growth' });
  }
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return '';
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  let cursor = 0;
  const rings = parts.length === 1
    ? `<circle class="${parts[0].slice}" cx="50" cy="50" r="${radius}" fill="none" stroke="currentColor" stroke-width="14"></circle>`
    : parts.map((part) => {
      const len = (part.value / total) * circ;
      const ring = `<circle class="${part.slice}" cx="50" cy="50" r="${radius}" fill="none" stroke="currentColor" stroke-width="14" stroke-dasharray="${len.toFixed(3)} ${(circ - len).toFixed(3)}" stroke-dashoffset="${(-cursor).toFixed(3)}" transform="rotate(-90 50 50)"></circle>`;
      cursor += len;
      return ring;
    }).join('');
  return `<div class="viz-card">
    <h3>${t('donutTitle')}</h3>
    <div class="donut-row">
      <svg class="donut" viewBox="0 0 100 100" role="img" aria-label="${t('donutTitle')}">${rings}</svg>
      <ul class="legend">
        ${parts.map((part) => `<li><span class="name"><i class="swatch ${part.swatch}"></i>${part.label}</span><b class="num">${money(part.value)}</b></li>`).join('')}
      </ul>
    </div>
  </div>`;
}

function paintGrowth(answerHost, detail) {
  const result = compoundGrowth(state.growth);
  if (!result.ok) {
    answer(answerHost, { ready: false, prompt: result.reason === 'range' ? t('tooLong') : t('waiting') });
    detail.innerHTML = '';
    return;
  }
  answer(answerHost, { ready: true, kicker: t('finalBalance'), value: money(result.finalBalance) });
  const rows = scheduleRows(result.months);
  detail.innerHTML = `
    ${stats([
      { label: t('totalInvested'), value: money(result.totalInvested) },
      { label: t('interest'), value: signedMoney(result.totalGrowth), tone: result.totalGrowth >= 0 ? 'gain' : 'loss' },
      { label: t('roi'), value: pct(result.roi), tone: result.roi >= 0 ? 'gain' : 'loss' },
      ...(result.totalDeposited > 0 ? [{ label: t('totalDeposited'), value: money(result.totalDeposited) }] : []),
    ])}
    <div class="viz">
      <div class="viz-card">
        <h3>${t('chartTitle')}</h3>
        ${growthChart(result.capital, result.months)}
      </div>
      ${compositionDonut(result)}
    </div>
    <div class="schedule">
      <div class="row head"><span></span><span class="sub">${t('interest')}</span><span class="sub">${t('finalBalance')}</span></div>
      ${rows.map((row) => `
        <div class="row">
          <span>${row.label}</span>
          <span class="sub num">${signedMoney(row.interest)}</span>
          <b class="num">${money(row.balance)}</b>
        </div>`).join('')}
    </div>`;
}

function readBind(bind, value) {
  const parts = bind.split('.');
  if (parts[0] === 'avg' && parts[1] === 'row') {
    state.avg.rows[Number(parts[2])][parts[3]] = value;
    return;
  }
  state[parts[0]][parts[1]] = value;
}

function significantCount(text, end) {
  let count = 0;
  for (let i = 0; i < end && i < text.length; i += 1) {
    if (/\d|[.,٫]/.test(text[i])) count += 1;
  }
  return count;
}

function caretFromCount(text, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d|[.,٫]/.test(text[i])) {
      seen += 1;
      if (seen >= count) return i + 1;
    }
  }
  return text.length;
}

function onField(event) {
  const el = event.target;
  if (!el.dataset || !el.dataset.bind) return;
  if (el.dataset.numeric && event.type === 'input') {
    const start = el.selectionStart ?? el.value.length;
    const marked = significantCount(el.value, start);
    const next = liveFormat(el.value, state.lang);
    readBind(el.dataset.bind, next.canonical);
    if (el.value !== next.display) {
      el.value = next.display;
      const pos = caretFromCount(next.display, marked);
      try { el.setSelectionRange(pos, pos); } catch (err) {}
    }
  } else if (!el.dataset.numeric || event.type === 'change') {
    readBind(el.dataset.bind, el.dataset.numeric ? liveFormat(el.value, state.lang).canonical : el.value);
  } else {
    return;
  }
  save();
  paint();
}

function onClick(event) {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    save();
    renderNav();
    renderMain();
    if (state.tab === 'avg') paintRows();
    return;
  }
  const press = event.target.closest('[data-press]');
  if (press) {
    readBind(press.dataset.press, press.dataset.value);
    save();
    if (press.dataset.press === 'pos.mode') renderMain();
    else {
      document.querySelectorAll(`[data-press="${press.dataset.press}"]`).forEach((button) => {
        button.setAttribute('aria-pressed', String(button === press));
      });
      syncUnits();
      paint();
    }
    return;
  }
  const act = event.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'add-row') {
    if (state.avg.rows.length >= 30) return;
    state.avg.rows.push({ price: '', qty: '' });
    save();
    appendBuyRow();
    const input = document.getElementById(`price-${state.avg.rows.length - 1}`);
    input?.focus({ preventScroll: true });
    input?.closest('.buy')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    paint();
  }
  if (act.dataset.act === 'remove-row') {
    const index = Number(act.dataset.index);
    state.avg.rows.splice(index, 1);
    if (!state.avg.rows.length) state.avg.rows.push({ price: '', qty: '' });
    save();
    const host = $('#rows');
    host?.children[index]?.remove();
    if (!host?.children.length) paintRows();
    else reindexBuyRows();
    paint();
  }
  if (act.dataset.act === 'toggle-fractional') {
    state.pos.fractional = !state.pos.fractional;
    save();
    act.setAttribute('aria-pressed', String(state.pos.fractional));
    paint();
  }
  if (act.dataset.act === 'share-save') shareSaved(act.dataset.id);
  if (act.dataset.act === 'open-save') openSaveSheet();
  if (act.dataset.act === 'open-library') openLibrarySheet();
  if (act.dataset.act === 'load-save') loadNamed(act.dataset.id);
  if (act.dataset.act === 'delete-save') deleteNamed(act.dataset.id);
  if (act.dataset.act === 'apply-update') applyPendingUpdate();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function libraryFor(tab = state.tab) {
  if (!state.library) state.library = { avg: [], growth: [] };
  if (!Array.isArray(state.library[tab])) state.library[tab] = [];
  return state.library[tab];
}

function snapshotOf(tab) {
  if (tab === 'avg') return clone(state.avg);
  if (tab === 'growth') return clone(state.growth);
  return null;
}

function applySnapshot(tab, data) {
  if (tab === 'avg') {
    const base = defaults().avg;
    state.avg = {
      ...base,
      ...data,
      rows: Array.isArray(data?.rows) && data.rows.length ? data.rows.slice(0, 30) : base.rows,
    };
  } else if (tab === 'growth') {
    state.growth = { ...defaults().growth, ...data };
  }
}

function suggestedSaveName() {
  if (state.tab === 'growth') {
    const duration = (state.growth.duration || '').trim();
    if (duration) return `${duration} ${t(state.growth.durationUnit === 'months' ? 'months' : 'years')}`;
  }
  if (state.tab === 'avg') {
    const filled = state.avg.rows.filter((row) => String(row.price || '').trim() && String(row.qty || '').trim());
    if (filled.length) return fill('buyN', { n: filled.length });
  }
  return '';
}

function openSheet(id, open) {
  const sheet = $(id);
  if (sheet) sheet.hidden = !open;
}

function closeSheets() {
  openSheet('#sheet', false);
  openSheet('#save-sheet', false);
  openSheet('#library-sheet', false);
}

function openSaveSheet() {
  if (state.tab !== 'avg' && state.tab !== 'growth') return;
  state.saveTab = state.tab;
  $('#save-name').value = suggestedSaveName();
  $('#save-preview').textContent = keepPreview(state.tab);
  closeSheets();
  openSheet('#save-sheet', true);
  requestAnimationFrame(() => $('#save-name').focus());
}

function saveNamed() {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const name = ($('#save-name').value || '').trim();
  if (!name) {
    $('#save-name').focus();
    return;
  }
  const list = libraryFor(tab);
  const key = name.toLowerCase();
  const existing = list.find((item) => String(item.name || '').toLowerCase() === key);
  const entry = {
    id: existing?.id || String(Date.now()),
    name,
    savedAt: Date.now(),
    data: snapshotOf(tab),
  };
  if (existing) Object.assign(existing, entry);
  else {
    list.unshift(entry);
    if (list.length > LIBRARY_CAP) list.length = LIBRARY_CAP;
  }
  save();
  closeSheets();
  paintKeep();
  toast(t('toastSaved'));
}

function openLibrarySheet() {
  if (state.tab !== 'avg' && state.tab !== 'growth') return;
  state.saveTab = state.tab;
  paintLibrary();
  closeSheets();
  openSheet('#library-sheet', true);
}

function savedWhen(ts) {
  try {
    return new Date(ts).toLocaleString(state.lang === 'ar' ? 'ar' : state.lang, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

function paintLibrary() {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const list = libraryFor(tab);
  const host = $('#library-list');
  if (!list.length) {
    host.innerHTML = `<p class="empty">${t('savedEmpty')}</p>`;
    return;
  }
  host.innerHTML = list.map((item) => `
    <article class="keep-card">
      <div class="buy-head">
        <span>${esc(item.name)}</span>
        <button type="button" class="text-btn" data-act="delete-save" data-id="${esc(item.id)}">${t('deleteSave')}</button>
      </div>
      <button type="button" class="load" data-act="load-save" data-id="${esc(item.id)}">
        <span class="figure num">${esc(namedSummary(tab, item.data))}</span>
        <span class="meta">${esc(savedWhen(item.savedAt))}</span>
      </button>
      ${tab === 'avg' ? `<div class="row-actions"><button type="button" class="text-btn" data-act="share-save" data-id="${esc(item.id)}">${t('shareThis')}</button></div>` : ''}
    </article>`).join('');
}

function loadNamed(id) {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const item = libraryFor(tab).find((entry) => entry.id === id);
  if (!item) return;
  applySnapshot(tab, item.data);
  state.tab = tab;
  save();
  closeSheets();
  applyChrome();
  renderMain();
  if (tab === 'avg') paintRows();
}

function deleteNamed(id) {
  if (!window.confirm(t('deleteSaveQ'))) return;
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  state.library[tab] = libraryFor(tab).filter((item) => item.id !== id);
  save();
  paintLibrary();
  paintKeep();
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function platformLabel() {
  try {
    return window.Capacitor?.isNativePlatform?.() ? 'Android app' : 'Web';
  } catch {
    return 'Web';
  }
}

async function sharePlain(text, copiedKey = 'shareCopied') {
  const title = t('appName');
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.Share?.share) {
      await cap.Plugins.Share.share({ title, text, dialogTitle: t('shareApp') });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message === 'Share canceled') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(t(copiedKey));
  } catch {
    toast(text);
  }
}

function shareApp() {
  return sharePlain(`${t('shareText')}\n\n${WEB_URL}`);
}

function shareSaved(id) {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const item = libraryFor(tab).find((entry) => entry.id === id);
  if (!item || tab !== 'avg') return;
  const summary = stockAverage(item.data?.rows || []);
  if (!summary.ok) return;
  const mark = positionMark({ qty: summary.totalShares, avg: summary.average, price: item.data.current });
  const lines = [
    t('shareAvgHead'),
    item.name,
    fill('shareBuys', { n: summary.buys }),
    fill('shareShares', { shares: qty(summary.totalShares) }),
    fill('shareAvgPrice', { avg: moneyPrice(summary.average) }),
    fill('shareCost', { cost: money(summary.totalCost) }),
  ];
  if (mark.ok) {
    lines.push(fill('shareMark', {
      price: moneyPrice(item.data.current),
      pnl: signedMoney(mark.unrealized),
      pct: pct(mark.unrealizedPct),
    }));
  }
  lines.push(savedWhen(item.savedAt), t('shareVia'), WEB_URL);
  return sharePlain(lines.join('\n'), 'shareSaveCopied');
}

function rateApp() {
  try {
    const cap = window.Capacitor;
    if (cap?.isNativePlatform?.() && cap.Plugins?.InAppReview?.requestReview) {
      cap.Plugins.InAppReview.requestReview();
      return;
    }
  } catch (err) {}
  window.open(PLAY_URL, '_blank', 'noopener');
}

function sendFeedback() {
  const body = `${t('feedbackBody')}\n\n\n\n----------\n${t('appName')}\nLanguage: ${state.lang} | Theme: ${state.theme} | Platform: ${platformLabel()}`;
  const href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(t('feedbackSubject'))}&body=${encodeURIComponent(body)}`;
  const link = document.createElement('a');
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function bindSheet(id) {
  const sheet = $(id);
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) openSheet(id, false);
  });
}

function boot() {
  applyChrome();
  renderMain();
  if (state.tab === 'avg') paintRows();
  $('#app').addEventListener('input', onField);
  $('#app').addEventListener('change', onField);
  $('#app').addEventListener('click', onClick);
  $('#settings-open').addEventListener('click', () => {
    closeSheets();
    openSheet('#sheet', true);
  });
  $('#sheet-close').addEventListener('click', () => openSheet('#sheet', false));
  $('#save-close').addEventListener('click', () => openSheet('#save-sheet', false));
  $('#library-close').addEventListener('click', () => openSheet('#library-sheet', false));
  $('#save-confirm').addEventListener('click', saveNamed);
  $('#save-name').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveNamed();
    }
  });
  $('#share-open').addEventListener('click', shareApp);
  $('#rate-app').addEventListener('click', rateApp);
  $('#send-feedback').addEventListener('click', sendFeedback);
  bindSheet('#sheet');
  bindSheet('#save-sheet');
  bindSheet('#library-sheet');
  $('#lang').addEventListener('change', () => {
    state.lang = $('#lang').value;
    save();
    applyChrome();
    renderMain();
    if (state.tab === 'avg') paintRows();
  });
  $('#currency').addEventListener('change', () => {
    state.currency = $('#currency').value;
    save();
    renderMain();
    if (state.tab === 'avg') paintRows();
  });
  $('#theme-light').addEventListener('click', () => setTheme('light'));
  $('#theme-dark').addEventListener('click', () => setTheme('dark'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSheets();
  });
  watchUpdates();
}

function setTheme(theme) {
  state.theme = theme;
  save();
  applyChrome();
}

function changelogText(cl) {
  if (!cl) return t('updateGeneric');
  return cl[state.lang] || cl.en || cl.ar || t('updateGeneric');
}

function versionLabel(version) {
  if (!version) return '';
  if (state.lang === 'ar') return ` · الإصدار ${version}`;
  if (state.lang === 'es') return ` · versión ${version}`;
  if (state.lang === 'pt') return ` · versão ${version}`;
  return ` · version ${version}`;
}

function applyPendingUpdate() {
  if (pendingWorker) pendingWorker.postMessage('SKIP_WAITING');
  else window.location.reload();
}

function paintUpdateUI() {
  const box = $('#settings-update');
  if (box) {
    if (!pendingWorker) {
      box.hidden = true;
      box.innerHTML = '';
    } else {
      box.hidden = false;
      box.className = 'settings-update';
      box.innerHTML = `
        <div class="settings-update-head">${t('updateReady')}${versionLabel(pendingInfo?.version)}</div>
        <p>${changelogText(pendingInfo?.changelog)}</p>
        <button type="button" class="update-now" data-act="apply-update">${t('updateNow')}</button>`;
    }
  }

  const oldBanner = $('#updateBanner');
  const oldChip = $('#updateChip');
  if (!pendingWorker) {
    oldBanner?.remove();
    oldChip?.remove();
    return;
  }
  if (bannerDismissed) {
    oldBanner?.remove();
    if (!oldChip) {
      const chip = document.createElement('button');
      chip.id = 'updateChip';
      chip.type = 'button';
      chip.className = 'update-chip';
      chip.textContent = t('updateReady');
      chip.addEventListener('click', applyPendingUpdate);
      $('#app').appendChild(chip);
    } else {
      oldChip.textContent = t('updateReady');
    }
    return;
  }
  oldChip?.remove();
  if (oldBanner) {
    oldBanner.querySelector('.update-banner-head').textContent = t('updateAvail') + versionLabel(pendingInfo?.version);
    oldBanner.querySelector('.update-banner-desc').textContent = changelogText(pendingInfo?.changelog);
    oldBanner.querySelector('.update-later').textContent = t('updateLater');
    oldBanner.querySelector('.update-now').textContent = t('updateNow');
    return;
  }
  const bar = document.createElement('div');
  bar.id = 'updateBanner';
  bar.className = 'update-banner';
  bar.innerHTML = `
    <div class="update-banner-head">${t('updateAvail')}${versionLabel(pendingInfo?.version)}</div>
    <div class="update-banner-desc"></div>
    <div class="update-banner-row">
      <button type="button" class="update-later">${t('updateLater')}</button>
      <button type="button" class="update-now">${t('updateNow')}</button>
    </div>`;
  bar.querySelector('.update-banner-desc').textContent = changelogText(pendingInfo?.changelog);
  bar.querySelector('.update-later').addEventListener('click', () => {
    bannerDismissed = true;
    paintUpdateUI();
  });
  bar.querySelector('.update-now').addEventListener('click', (event) => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = '…';
    applyPendingUpdate();
  });
  $('#app').appendChild(bar);
}

function offerUpdate(worker) {
  pendingWorker = worker || null;
  if (worker) {
    const onMsg = (event) => {
      if (event.data && event.data.type === 'VERSION_INFO') {
        pendingInfo = { version: event.data.version, changelog: event.data.changelog };
        paintUpdateUI();
        navigator.serviceWorker.removeEventListener('message', onMsg);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMsg);
    try { worker.postMessage('GET_VERSION_INFO'); } catch (err) {}
  }
  paintUpdateUI();
}

function watchUpdates() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  try {
    if (window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web') return;
  } catch (err) {}

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    const checkWaiting = () => {
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    };
    checkWaiting();
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(installing);
      });
    });
    reg.update().then(checkWaiting).catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().then(checkWaiting).catch(() => {});
    });
    setInterval(() => { reg.update().then(checkWaiting).catch(() => {}); }, 60000);
  }).catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function iconBars() {
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="3" y="13" width="3.2" height="7" rx="1"/><rect x="8" y="9" width="3.2" height="11" rx="1"/><rect x="13" y="4" width="3.2" height="16" rx="1"/><rect x="18" y="11" width="3.2" height="9" rx="1"/></svg>';
}
function iconPnl() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 16l5-5 3 3 6-7"/><path d="M14 7h5v5"/></svg>';
}
function iconSize() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15V9M12 15v-3M16 15V8"/></svg>';
}
function iconGrowth() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 16c2-1 3-5 5-5s3 3 5 3 3-6 6-7"/><path d="M4 19h16"/></svg>';
}

boot();
