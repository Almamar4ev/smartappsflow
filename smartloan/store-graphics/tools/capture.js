const fs = require('fs');
const { open } = require('./lib');

const FONT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&family=Noto+Sans+Arabic:wght@400;500;600;700;800;900&display=block');
*{font-family:'Roboto','Noto Sans Arabic',sans-serif!important}
#backup-banner{display:none!important}`;

async function prep(page) {
  await page.addStyleTag({ content: FONT_CSS });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(700);
}

(async () => {
  const lang = process.argv[2];
  const out = `raw/${lang}`;
  fs.mkdirSync(out, { recursive: true });
  const { browser, page } = await open(lang, { dsf: 4 });
  await prep(page);
  const full = n => page.screenshot({ path: `${out}/${n}.png`, fullPage: true });
  const el = (sel, n) => page.locator(sel).first().screenshot({ path: `${out}/${n}.png` });

  // Home
  await page.evaluate(() => { showScreen('home'); renderHome(); });
  await page.waitForTimeout(600);
  await full('home');
  await el('#home-profile-card', 'f-profile');
  await el('#home-loans-section', 'f-myloans');
  await el('#home-loans-list > *', 'f-loanrow');
  const homeMeta = await page.evaluate(() => { const b = document.getElementById('home-loans-section').getBoundingClientRect(); return { loansTop: b.top + scrollY }; });

  // Plan report
  await page.evaluate(() => openSavedDetail(0));
  await page.waitForTimeout(800);
  await full('report');
  await el('#banklimit-card > div', 'f-bankstatus');
  await el('#kpi-grid', 'f-kpi');
  for (const t of ['charts', 'schedule', 'simulate']) {
    await page.evaluate(t => switchTab(t, document.getElementById('tab-' + t)), t);
    await page.waitForTimeout(1000);
    await full(t);
  }
  await page.evaluate(() => switchTab('charts', document.getElementById('tab-charts')));
  await page.waitForTimeout(1000);
  await el('#chart-pie-html', 'f-donut');
  await el('#income-dist-card', 'f-income');
  await page.evaluate(() => switchTab('schedule', document.getElementById('tab-schedule')));
  await page.waitForTimeout(800);
  await el('#srow-0', 'f-schedrow');
  await page.evaluate(() => switchTab('simulate', document.getElementById('tab-simulate')));
  await page.waitForTimeout(800);
  const simKpi = await page.evaluate(() => {
    const c = document.getElementById('tc-simulate');
    const cards = [...c.querySelectorAll('*')].filter(e => e.children.length > 1 && /grid/.test(getComputedStyle(e).display));
    const g = cards[cards.length - 1]; g.setAttribute('data-shot', 'simkpi'); return !!g;
  });
  if (simKpi) await el('[data-shot=simkpi]', 'f-simkpi');

  // Compare
  await page.evaluate(() => { showScreen('home'); renderHome(); openCompare(); });
  await page.waitForTimeout(1000);
  await full('compare');
  await el('.cmp-side.win', 'f-cheapest');
  await el('.cmp-sides', 'f-sides');

  const meta = { ...homeMeta, bg: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) };
  fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
  await browser.close();
  console.log('done', lang);
})();
