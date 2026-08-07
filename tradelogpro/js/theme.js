// THEME
// ==========================================================================
function applyTheme(mode) {
  var btnTop = document.getElementById('themeBtnTop');
  var btnNav = document.getElementById('themeBtnNav');
  document.body.classList.remove('light');
  document.body.classList.remove('green');
  if (mode === 'light') {
    document.body.classList.add('light');
    if (btnTop) btnTop.innerHTML = 'Light';
    if (btnNav) btnNav.textContent = 'Light';
    localStorage.setItem('tl_theme', 'light');
  } else if (mode === 'green') {
    document.body.classList.add('green');
    if (btnTop) btnTop.innerHTML = 'Green';
    if (btnNav) btnNav.textContent = 'Green';
    localStorage.setItem('tl_theme', 'green');
  } else {
    if (btnTop) btnTop.innerHTML = 'Dark';
    if (btnNav) btnNav.textContent = 'Dark';
    localStorage.setItem('tl_theme', 'dark');
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
  if (cur === 'dark') { applyTheme('light'); }
  else if (cur === 'light') { applyTheme('green'); }
  else { applyTheme('dark'); }
}
function updateDrawerThemeLabel() {
  var lbl = document.getElementById('drawerThemeLabel');
  var ico = document.getElementById('drawerThemeIcon');
  var topIco = document.getElementById('topbarThemeBtn');
  var cur = localStorage.getItem('tl_theme') || 'dark';
  var name, label;
  if (cur === 'dark') { name = 'sun'; label = 'Switch to Light'; }
  else if (cur === 'light') { name = 'leaf'; label = 'Switch to Green'; }
  else { name = 'moon'; label = 'Switch to Dark'; }
  if (lbl) lbl.textContent = label;
  if (ico) ico.innerHTML = icon(name, 18);
  if (topIco) { topIco.innerHTML = icon(name, 18); topIco.title = label; }
}

// ==========================================================================
