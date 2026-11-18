import { stockAverage, profitLoss, positionByPercent, positionByPrice, compoundGrowth, positionMark, targetAverage, whatIfSell, sellCompare, liveFormat, formatInputValue, tidyNumber, separators } from './calc.js';
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
const APP_VERSION = (typeof self !== 'undefined' && self.BASIS_VERSION) ? self.BASIS_VERSION : '1.0';
const APP_BUILD = (typeof self !== 'undefined' && self.BASIS_BUILD) ? self.BASIS_BUILD : 0;
const LTR = '\u2066';
const PDF = '\u2069';
let toastTimer = 0;
let pendingDeleteId = null;
let pendingDeleteAt = 0;
let saveSuggestion = '';
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
      whatIf: 'lower',
      planOpen: true,
      compareOpen: false,
      sellMode: 'pct',
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
      mode: 'percent', riskMode: 'percent', fractional: false,
      balance: '', risk: '', stopPct: '', targetPct: '',
      entry: '', stopPrice: '', targetPrice: '',
      maxLev: '1', customLev: '', fee: '',
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
      avg: {
        ...base.avg,
        ...saved.avg,
        rows: Array.isArray(saved.avg?.rows) && saved.avg.rows.length ? saved.avg.rows.slice(0, 30) : base.avg.rows,
        whatIf: saved.avg?.whatIf === 'sell' ? 'sell' : 'lower',
        sellMode: saved.avg?.sellMode === 'qty' ? 'qty' : 'pct',
        planOpen: saved.avg?.planOpen !== false,
        compareOpen: Boolean(saved.avg?.compareOpen),
      },
      pnl: { ...base.pnl, ...saved.pnl },
      pos: migratePos({ ...base.pos, ...saved.pos, fractional: Boolean(saved.pos?.fractional) }),
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

