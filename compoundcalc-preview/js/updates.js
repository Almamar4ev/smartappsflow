/* Update card: new version waits until the user taps Update — moved out of index.html so the page can use a strict
   Content-Security-Policy (no inline scripts). */
(function () {
      if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;

      var pendingWorker = null;
      var pendingInfo = null;
      var bannerDismissed = false;
      var lang = (document.documentElement.lang || 'en').toLowerCase();

      function t(key) {
        var S = {
          ar: { avail: 'يتوفّر تحديث جديد', now: 'تحديث الآن', later: 'لاحقاً', generic: 'تحسينات وإصلاحات جديدة.', ready: 'نسخة جديدة جاهزة' },
          en: { avail: 'A new update is available', now: 'Update now', later: 'Later', generic: 'New improvements and fixes.', ready: 'A new version is ready' },
          es: { avail: 'Hay una actualización disponible', now: 'Actualizar ahora', later: 'Después', generic: 'Nuevas mejoras y correcciones.', ready: 'Una nueva versión está lista' },
          pt: { avail: 'Há uma atualização disponível', now: 'Atualizar agora', later: 'Depois', generic: 'Novas melhorias e correções.', ready: 'Uma nova versão está pronta' }
        };
        return (S[lang] || S.en)[key];
      }

      function versionLabel(v) {
        if (!v) return '';
        if (lang === 'ar') return ' · الإصدار ' + v;
        if (lang === 'es') return ' · versión ' + v;
        if (lang === 'pt') return ' · versão ' + v;
        return ' · version ' + v;
      }

      function changelogText(cl) {
        if (!cl) return t('generic');
        return cl[lang] || cl.en || cl.ar || t('generic');
      }

      function applyUpdate() {
        if (pendingWorker) pendingWorker.postMessage('SKIP_WAITING');
        else window.location.reload();
      }

      function showChip() {
        if (document.getElementById('updateChip')) return;
        var chip = document.createElement('button');
        chip.id = 'updateChip';
        chip.type = 'button';
        chip.textContent = t('ready');
        chip.style.cssText = [
          'position:fixed', 'left:12px', 'right:12px', 'margin:0 auto',
          'bottom:calc(16px + env(safe-area-inset-bottom))',
          'max-width:280px', 'z-index:4000',
          'background:#0B5ED7', 'color:#fff', 'border:none',
          'border-radius:999px', 'padding:11px 18px',
          'font:800 13px/1.3 inherit', 'cursor:pointer',
          'box-shadow:0 10px 28px rgba(11,94,215,.35)'
        ].join(';');
        chip.onclick = applyUpdate;
        document.body.appendChild(chip);
      }

      function showBanner(newWorker) {
        pendingWorker = newWorker || null;
        if (bannerDismissed) {
          showChip();
          return;
        }
        if (document.getElementById('updateBanner')) return;

        var bar = document.createElement('div');
        bar.id = 'updateBanner';
        bar.style.cssText = [
          'position:fixed', 'left:12px', 'right:12px',
          'bottom:calc(16px + env(safe-area-inset-bottom))',
          'max-width:460px', 'margin:0 auto', 'z-index:4000',
          'background:#fff', 'color:#0f172a',
          'border:1.5px solid #0B5ED7', 'border-inline-start:4px solid #0B5ED7',
          'border-radius:14px', 'padding:14px 16px',
          'box-shadow:0 12px 34px rgba(15,23,42,.18)',
          'display:flex', 'flex-direction:column', 'gap:8px',
          'font-family:inherit'
        ].join(';');

        var head = document.createElement('div');
        head.style.cssText = 'font-size:14px;font-weight:800;line-height:1.3;color:#0B5ED7';
        head.textContent = t('avail');

        var desc = document.createElement('div');
        desc.style.cssText = 'font-size:12.5px;font-weight:500;line-height:1.7;color:#475569;white-space:pre-line;text-align:start';
        desc.textContent = changelogText(pendingInfo && pendingInfo.changelog);

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:flex-end';

        var later = document.createElement('button');
        later.type = 'button';
        later.textContent = t('later');
        later.style.cssText = 'background:none;border:none;color:#64748b;font-weight:700;font-size:12.5px;font-family:inherit;cursor:pointer;padding:8px 12px';
        later.onclick = function () {
          bannerDismissed = true;
          bar.remove();
          showChip();
        };

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = t('now');
        btn.style.cssText = 'background:#0B5ED7;color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:800;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap';
        btn.onclick = function () {
          btn.disabled = true;
          btn.textContent = '…';
          applyUpdate();
        };

        row.appendChild(later);
        row.appendChild(btn);
        bar.appendChild(head);
        bar.appendChild(desc);
        bar.appendChild(row);
        document.body.appendChild(bar);

        if (newWorker) {
          navigator.serviceWorker.addEventListener('message', function onMsg(e) {
            if (e.data && e.data.type === 'VERSION_INFO') {
              pendingInfo = { version: e.data.version, changelog: e.data.changelog };
              desc.textContent = changelogText(e.data.changelog);
              head.textContent = t('avail') + versionLabel(e.data.version);
              navigator.serviceWorker.removeEventListener('message', onMsg);
            }
          });
          try { newWorker.postMessage('GET_VERSION_INFO'); } catch (_) {}
        }
      }

      window.addEventListener('load', function () {
        navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).then(function (reg) {
          var checkWaiting = function () {
            if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);
          };
          checkWaiting();
          reg.addEventListener('updatefound', function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', function () {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) showBanner(nw);
            });
          });
          reg.update().then(checkWaiting).catch(function () {});
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') reg.update().then(checkWaiting).catch(function () {});
          });
          setInterval(function () { reg.update().then(checkWaiting).catch(function () {}); }, 60000);
        }).catch(function () {});

        var refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      });
    })();
