/* Page language, title and manifest — moved out of index.html so the page can use a strict
   Content-Security-Policy (no inline scripts). */
(function () {
      var code = String(navigator.language || 'en').toLowerCase().split('-')[0];
      var pages = {
        ar: {
          title: 'حاسبة الفائدة المركبة',
          shortTitle: 'حاسبة الاستثمار',
          description: 'حاسبة الفائدة المركبة — أداة تقديرية لتخطيط الاستثمار طويل الأجل.',
          htmlLang: 'ar',
          dir: 'rtl',
          manifest: 'manifest.json'
        },
        es: {
          title: 'Calculadora de interés compuesto',
          shortTitle: 'Interés compuesto',
          description: 'Calculadora de interés compuesto para planificar inversiones a largo plazo.',
          htmlLang: 'es',
          dir: 'ltr',
          manifest: 'manifest-es.json'
        },
        pt: {
          title: 'Calculadora de juros compostos',
          shortTitle: 'Juros compostos',
          description: 'Calculadora de juros compostos para planejar investimentos de longo prazo.',
          htmlLang: 'pt',
          dir: 'ltr',
          manifest: 'manifest-pt.json'
        }
      };
      var page = pages[code] || {
        title: 'Compound Interest Calculator',
        shortTitle: 'Compound Calc',
        description: 'Compound interest calculator for long-term investment planning.',
        htmlLang: 'en',
        dir: 'ltr',
        manifest: 'manifest-en.json'
      };
      document.documentElement.lang = page.htmlLang;
      document.documentElement.dir = page.dir;
      document.title = page.title;
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', page.description);
      var apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (apple) apple.setAttribute('content', page.shortTitle);
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = page.manifest;
      document.head.appendChild(link);
    })();
