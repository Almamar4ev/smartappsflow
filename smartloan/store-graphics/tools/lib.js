const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.env.APPURL || 'http://127.0.0.1:8765/index.html';

// Builds a realistic USD profile, two real loans and three bank offers for the same home loan.
async function seed(page, lang) {
  await page.evaluate((lang) => {
    const L = (en, ar, es) => ({ en, ar, es })[lang];
    const now = new Date();
    currency = 'USD';
    window.lang = lang;
    profile = { ...blankProfile(), salary: '2200', income: '0', expenses: '700', variable: '300', existing: '0', employment: 'full', risk: 'medium', bankLimit: '40', limitBasis: 'gross' };
    profileSaved = true;
    const mk = (type, amount, months, rate, label, extra = {}) => {
      const sm = extra.startMonth != null ? extra.startMonth : now.getMonth();
      const sy = extra.startYear != null ? extra.startYear : now.getFullYear();
      form = { loanType: type, amount: String(amount), period: String(months), rate: String(rate), startMonth: sm, startYear: sy };
      const results = analyse();
      const o = { loanType: type, loanAmount: amount, loanMonthly: results.monthly, name: T[lang]['lt_' + type], label, results, form: { ...profile, ...form }, lang, time: '' };
      return Object.assign(o, extra.flags || {});
    };
    myLoans = [];
    const car = mk('car', 9000, 60, 5.9, L('Car', 'سيارة', 'Auto'), { startMonth: 2, startYear: 2025, flags: { startConfirmed: true } });
    const pers = mk('personal', 4000, 36, 7.5, L('Home furniture', 'أثاث المنزل', 'Muebles del hogar'), { startMonth: 5, startYear: 2024, flags: { startConfirmed: true } });
    myLoans = [car, pers];
    saved = [
      mk('personal', 12000, 48, 6.5, L('Bank A', 'البنك أ', 'Banco A')),
      mk('personal', 12000, 60, 6.2, L('Bank B', 'البنك ب', 'Banco B')),
      mk('personal', 12000, 48, 7, L('Bank C', 'البنك ج', 'Banco C')),
    ];
    form = { ...saved[0].form };
    persistState();
    localStorage.setItem('emigo_home_open', JSON.stringify({ loans: true, plans: true }));
  }, lang);
}

const HIDE_CSS = `#guide-welcome,#guide-whatsnew,#guide-nudge,#guide-tour-card,#guide-spot,.guide-spotlight,#sw-update-banner,.result-tip,#result-tip{display:none!important}
*{caret-color:transparent!important}`;

async function open(lang, opts = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({
    viewport: { width: opts.w || 390, height: opts.h || 844 },
    deviceScaleFactor: opts.dsf || 4,
    locale: lang === 'ar' ? 'ar' : lang === 'es' ? 'es-ES' : 'en-US',
    serviceWorkers: 'block',
    colorScheme: 'light',
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.goto(URL);
  await page.waitForTimeout(600);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(800);
  await seed(page, lang);
  await page.evaluate((lang) => {
    const st = JSON.parse(localStorage.getItem('sla_v1')); st.lang = lang; localStorage.setItem('sla_v1', JSON.stringify(st));
    localStorage.setItem('emigo_guide_v1', JSON.stringify({ tourDone: true, welcomed: true, seen: ['*'] }));
  }, lang);
  await page.reload();
  await page.addStyleTag({ content: HIDE_CSS });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: HIDE_CSS });
  return { browser, page };
}

module.exports = { open, HIDE_CSS };
