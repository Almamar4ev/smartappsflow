// Screenshot import — OCR text → trade draft. Fills fields only; never saves.
// Classic script (no modules) so the web app and Node tests can both run it.
function siNum(s) {
  return parseFloat(String(s).replace(/,/g, '').replace(/[^\d.\-]/g, ''));
}
function siNear(a, b, tolPct) {
  return Math.abs(a - b) <= Math.abs(b) * tolPct / 100 + 0.02;
}
function siLines(t) {
  return String(t || '').replace(/US[S$]/g, 'USD').replace(/i CPRT\s*=/g, '1 CPRT =').split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
}

var SI_NAME_TICKERS = {
  'Rocket Lab': 'RKLB',
  'Apple': 'AAPL',
  'Microsoft': 'MSFT',
  'NVIDIA': 'NVDA',
  'Tesla': 'TSLA',
  'Amazon': 'AMZN',
  'Alphabet': 'GOOGL',
  'Meta': 'META',
  'Netflix': 'NFLX',
  'Intel': 'INTC',
  'AMD': 'AMD',
  'Palantir': 'PLTR',
  'Coinbase': 'COIN',
  'iShares Bitcoin': 'IBIT'
};

function siDetect(t) {
  if (/Volume\s+Market value\s+Net profit/i.test(t)) return 'xtb';
  if (/Your Position/i.test(t) && /Average Cost/i.test(t)) return 'baraka';
  if (/FILL PRICE\/AMT\/COMM/i.test(t)) return 'ibkr';
  if (/Your investment/i.test(t) && /AVERAGE PRICE/i.test(t)) return 't212-position';
  if (/FILLED QUANTITY/i.test(t) && /FILL PRICE/i.test(t)) return 't212-order';
  return null;
}

function siParseXTB(L) {
  var head = L.find(function(l){ return /\b(Stock|ETF)\b/.test(l); }) || '';
  var name = head.split(/\s+/).filter(function(w){
    return (/^[A-Z][a-z]+$/.test(w) || /^[A-Z]{2,}$/.test(w)) && w !== 'Stock' && w !== 'ETF';
  }).join(' ');
  var pl = L.find(function(l){ return /^\d+(\.\d+)?\s+USD\b/.test(l); });
  var current = pl ? siNum(pl.split(' ')[0]) : null;
  var buys = [];
  L.forEach(function(l, i) {
    if (/^Volume\b/.test(l) && L[i + 2] && /^@/.test(L[i + 2])) {
      var a = L[i + 1].split(/\s+/), b = L[i + 2].replace('@', '').trim().split(/\s+/);
      var qty = siNum(a[0]), mv = siNum(a[1]), price = siNum(b[0]);
      buys.push({ qty: qty, price: price, date: null, check: siNear(qty * current, mv, 0.1) });
    }
  });
  return { platform: 'XTB', symbol: SI_NAME_TICKERS[name] || null, name: name, current: current, buys: buys, sells: [], fees: 0, needs: ['symbol', 'dates'] };
}

function siParseBaraka(L) {
  var symbol = null, current = null;
  for (var k = 0; k < L.length - 1; k++) {
    if (/^[A-Z]{1,6}$/.test(L[k]) && /\$\d/.test(L[k + 1])) {
      symbol = L[k];
      current = siNum(L[k + 1].match(/\$[\d,.]+/)[0]);
      break;
    }
  }
  var r = -1;
  for (var i = 0; i < L.length; i++) { if (/Shares\s+Average Cost\s+Total Cost/i.test(L[i])) { r = i; break; } }
  var v = (L[r + 1] || '').split(/\s+/);
  var shares = siNum(v[0]), avgShown = siNum(v[1]), total = siNum(v[2]);
  var cv = -1;
  for (var j = 0; j < L.length; j++) { if (/Current Value/i.test(L[j])) { cv = j; break; } }
  var curValue = siNum(((L[cv + 1] || '').match(/\$[\d,.]+/) || [''])[0]);
  var avg = shares ? total / shares : 0;
  return {
    platform: 'Baraka', symbol: symbol, name: null, current: current, shares: shares, avgShown: avgShown,
    avgExact: +avg.toFixed(6), totalCost: total,
    buys: [{ qty: shares, price: +avg.toFixed(6), date: null, check: siNear(shares * avgShown, total, 0.1) && siNear(shares * current, curValue, 0.5) }],
    sells: [], fees: 0, needs: ['date']
  };
}

var SI_MONTHS = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};

