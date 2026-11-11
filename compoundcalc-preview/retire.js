/* Review copy retired: remove only its own saved data and service worker.
   Never touches compoundcalc.* (the live app) or other apps' keys. */
(function () {
  try {
    var mine = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('compoundcalc_preview.') === 0) mine.push(key);
    }
    mine.forEach(function (key) { localStorage.removeItem(key); });
  } catch (_) {}
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      regs.forEach(function (reg) {
        if (reg.scope.indexOf('/compoundcalc-preview/') !== -1) reg.unregister();
      });
    }).catch(function () {});
  }
})();