// Older saves had a Cash / Margin toggle; margin had no cap, the closest broker limit is 2x.
function migratePos(pos) {
  const next = { ...pos };
  const valid = ['1', '2', '4', '10', '30', 'custom'].includes(String(next.maxLev));
  // "account" only exists in saves from before max leverage; the default maxLev ('1') is already merged
  // in by then, so the old choice decides. Once saved again, "account" is gone and maxLev is the user's.
  if ('account' in next) next.maxLev = next.account === 'margin' ? '2' : '1';
  else if (!valid) next.maxLev = '1';
  delete next.account;
  return next;
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

// Display rules (owner's decision, 1.0). Every calculation keeps full precision.
//   money / prices >= 1 / averages / percents : whole → no decimals ($77, +50%); otherwise 2 ($79.60, +38.19%)
//   prices below 1                            : 4 significant digits ($0.4523, $0.00001234), at least 2 decimals
//   quantities                                : bare when whole, precise when fractional (qty)
//   Compound calculator                       : whole money everywhere (growthMoney) — long-range estimates
const TWO = { min: 2, max: 2 };

// Whole once rounded to cents → no decimals; otherwise exactly 2 ($364.80, never $364.8).
function cents(value) {
  return Number.isInteger(Math.round(Math.abs(Number(value)) * 100) / 100) ? { min: 0, max: 0 } : TWO;
}

function money(value) {
  const negative = value < 0;
  return `${negative ? '−' : ''}${moneyCore(formatNumber(Math.abs(value), cents(value)))}`;
}

function signedMoney(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${moneyCore(formatNumber(Math.abs(value), cents(value)))}`;
}

function growthMoney(value) {
  const rounded = Math.round(Number(value));
  return `${rounded < 0 ? '−' : ''}${moneyCore(formatNumber(Math.abs(rounded), { min: 0, max: 0 }))}`;
}

function signedGrowthMoney(value) {
  const rounded = Math.round(Number(value));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${moneyCore(formatNumber(Math.abs(rounded), { min: 0, max: 0 }))}`;
}

function price(value) {
  const n = Number(value);
  if (!(Math.abs(n) < 1) || n === 0) return formatNumber(n, cents(n));
  const sig = Number(n).toLocaleString(localeTag(), { maximumSignificantDigits: 4 });
  const decimals = (sig.split(/[.,]/)[1] || '').length;
  return decimals >= 2 ? sig : formatNumber(n, TWO);
}

// Count + unit with real plural forms (Intl.PluralRules). Arabic: سنة واحدة · سنتان · 3 سنوات · 11 سنة.
const UNIT_FORMS = {
  en: { years: { one: '{n} year', other: '{n} years' }, months: { one: '{n} month', other: '{n} months' } },
  es: { years: { one: '{n} año', other: '{n} años' }, months: { one: '{n} mes', other: '{n} meses' } },
  pt: { years: { one: '{n} ano', other: '{n} anos' }, months: { one: '{n} mês', other: '{n} meses' } },
  ar: {
    years: { one: 'سنة واحدة', two: 'سنتان', few: '{n} سنوات', many: '{n} سنة', other: '{n} سنة' },
    months: { one: 'شهر واحد', two: 'شهران', few: '{n} أشهر', many: '{n} شهرا', other: '{n} شهر' },
    shares: { one: 'سهم واحد', two: 'سهمان', few: '{n} أسهم', many: '{n} سهما', other: '{n} سهم' },
  },
};
UNIT_FORMS.en.shares = { one: '{n} share', other: '{n} shares' };
UNIT_FORMS.es.shares = { one: '{n} acción', other: '{n} acciones' };
UNIT_FORMS.pt.shares = { one: '{n} ação', other: '{n} ações' };

function countUnit(count, unit, wrap = (s) => s) {
  const n = Number(count);
  const table = UNIT_FORMS[state.lang] || UNIT_FORMS.en;
  const forms = table[unit] || table.years;
  let category = 'other';
  try { category = new Intl.PluralRules(state.lang).select(n); } catch {}
  const form = forms[category] || forms.other;
  return form.replace('{n}', wrap(formatInputValue(String(count), state.lang)));
}

function moneyPrice(value) {
  return moneyCore(price(value));
}

// Quantities: whole numbers bare (50), fractions up to 4 decimals (12.5); below 1 up to 8 (0.00125 BTC).
function qty(value) {
  return formatNumber(value, { min: 0, max: Math.abs(Number(value)) >= 1 ? 4 : 8 });
}

function pct(value) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(value), cents(value))}%`;
}

function plainPct(value) {
  return `${formatNumber(value, cents(value))}%`;
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
  $('#save-name-hint').textContent = t('saveNameHint');
  $('#save-confirm').textContent = t('save');
  $('#library-title').textContent = t('savedCalcs');
  $('#library-close').setAttribute('aria-label', t('close'));
  $('#lang').value = state.lang;
  $('#currency').value = state.currency;
  const version = $('#version-label');
  if (version) version.textContent = fill('versionName', { v: APP_BUILD ? `${APP_VERSION} (${fill('buildN', { n: APP_BUILD })})` : APP_VERSION });
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

function field(id, label, bind, unit, value, placeholder = '0') {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <div class="control">
      <input id="${id}" data-bind="${bind}" data-numeric="1" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(shown(value))}" data-shown="${esc(shown(value))}">
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
  const planOpen = state.avg.planOpen !== false;
  const lower = state.avg.whatIf !== 'sell';
  const byPct = state.avg.sellMode !== 'qty';
  return `${screenHead(t('avgTitle'), t('avgLead'))}
    <div class="stack">
      <section class="answer" id="answer"></section>
      <div id="snapshot"></div>
      <div id="rows"></div>
      <button type="button" class="add-btn" data-act="add-row">${t('addBuy')}</button>
      ${field('current', `${t('currentPrice')} · ${t('optional')}`, 'avg.current', 'currency', state.avg.current)}
      <section class="plan${planOpen ? ' open' : ''}" id="plan" hidden>
        <button type="button" class="plan-head" data-act="toggle-plan" aria-expanded="${planOpen ? 'true' : 'false'}">
          <span><b>${t('planNext')}</b><small>${t('planNextLead')}</small></span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="plan-body" id="plan-body" ${planOpen ? '' : 'hidden'}>
          ${segment('avg.whatIf', [{ value: 'lower', label: t('lowerAvg') }, { value: 'sell', label: t('sellPart') }])}
          <div class="plan-tool" id="lower-tool" ${lower ? '' : 'hidden'}>
            <div class="grid-2">
              ${field('target-avg', t('targetAvg'), 'avg.target', 'currency', state.avg.target)}
              ${field('buy-price', t('buyPrice'), 'avg.buyPrice', 'currency', state.avg.buyPrice)}
            </div>
            <div id="lower-out"></div>
          </div>
          <div class="plan-tool" id="sell-tool" ${lower ? 'hidden' : ''}>
            ${segment('avg.sellMode', [{ value: 'pct', label: t('sellByPct') }, { value: 'qty', label: t('sellByQty') }])}
            <div class="grid-2">
              <div id="sell-pct-wrap" ${byPct ? '' : 'hidden'}>${field('sell-pct', t('sellPct'), 'avg.sellPct', 'percent', state.avg.sellPct)}</div>
              <div id="sell-qty-wrap" ${byPct ? 'hidden' : ''}>${field('sell-qty', t('shares'), 'avg.sellQty', '', state.avg.sellQty, '0')}</div>
              ${field('sell-price', t('sellPrice'), 'avg.sellPrice', 'currency', state.avg.sellPrice)}
            </div>
            <div id="sell-out"></div>
            <button type="button" class="link-btn" id="compare-toggle" data-act="toggle-compare" aria-expanded="${state.avg.compareOpen ? 'true' : 'false'}">${state.avg.compareOpen ? t('hideCompare') : t('compareAmounts')}</button>
            <div id="compare-out" ${state.avg.compareOpen ? '' : 'hidden'}></div>
          </div>
          <p class="plan-note">${t('journalHint')}</p>
        </div>
      </section>
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
      ${field('qty', t('qty'), 'pnl.qty', '', state.pnl.qty, '0')}
      <p class="hint">${t('feesNote')}</p>
      <section class="answer" id="answer"></section>
      <div id="detail"></div>
    </div>`;
}

// Max leverage at the broker (replaces Cash / Margin, in both modes) + optional fees.
const LEVERAGE_CHIPS = ['1', '2', '4', '10', '30', 'custom'];

function leverageBlock() {
  const custom = state.pos.maxLev === 'custom';
  const feeOpen = Number(state.pos.fee) > 0;
  return `<div class="lev-block">
      <span class="lev-label">${t('maxLev')}</span>
      ${segment('pos.maxLev', LEVERAGE_CHIPS.map((value) => ({
        value,
        label: value === 'custom' ? t('levCustom') : value === '1' ? `1x <small>${t('levCashChip')}</small>` : `${value}x`,
      })))}
      <div id="custom-lev-wrap" ${custom ? '' : 'hidden'}>${field('custom-lev', t('levCustom'), 'pos.customLev', 'lev', state.pos.customLev, '20')}</div>
      <p class="hint" id="lev-hint"></p>
      <div class="lev-notes" id="lev-notes" hidden></div>
    </div>
    <details class="fees" ${feeOpen ? 'open' : ''}>
      <summary><span id="fees-title">${t('feesToggle')}</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></summary>
      ${field('fee', t('feesLabel'), 'pos.fee', 'percent', state.pos.fee, '0.1')}
    </details>`;
}

function maxLeverage() {
  return state.pos.maxLev === 'custom' ? state.pos.customLev : state.pos.maxLev;
}

// Risk with its % / currency switch inside the field, so the choice costs no extra row.
// The hint under it turns the value into the other unit ("= $30 of your balance").
function riskField() {
  const amount = state.pos.riskMode === 'amount';
  const currency = CURRENCIES[state.currency];
  const option = (value, label, on) => `<button type="button" data-press="pos.riskMode" data-value="${value}" aria-pressed="${on ? 'true' : 'false'}">${esc(label)}</button>`;
  return `<div class="field">
    <label for="risk">${t('risk')}</label>
    <div class="control has-switch">
      <input id="risk" data-bind="pos.risk" data-numeric="1" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(shown(state.pos.risk))}" data-shown="${esc(shown(state.pos.risk))}">
      <div class="unit-switch" role="group">${option('percent', '%', !amount)}${option('amount', currency.symbol || currency.label, amount)}</div>
    </div>
    <p class="hint" id="risk-hint"></p>
  </div>`;
}

function viewPosition() {
  const byPercent = state.pos.mode === 'percent';
  const fields = byPercent ? `
    ${field('balance', t('balance'), 'pos.balance', 'currency', state.pos.balance)}
    ${riskField()}
    ${field('stop', t('stopPct'), 'pos.stopPct', 'percent', state.pos.stopPct)}
    ${field('target', `${t('targetPct')} · ${t('optional')}`, 'pos.targetPct', 'percent', state.pos.targetPct)}
    ${leverageBlock()}` : `
    ${field('balance', t('balance'), 'pos.balance', 'currency', state.pos.balance)}
    ${field('entry', t('entry'), 'pos.entry', 'currency', state.pos.entry)}
    ${riskField()}
    <div class="field-group">
      <div class="grid-2">
        ${field('stop', t('stopPrice'), 'pos.stopPrice', 'currency', state.pos.stopPrice)}
        ${field('target', `${t('targetPrice')} · ${t('optional')}`, 'pos.targetPrice', 'currency', state.pos.targetPrice)}
      </div>
      <p class="hint" id="stop-hint" hidden></p>
    </div>
    <button type="button" class="toggle-row" data-act="toggle-fractional" aria-pressed="${state.pos.fractional ? 'true' : 'false'}">
      <span>${t('fractionalShares')}</span><i></i>
    </button>
    ${leverageBlock()}`;
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
  return result.ok ? `${t('finalBalance')} · ${growthMoney(result.finalBalance)}` : t('waiting');
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
        ${field(`qty-${index}`, t('shares'), `avg.row.${index}.qty`, '', row.qty, '0')}
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
    } else if (el.dataset.unit === 'lev') {
      el.textContent = 'x';
      el.hidden = false;
    } else if (el.dataset.unit === 'risk') {
      const amount = state.pos.riskMode === 'amount';
      el.textContent = amount ? symbol : '%';
      el.hidden = amount && !symbol;
    }
  });
  paintRiskHint();
}

function paintRiskHint() {
  const hint = $('#risk-hint');
  if (!hint) return;
  const amount = state.pos.riskMode === 'amount';
  const balance = Number(state.pos.balance);
  const risk = Number(state.pos.risk);
  if (balance > 0 && risk > 0) {
    hint.innerHTML = amount
      ? fill('riskIsPct', { pct: numSpan(plainPct((risk / balance) * 100)) })
      : fill('riskIsAmount', { money: numSpan(money((balance * risk) / 100)) });
  } else {
    hint.textContent = amount ? t('riskHintAmount') : t('riskHintPercent');
  }
}

// Switching % <-> currency keeps the same money at risk: 3% of $1,000 becomes $30, and back.
function convertRisk(to) {
  const balance = Number(state.pos.balance);
  const risk = Number(state.pos.risk);
  if (!(balance > 0 && risk > 0) || to === state.pos.riskMode) return;
  const next = to === 'amount' ? (balance * risk) / 100 : (risk / balance) * 100;
  state.pos.risk = String(Math.round(next * 100) / 100);
  const input = $('#risk');
  if (input) {
    input.value = shown(state.pos.risk);
    input.dataset.shown = input.value;
  }
}

function answer(host, { ready, tone, kicker, value, prompt, sub }) {
  host.className = `answer${ready ? ` ready ${tone || ''}` : ''}`;
  host.innerHTML = ready
    ? `<span class="result-label">${t('result')}</span><span class="kicker">${kicker}</span><span class="value num">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`
    : `<span class="result-label">${t('result')}</span><span class="prompt">${prompt}</span>`;
}

function stats(items, variant = '') {
  const three = variant === 'three';
  return `<div class="stats${variant ? ` ${variant}` : ''}">${items.map((item, index) => `
    <div class="stat${!three && items.length % 2 && index === items.length - 1 ? ' wide' : ''}"><span>${item.label}</span><strong class="${item.text ? 'text' : 'num'} ${item.tone || ''}">${item.value}</strong></div>
  `).join('')}</div>`;
}

function paint() {
  syncUnits();
  const answerHost = $('#answer');
  const detail = $('#detail') || $('#snapshot');
  if (!answerHost || !detail) return;
  if (state.tab === 'avg') paintAverage(answerHost, detail);
  else if (state.tab === 'pnl') paintPnl(answerHost, detail);
  else if (state.tab === 'pos') paintPosition(answerHost, detail);
  else paintGrowth(answerHost, detail);
  fitNumbers($('#main'));
}

function paintAverage(answerHost, snapshot) {
  const summary = stockAverage(state.avg.rows);
  const plan = $('#plan');
  // Placeholders for the buy/sell price fields follow the current price when there is one.
  const currentShown = Number(state.avg.current) > 0 ? shown(state.avg.current) : '0';
  ['#buy-price', '#sell-price'].forEach((sel) => { const el = $(sel); if (el) el.placeholder = currentShown; });
  if (!summary.ok) {
    // Same shape as a real result ("—" placeholders) so the buy rows do not jump when the first result appears.
    answer(answerHost, { ready: true, kicker: t('avgPrice'), value: '—' });
    answerHost.classList.add('pending');
    snapshot.innerHTML = `<div class="totals">${[t('shares'), t('shareCostLabel'), t('buys')].map((label) => `
    <div><span>${label}</span><b class="num">—</b></div>`).join('')}</div>`;
    if (plan) plan.hidden = true;
    return;
  }
  if (plan) plan.hidden = false;
  answer(answerHost, { ready: true, kicker: t('avgPrice'), value: moneyPrice(summary.average) });
  const mark = positionMark({ qty: summary.totalShares, avg: summary.average, price: state.avg.current });
  const cells = [
    { label: t('shares'), value: qty(summary.totalShares) },
    { label: t('shareCostLabel'), value: money(summary.totalCost) },
    mark.ok
      ? { label: t('profitNow'), value: signedMoney(mark.unrealized), tone: mark.unrealized >= 0 ? 'gain' : 'loss' }
      : { label: t('buys'), value: String(summary.buys) },
  ];
  snapshot.innerHTML = `<div class="totals">${cells.map((cell) => `
    <div><span>${cell.label}</span><b class="num ${cell.tone || ''}">${cell.value}</b></div>`).join('')}</div>`;
  paintLower(summary);
  paintSell(summary);
}

function usedBuyPrice() {
  const named = String(state.avg.buyPrice || '').trim();
  if (named && Number(named) > 0) return named;
  return String(state.avg.current || '').trim();
}

function paintLower(summary) {
  const host = $('#lower-out');
  if (!host) return;
  const target = targetAverage({
    qty: summary.totalShares,
    avg: summary.average,
    price: state.avg.current,
    buyPrice: state.avg.buyPrice,
    target: state.avg.target,
    whole: true,
  });
  if (target.reason === 'already') {
    host.innerHTML = `<p class="note">${fill('pickLowerTarget', { avg: numSpan(moneyPrice(summary.average)) })}</p>`;
    return;
  }
  if (target.reason === 'impossible') {
    const shownTarget = moneyPrice(Number(state.avg.target));
    host.innerHTML = `<p class="note">${fill('mustBuyBelow', { target: numSpan(shownTarget) })}</p>`;
    return;
  }
  if (!target.ok) {
    host.innerHTML = `<div class="idle">${t('enterLower')}</div>`;
    return;
  }
  const buyPrice = usedBuyPrice();
  host.innerHTML = `<div class="result-card">
    <div class="ba">
      <span class="from num">${esc(moneyPrice(summary.average))}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      <span class="to num">${esc(moneyPrice(target.newAvg))}</span>
    </div>
    <p>${fill('buySharesAt', { q: countUnit(target.needed, 'shares', (n) => `<strong class="num">${n}</strong>`), price: `<span class="num">${moneyPrice(Number(buyPrice))}</span>` })}</p>
    <div class="facts">
      <div><span>${t('neededCost')}</span><b class="num">${esc(money(target.neededCost))}</b></div>
      <div><span>${t('sharesAfter')}</span><b class="num">${esc(qty(target.newQty))}</b></div>
    </div>
    ${target.belowTarget ? `<p class="plan-note">${t('wholeSharesBelow')}</p>` : ''}
    <button type="button" class="ghost" data-act="add-as-buy" data-price="${esc(buyPrice)}" data-qty="${esc(String(target.needed))}">${t('addAsBuy')}</button>
  </div>`;
}

function paintSell(summary) {
  const host = $('#sell-out');
  if (!host) return;
  const byQty = state.avg.sellMode === 'qty';
  const position = { qty: summary.totalShares, avg: summary.average, price: state.avg.current };
  const sold = whatIfSell({
    ...position,
    sellPct: byQty ? '' : state.avg.sellPct,
    sellQty: byQty ? state.avg.sellQty : '',
    sellPrice: state.avg.sellPrice,
    whole: true,
  });
  if (sold.reason === 'shares') {
    host.innerHTML = `<div class="note">${t('qtyTooSmall')}</div>`;
  } else if (!sold.ok) {
    host.innerHTML = `<div class="idle">${t('enterSell')}</div>`;
  } else {
    const tone = sold.realized >= 0 ? 'gain' : 'loss';
    const sellPx = Number(state.avg.sellPrice) > 0 ? Number(state.avg.sellPrice) : Number(state.avg.current);
    host.innerHTML = `<div class="result-card">
      <p>${fill('sellResult', { q: countUnit(sold.sold, 'shares', numSpan), price: `<span class="num">${moneyPrice(sellPx)}</span>`, pnl: `<strong class="num ${tone}">${signedMoney(sold.realized)}</strong>` })}</p>
      ${sold.capped ? `<p class="plan-note">${fill('sellQtyCap', { shares: countUnit(summary.totalShares, 'shares', numSpan) })}</p>` : ''}
      <div class="facts">
        <div><span>${t('youReceive')}</span><b class="num">${esc(money(sold.received))}</b></div>
        <div><span>${t('remaining')}</span><b class="num">${esc(qty(sold.remaining))}</b></div>
        <div><span>${t('returnPct')}</span><b class="num ${tone}">${esc(pct(sold.returnPct))}</b></div>
      </div>
    </div>`;
  }
  paintCompare(position);
}

function paintCompare(position) {
  const host = $('#compare-out');
  if (!host) return;
  const rows = sellCompare({ ...position, sellPrice: state.avg.sellPrice, whole: true });
  if (!rows.every((row) => row.ok)) {
    host.innerHTML = '';
    return;
  }
  // Highlight only when the row truly matches the current input: % in percent mode, share count in qty mode.
  const byQty = state.avg.sellMode === 'qty';
  const currentPct = byQty ? NaN : Math.round(Number(state.avg.sellPct));
  const currentQty = byQty ? Math.floor(Number(state.avg.sellQty)) : NaN;
  host.innerHTML = `<div class="compare">
    <div class="row head">
      <span>${t('comparePercent')}</span>
      <span class="sub">${t('shares')}</span>
      <span class="sub">${t('youReceive')}</span>
      <span class="sub">${t('realizedProfit')}</span>
    </div>
    ${rows.map((row) => `
      <button type="button" class="row${currentPct === row.pct || currentQty === row.sold ? ' active' : ''}" data-act="pick-compare" data-pct="${row.pct}">
        <span class="num">${row.pct}%</span>
        <span class="num">${qty(row.sold)}</span>
        <span class="num">${money(row.received)}</span>
        <b class="num ${row.realized >= 0 ? 'gain' : 'loss'}">${signedMoney(row.realized)}</b>
      </button>`).join('')}
  </div>`;
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
  const shareMode = state.pos.mode === 'price';
  const common = {
    balance: state.pos.balance,
    riskMode: state.pos.riskMode,
    riskValue: state.pos.risk,
    maxLeverage: maxLeverage(),
    fee: state.pos.fee,
  };
  const result = shareMode
    ? positionByPrice({ ...common, entry: state.pos.entry, stop: state.pos.stopPrice, target: state.pos.targetPrice, fractional: state.pos.fractional })
    : positionByPercent({ ...common, stopPct: state.pos.stopPct, targetPct: state.pos.targetPct });
  paintLeverage(result);
  const stopHint = $('#stop-hint');
  if (stopHint) {
    stopHint.hidden = !(shareMode && result.ok);
    stopHint.innerHTML = stopHint.hidden ? '' : fill('stopNote', { money: numSpan(money(result.riskPerShare)), pct: numSpan(plainPct(result.stopPct)) });
  }
  if (!result.ok) {
    const prompt = result.reason === 'stop' ? t('needStop') : result.reason === 'prices' ? t('needPrices') : result.reason === 'shares' ? t('needShares') : t('needBalance');
    answer(answerHost, { ready: false, prompt });
    detail.innerHTML = '';
    return;
  }
  // Price mode: the hero shows shares, with the direction and the position value right under them.
  answer(answerHost, {
    ready: true,
    tone: result.capped ? 'warn' : '',
    kicker: shareMode ? t('quantity') : t('positionValue'),
    value: shareMode ? qty(result.quantity) : money(result.position),
    sub: shareMode
      ? `<span class="tag ${result.direction}">${t(result.direction === 'long' ? 'dirLong' : 'dirShort')}</span><span>${t('positionValue')} <b class="num">${money(result.position)}</b></span>`
      : '',
  });
  const lev = (value) => `${formatNumber(value, cents(value))}x`;
  const blocks = [];
  if (result.riskPct > 10) blocks.push(`<p class="note warn">${t('highRisk')}</p>`);
  if (result.wrongTarget) blocks.push(`<p class="note info">${t(result.direction === 'long' ? 'wrongTargetLong' : 'wrongTargetShort')}</p>`);
  // A target the round-trip fees eat: say so and give the break-even target, never a negative "gain".
  const feeEats = result.feeEatsTarget;
  if (feeEats) {
    const breakEven = shareMode ? moneyPrice(result.breakEvenPrice) : plainPct(result.breakEvenPct);
    blocks.push(`<p class="note info">${fill('feeTarget', { be: numSpan(breakEven) })}</p>`);
  }
  // Top row: risk : reward next to the position's share of the account (one label at every value;
  // above 100% it also shows the leverage used, "200% · 2x"). Bottom row: gain faces loss.
  const hasTarget = result.reward != null;
  const risk = { label: t('totalRisk'), value: money(result.actualRisk), tone: 'loss' };
  const share = {
    label: t('pctOfBalance'),
    // Above 100% the percent stops being readable (1,666.67%), so say it in words: "16.67 × your balance".
    value: result.leverage > 1.0001
      ? fill('timesBalance', { n: numSpan(formatNumber(result.leverage, cents(result.leverage))) })
      : plainPct(result.pctOfBalance),
    text: result.leverage > 1.0001,
  };
  blocks.push(stats(hasTarget
    ? [
      { label: t('riskReward'), value: !feeEats && result.rr > 0 ? `1 : ${formatNumber(result.rr, cents(result.rr))}` : '—' },
      share,
      feeEats
        ? { label: t('totalReward'), value: '—' }
        : { label: t('totalReward'), value: money(result.reward), tone: result.reward >= 0 ? 'gain' : 'loss' },
      risk,
    ]
    : [share, risk]));
  if (hasTarget) {
    blocks.push(`<div class="outcome">
      ${feeEats ? '' : `<div><span>${t('ifWin')}</span><b class="num gain">${money(result.balance + result.reward)}</b></div>`}
      <div><span>${t('ifLoss')}</span><b class="num loss">${money(result.balance - result.actualRisk)}</b></div>
    </div>`);
  }
  if (result.feeRate > 0) blocks.push(`<p class="fine">${fill('feesIncluded', { amount: numSpan(money(result.fees)) })}</p>`);
  blocks.push(`<p class="fine">${t('slipNote')}</p>`);
  detail.innerHTML = `<div class="pos-results">${blocks.join('')}</div>`;
}

// Everything leverage changes sits under the chips: buying power + margin in one line,
// then the cap warning and the account-wipeout line. The fees toggle comes after them.
function paintLeverage(result) {
  const hint = $('#lev-hint');
  if (!hint) return;
  const cap = Number(maxLeverage());
  const balance = Number(state.pos.balance);
  const lev = (value) => `${formatNumber(value, cents(value))}x`;
  if (!(cap > 1)) hint.textContent = t('levCashHint');
  else if (result.ok && result.marginRequired != null) {
    hint.innerHTML = fill('levPowerMargin', { power: numSpan(money(result.buyingPower)), margin: numSpan(money(result.marginRequired)) });
  } else {
    hint.innerHTML = balance > 0 ? fill('levPowerHint', { power: numSpan(money(balance * cap)), lev: numSpan(lev(cap)) }) : '';
  }
  const feesTitle = $('#fees-title');
  if (feesTitle) {
    const fee = Number(state.pos.fee);
    // Same digits as the field ("0.1%"), not padded to two decimals.
    feesTitle.innerHTML = fee > 0 ? fill('feesSet', { pct: numSpan(`${shown(state.pos.fee)}%`) }) : t('feesToggle');
  }
  const notes = $('#lev-notes');
  if (!notes) return;
  const list = [];
  if (result.ok && result.capped) {
    list.push(`<p class="note warn">${fill('capped', {
      power: numSpan(money(result.buyingPower)), risk: numSpan(money(result.actualRisk)), asked: numSpan(money(result.requestedRisk)),
    })}</p>`);
  }
  // Once the position is bigger than the balance: the move that wipes out the account, "about" a whole
  // percent. Muted information normally; red in a frame only when an everyday move (under 10%) is enough,
  // so the red stays rare and means something. With 10x+ available, one line about isolated crypto margin.
  if (result.ok && result.wipeoutPct != null) {
    const x = result.wipeoutPct >= 1 ? Math.round(result.wipeoutPct) : Math.round(result.wipeoutPct * 10) / 10;
    list.push(`<p class="note wipe${result.wipeoutNear ? ' near' : ''}">${fill('wipeLine', { pct: numSpan(plainPct(x)) })}</p>`);
    if (Number.isFinite(cap) && cap >= 10) list.push(`<p class="note crypto">${t('cryptoIsolated')}</p>`);
  }
  notes.innerHTML = list.join('');
  notes.hidden = !list.length;
}

// Long numbers shrink to fit their card instead of breaking onto a second line. Cards on the same row
// share one size (the smallest that fits all of them), never below 13px; past that the number may wrap.
function fitNumbers(root = document) {
  const MIN = 13;
  const rows = new Map();
  root.querySelectorAll('.totals, .stats').forEach((box, index) => {
    box.querySelectorAll(':scope > div > b, :scope > .stat > strong').forEach((el) => {
      el.style.fontSize = '';
      el.style.whiteSpace = '';
      if (!el.clientWidth) return;
      const key = `${index}:${Math.round(el.parentElement.getBoundingClientRect().top)}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push(el);
    });
  });
  const fits = (el) => el.scrollWidth <= el.clientWidth + 1;
  rows.forEach((els) => {
    if (els.every(fits)) return;
    let size = Math.min(...els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
    while (size > MIN && !els.every(fits)) {
      size = Math.max(MIN, size - 0.5);
      els.forEach((el) => { el.style.fontSize = `${size}px`; });
    }
    els.forEach((el) => { if (!fits(el)) el.style.whiteSpace = 'normal'; });
  });
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

// Points the touch cursor can snap to (set by growthChart, read by the chart pointer handlers).
let chartModel = null;

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
  // Snap targets: every year (and the last month) from 2 years up, otherwise every month.
  const byYear = months.length >= 24;
  const deposit = months[0]?.deposit || 0;
  const snaps = [];
  for (let i = 0; i < values.length; i += 1) {
    if (byYear && i % 12 !== 0 && i !== values.length - 1) continue;
    const invested = capital + deposit * i;
    let label = t('chartStart');
    if (i > 0) label = byYear && i % 12 === 0 ? fill('yearN', { n: i / 12 }) : fill('monthN', { n: i });
    snaps.push({ x: coords[i][0] / w, y: coords[i][1] / h, label, balance: values[i], invested, growth: values[i] - invested });
  }
  chartModel = { snaps };
  chartIndex = -1;
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return `<div class="chart-wrap" tabindex="0" dir="ltr" aria-label="${esc(t('chartHint'))}">
    <div class="chart-band" dir="${state.lang === 'ar' ? 'rtl' : 'ltr'}">
      <p class="chart-hint">${t('chartHint')}</p>
      <div class="chart-tip" hidden>
        <span class="tip-label"></span>
        <b class="tip-balance num"></b>
        <span class="tip-row"><span class="tip-key"></span> <span class="tip-growth num"></span></span>
        <span class="tip-row"><span class="tip-key"></span> <span class="tip-invested num"></span></span>
      </div>
    </div>
    <svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${t('chartTitle')}">
      <path class="area" d="${area}"></path>
      <path class="line" d="${line}"></path>
    </svg>
    <i class="chart-cursor" hidden></i>
    <i class="chart-dot" hidden></i>
  </div>
  <div class="chart-scale" dir="ltr"><span class="num">${growthMoney(capital)}</span><span class="num">${growthMoney(values.at(-1))}</span></div>`;
}

