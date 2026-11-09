/* Loading screen until the first Flutter frame — moved out of index.html so the page can use a strict
   Content-Security-Policy (no inline scripts). */
(function () {
      var splash = document.getElementById('app-splash');
      var label = { ar: 'جارٍ التحميل', es: 'Cargando', pt: 'Carregando' };
      splash.setAttribute('aria-label', label[document.documentElement.lang] || 'Loading');
      function hideSplash() {
        if (!splash) return;
        var el = splash;
        splash = null;
        el.classList.add('hide');
        setTimeout(function () { el.remove(); }, 300);
      }
      // Flutter fires this once the first frame is on screen.
      window.addEventListener('flutter-first-frame', hideSplash, { once: true });
    })();
