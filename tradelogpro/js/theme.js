// THEME
// ==========================================================================
var _systemThemeMq = null;
function systemPrefersLight() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches); } catch (e) { return false; }
}
function applyTheme(mode) {
  var btnTop = document.getElementById('themeBtnTop');
  var btnNav = document.getElementById('themeBtnNav');
  var saved = (mode === 'system' || mode === 'light' || mode === 'green') ? mode : 'dark';
  localStorage.setItem('tl_theme', saved);
  if (saved === 'system') {
    mode = systemPrefersLight() ? 'light' : 'dark';
    if (!_systemThemeMq && window.matchMedia) {
      try {
        _systemThemeMq = window.matchMedia('(prefers-color-scheme: light)');
        var onChange = function() { if (localStorage.getItem('tl_theme') === 'system') applyTheme('system'); };
        if (_systemThemeMq.addEventListener) _systemThemeMq.addEventListener('change', onChange);
        else if (_systemThemeMq.addListener) _systemThemeMq.addListener(onChange);
      } catch (e) {}
    }
  } else {
    mode = saved;
  }
  document.body.classList.remove('light');
  document.body.classList.remove('green');
  if (mode === 'light') {
    document.body.classList.add('light');
    if (btnTop) btnTop.innerHTML = 'Light';
    if (btnNav) btnNav.textContent = 'Light';
  } else if (mode === 'green') {
    document.body.classList.add('green');
    if (btnTop) btnTop.innerHTML = 'Green';
    if (btnNav) btnNav.textContent = 'Green';
  } else {
    if (btnTop) btnTop.innerHTML = 'Dark';
    if (btnNav) btnNav.textContent = 'Dark';
  }
  updateDrawerThemeLabel();
  // Sync system status bar icon color + theme-color to the active theme
  var isLightBg = (mode === 'light' || mode === 'green');
  var tcMeta = document.getElementById('themeColorMeta');
  if (tcMeta) tcMeta.setAttribute('content', mode === 'light' ? '#ffffff' : (mode === 'green' ? '#f4fbf4' : '#0c0f1a'));
  try {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
      window.Capacitor.Plugins.StatusBar.setStyle({ style: isLightBg ? 'LIGHT' : 'DARK' });
    }
  } catch (e) {}
}
function toggleTheme() {
  var cur = localStorage.getItem('tl_theme') || 'dark';
  if (cur === 'system') cur = document.body.classList.contains('light') ? 'light' : 'dark';
  if (cur === 'dark') { applyTheme('light'); }
  else if (cur === 'light') { applyTheme('green'); }
  else { applyTheme('dark'); }
}
function updateDrawerThemeLabel() {
  var lbl = document.getElementById('drawerThemeLabel');
  var ico = document.getElementById('drawerThemeIcon');
  var topIco = document.getElementById('topbarThemeBtn');
  var cur = localStorage.getItem('tl_theme') || 'dark';
  if (cur === 'system') cur = document.body.classList.contains('light') ? 'light' : 'dark';
  var name, label;
  if (cur === 'dark') { name = 'sun'; label = 'Switch to Light'; }
  else if (cur === 'light') { name = 'leaf'; label = 'Switch to Green'; }
  else { name = 'moon'; label = 'Switch to Dark'; }
  if (lbl) lbl.textContent = label;
  if (ico) ico.innerHTML = icon(name, 18);
  if (topIco) { topIco.innerHTML = icon(name, 18); topIco.title = label; }
}

// TEXT SIZE — default / large / xlarge. CSS reads html[data-font] (--fz / --fzh).
function normalizeFontSize(v) {
  return (v === 'large' || v === 'xlarge') ? v : 'default';
}
function applyFontSize(size) {
  var saved = normalizeFontSize(size);
  try { localStorage.setItem('tl_font', saved); } catch (e) {}
  var root = document.documentElement;
  if (saved === 'default') root.removeAttribute('data-font');
  else root.setAttribute('data-font', saved);
}
function currentFontScale() {
  var f = document.documentElement.getAttribute('data-font');
  return f === 'xlarge' ? 1.25 : (f === 'large' ? 1.12 : 1);
}
// Chart.js tick sizes are numbers, not CSS — scale them here.
function chartFontSize(base) {
  return Math.round(base * currentFontScale());
}

// ==========================================================================