function siIbkrRange(L) {
  var re = /(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/;
  for (var i = 0; i < L.length; i++) {
    var m = L[i].match(re);
    if (!m) continue;
    var m1 = SI_MONTHS[m[2].toLowerCase()], m2 = SI_MONTHS[m[5].toLowerCase()];
    if (!m1 || !m2) continue;
    var pad = function(s){ return s.length === 1 ? '0' + s : s; };
    return { from: m[3] + '-' + m1 + '-' + pad(m[1]), to: m[6] + '-' + m2 + '-' + pad(m[4]) };
  }
  return null;
}

// IBKR shows dd/mm/yyyy. When both parts are 12 or less, the month-name range line decides; otherwise the user enters it.
function siIbkrDate(a, b, y, range) {
  var dm = y + '-' + b + '-' + a, md = y + '-' + a + '-' + b;
  if (parseInt(a, 10) > 12) return dm;
  if (parseInt(b, 10) > 12) return md;
  if (a === b) return dm;
  if (!range) return null;
  var inR = function(s){ return s >= range.from && s <= range.to; };
  if (inR(dm) && !inR(md)) return dm;
  if (inR(md) && !inR(dm)) return md;
  return null;
}

function siParseIBKR(L) {
  var symbolLine = L.find(function(l){ return /^[<\s_—-]*[A-Z]{1,6}$/.test(l); }) || '';
  var symbol = symbolLine.replace(/[^A-Z]/g, '') || null;
  var buys = [], sells = [];
  var curDate = null, fees = 0;
  var range = siIbkrRange(L);
  L.forEach(function(l, i) {
    var d = l.match(/^(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (d) curDate = siIbkrDate(d[1], d[2], d[3], range);
    var m = l.match(/^(Bought|Sold)\s+([\d.,]+)\s+([\d.,]+)\s+USD/);
    if (m) {
      var priceLine = L[i - 1] || '';
      var price = siNum((priceLine.match(/([\d.,]+)\s+USD/) || [])[1]);
      var time = (priceLine.match(/(\d{2}:\d{2}:\d{2})/) || [])[1] || null;
      var comm = siNum(((L[i + 1] || '').match(/([\d.,]+)\s+USD/) || [])[1]) || 0;
      var qty = siNum(m[2]), amt = siNum(m[3]);
      fees += comm;
      var row = { qty: qty, price: price, amount: amt, date: curDate, time: time, commission: comm, check: siNear(qty * price, amt, 0.1) };
      if (m[1] === 'Bought') buys.push(row); else sells.push(row);
    }
  });
  return { platform: 'IBKR', symbol: symbol, name: null, current: null, buys: buys, sells: sells, fees: fees, needs: [], ignored: ['account number'] };
}

function siParseT212Position(L) {
  var head = L.find(function(l){ return /^[A-Z]{1,6}\s*[·\-]\s*(NASDAQ|NYSE|LSE|XETRA)/i.test(l); }) || '';
  var symbol = (head.match(/^([A-Z]{1,6})/) || [])[1] || null;
  function get(re) {
    var l = L.find(function(x){ return re.test(x); });
    return l ? l.replace(re, '').trim() : null;
  }
  var value = siNum(((get(/^VALUE\s+/i) || '').match(/[\d,.]+/) || [''])[0]);
  var retTxt = get(/^RETURN\s+/i) || '';
  var ret = siNum((retTxt.match(/-?\$?[\d,.]+/) || ['0'])[0].replace('$', ''));
  var shares = siNum(get(/^SHARES\s+/i));
  var avg = siNum(get(/^AVERAGE PRICE\s+/i));
  var current = shares ? +(value / shares).toFixed(4) : null;
  var cost = shares * avg;
  return {
    platform: 'Trading 212', symbol: symbol, name: null, current: current, ret: retTxt ? ret : null,
    buys: [{ qty: shares, price: avg, date: null, check: siNear(cost + ret, value, 0.2) }],
    sells: [], fees: 0, needs: ['date']
  };
}

function siParseT212Order(L) {
  var top = L.find(function(l){ return /^Market\s+(Buy|Sell)\s+[\d.,]+\s+[A-Z]{1,6}/i.test(l); }) || '';
  var m = top.match(/^Market\s+(Buy|Sell)\s+([\d.,]+)\s+([A-Z]{1,6})/i) || [];
  var months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  var topIdx = L.indexOf(top);
  var dl = L[topIdx + 1] || '';
  var d = dl.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),\s*(\d{2}:\d{2})/);
  var date = d ? d[3] + '-' + months[d[2].toLowerCase()] + '-' + (d[1].length === 1 ? '0' + d[1] : d[1]) : null;
  var qty = siNum((L.find(function(l){ return /^FILLED QUANTITY/i.test(l); }) || '').replace(/^FILLED QUANTITY/i, ''));
  var price = siNum(((L.find(function(l){ return /^FILL PRICE/i.test(l); }) || '').match(/=\s*\$?([\d.,]+)/) || [])[1]);
  var total = siNum(((L.find(function(l){ return /^TOTAL/i.test(l); }) || '').match(/[\d.,]+/) || [])[0]);
  var resLine = L.find(function(l){ return /^RESULT/i.test(l); });
  var result = resLine ? siNum(resLine.replace(/^RESULT/i, '').replace('$', '')) : null;
  var row = { qty: qty, price: price, amount: total, date: date, time: d ? d[4] : null, check: siNear(qty * price, total, 0.1) };
  var side = (m[1] || '').toLowerCase();
  if (side === 'sell' && result != null && qty) {
    row.realized = result;
    row.derivedEntry = +((total - result) / qty).toFixed(4);
  }
  return {
    platform: 'Trading 212', symbol: m[3] || null, name: null, current: null,
    buys: side === 'buy' ? [row] : [],
    sells: side === 'sell' ? [row] : [],
    fees: 0, needs: [], ignored: ['order id', 'fill id']
  };
}

function siSummarize(r) {
  if (!r || r.error) return r;
  if (r.buys && r.buys.length) {
    var q = r.buys.reduce(function(s, b){ return s + b.qty; }, 0);
    var c = r.buys.reduce(function(s, b){ return s + b.qty * b.price; }, 0);
    r.summary = {
      shares: +q.toFixed(6),
      avg: q ? +(c / q).toFixed(4) : 0,
      invested: +c.toFixed(2),
      allChecksPass: r.buys.concat(r.sells || []).every(function(b){ return b.check; })
    };
  }
  return r;
}

// XTB: a second screenshot of the same stock adds its buys; a buy with the same shares and price is a duplicate.
function siMergeBuys(a, b) {
  var out = (a || []).slice();
  (b || []).forEach(function(nb) {
    var dup = out.some(function(x){ return Math.abs(x.qty - nb.qty) < 1e-9 && Math.abs(x.price - nb.price) < 1e-9; });
    if (!dup) out.push(nb);
  });
  return out;
}

function parseScreenshotText(text) {
  var t = String(text || '');
  var L = siLines(t);
  var kind = siDetect(t);
  var r;
  if (kind === 'xtb') r = siParseXTB(L);
  else if (kind === 'baraka') r = siParseBaraka(L);
  else if (kind === 'ibkr') r = siParseIBKR(L);
  else if (kind === 't212-position') r = siParseT212Position(L);
  else if (kind === 't212-order') r = siParseT212Order(L);
  else r = { error: 'This screen isn’t supported yet' };
  if (r && r.ignored) {
    r.ignored = r.ignored.slice();
  }
  if (r && !r.error) r.screen = kind;
  return siSummarize(r);
}

function siClone(rows) {
  return (rows || []).map(function(r){ return JSON.parse(JSON.stringify(r)); });
}

function screenshotDraftToTrade(parsed, accountId) {
  if (!parsed || parsed.error) return null;
  var buy = (parsed.buys && parsed.buys[0]) || null;
  var sell = (parsed.sells && parsed.sells[0]) || null;
  var qty = parsed.summary ? parsed.summary.shares : (buy ? buy.qty : (sell ? sell.qty : 0));
  var entry = parsed.summary ? parsed.summary.avg : (buy ? buy.price : (sell && sell.derivedEntry ? sell.derivedEntry : (sell ? sell.price : 0)));
  var buyFees = (parsed.buys || []).reduce(function(s, b){ return s + (b.commission || 0); }, 0);
  var fees = parsed.screen === 'ibkr' ? +buyFees.toFixed(2) : (parsed.fees || 0);
  var addBuys = (parsed.buys || []).slice(1).map(function(b, i){
    return { id: 'ab_imp_' + i, qty: b.qty, price: b.price, date: b.date || '', fees: 0, fees_mode: '$' };
  });
  return {
    accountId: accountId || null,
    ticker: parsed.symbol || '',
    nameHint: parsed.name || '',
    direction: 'Long',
    status: sell && !buy ? 'closed' : 'open',
    entry: entry,
    exit: sell ? sell.price : null,
    qty: qty,
    original_qty: qty,
    entry_date: (buy && buy.date) || (sell && sell.date) || '',
    exit_date: sell ? sell.date : null,
    fees: fees ? String(fees) : '',
    fees_mode: '$',
    current_price: parsed.current || null,
    notes: parsed.platform ? ('Imported from ' + parsed.platform + ' screenshot') : '',
    add_buys: addBuys,
    buys: siClone(parsed.buys),
    sells: siClone(parsed.sells),
    read: { symbol: parsed.symbol || '', name: parsed.name || '', buys: siClone(parsed.buys), sells: siClone(parsed.sells) },
    checksOk: (parsed.buys || []).concat(parsed.sells || []).every(function(b){ return b.check !== false; }),
    needsSellChoice: !!(sell && !(parsed.buys && parsed.buys.length)),
    partial_closes: [],
    photos: [],
    needs: parsed.needs || [],
    platform: parsed.platform || '',
    screen: parsed.screen || '',
    feesRead: parsed.fees || 0,
    avgShown: parsed.avgShown || null,
    totalCost: parsed.totalCost || null,
    returnRead: parsed.ret != null ? parsed.ret : null
  };
}
