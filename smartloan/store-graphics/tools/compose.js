const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ICON = path.resolve(__dirname, '../../icon-512.png');

const W = 1080, H = 1920, DSF = 2;           // 2160 x 3840 output
const SCREEN_W = 624, SCALE = SCREEN_W / 390; // phone screen in canvas px; app was 390 css wide

const COPY = {
  en: [
    { k: 'home', h: 'Calculate any loan<br>in seconds', s: 'Your budget, loans and bank offers in one place', float: 'f-profile', layout: 'center', fw: 560, fpos: 'left:46px;bottom:200px', brand: true },
    { k: 'compare', h: 'Which offer is<br>really cheaper?', s: 'Compare bank offers for the same amount and term', float: 'f-sides', layout: 'start', fw: 600, fpos: 'right:40px;bottom:250px' },
    { k: 'report', h: 'Stay within your<br>bank limit', s: 'Know how much you can safely borrow', float: 'f-bankstatus', layout: 'center', fw: 640, fpos: 'left:40px;bottom:330px' },
    { k: 'myloans', h: 'Track the loans<br>you already pay', s: 'See when each one ends and what frees up', float: 'f-loanrow', layout: 'start', fw: 640, fpos: 'right:36px;bottom:420px' },
    { k: 'charts', h: 'See where<br>every dollar goes', s: 'Principal vs interest and your monthly income split', float: 'f-donut', layout: 'center', fw: 620, fpos: 'right:40px;top:930px' },
    { k: 'simulate', h: 'Try any<br>what-if', s: 'Change the amount, rate or term and see it instantly', float: 'f-simkpi', layout: 'start', fw: 620, fpos: 'right:40px;bottom:150px' },
    { k: 'schedule', h: 'Every payment,<br>month by month', s: 'A full payment schedule for any loan', float: 'f-schedrow', layout: 'center', fw: 960, fpos: 'left:60px;top:1040px' },
  ],
  ar: [
    { k: 'home', h: 'احسب أي قرض<br>في ثوان', s: 'ميزانيتك وقروضك وعروض البنوك في مكان واحد', float: 'f-profile', layout: 'center', fw: 560, fpos: 'right:46px;bottom:200px', brand: true },
    { k: 'compare', h: 'أي عرض<br>أرخص فعلا؟', s: 'قارن عروض البنوك بنفس المبلغ والمدة', float: 'f-sides', layout: 'start', fw: 600, fpos: 'left:40px;bottom:250px' },
    { k: 'report', h: 'ابق ضمن<br>حد البنك', s: 'اعرف كم يمكنك الاقتراض بأمان', float: 'f-bankstatus', layout: 'center', fw: 640, fpos: 'right:40px;bottom:330px' },
    { k: 'myloans', h: 'تابع قروضك<br>التي تدفعها', s: 'اعرف متى ينتهي كل قرض وكم يتوفر لك بعده', float: 'f-loanrow', layout: 'start', fw: 640, fpos: 'left:36px;bottom:420px' },
    { k: 'charts', h: 'اعرف أين يذهب<br>كل دولار', s: 'الأصل مقابل الفائدة وتوزيع دخلك الشهري', float: 'f-donut', layout: 'center', fw: 620, fpos: 'left:40px;top:930px' },
    { k: 'simulate', h: 'جرب<br>أي احتمال', s: 'غير المبلغ أو المدة أو الفائدة وشاهد النتيجة فورا', float: 'f-simkpi', layout: 'start', fw: 620, fpos: 'left:40px;bottom:150px' },
    { k: 'schedule', h: 'كل قسط،<br>شهرا بشهر', s: 'جدول سداد كامل لأي قرض', float: 'f-schedrow', layout: 'center', fw: 960, fpos: 'right:60px;top:1040px' },
  ],
};

const src = { home: 'home', compare: 'compare', report: 'report', myloans: 'home', charts: 'charts', simulate: 'simulate', schedule: 'schedule' };

function fileUrl(p) { return 'file:///' + path.resolve(p).replace(/\\/g, '/'); }

