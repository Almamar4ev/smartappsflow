try {
  var saved = JSON.parse(localStorage.getItem('basis.v1') || '{}');
  var loc = (saved.lang || navigator.language || 'en').toLowerCase();
  var lang = loc.indexOf('ar') === 0 ? 'ar' : loc.indexOf('es') === 0 ? 'es' : loc.indexOf('pt') === 0 ? 'pt' : 'en';
  var theme = saved.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#12110f' : '#f4f0e7';
} catch (e) {}
