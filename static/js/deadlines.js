/* Deadline table for /deadlines/. Data: static/data/ccf-deadlines.json (CCFDDL, MIT). */
(function () {
  'use strict';

  var app = document.getElementById('ddl-app');
  if (!app) return;

  var body = document.getElementById('ddl-body');
  var countEl = document.getElementById('ddl-count');
  var emptyEl = document.getElementById('ddl-empty');
  var input = document.getElementById('ddl-q');
  var pastBox = document.getElementById('ddl-past');
  var chips = Array.prototype.slice.call(document.querySelectorAll('.ddl-chip'));

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = 86400000;

  var state = { q: '', rank: '', past: false };
  var entries = [];
  var localFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  var shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

  function sourceLabel(e) {
    var parts = String(e.deadline || '').split(' ');
    if (parts.length !== 2) return e.tz || '';
    var d = parts[0].split('-');
    var t = parts[1].split(':');
    if (d.length !== 3) return e.tz || '';
    return (e.tz || '') + ' ' + MONTHS[+d[1] - 1] + ' ' + (+d[2]) + ', ' + t[0] + ':' + t[1];
  }

  function leftText(ts) {
    var diff = ts * 1000 - Date.now();
    if (diff <= 0) return 'passed';
    var hours = diff / 3600000;
    if (hours < 1) return Math.max(1, Math.round(hours * 60)) + ' min';
    if (hours < 48) return Math.round(hours) + ' h';
    return Math.ceil(hours / 24) + ' d';
  }

  function readState() {
    var p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.rank = p.get('rank') || '';
    state.past = p.get('past') === '1';
    input.value = state.q;
    pastBox.checked = state.past;
    chips.forEach(function (c) {
      c.classList.toggle('is-on', c.dataset.rank === state.rank);
    });
  }

  function writeState() {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.rank) p.set('rank', state.rank);
    if (state.past) p.set('past', '1');
    var qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  function matches(e) {
    if (state.rank && e.rank !== state.rank) return false;
    if (!state.q) return true;
    var hay = (e.venue + ' ' + e.desc + ' ' + e.place + ' ' + e.year + ' ' + e.dblp).toLowerCase();
    return hay.indexOf(state.q.toLowerCase()) !== -1;
  }

  function cell(cls, text) {
    var td = document.createElement('td');
    if (cls) td.className = cls;
    if (text !== undefined) td.textContent = text;
    return td;
  }

  function render() {
    var now = Date.now();
    var rows = entries.filter(matches).map(function (e) {
      return e;
    });
    var upcoming = rows.filter(function (e) { return e.ts * 1000 >= now; })
      .sort(function (a, b) { return a.ts - b.ts; });
    var past = rows.filter(function (e) { return e.ts * 1000 < now; })
      .sort(function (a, b) { return b.ts - a.ts; });
    var list = state.past ? upcoming.concat(past) : upcoming;

    body.textContent = '';
    var frag = document.createDocumentFragment();

    list.forEach(function (e) {
      var tr = document.createElement('tr');
      tr.dataset.id = e.id;
      if (e.ts * 1000 < now) tr.classList.add('is-past');
      else if (e.ts * 1000 - now < 7 * DAY) tr.classList.add('is-soon');

      var when = cell('ddl-when');
      var loc = document.createElement('span');
      loc.className = 'ddl-local';
      loc.textContent = localFmt.format(new Date(e.ts * 1000));
      var src = document.createElement('span');
      src.className = 'ddl-src';
      src.textContent = sourceLabel(e);
      when.appendChild(loc);
      when.appendChild(src);
      if (e.abstract_ts) {
        var abs = document.createElement('span');
        abs.className = 'ddl-abs';
        abs.textContent = 'abstract ' + shortFmt.format(new Date(e.abstract_ts * 1000));
        when.appendChild(abs);
      }
      tr.appendChild(when);

      var conf = cell('ddl-conf-cell');
      var a = document.createElement('a');
      a.className = 'ddl-conf';
      a.href = e.link || '#';
      a.rel = 'noopener';
      a.textContent = e.venue + ' ' + e.year;
      conf.appendChild(a);
      var desc = document.createElement('span');
      desc.className = 'ddl-desc';
      desc.textContent = e.desc + (e.talk ? ' · ' + e.talk : '');
      conf.appendChild(desc);
      tr.appendChild(conf);

      var rank = cell('ddl-rank-cell');
      var badge = document.createElement('span');
      badge.className = 'ddl-rank' + (e.rank && e.rank !== 'N' ? ' rank-' + e.rank : ' rank-none');
      badge.textContent = e.rank || 'N';
      rank.appendChild(badge);
      tr.appendChild(rank);

      tr.appendChild(cell('ddl-place', e.place));

      var left = cell('ddl-left', leftText(e.ts));
      left.dataset.ts = e.ts;
      tr.appendChild(left);

      frag.appendChild(tr);
    });

    body.appendChild(frag);
    emptyEl.hidden = list.length !== 0;
    var filtered = !!(state.q || state.rank);
    countEl.textContent = filtered
      ? list.length + ' of ' + entries.length + ' deadlines match'
      : upcoming.length + ' deadlines ahead · ' + entries.length + ' in total';
    return list;
  }

  function updateLeft() {
    Array.prototype.forEach.call(document.querySelectorAll('.ddl-left[data-ts]'), function (el) {
      el.textContent = leftText(+el.dataset.ts);
    });
  }

  function jumpToHash() {
    var id = decodeURIComponent(location.hash.replace('#', ''));
    if (!id) return;
    var row = body.querySelector('[data-id="' + id.replace(/"/g, '\\"') + '"]');
    if (!row && !state.past) {
      state.past = true;
      pastBox.checked = true;
      render();
      row = body.querySelector('[data-id="' + id.replace(/"/g, '\\"') + '"]');
    }
    if (row) {
      row.scrollIntoView({ block: 'center' });
      row.classList.add('is-target');
    }
  }

  fetch('/data/ccf-deadlines.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      entries = data.entries || [];
      app.hidden = false;
      readState();
      render();
      jumpToHash();
      setInterval(updateLeft, 60000);
    })
    .catch(function () {
      app.hidden = false;
      countEl.textContent = 'Could not load the deadline data.';
    });

  input.addEventListener('input', function () {
    state.q = input.value.trim();
    writeState();
    render();
  });

  pastBox.addEventListener('change', function () {
    state.past = pastBox.checked;
    writeState();
    render();
  });

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.rank = chip.dataset.rank;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      writeState();
      render();
    });
  });
})();