function statusBar(rtl) {
  const icons = `<svg width="30" height="22" viewBox="0 0 17 12"><rect x="0" y="8" width="3" height="4" rx=".7" fill="#0f172a"/><rect x="4.5" y="5.5" width="3" height="6.5" rx=".7" fill="#0f172a"/><rect x="9" y="3" width="3" height="9" rx=".7" fill="#0f172a"/><rect x="13.5" y="0" width="3" height="12" rx=".7" fill="#0f172a"/></svg>
  <svg width="30" height="22" viewBox="0 0 16 12"><path d="M8 11.5 5.6 8.9a3.4 3.4 0 0 1 4.8 0z M3.3 6.6a6.6 6.6 0 0 1 9.4 0l-1.2 1.2a4.9 4.9 0 0 0-7 0z M1 4.3a9.9 9.9 0 0 1 14 0l-1.2 1.2a8.2 8.2 0 0 0-11.6 0z" fill="#0f172a"/></svg>
  <svg width="44" height="22" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="#0f172a" opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2" fill="#0f172a"/><rect x="24" y="4.5" width="2" height="4" rx="1" fill="#0f172a" opacity=".45"/></svg>`;
  return `<div class="sb" style="flex-direction:${rtl ? 'row-reverse' : 'row'}"><span class="clock">9:41</span><span class="ic">${icons}</span></div>`;
}

