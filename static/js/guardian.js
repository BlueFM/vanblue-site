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

  function drawSprite(ctx, rows, x, y, pal, pupilDx, pupilDy) {
    var shiftX = pupilDx || 0;
    var shiftY = pupilDy || 0;
    if (shiftY > 1) shiftY = 1;
    if (shiftY < -1) shiftY = -1;
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
          pupils.push([x + c + shiftX, y + r + shiftY]);
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

    drawSprite(ctx, rows, BODY_X, top, pal, state.eyeDx || 0, state.eyeDy || 0);

    // Clinging to a wall: two tiny hands on the wall side.
    if (state.onWall) {
      ctx.fillStyle = pal.a;
      var hx = state.onWall === 'left' ? BODY_X : BODY_X + 15;
      ctx.fillRect(hx, top + 6, 1, 1);
      ctx.fillRect(hx, top + 9, 1, 1);
    }

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
      eyeDx: 0,
      eyeDy: 0,
      onWall: null
    };
    var lastT = 0;
    var anchoredRight = null;
    var anchoredLow = null;

    var pal = palette();
    var bubble = el.querySelector('.guardian-bubble');
    var btn = el.querySelector('.guardian-btn');
    var hideTimer = 0;

    /* --- roaming, climbing, dragging ------------------------------------ */

    var EDGE = 4;              // px kept clear at the viewport edges
    var FLOOR_GAP = 12;        // px between the floor and the viewport bottom
    var WALK_SPEED = 24;       // px per second
    var CLIMB_SPEED = 40;      // px per second
    var GRAVITY = 2000;        // px per second squared
    var clock = 0;             // ms of animated time, advanced by the frame loop
    var nextLook = 0;
    var creatureW = (btn && btn.offsetWidth) || 72;
    var creatureH = (btn && btn.offsetHeight) || 80;

    var pos = { x: 0, y: 0 };
    var fall = { vy: 0, bounce: 0 };
    var motion = {
      mode: 'idle',            // idle | walk | climb | fall | drag
      surface: 'floor',        // floor | left | right
      target: 0,
      pauseUntil: 1400,
      nextNudge: 0
    };
    var pointer = { x: -9999, y: -9999 };
    var dragging = false;
    var wasDragged = false;
    var dragOffset = { x: 0, y: 0 };

    function viewport() {
      return { w: global.innerWidth || 1024, h: global.innerHeight || 768 };
    }

    function floorY() { return viewport().h - creatureH - FLOOR_GAP; }
    function wallX(side) { return side === 'left' ? EDGE : viewport().w - creatureW - EDGE; }
    function rand(min, max) { return min + Math.random() * (max - min); }

    function place() {
      if (el.style) {
        el.style.transform =
          'translate3d(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px,0)';
      }
      if (!el.classList) return;
      // Keep the speech bubble on the inside of the viewport.
      var right = pos.x + creatureW / 2 > viewport().w / 2;
      if (right !== anchoredRight) {
        anchoredRight = right;
        el.classList.toggle('is-right', right);
      }
      // High on a wall, the bubble has to go below instead of above.
      var low = pos.y < 96;
      if (low !== anchoredLow) {
        anchoredLow = low;
        el.classList.toggle('is-low', low);
      }
    }

    function hop() { state.hopAt = lastT; }

    // Eyes: follow the pointer when it is close, otherwise look where the
    // body is heading, otherwise glance around now and then.
    function eyes() {
      var cx = pos.x + creatureW / 2;
      var cy = pos.y + creatureH / 2;
      var dx = pointer.x - cx;
      var dy = pointer.y - cy;

      if (mood !== 'sleep' && Math.abs(dx) < 260 && Math.abs(dy) < 260) {
        state.eyeDx = Math.abs(dx) > 10 ? (dx > 0 ? 1 : -1) : 0;
        state.eyeDy = Math.abs(dy) > 12 ? (dy > 0 ? 1 : -1) : 0;
        return;
      }
      if (motion.mode === 'walk') {
        state.eyeDx = motion.target > pos.x ? 1 : -1;
        state.eyeDy = 0;
        return;
      }
      if (motion.mode === 'climb') {
        state.eyeDx = 0;
        state.eyeDy = motion.target > pos.y ? 1 : -1;
        return;
      }
      if (clock > nextLook) {
        state.eyeDx = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
        state.eyeDy = 0;
        nextLook = clock + 2200 + Math.random() * 3200;
      }
    }

    // A small hop when the pointer lingers on top of it.
    function hoverNudge() {
      if (reduce || mood === 'sleep' || clock < motion.nextNudge) return;
      var cx = pos.x + creatureW / 2;
      var cy = pos.y + creatureH / 2;
      if (Math.abs(pointer.x - cx) < 52 && Math.abs(pointer.y - cy) < 52) {
        hop();
        motion.nextNudge = clock + 4500;
      }
    }

    function arrive() {
      motion.mode = 'idle';
      state.walking = false;
      state.step = 0;
      motion.pauseUntil = clock + rand(1800, 5200);
    }

    function climbToWall(side) {
      motion.surface = side;
      pos.x = wallX(side);
      motion.mode = 'climb';
      motion.target = Math.round(rand(12, Math.max(20, floorY() - 60)));
      place();
    }

    function nextAction() {
      var vp = viewport();

      if (motion.surface === 'floor') {
        var atLeft = pos.x <= EDGE + 2;
        var atRight = pos.x >= vp.w - creatureW - EDGE - 2;
        var r = Math.random();
        if (atLeft && r < 0.6) return climbToWall('left');
        if (atRight && r < 0.6) return climbToWall('right');
        motion.mode = 'walk';
        motion.target = Math.round(Math.random() < 0.3
          ? (Math.random() < 0.5 ? EDGE : vp.w - creatureW - EDGE)
          : rand(EDGE, vp.w - creatureW - EDGE));
        return;
      }

      // On a wall: climb higher or lower, or come back down to the floor.
      motion.mode = 'climb';
      motion.target = Math.round(Math.random() < 0.55
        ? rand(12, Math.max(20, floorY() - 80))
        : floorY());
    }

    function advance(dt) {
      clock += dt;
      var vp = viewport();
      state.onWall = motion.surface === 'floor' ? null : motion.surface;

      if (motion.mode === 'drag') {
        eyes();
        return;
      }

      if (pos.x > vp.w - creatureW) pos.x = Math.max(0, vp.w - creatureW);

      if (motion.mode === 'fall') {
        fall.vy += GRAVITY * dt / 1000;
        pos.y += fall.vy * dt / 1000;
        var ground = floorY();
        if (pos.y >= ground) {
          pos.y = ground;
          if (fall.vy > 320 && fall.bounce < 2) {
            fall.vy = -fall.vy * 0.26;
            fall.bounce++;
          } else {
            fall.vy = 0;
            fall.bounce = 0;
            motion.mode = 'idle';
            motion.surface = 'floor';
            motion.pauseUntil = clock + 900;
          }
        }
        eyes();
        place();
        return;
      }

      var canRoam = mood === 'idle' || mood === 'deploy';
      if (!canRoam && (motion.mode === 'walk' || motion.mode === 'climb')) {
        motion.mode = 'idle';
        motion.pauseUntil = clock + 1500;
      }

      if (motion.mode === 'walk') {
        var dx = motion.target - pos.x;
        var stride = WALK_SPEED * dt / 1000;
        if (Math.abs(dx) <= stride) {
          pos.x = motion.target;
          arrive();
        } else {
          pos.x += dx > 0 ? stride : -stride;
          state.walking = true;
          state.step = Math.floor(clock / 150) % 2;
        }
        eyes();
        place();
        return;
      }

      if (motion.mode === 'climb') {
        var dy = motion.target - pos.y;
        var climb = CLIMB_SPEED * dt / 1000;
        if (Math.abs(dy) <= climb) {
          pos.y = motion.target;
          if (motion.surface !== 'floor' && pos.y >= floorY() - 0.5) {
            motion.surface = 'floor';
            pos.y = floorY();
          }
          arrive();
        } else {
          pos.y += dy > 0 ? climb : -climb;
          state.walking = true;
          state.step = Math.floor(clock / 120) % 2;
        }
        eyes();
        place();
        return;
      }

      // idle
      state.walking = false;
      state.step = 0;
      if (motion.surface === 'floor') pos.y = floorY();
      eyes();
      hoverNudge();
      if (canRoam && clock >= motion.pauseUntil) nextAction();
      place();
    }

    pos.x = viewport().w - creatureW - EDGE;
    pos.y = floorY();
    place();

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

    function onDown(ev) {
      if (ev && ev.button != null && ev.button !== 0) return;
      dragging = true;
      wasDragged = false;
      dragOffset.x = (ev && ev.clientX != null ? ev.clientX : 0) - pos.x;
      dragOffset.y = (ev && ev.clientY != null ? ev.clientY : 0) - pos.y;
      motion.mode = 'drag';
      if (el.classList) el.classList.add('is-dragging');
      // Keep receiving moves if the pointer leaves the element. No
      // preventDefault: it can swallow the click that opens the bubble.
      if (btn.setPointerCapture && ev && ev.pointerId != null) {
        try { btn.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
      }
    }

    function onMove(ev) {
      if (!ev) return;
      if (ev.clientX != null) {
        pointer.x = ev.clientX;
        pointer.y = ev.clientY;
      }
      if (!dragging) return;
      var vp = viewport();
      var nx = pointer.x - dragOffset.x;
      var ny = pointer.y - dragOffset.y;
      nx = Math.max(0, Math.min(vp.w - creatureW, nx));
      ny = Math.max(0, Math.min(vp.h - creatureH, ny));
      if (Math.abs(nx - pos.x) + Math.abs(ny - pos.y) > 3) wasDragged = true;
      pos.x = nx;
      pos.y = ny;
      place();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (el.classList) el.classList.remove('is-dragging');
      var vp = viewport();
      if (pos.x < EDGE + 40) {
        motion.surface = 'left';
        pos.x = EDGE;
        pos.y = Math.min(pos.y, floorY());
        motion.mode = 'idle';
        motion.pauseUntil = clock + 1200;
      } else if (pos.x + creatureW > vp.w - EDGE - 40) {
        motion.surface = 'right';
        pos.x = vp.w - creatureW - EDGE;
        pos.y = Math.min(pos.y, floorY());
        motion.mode = 'idle';
        motion.pauseUntil = clock + 1200;
      } else if (reduce) {
        motion.surface = 'floor';
        pos.y = floorY();
        motion.mode = 'idle';
      } else {
        // Let go in mid-air and it drops to the floor.
        motion.surface = 'floor';
        motion.mode = 'fall';
        fall.vy = 0;
        fall.bounce = 0;
      }
      state.onWall = motion.surface === 'floor' ? null : motion.surface;
      place();
    }

    function onResize() {
      creatureW = (btn && btn.offsetWidth) || 72;
      creatureH = (btn && btn.offsetHeight) || 80;
      var vp = viewport();
      if (pos.x > vp.w - creatureW) pos.x = Math.max(0, vp.w - creatureW);
      if (motion.surface === 'left') pos.x = wallX('left');
      else if (motion.surface === 'right') pos.x = wallX('right');
      if (pos.y > floorY()) pos.y = floorY();
      if (motion.surface === 'floor') pos.y = floorY();
      place();
    }

    if (btn) {
      btn.setAttribute('aria-label', txt.label);
      btn.addEventListener('pointerdown', onDown);
      btn.addEventListener('click', function () {
        if (wasDragged) { wasDragged = false; return; }
        hop();
        if (motion.mode === 'walk' || motion.mode === 'climb') {
          motion.mode = 'idle';
          motion.pauseUntil = clock + 2400;
        }
        toggleBubble();
      });
    }

    if (global.addEventListener) {
      global.addEventListener('pointermove', onMove, { passive: true });
      global.addEventListener('pointerup', onUp);
      global.addEventListener('pointercancel', onUp);
      global.addEventListener('resize', onResize);
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

    return { setStatus: applyStatus, paint: draw, state: state, pos: pos, motion: motion };
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
