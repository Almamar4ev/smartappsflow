/* Cloudflare Web Analytics (live site only) — moved out of index.html so the page can use a strict
   Content-Security-Policy (no inline scripts). */
(function () {
      function shouldTrackWebUsage() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('source') === 'play') return false;
        if (document.referrer && document.referrer.indexOf('play.google.com') !== -1) {
          return false;
        }
        var protocol = String(window.location.protocol || '').toLowerCase();
        var hostname = String(window.location.hostname || '').toLowerCase();
        if (protocol !== 'https:') return false;
        return hostname === 'smartappsflow.net' ||
          hostname.slice(-18) === '.smartappsflow.net';
      }

      window.initWebAnalytics = function () {
        if (!shouldTrackWebUsage()) return;
        // Cloudflare Web Analytics — same token as smartappsflow.net / smartloan
        var s = document.createElement('script');
        s.defer = true;
        s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
        s.setAttribute('data-cf-beacon', '{"token": "215281d4f5024ae0bec2a82dea63a851"}');
        document.body.appendChild(s);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.initWebAnalytics);
      } else {
        window.initWebAnalytics();
      }
    })();