function slideHtml(lang, s, idx, meta) {
  const rtl = lang === 'ar';
  const raw = `raw/${lang}`;
  const scroll = s.k === 'myloans' ? Math.max(0, meta.loansTop - 14) : 0;
  const startSide = rtl ? 'right' : 'left';
  const center = s.layout === 'center';
  const phoneLeft = center ? (W - (SCREEN_W + 36)) / 2 : (rtl ? W - (SCREEN_W + 36) - 70 : 70);
  const headAlign = center ? 'center' : startSide;
  const fontHead = rtl ? "'Cairo'" : "'Inter'";
  const circles = [
    [ -160, -120, 520, .13 ], [ W - 260, 120, 460, .10 ], [ -220, 980, 560, .09 ], [ W - 300, 1250, 640, .11 ],
  ].map(([x, y, d, o], i) => `<div class="c" style="left:${(idx % 2 ? W - x - d : x)}px;top:${y + (idx * 37) % 90}px;width:${d}px;height:${d}px;opacity:${o}"></div>`).join('');
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;800;900&family=Cairo:wght@600;700;800;900&family=Roboto:wght@500;700&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;background:linear-gradient(168deg,#5b4fe0 0%,#7a68f0 38%,#9a86f7 70%,#c3b2fb 100%);font-family:${fontHead},sans-serif}
.glow{position:absolute;inset:0;background:radial-gradient(900px 700px at ${idx % 2 ? 85 : 15}% 8%,rgba(255,255,255,.22),transparent 60%),radial-gradient(800px 800px at ${idx % 2 ? 10 : 90}% 95%,rgba(255,255,255,.18),transparent 60%)}
.c{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.9),rgba(255,255,255,.35) 70%);}
.dots{position:absolute;${rtl ? 'left' : 'right'}:56px;top:${center ? 640 : 560}px;width:200px;height:250px;background-image:radial-gradient(rgba(255,255,255,.55) 3px,transparent 3.5px);background-size:36px 36px;opacity:.55}
.head{position:absolute;top:${s.brand ? 150 : 118}px;left:70px;right:70px;text-align:${headAlign};color:#fff}
.brand{display:inline-flex;align-items:center;gap:16px;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.28);border-radius:999px;padding:10px 26px 10px 10px;margin-bottom:28px;position:absolute;top:-96px;${center ? 'left:50%;transform:translateX(-50%)' : startSide + ':0'};${rtl ? 'flex-direction:row-reverse;padding:10px 10px 10px 26px;' : ''}}
.brand img{width:56px;height:56px;border-radius:14px}
.brand span{font-family:'Inter';font-weight:800;font-size:34px;letter-spacing:-.5px}
h1{text-wrap:balance;font-weight:${rtl ? 800 : 800};font-size:${rtl ? 112 : 104}px;line-height:${rtl ? 1.22 : 1.04};letter-spacing:${rtl ? 0 : -2.5}px;text-shadow:0 6px 30px rgba(40,20,120,.25)}
p.sub{text-wrap:balance;margin-top:${rtl ? 18 : 30}px;font-weight:${rtl ? 600 : 500};font-size:${rtl ? 44 : 42}px;line-height:1.3;color:rgba(255,255,255,.93);text-shadow:0 3px 14px rgba(40,20,120,.25)}
.phone{position:absolute;left:${phoneLeft}px;top:${s.brand ? 600 : 560}px;width:${SCREEN_W + 36}px;height:1500px;border-radius:104px;background:linear-gradient(145deg,#2a2a33,#0b0b10 40%,#1c1c24);padding:18px;box-shadow:0 60px 120px rgba(30,15,90,.45),0 0 0 3px #3a3a46 inset}
.phone:before{content:'';position:absolute;${rtl ? 'left' : 'right'}:-7px;top:300px;width:7px;height:150px;border-radius:4px;background:#22222b}
.phone:after{content:'';position:absolute;${rtl ? 'left' : 'right'}:-7px;top:500px;width:7px;height:90px;border-radius:4px;background:#22222b}
.screen{position:relative;width:${SCREEN_W}px;height:100%;border-radius:88px;overflow:hidden;background:${meta.bg}}
.screen img.app{position:absolute;left:0;top:${70 - scroll * SCALE}px;width:${SCREEN_W}px}
.sb{position:absolute;left:0;right:0;top:0;height:70px;padding:0 64px;display:flex;align-items:center;justify-content:space-between;background:${meta.bg};z-index:2}
.sb .clock{font-family:'Roboto';font-weight:700;font-size:28px;color:#0f172a}
.sb .ic{display:flex;gap:8px;align-items:center}
.cam{position:absolute;left:50%;top:22px;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:#050507;box-shadow:0 0 0 3px #15151b;z-index:3}
.float{position:absolute;${s.fpos};width:${s.fw}px;background:#fff;border-radius:40px;padding:${s.float === 'f-schedrow' ? 14 : 18}px;box-shadow:0 40px 80px rgba(30,15,90,.40),0 8px 24px rgba(30,15,90,.18)}
.float img{display:block;width:100%;border-radius:26px}
</style></head><body>
<div class="glow"></div>${circles}<div class="dots"></div>
<div class="head">${s.brand ? `<div class="brand"><img src="${fileUrl(ICON)}"><span>emiGo</span></div>` : ''}<h1>${s.h}</h1><p class="sub">${s.s}</p></div>
<div class="phone"><div class="screen"><div class="cam"></div>${statusBar(rtl)}<img class="app" src="${fileUrl(`${raw}/${src[s.k]}.png`)}"></div></div>
<div class="float"><img src="${fileUrl(`${raw}/${s.float}.png`)}"></div>
</body></html>`;
}

(async () => {
  const only = process.argv[2];
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  const page = await ctx.newPage();
  fs.mkdirSync('out', { recursive: true });
  for (const lang of ['en', 'ar']) {
    const meta = JSON.parse(fs.readFileSync(`raw/${lang}/meta.json`, 'utf8'));
    for (const [i, s] of COPY[lang].entries()) {
      if (only && only !== `${lang}${i + 1}`) continue;
      const f = `tmp-${lang}-${i + 1}.html`;
      fs.writeFileSync(f, slideHtml(lang, s, i, meta));
      await page.goto(fileUrl(f));
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(im => im.decode().catch(() => {}))); });
      await page.waitForTimeout(300);
      const name = `${lang === 'ar' ? 'emigo-ar' : 'emigo-en'}-0${i + 1}-${s.k}.png`;
      await page.screenshot({ path: `out/${name}` });
      console.log(name);
    }
  }
  await browser.close();
})();