// Touch / mouse / keyboard cursor on the growth chart. One rAF per frame, no re-render:
// it only moves three absolutely positioned elements and swaps text.
let chartFrame = 0;
let chartIndex = -1;

function showChartPoint(wrap, index) {
  const snaps = chartModel?.snaps;
  if (!snaps?.length) return;
  const i = Math.max(0, Math.min(snaps.length - 1, index));
  chartIndex = i;
  const p = snaps[i];
  const svg = wrap.querySelector('.chart');
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  // SVG elements have no offsetTop; measure the plot against the wrapper instead.
  const top = svg.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
  const x = p.x * width;
  const cursor = wrap.querySelector('.chart-cursor');
  const dot = wrap.querySelector('.chart-dot');
  const tip = wrap.querySelector('.chart-tip');
  cursor.hidden = false;
  dot.hidden = false;
  tip.hidden = false;
  wrap.querySelector('.chart-hint').hidden = true;
  cursor.style.transform = `translate(${x}px, ${top}px)`;
  cursor.style.height = `${height}px`;
  dot.style.transform = `translate(${x}px, ${top + p.y * height}px)`;
  tip.querySelector('.tip-label').textContent = p.label;
  tip.querySelector('.tip-balance').textContent = growthMoney(p.balance);
  const keys = tip.querySelectorAll('.tip-key');
  keys[0].textContent = t('chartGrowth');
  keys[1].textContent = t('chartInvested');
  tip.querySelector('.tip-growth').textContent = signedGrowthMoney(p.growth);
  tip.querySelector('.tip-invested').textContent = growthMoney(p.invested);
  // The readout follows the finger inside the band above the plot, clamped to the card.
  const tipWidth = tip.offsetWidth;
  const left = Math.max(0, Math.min(width - tipWidth, x - tipWidth / 2));
  tip.style.transform = `translateX(${left}px)`;
}

