/* Site guardian — a small pixel spirit that lives in the corner of the site.
 *
 * Its mood comes from /guardian/status.json: a static file rewritten once a
 * minute by a systemd timer on the server (see deploy/guardian/). If the file
 * is missing — local preview, a fresh clone, a failed timer — the spirit falls
 * back to the visitor's own clock, so it keeps blinking instead of vanishing.
 *
 * No dependencies, no build step. Attach with <div data-guardian>.
 */
(function (global) {
  'use strict';

  var W = 18;
  var H = 20;
  var BODY_Y = 5;
  var BODY_X = 1;
  var POLL_MS = 60000;
  var STALE_S = 600;

  /* ---------------------------------------------------------------- pixels */

  // 16x15. '.' transparent, '#' outline, 'a' body, 'b' highlight,
  // 'w' eye white, 'p' pupil, 'c' cheek, 'm' mouth.
  var BODY_OPEN = [
    '......####......',
    '....#aaaaaa#....',
    '...#aaaaaaaa#...',
    '..#aaaaaaaaaa#..',
    '..#aaaaaaaaaa#..',
    '.#aaaaaaaaaaaa#.',
    '.#aawwwaawwwaa#.',
    '.#aawpwaawpwaa#.',
    '.#aawwwaawwwaa#.',
    '.#accaaaaaacca#.',
    '.#aaaaammaaaaa#.',
    '..#aaaaaaaaaa#..',
    '...#aaaaaaaa#...',
    '....#aaaaaa#....',
    '.....aa..aa.....'
  ];

  var CLOSED_EYES = {
    6: '.#aaaaaaaaaaaa#.',
    7: '.#aammmaammmaa#.',
    8: '.#aaaaaaaaaaaa#.'
  };

  function withRows(rows, changes) {
    var out = rows.slice();
    for (var k in changes) {
      if (Object.prototype.hasOwnProperty.call(changes, k)) out[k] = changes[k];
    }
    return out;
  }

  var BODY = {
    open: BODY_OPEN,
    blink: withRows(BODY_OPEN, CLOSED_EYES),
    sleep: withRows(BODY_OPEN, CLOSED_EYES),
    yawn: withRows(BODY_OPEN, { 11: '..#aaaammaaaa#..' })
  };

  // Two-step shuffle: the feet swap places while the body bobs one pixel.
  var BODY_WALK = [
    withRows(BODY_OPEN, { 14: '....aa...aa.....' }),
    withRows(BODY_OPEN, { 14: '.....aa...aa....' })
  ];

  // 6x4 cardboard box, held in front of the body while a release lands.
  var BOX = [
    'xxxxxx',
    'xXttXx',
    'xXttXx',
    'xxxxxx'
  ];

  /* --------------------------------------------------------------- palette */

  function parseColor(value) {
    if (!value) return null;
    var s = String(value).trim();
    var m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) {
      return [
        parseInt(m[1].charAt(0) + m[1].charAt(0), 16),
        parseInt(m[1].charAt(1) + m[1].charAt(1), 16),
        parseInt(m[1].charAt(2) + m[1].charAt(2), 16)
      ];
    }
    m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) {
      return [
        parseInt(m[1].slice(0, 2), 16),
        parseInt(m[1].slice(2, 4), 16),
        parseInt(m[1].slice(4, 6), 16)
      ];
    }
    m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
    if (m) return [Number(m[1]) | 0, Number(m[2]) | 0, Number(m[3]) | 0];
    return null;
  }

  function mix(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t)
    ];
  }

  function rgb(c) {
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function cssVar(name) {
    if (!document.documentElement) return '';
    return global.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function isDark() {
    return !!(global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  // The body uses the site accent, so the spirit inherits light/dark themes.
  function palette() {
    var dark = isDark();
    var accent = parseColor(cssVar('--accent')) || [20, 80, 140];
    var muted = parseColor(cssVar('--muted')) || [107, 107, 107];
    var white = [255, 255, 255];
    return {
      '#': rgb(mix(accent, [0, 0, 0], dark ? 0.3 : 0.55)),
      a: rgb(accent),
      b: rgb(mix(accent, white, dark ? 0.5 : 0.4)),
      w: rgb(mix(white, accent, 0.08)),
      p: rgb([12, 22, 34]),
      c: rgb(mix([226, 140, 140], accent, dark ? 0.4 : 0.1)),
      m: rgb(mix(accent, [0, 0, 0], 0.68)),
      x: rgb([205, 168, 116]),
      X: rgb([176, 138, 86]),
      t: rgb([234, 223, 198]),
      s: rgb(mix(muted, white, 0.5)),
      S: rgb(mix(muted, white, 0.25)),
      z: rgb(muted),
      d: rgb(mix([140, 198, 242], white, 0.15))
    };
  }

  /* ---------------------------------------------------------------- drawing */

  function drawSprite(ctx, rows, x, y, pal, pupilDx) {
    var shift = pupilDx || 0;
    var pupils = [];
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === '.') continue;
        var color = pal[ch];
        if (!color) continue;
        // Pupils shift with the gaze, so they land on the eye whites. They
        // have to go on top, or the rest of the eye paints over them.
        if (ch === 'p') {
          pupils.push([x + c + shift, y + r]);
          continue;
        }
        ctx.fillStyle = color;
        ctx.fillRect(x + c, y + r, 1, 1);
      }
    }
    ctx.fillStyle = pal.p;
    for (var i = 0; i < pupils.length; i++) {
      ctx.fillRect(pupils[i][0], pupils[i][1], 1, 1);
    }
  }

  function drawZ(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, 1);
    ctx.fillRect(x + 3, y + 1, 1, 1);
    ctx.fillRect(x + 2, y + 2, 1, 1);
    ctx.fillRect(x + 1, y + 3, 1, 1);
    ctx.fillRect(x, y + 4, 5, 1);
  }

  function drawZzz(ctx, pal, t) {
    var cyc = 2600;
    var phase = (t % cyc) / cyc;
    var y = 3 - Math.round(phase * 3);
    ctx.globalAlpha = 0.9 - 0.55 * phase;
    drawZ(ctx, 11, Math.max(0, y), pal.z);
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, pal, t, top) {
    var cyc = 1100;
    for (var i = 0; i < 3; i++) {
      var g = ((t % cyc) / cyc + i / 3) % 1;
      var px = 10 + i * 2;
      var py = top - 1 - Math.round(g * 5);
      ctx.fillStyle = g < 0.35 ? pal.S : pal.s;
      ctx.fillRect(px, py, 2, 1);
      ctx.fillRect(px + (i % 2), py - 1, 1, 1);
    }
  }

  function drawBox(ctx, pal, x, y) {
    var bx = x + 5;
    var by = y + 9;
    drawSprite(ctx, BOX, bx, by, pal);
    ctx.fillStyle = pal.a;
    ctx.fillRect(bx - 1, by + 2, 1, 1);
    ctx.fillRect(bx + 6, by + 2, 1, 1);
  }

  function drawSweat(ctx, pal, t, x, y) {
    var phase = t % 2400;
    if (phase > 700) return;
    var drop = Math.floor(phase / 200);
    ctx.fillStyle = pal.d;
    ctx.fillRect(x + 15, y + 5 + drop, 1, 2);
  }

  function paint(ctx, t, mood, pal, state) {
    state = state || {};
    ctx.clearRect(0, 0, W, H);

    var walking = !!state.walking && (mood === 'idle' || mood === 'deploy');
    var step = state.step | 0;
    var bob = 0;

    if (mood === 'sleep') bob = (Math.floor(t / 900) % 2) ? 0 : 1;
    else if (mood === 'busy') bob = Math.floor(t / 140) % 2;
    else if (walking) bob = step % 2 ? -1 : 0;
    else if (mood === 'deploy') bob = (Math.floor(t / 220) % 2) ? -1 : 0;
    else bob = (Math.floor(t / 520) % 2) ? -1 : 0;

    if (state.hopAt > 0 && t - state.hopAt < 480) bob -= 2;

    var top = BODY_Y + bob;

    if (mood === 'sleep') drawZzz(ctx, pal, t);
    if (mood === 'busy') drawSmoke(ctx, pal, t, top);

    var rows;
    if (mood === 'sleep') rows = BODY.sleep;
    else if (mood === 'busy') rows = BODY.open;
    else if (walking) rows = BODY_WALK[step % 2];
    else if ((t % 17000) > 16200) rows = BODY.yawn;
    else if ((t % 4300) < 130) rows = BODY.blink;
    else rows = BODY.open;

    drawSprite(ctx, rows, BODY_X, top, pal, state.eyeDx || 0);

    if (mood === 'deploy') drawBox(ctx, pal, BODY_X, top);
    if (mood === 'busy') drawSweat(ctx, pal, t, BODY_X, top);
  }

  /* ----------------------------------------------------------------- state */

  function clockMood() {
    var hour = new Date().getHours();
    return hour >= 1 && hour < 7 ? 'sleep' : 'idle';
  }

  function moodFromStatus(status, nowS) {
    if (!status || typeof status !== 'object') return clockMood();
    var fresh = typeof status.ts === 'number' && nowS - status.ts < STALE_S;
    if (!fresh || !status.mood) return 'idle';
    if (status.mood === 'idle' || status.mood === 'sleep' ||
        status.mood === 'busy' || status.mood === 'deploy') {
      return status.mood;
    }
    return 'idle';
  }

  /* ------------------------------------------------------------------ mount */

  function mount(el, opts) {
    opts = opts || {};
    var canvas = el.querySelector('canvas');
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = W;
    canvas.height = H;
    el.hidden = false;

    function attr(name, fallback) {
      var v = el.getAttribute('data-' + name);
      return v === null ? fallback : v;
    }

    var txt = {
      label: attr('label', 'Site guardian'),
      stats: attr('stats', '%n visitors today'),
      load: attr('load', 'load'),
      moods: {
        idle: attr('mood-idle', 'idling'),
        sleep: attr('mood-sleep', 'napping'),
        busy: attr('mood-busy', 'running hot'),
        deploy: attr('mood-deploy', 'carrying boxes')
      }
    };

    var status = opts.status || null;
    var mood = opts.mood || attr('mood', '') ||
      (status ? moodFromStatus(status, Date.now() / 1000) : 'idle');
    var state = {
      hopAt: -1,
      status: status,
      walking: false,
      step: 0,
      eyeDx: 0
    };
    var lastT = 0;
    var anchoredRight = null;

    var pal = palette();
    var bubble = el.querySelector('.guardian-bubble');
    var btn = el.querySelector('.guardian-btn');
    var hideTimer = 0;

    /* --- roaming -------------------------------------------------------- */

    var EDGE = 8;        // px kept clear at either side of the viewport
    var SPEED = 24;      // px per second
    var clock = 0;       // ms of animated time, advanced by the frame loop
    var nextLook = 0;
    var creatureW = (btn && btn.offsetWidth) || 72;

    var walk = {
      x: 0,
      target: 0,
      dir: -1,
      moving: false,
      pauseUntil: 1400
    };

    function homeX() {
      var vw = global.innerWidth || 1024;
      return Math.max(EDGE, vw - creatureW - EDGE);
    }

    function applyPosition() {
      if (el.style) {
        el.style.transform = 'translate3d(' + Math.round(walk.x) + 'px,0,0)';
      }
      // Keep the speech bubble on the inside of the viewport.
      if (el.classList) {
        var right = walk.x > homeX() / 2;
        if (right !== anchoredRight) {
          anchoredRight = right;
          el.classList.toggle('is-right', right);
        }
      }
    }

    function lookAround() {
      if (clock < nextLook) return;
      state.eyeDx = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
      nextLook = clock + 2200 + Math.random() * 3200;
    }

    function pickTarget() {
      var far = homeX();
      var t = EDGE + Math.random() * Math.max(1, far - EDGE);
      if (Math.abs(t - walk.x) < 140) t = walk.x > (far + EDGE) / 2 ? EDGE : far;
      walk.target = Math.round(t);
    }

    function advance(dt) {
      clock += dt;
      var far = homeX();
      if (walk.x > far) {
        walk.x = far;
        applyPosition();
      }

      state.walking = false;

      // Asleep or busy: stay put. Only wandering moods move.
      if (mood !== 'idle' && mood !== 'deploy') {
        walk.moving = false;
        state.step = 0;
        return;
      }

      if (!walk.moving) {
        lookAround();
        if (clock >= walk.pauseUntil) {
          pickTarget();
          walk.moving = true;
        }
        return;
      }

      var delta = walk.target - walk.x;
      var stride = SPEED * dt / 1000;

      if (Math.abs(delta) <= stride) {
        walk.x = walk.target;
        walk.moving = false;
        walk.pauseUntil = clock + 2000 + Math.random() * 5000;
        state.step = 0;
        applyPosition();
        return;
      }

      walk.dir = delta > 0 ? 1 : -1;
      walk.x += walk.dir * stride;
      state.eyeDx = walk.dir;
      state.step = Math.floor(clock / 150) % 2;
      state.walking = true;
      applyPosition();
    }

    walk.x = homeX();
    applyPosition();

    function bubbleText() {
      var lines = [txt.moods[mood] || txt.moods.idle];
      var s = state.status;
      if (s && typeof s === 'object') {
        var parts = [];
        if (typeof s.visitors === 'number') parts.push(txt.stats.replace('%n', s.visitors));
        if (typeof s.load === 'number') parts.push(txt.load + ' ' + s.load.toFixed(2));
        if (parts.length) lines.push(parts.join(' \u00b7 '));
      }
      return lines.join('\n');
    }

    function closeBubble() {
      if (!bubble) return;
      global.clearTimeout(hideTimer);
      bubble.hidden = true;
      bubble.textContent = '';
    }

    function openBubble() {
      if (!bubble) return;
      bubble.textContent = bubbleText();
      bubble.hidden = false;
      global.clearTimeout(hideTimer);
      hideTimer = global.setTimeout(closeBubble, 6000);
    }

    function toggleBubble() {
      if (!bubble) return;
      if (bubble.hidden) openBubble();
      else closeBubble();
    }

    function applyStatus(next) {
      state.status = next;
      var nextMood = moodFromStatus(next, Date.now() / 1000);
      if (nextMood !== mood) {
        mood = nextMood;
        if (bubble && !bubble.hidden) bubble.textContent = bubbleText();
      }
      if (reduce) draw();
    }

    function loadStatus() {
      if (opts.demo || !global.fetch) return;
      global.fetch('/guardian/status.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { applyStatus(data); })
        .catch(function () { applyStatus(null); });
    }

    var reduce = !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var raf = 0;
    var start = 0;
    var lastTs = 0;

    function draw() {
      paint(ctx, lastT, mood, pal, state);
    }

    function frame(ts) {
      if (opts.freeze != null) { lastT = opts.freeze; draw(); return; }
      if (!start) { start = ts; lastTs = ts; }
      var dt = ts - lastTs;
      lastTs = ts;
      if (dt < 0) dt = 0;
      if (dt > 80) dt = 80;          // the tab was hidden; do not teleport
      lastT = ts - start;
      advance(dt);
      paint(ctx, lastT, mood, pal, state);
      raf = global.requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
    }

    if (opts.freeze != null) {
      frame(0);
    } else if (reduce) {
      lastT = 0;
      draw();
    } else {
      raf = global.requestAnimationFrame(frame);
    }

    if (btn) {
      btn.setAttribute('aria-label', txt.label);
      btn.addEventListener('click', function () {
        state.hopAt = lastT;
        walk.moving = false;
        walk.pauseUntil = clock + 3200;
        toggleBubble();
      });
    }

    if (global.addEventListener) {
      global.addEventListener('resize', function () {
        creatureW = (btn && btn.offsetWidth) || 72;
        var far = homeX();
        if (walk.x > far) walk.x = far;
        applyPosition();
      });
    }

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeBubble();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (!reduce && !raf) {
        start = 0;
        raf = global.requestAnimationFrame(frame);
      }
    });

    var mq = global.matchMedia ? global.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq) {
      var onScheme = function () { pal = palette(); draw(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }

    if (opts.status) applyStatus(opts.status);
    else loadStatus();

    global.setInterval(function () {
      if (!document.hidden) loadStatus();
    }, POLL_MS);

    return { setStatus: applyStatus, paint: draw };
  }

  function autoMount() {
    var nodes = document.querySelectorAll('[data-guardian]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-demo') !== null) continue;
      mount(nodes[i]);
    }
  }

  global.Guardian = { mount: mount, paint: paint, palette: palette };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }
})(window);
