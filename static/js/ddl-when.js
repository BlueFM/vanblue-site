/* Sidebar deadline card: turn the build-time dates into live countdowns. */
(function () {
  'use strict';
  var els = document.querySelectorAll('.ddl-when[data-ts]');
  if (!els.length) return;

  function text(ts) {
    var diff = ts * 1000 - Date.now();
    if (diff <= 0) return 'closed';
    var hours = diff / 3600000;
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' min';
    if (hours < 48) return Math.round(hours) + ' h';
    return Math.ceil(hours / 24) + ' d';
  }

  function paint() {
    for (var i = 0; i < els.length; i++) els[i].textContent = text(+els[i].dataset.ts);
  }

  paint();
  setInterval(paint, 60000);
})();