function chartIndexAt(wrap, clientX) {
  const snaps = chartModel?.snaps;
  if (!snaps?.length) return -1;
  const rect = wrap.getBoundingClientRect();
  const fraction = (clientX - rect.left) / rect.width;
  let best = 0;
  for (let i = 1; i < snaps.length; i += 1) {
    if (Math.abs(snaps[i].x - fraction) < Math.abs(snaps[best].x - fraction)) best = i;
  }
  return best;
}

// Touch: a finger that starts on the chart and goes up or down is scrolling the page, so the marker
// waits until the drag is clearly sideways (or the finger lifts after a tap) before it moves.
let chartTouch = null;

function onChartPointer(event) {
  const touch = event.pointerType !== 'mouse';
  if (touch && (event.type === 'pointercancel' || event.type === 'pointerup')) {
    const pending = chartTouch;
    chartTouch = null;
    // A tap (no real movement) still shows the point under the finger.
    if (event.type === 'pointercancel' || !pending || pending.active) return;
    if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 10) return;
  }
  const wrap = event.target.closest?.('.chart-wrap');
  if (!wrap) return;
  if (event.type === 'pointerdown') {
    try { wrap.setPointerCapture(event.pointerId); } catch {}
    if (touch) {
      chartTouch = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
      return;
    }
  } else if (event.type === 'pointermove' && touch) {
    if (!chartTouch || chartTouch.id !== event.pointerId) return;
    if (!chartTouch.active) {
      const dx = Math.abs(event.clientX - chartTouch.x);
      const dy = Math.abs(event.clientY - chartTouch.y);
      if (dx < 6 || dx <= dy) return;
      chartTouch.active = true;
    }
  }
  const clientX = event.clientX;
  cancelAnimationFrame(chartFrame);
  chartFrame = requestAnimationFrame(() => {
    const index = chartIndexAt(wrap, clientX);
    if (index >= 0 && index !== chartIndex) showChartPoint(wrap, index);
    else if (index >= 0 && wrap.querySelector('.chart-tip').hidden) showChartPoint(wrap, index);
  });
}

function onChartKey(event) {
  const wrap = event.target.closest?.('.chart-wrap');
  if (!wrap || !chartModel) return;
  const last = chartModel.snaps.length - 1;
  const moves = { ArrowRight: chartIndex + 1, ArrowLeft: chartIndex - 1, Home: 0, End: last };
  if (!(event.key in moves)) return;
  event.preventDefault();
  showChartPoint(wrap, chartIndex < 0 && event.key.startsWith('Arrow') ? last : moves[event.key]);
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
        ${parts.map((part) => `<li><span class="name"><i class="swatch ${part.swatch}"></i>${part.label}</span><b class="num">${growthMoney(part.value)}</b></li>`).join('')}
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
  answer(answerHost, { ready: true, kicker: t('finalBalance'), value: growthMoney(result.finalBalance) });
  const rows = scheduleRows(result.months);
  detail.innerHTML = `
    ${stats([
      { label: t('totalInvested'), value: growthMoney(result.totalInvested) },
      { label: t('interest'), value: signedGrowthMoney(result.totalGrowth), tone: result.totalGrowth >= 0 ? 'gain' : 'loss' },
      { label: t('roi'), value: pct(result.roi), tone: result.roi >= 0 ? 'gain' : 'loss' },
      ...(result.totalDeposited > 0 ? [{ label: t('totalDeposited'), value: growthMoney(result.totalDeposited) }] : []),
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
          <span class="sub num">${signedGrowthMoney(row.interest)}</span>
          <b class="num">${growthMoney(row.balance)}</b>
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

// Caret mapping while a number is reformatted: only characters that survive formatting count —
// digits, the decimal mark of the current language and a minus sign. Thousands separators come and go
// (6,000 → 600), so counting them moved the caret one place off.
function keeps(ch) {
  return /[\d٠-٩۰-۹٫-]/.test(ch) || ch === separators(state.lang).decimal;
}

function significantCount(text, end) {
  let count = 0;
  for (let i = 0; i < end && i < text.length; i += 1) if (keeps(text[i])) count += 1;
  return count;
}

function caretFromCount(text, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (keeps(text[i])) {
      seen += 1;
      if (seen >= count) return i + 1;
    }
  }
  return text.length;
}

function keptOnly(text) {
  return [...String(text)].filter(keeps).join('');
}

function onField(event) {
  const el = event.target;
  if (!el.dataset || !el.dataset.bind) return;
  if (el.dataset.numeric && event.type === 'input') {
    let raw = el.value;
    let start = el.selectionStart ?? raw.length;
    // Backspace/Delete that only removed a thousands separator would be undone by reformatting;
    // remove the digit next to it instead, like a normal text field.
    const prev = el.dataset.shown ?? raw;
    if (raw.length < prev.length && keptOnly(raw) === keptOnly(prev)) {
      if (event.inputType === 'deleteContentBackward') {
        let i = start - 1;
        while (i >= 0 && !keeps(raw[i])) i -= 1;
        if (i >= 0) { raw = raw.slice(0, i) + raw.slice(i + 1); start = i; }
      } else if (event.inputType === 'deleteContentForward') {
        let i = start;
        while (i < raw.length && !keeps(raw[i])) i += 1;
        if (i < raw.length) raw = raw.slice(0, i) + raw.slice(i + 1);
      }
    }
    const marked = significantCount(raw, start);
    const next = liveFormat(raw, state.lang);
    readBind(el.dataset.bind, next.canonical);
    if (el.value !== next.display) el.value = next.display;
    const pos = caretFromCount(next.display, marked);
    try { el.setSelectionRange(pos, pos); } catch (err) {}
    el.dataset.shown = next.display;
  } else if (el.dataset.numeric && event.type === 'change') {
    // Leaving the field: drop leading zeros ("00012" → "12").
    const canonical = tidyNumber(liveFormat(el.value, state.lang).canonical);
    readBind(el.dataset.bind, canonical);
    el.value = formatInputValue(canonical, state.lang);
    el.dataset.shown = el.value;
  } else if (!el.dataset.numeric) {
    readBind(el.dataset.bind, el.value);
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
    if (press.dataset.press === 'pos.riskMode') convertRisk(press.dataset.value);
    readBind(press.dataset.press, press.dataset.value);
    save();
    if (press.dataset.press === 'pos.mode') renderMain();
    else {
      document.querySelectorAll(`[data-press="${press.dataset.press}"]`).forEach((button) => {
        button.setAttribute('aria-pressed', String(button === press));
      });
      if (press.dataset.press === 'avg.whatIf') {
        const lower = $('#lower-tool');
        const sell = $('#sell-tool');
        if (lower) lower.hidden = state.avg.whatIf !== 'lower';
        if (sell) sell.hidden = state.avg.whatIf !== 'sell';
      }
      if (press.dataset.press === 'avg.sellMode') {
        const pctWrap = $('#sell-pct-wrap');
        const qtyWrap = $('#sell-qty-wrap');
        if (pctWrap) pctWrap.hidden = state.avg.sellMode === 'qty';
        if (qtyWrap) qtyWrap.hidden = state.avg.sellMode !== 'qty';
      }
      if (press.dataset.press === 'pos.maxLev') {
        const wrap = $('#custom-lev-wrap');
        if (wrap) wrap.hidden = state.pos.maxLev !== 'custom';
        if (state.pos.maxLev === 'custom') $('#custom-lev')?.focus();
      }
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
  if (act.dataset.act === 'pending-delete') {
    pendingDeleteId = act.dataset.id;
    pendingDeleteAt = performance.now();
    paintLibrary();
    requestAnimationFrame(() => document.querySelector('.keep-card.pending .no')?.focus());
  }
  if (act.dataset.act === 'cancel-delete') {
    pendingDeleteId = null;
    paintLibrary();
  }
  // Ignore a Delete tap in the first 400 ms: it is the second half of a double tap on the trash icon.
  if (act.dataset.act === 'confirm-delete' && performance.now() - pendingDeleteAt >= 400) deleteNamed(act.dataset.id);
  if (act.dataset.act === 'lib-tab') {
    state.saveTab = act.dataset.lib === 'growth' ? 'growth' : 'avg';
    pendingDeleteId = null;
    paintLibrary();
  }
  if (act.dataset.act === 'toggle-plan') {
    state.avg.planOpen = state.avg.planOpen === false;
    save();
    const plan = $('#plan');
    const open = state.avg.planOpen !== false;
    plan?.classList.toggle('open', open);
    const body = $('#plan-body');
    if (body) body.hidden = !open;
    act.setAttribute('aria-expanded', String(open));
  }
  if (act.dataset.act === 'toggle-compare') {
    state.avg.compareOpen = !state.avg.compareOpen;
    save();
    const box = $('#compare-out');
    if (box) box.hidden = !state.avg.compareOpen;
    act.setAttribute('aria-expanded', String(state.avg.compareOpen));
    act.textContent = state.avg.compareOpen ? t('hideCompare') : t('compareAmounts');
  }
  if (act.dataset.act === 'pick-compare') {
    state.avg.sellPct = String(act.dataset.pct);
    state.avg.sellMode = 'pct';
    save();
    const pctWrap = $('#sell-pct-wrap');
    const qtyWrap = $('#sell-qty-wrap');
    if (pctWrap) pctWrap.hidden = false;
    if (qtyWrap) qtyWrap.hidden = true;
    document.querySelectorAll('[data-press="avg.sellMode"]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.value === 'pct'));
    });
    const input = $('#sell-pct');
    if (input) { input.value = shown(state.avg.sellPct); input.dataset.shown = input.value; }
    paint();
  }
  if (act.dataset.act === 'add-as-buy') {
    if (state.avg.rows.length >= 30) return;
    state.avg.rows.push({ price: act.dataset.price || '', qty: act.dataset.qty || '' });
    save();
    appendBuyRow();
    // The row is already filled, so no focus (no keyboard) and no toast that would cover it:
    // scroll to the new row and mark it briefly instead.
    const row = document.getElementById(`price-${state.avg.rows.length - 1}`)?.closest('.buy');
    paint();
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.add('just-added');
      setTimeout(() => row.classList.remove('just-added'), 1800);
    }
  }
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

// Default names: compound → its duration ("5 سنوات"); avg cost → "{tool} · {short date}", never "Buy 2".
function suggestedSaveName() {
  const duration = String(state.growth.duration || '').trim();
  if (state.tab === 'growth' && duration) return countUnit(duration, state.growth.durationUnit);
  const tool = state.tab === 'growth' ? t('growthTitle') : t('avgTitle');
  return `${tool} · ${shortDate(Date.now())}`;
}

function dateLocale() {
  return state.lang === 'ar' ? 'ar-u-nu-latn' : localeTag();
}

function shortDate(ts) {
  try {
    return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(new Date(ts));
  } catch {
    return '';
  }
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
  saveSuggestion = suggestedSaveName();
  $('#save-name').value = saveSuggestion;
  $('#save-name').placeholder = t(state.tab === 'growth' ? 'saveNamePhGrowth' : 'saveNamePhAvg');
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
    // An untouched suggested name is generic: the share title then shows only the tool name.
    auto: name === saveSuggestion,
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
  pendingDeleteId = null;
  paintLibrary();
  closeSheets();
  openSheet('#library-sheet', true);
}

// One date format for every saved card: "Today, 12:44 AM" when saved today, otherwise the date only.
function savedWhen(ts) {
  try {
    const when = new Date(ts);
    if (when.toDateString() === new Date().toDateString()) {
      const time = new Intl.DateTimeFormat(dateLocale(), { hour: 'numeric', minute: '2-digit' }).format(when);
      return fill('savedToday', { time });
    }
    return new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(when);
  } catch {
    return '';
  }
}

// Isolate one number inside running text so RTL lines keep it intact.
function numSpan(value) {
  return `<span class="num">${esc(value)}</span>`;
}

function libraryBits(tab, item) {
  if (tab === 'avg') {
    const summary = stockAverage(item.data?.rows || []);
    if (!summary.ok) return { value: '—', sum: '' };
    return {
      value: moneyPrice(summary.average),
      sum: fill('libAvgSum', {
        buys: numSpan(String(summary.buys)),
        shares: numSpan(qty(summary.totalShares)),
        cost: numSpan(money(summary.totalCost)),
      }),
    };
  }
  const result = compoundGrowth(item.data || {});
  if (!result.ok) return { value: '—', sum: '' };
  const data = item.data || {};
  const deposit = Number(data.deposit) > 0
    ? ` · ${fill('libDepositSum', { amount: numSpan(growthMoney(Number(data.deposit))) })}`
    : '';
  return {
    value: growthMoney(result.finalBalance),
    sum: fill('libGrowthSum', { duration: countUnit(data.duration, data.durationUnit, numSpan), rate: numSpan(annualRateOf(data)) }) + deposit,
  };
}

function paintLibrary() {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const list = libraryFor(tab);
  const host = $('#library-list');
  const tabs = `<div class="lib-tabs" role="group">
    <button type="button" class="chip" data-act="lib-tab" data-lib="avg" aria-pressed="${tab === 'avg' ? 'true' : 'false'}">${t('libAvg')}</button>
    <button type="button" class="chip" data-act="lib-tab" data-lib="growth" aria-pressed="${tab === 'growth' ? 'true' : 'false'}">${t('libGrowth')}</button>
  </div>`;
  if (!list.length) {
    host.innerHTML = `${tabs}<p class="empty">${t('savedEmpty')}</p>`;
    return;
  }
  host.innerHTML = tabs + list.map((item) => {
    const pending = pendingDeleteId === item.id;
    const bits = libraryBits(tab, item);
    return `<article class="keep-card${pending ? ' pending' : ''}">
      <div class="r1"><span class="name">${esc(item.name)}</span><span class="date">${esc(savedWhen(item.savedAt))}</span></div>
      <div class="figure num">${esc(bits.value)}</div>
      <div class="sum">${bits.sum}</div>
      ${pending
        ? `<div class="confirm" role="alertdialog" aria-label="${esc(t('deleteSave'))}">
            <button type="button" class="yes" data-act="confirm-delete" data-id="${esc(item.id)}">${t('deleteSave')}</button>
            <span>${esc(fill('deleteNamed', { name: item.name }))}</span>
            <button type="button" class="no" data-act="cancel-delete">${t('cancel')}</button>
          </div>`
        : `<div class="acts">
            <button type="button" class="load" data-act="load-save" data-id="${esc(item.id)}">${t('loadSave')}</button>
            <button type="button" class="act" data-act="share-save" data-id="${esc(item.id)}" aria-label="${esc(t('shareThis'))}">${iconShareSmall()}</button>
            <button type="button" class="act del" data-act="pending-delete" data-id="${esc(item.id)}" aria-label="${esc(t('deleteSave'))}">${iconTrash()}</button>
          </div>`}
    </article>`;
  }).join('');
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
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  state.library[tab] = libraryFor(tab).filter((item) => item.id !== id);
  pendingDeleteId = null;
  save();
  paintLibrary();
  paintKeep();
  toast(t('toastDeleted'), 2500);
}

function toast(message, ms = 2200) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function platformLabel() {
  try {
    return window.Capacitor?.isNativePlatform?.() ? 'Android app' : 'Web';
  } catch {
    return 'Web';
  }
}

function systemShowsCopied() {
  const match = /Android (\d+)/.exec(navigator.userAgent || '');
  return Boolean(match && Number(match[1]) >= 13);
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
    // Android 13+ shows its own "Copied" bubble; a second toast would sit under it.
    if (!systemShowsCopied()) toast(t(copiedKey));
  } catch {
    toast(text);
  }
}

function shareApp() {
  return sharePlain(`${t('shareText')}\n\n${WEB_URL}`);
}

function wrapVal(value) {
  return `${LTR}${value}${PDF}`;
}

function factLine(label, value) {
  return `${label}: ${wrapVal(value)}`;
}

// Title is "{name} · {tool}", or just the tool when the name is a default (untouched suggestion,
// a tool name, or an old "Buy 2" style name) so the title never repeats the duration or a row count.
function shareHeading(item, toolKey) {
  const tool = t(toolKey);
  const trimmed = String(item?.name || '').trim();
  const oldBuyName = new RegExp(`^${t('buyN').replace('{n}', '\\d+')}$`);
  const generic = !trimmed || item?.auto || trimmed.startsWith(`${tool} · `)
    || trimmed === tool || trimmed === t('avgTitle') || trimmed === t('growthTitle') || oldBuyName.test(trimmed);
  if (generic) return `*${tool}*`;
  // Average cost names are tickers, so the title reads as a sentence: "Average cost for AAPL".
  return toolKey === 'avgTitle' ? `*${fill('avgShareTitle', { name: trimmed })}*` : `*${trimmed} · ${tool}*`;
}

function shareAvgText(item) {
  const summary = stockAverage(item.data?.rows || []);
  if (!summary.ok) return '';
  const lines = [
    shareHeading(item, 'avgTitle'),
    factLine(t('avgPrice'), moneyPrice(summary.average)),
    factLine(t('shares'), qty(summary.totalShares)),
    factLine(t('shareCostLabel'), money(summary.totalCost)),
  ];
  const mark = positionMark({ qty: summary.totalShares, avg: summary.average, price: item.data?.current });
  if (mark.ok) {
    lines.push(factLine(t('currentPrice'), moneyPrice(item.data.current)));
    lines.push(factLine(mark.unrealized < 0 ? t('shareLoss') : t('shareProfit'), signedMoney(mark.unrealized)));
    lines.push(factLine(t('returnPct'), pct(mark.unrealizedPct)));
  }
  lines.push('', WEB_URL);
  return lines.join('\n');
}

function annualRateOf(growth) {
  const rate = Number(growth?.rate);
  if (!Number.isFinite(rate)) return '';
  const annual = growth.ratePeriod === 'monthly' ? rate * 12 : growth.ratePeriod === 'weekly' ? rate * 52 : rate;
  return `${formatNumber(annual, { min: 0, max: 2 })}%`;
}

function shareGrowthText(item) {
  const data = item.data || {};
  const result = compoundGrowth(data);
  if (!result.ok) return '';
  const lines = [
    shareHeading(item, 'growthTitle'),
    factLine(t('finalBalance'), growthMoney(result.finalBalance)),
    factLine(t('capital'), growthMoney(result.capital)),
  ];
  if (result.totalDeposited > 0 && Number(data.deposit) > 0) {
    lines.push(factLine(t('deposit'), growthMoney(Number(data.deposit))));
  }
  lines.push(factLine(t('shareAnnual'), annualRateOf(data)));
  lines.push(`${t('duration')}: ${countUnit(data.duration, data.durationUnit, wrapVal)}`);
  lines.push('', WEB_URL);
  return lines.join('\n');
}

function shareSaved(id) {
  const tab = state.saveTab === 'growth' ? 'growth' : 'avg';
  const item = libraryFor(tab).find((entry) => entry.id === id);
  if (!item) return;
  const text = tab === 'avg' ? shareAvgText(item) : shareGrowthText(item);
  if (text) return sharePlain(text, 'shareSaveCopied');
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
  $('#app').addEventListener('pointerdown', onChartPointer);
  $('#app').addEventListener('pointermove', onChartPointer, { passive: true });
  $('#app').addEventListener('pointerup', onChartPointer);
  $('#app').addEventListener('pointercancel', onChartPointer);
  $('#app').addEventListener('keydown', onChartKey);
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

// Full version everywhere (settings + update banner), so a user report names the exact build.
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
function iconShareSmall() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
}
function iconTrash() {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
}

boot();
