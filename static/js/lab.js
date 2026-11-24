/* Loss-landscape playground for /lab/.
   Two inverted Gaussian wells plus a shallow bowl; three update rules start
   from the same point and run the same number of steps. */
(function () {
  'use strict';

  var canvas = document.getElementById('lab-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var field = document.createElement('canvas');
  var statsBody = document.getElementById('lab-stats');
  var playBtn = document.getElementById('lab-play');
  var resetBtn = document.getElementById('lab-reset');
  var speedInput = document.getElementById('lab-speed');

  // two anisotropic, slightly rotated wells and one broad low hill
  var WELLS = [
    { x: 0.34, y: 0.04, a: 1.00, sx: 0.15, sy: 0.24, th: 0.45 },   // sharp
    { x: -0.36, y: -0.06, a: 0.86, sx: 0.52, sy: 0.36, th: -0.30 }, // flat
  ];
  var HILL = { x: 0.02, y: -0.52, a: 0.16, s: 0.34 };
  var BOWL = 0.07;
  var XMIN = -1.35, XMAX = 1.35;
  var WORLD_W = XMAX - XMIN;
  var MAX_STEPS = 1400;
  var START = { x: 0.12, y: 0.42 };

  var METHODS = [
    {
      key: 'sgd', label: 'SGD', colour: '#717a80', width: 2.2, dash: null,
      step: function (s) {
        var g = gradAt(s.x, s.y);
        s.x -= 0.004 * g[0];
        s.y -= 0.004 * g[1];
      },
    },
    {
      key: 'sgdm', label: 'SGDM', colour: '#6d8fbd', width: 2.2, dash: [6, 4],
      step: function (s) {
        var g = gradAt(s.x, s.y);
        s.vx = 0.8 * s.vx - 0.01 * g[0];
        s.vy = 0.8 * s.vy - 0.01 * g[1];
        s.x += s.vx;
        s.y += s.vy;
      },
    },
    {
      key: 'diesgd', label: 'DIESGD', colour: '#224b8d', width: 3, dash: null,
      step: function (s) {
        var g = gradAt(s.x, s.y);
        var a = 0.16;
        s.s1x += a * (g[0] - s.s1x);
        s.s1y += a * (g[1] - s.s1y);
        s.s2x += a * (s.s1x - s.s2x);
        s.s2y += a * (s.s1y - s.s2y);
        s.x -= 0.03 * s.s2x;
        s.y -= 0.03 * s.s2y;
      },
    },
    {
      // MIESGD, l = 3: s0 = g, sj = xi sj + alpha s(j-1); coefficients are
      // softplus of a hypergradient-smoothed state; the step adds the
      // gradient difference to the multi-order integral sum.
      key: 'mie', label: 'MIE', colour: '#2f6f63', width: 2.6, dash: null,
      step: function (s) {
        var alpha = 0.05, eta = 0.01, xi = 0.98, mu = 0.9, eps = 1e-8, l = 3;
        var g = gradAt(s.x, s.y);
        var gn = Math.hypot(g[0], g[1]);
        var j;

        var next = [[g[0], g[1]]];
        for (j = 1; j <= l; j++) {
          var prev = next[j - 1];
          var old = s.order[j];
          next.push([xi * old[0] + alpha * prev[0], xi * old[1] + alpha * prev[1]]);
        }

        for (j = 0; j <= l; j++) {
          var st = s.order[j];
          var sn = Math.hypot(st[0], st[1]);
          var tilt = (g[0] * st[0] + g[1] * st[1]) / ((gn + eps) * (sn + eps));
          var signal = -alpha * tilt * sigmoid(s.lamHat[j]);
          s.hm[j] = mu * s.hm[j] + (1 - mu) * signal;
          s.lamHat[j] -= eta * s.hm[j];
        }

        var stepx, stepy;
        if (s.steps === 0) {
          stepx = alpha * g[0];
          stepy = alpha * g[1];
        } else {
          var sumx = 0, sumy = 0;
          for (j = 0; j <= l; j++) {
            sumx += s.lamPrev[j] * s.order[j][0];
            sumy += s.lamPrev[j] * s.order[j][1];
          }
          stepx = alpha * (s.gPrev[0] - s.gPrev2[0]) + alpha * sumx;
          stepy = alpha * (s.gPrev[1] - s.gPrev2[1]) + alpha * sumy;
        }
        s.x -= stepx;
        s.y -= stepy;

        s.gPrev2 = s.gPrev || g;
        s.gPrev = g;
        s.order = next;
        s.lamPrev = s.lamHat.map(function (v) { return softplus(v); });
        s.steps += 1;
      },
    },
  ];

  var cssW = 0, cssH = 0, dpr = 1;
  var yMin = 0, yMax = 0;
  var lossMin = -1.25, lossMax = 0.25;
  var playing = false, steps = 2, raf = 0;
  var states = [];
  var visible = { sgd: false, sgdm: true, diesgd: false, mie: true };

  function sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
  }

  function softplus(x) {
    return Math.log1p(Math.exp(Math.min(30, x)));
  }

  function lossAt(x, y) {
    var v = BOWL * (x * x + y * y);
    var i, w, dx, dy, c, sn, u, t;
    for (i = 0; i < WELLS.length; i++) {
      w = WELLS[i];
      dx = x - w.x;
      dy = y - w.y;
      c = Math.cos(w.th);
      sn = Math.sin(w.th);
      u = c * dx + sn * dy;
      t = -sn * dx + c * dy;
      v -= w.a * Math.exp(-0.5 * (u * u / (w.sx * w.sx) + t * t / (w.sy * w.sy)));
    }
    dx = x - HILL.x;
    dy = y - HILL.y;
    v += HILL.a * Math.exp(-(dx * dx + dy * dy) / (2 * HILL.s * HILL.s));
    return v;
  }

  function gradAt(x, y) {
    var gx = 2 * BOWL * x, gy = 2 * BOWL * y;
    var i, w, dx, dy, c, sn, u, t, e;
    for (i = 0; i < WELLS.length; i++) {
      w = WELLS[i];
      dx = x - w.x;
      dy = y - w.y;
      c = Math.cos(w.th);
      sn = Math.sin(w.th);
      u = c * dx + sn * dy;
      t = -sn * dx + c * dy;
      e = w.a * Math.exp(-0.5 * (u * u / (w.sx * w.sx) + t * t / (w.sy * w.sy)));
      gx += e * (u / (w.sx * w.sx) * c - t / (w.sy * w.sy) * sn);
      gy += e * (u / (w.sx * w.sx) * sn + t / (w.sy * w.sy) * c);
    }
    dx = x - HILL.x;
    dy = y - HILL.y;
    e = HILL.a * Math.exp(-(dx * dx + dy * dy) / (2 * HILL.s * HILL.s)) / (HILL.s * HILL.s);
    gx -= e * dx;
    gy -= e * dy;
    return [gx, gy];
  }

  function sharpness(x, y) {
    var h = 1e-4;
    var gx1 = gradAt(x + h, y)[0], gx0 = gradAt(x - h, y)[0];
    var gy1 = gradAt(x, y + h)[1], gy0 = gradAt(x, y - h)[1];
    return (gx1 - gx0 + gy1 - gy0) / (2 * h);
  }

  function toScreen(x, y) {
    return [((x - XMIN) / WORLD_W) * cssW, ((y - yMin) / (yMax - yMin)) * cssH];
  }

  function toWorld(px, py) {
    var x = XMIN + (px / cssW) * WORLD_W;
    var y = yMin + (py / cssH) * (yMax - yMin);
    return {
      x: Math.max(-1.2, Math.min(1.2, x)),
      y: Math.max(-0.75, Math.min(0.75, y)),
    };
  }

  function buildField() {
    var w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    field.width = w;
    field.height = h;
    var fctx = field.getContext('2d');
    var img = fctx.createImageData(w, h);
    var data = img.data;
    var bands = new Uint8Array(w * h);
    var BANDS = 14;

    // the shading range follows the surface, so new terms never clip it
    lossMin = Infinity;
    lossMax = -Infinity;
    for (var sy2 = 0; sy2 < 18; sy2++) {
      var ly = yMin + ((yMax - yMin) * (sy2 + 0.5)) / 18;
      for (var sx2 = 0; sx2 < 24; sx2++) {
        var lx = XMIN + (WORLD_W * (sx2 + 0.5)) / 24;
        var lv = lossAt(lx, ly);
        if (lv < lossMin) lossMin = lv;
        if (lv > lossMax) lossMax = lv;
      }
    }
    var span = lossMax - lossMin || 1;

    for (var j = 0; j < h; j++) {
      var wy = yMin + ((j + 0.5) / h) * (yMax - yMin);
      for (var i = 0; i < w; i++) {
        var wx = XMIN + ((i + 0.5) / w) * WORLD_W;
        var t = (lossAt(wx, wy) - lossMin) / span;
        bands[j * w + i] = Math.min(BANDS - 1, Math.max(0, Math.floor(t * BANDS)));
      }
    }

    for (var j2 = 0; j2 < h; j2++) {
      for (var i2 = 0; i2 < w; i2++) {
        var idx = j2 * w + i2;
        var b = bands[idx];
        var edge = b !== (i2 > 0 ? bands[idx - 1] : b) || b !== (j2 > 0 ? bands[idx - w] : b);
        var s = b / (BANDS - 1);
        var r = 226 + (255 - 226) * s;
        var g = 232 + (255 - 232) * s;
        var bl = 242 + (255 - 242) * s;
        if (edge) { r -= 12; g -= 12; bl -= 16; }
        var o = idx * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = bl;
        data[o + 3] = 255;
      }
    }
    fctx.putImageData(img, 0, 0);
  }

  function reset() {
    states = METHODS.map(function (m) {
      var st = {
        m: m, x: START.x, y: START.y, vx: 0, vy: 0,
        s1x: 0, s1y: 0, s2x: 0, s2y: 0,
        path: [[START.x, START.y]], done: false,
      };
      if (m.key === 'mie') {
        st.order = [[0, 0], [0, 0], [0, 0], [0, 0]];
        st.lamHat = [1.2477, 1.2477, 1.2477, 1.2477];
        st.lamPrev = [1.5, 1.5, 1.5, 1.5];
        st.hm = [0, 0, 0, 0];
        st.gPrev = null;
        st.gPrev2 = null;
        st.steps = 0;
      }
      return st;
    });
    draw();
    renderStats();
  }

  function stepAll() {
    var moving = false;
    states.forEach(function (s) {
      if (s.done) return;
      s.m.step(s);
      s.path.push([s.x, s.y]);
      var g = gradAt(s.x, s.y);
      if (Math.hypot(g[0], g[1]) < 0.004 || s.path.length > MAX_STEPS) s.done = true;
      else moving = true;
    });
    if (!moving) {
      playing = false;
      playBtn.textContent = 'Play';
    }
    return moving;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(field, 0, 0, cssW, cssH);

    states.forEach(function (s) {
      if (!visible[s.m.key]) return;
      if (s.path.length < 2) return;
      var n = s.path.length;

      // the trajectory, drawn in chunks so the head stands out but the
      // whole route stays visible once the run has settled
      var chunks = 10;
      for (var c = 0; c < chunks; c++) {
        var from = Math.max(1, Math.floor((n * c) / chunks));
        var to = Math.min(n - 1, Math.floor((n * (c + 1)) / chunks));
        if (to <= from) continue;
        var t = (c + 1) / chunks;
        ctx.beginPath();
        ctx.lineWidth = s.m.width * (0.8 + 0.25 * t);
        ctx.strokeStyle = s.m.colour;
        ctx.globalAlpha = s.done ? 0.75 : 0.3 + 0.7 * t;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (ctx.setLineDash) ctx.setLineDash(s.m.dash || []);
        for (var i = from; i <= to; i++) {
          var a = toScreen(s.path[i - 1][0], s.path[i - 1][1]);
          var b = toScreen(s.path[i][0], s.path[i][1]);
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (ctx.setLineDash) ctx.setLineDash([]);

      var end = toScreen(s.x, s.y);
      ctx.beginPath();
      ctx.arc(end[0], end[1], s.m.width + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = s.m.colour;
      ctx.fill();
    });

    var s0 = toScreen(START.x, START.y);
    ctx.beginPath();
    ctx.arc(s0[0], s0[1], 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#224b8d';
    ctx.stroke();
  }

  function wellOf(s) {
    var dSharp = Math.hypot(s.x - WELLS[0].x, s.y - WELLS[0].y);
    var dFlat = Math.hypot(s.x - WELLS[1].x, s.y - WELLS[1].y);
    if (Math.min(dSharp, dFlat) > 0.3) return 'still moving';
    return dSharp < dFlat ? 'sharp well' : 'flat well';
  }

  function renderStats() {
    if (!statsBody) return;
    statsBody.innerHTML = '';
    states.forEach(function (s) {
      if (!visible[s.m.key]) return;
      var tr = document.createElement('tr');
      var name = document.createElement('td');
      var swatch = document.createElement('span');
      swatch.className = 'lab-swatch';
      swatch.style.borderTopColor = s.m.colour;
      name.appendChild(swatch);
      name.appendChild(document.createTextNode(s.m.label));

      var loss = document.createElement('td');
      loss.textContent = lossAt(s.x, s.y).toFixed(2);

      var sharp = document.createElement('td');
      sharp.textContent = sharpness(s.x, s.y).toFixed(1);

      var counted = document.createElement('td');
      counted.textContent = String(s.path.length - 1);

      var where = document.createElement('td');
      where.className = 'lab-verdict';
      where.textContent = s.done ? wellOf(s) : '—';

      tr.appendChild(name);
      tr.appendChild(loss);
      tr.appendChild(sharp);
      tr.appendChild(counted);
      tr.appendChild(where);
      statsBody.appendChild(tr);
    });
  }

  function tick() {
    raf = 0;
    if (!playing) return;
    for (var i = 0; i < steps; i++) stepAll();
    draw();
    renderStats();
    if (playing) raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    playing = true;
    playBtn.textContent = 'Pause';
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function pause() {
    playing = false;
    playBtn.textContent = 'Play';
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width);
    if (!w) return;
    cssW = w;
    cssH = Math.round(w * 0.71);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = cssH + 'px';
    yMin = -(WORLD_W * cssH / cssW) / 2;
    yMax = -yMin;
    lossMin = -1.25;
    lossMax = 0.25;
    buildField();
    draw();
  }

  playBtn.addEventListener('click', function () {
    if (playing) pause(); else play();
  });

  resetBtn.addEventListener('click', function () {
    pause();
    reset();
  });

  speedInput.addEventListener('input', function () {
    steps = parseInt(speedInput.value, 10) || 1;
  });

  var toggles = Array.prototype.slice.call(document.querySelectorAll('.lab-toggle'));

  function paintToggles() {
    toggles.forEach(function (b) {
      var on = !!visible[b.dataset.key];
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  toggles.forEach(function (b) {
    b.addEventListener('click', function () {
      visible[b.dataset.key] = !visible[b.dataset.key];
      paintToggles();
      draw();
      renderStats();
    });
  });

  paintToggles();

  var dragging = false;

  function moveStart(ev) {
    var rect = canvas.getBoundingClientRect();
    var p = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
    START.x = p.x;
    START.y = p.y;
    pause();
    reset();
  }

  canvas.addEventListener('pointerdown', function (ev) {
    dragging = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
    moveStart(ev);
  });

  canvas.addEventListener('pointermove', function (ev) {
    if (dragging) moveStart(ev);
  });

  canvas.addEventListener('pointerup', function () {
    dragging = false;
  });

  canvas.addEventListener('pointercancel', function () {
    dragging = false;
  });

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  resize();
  reset();
  window.addEventListener('resize', function () {
    resize();
    draw();
  });
  if (!reduced) play();

})();
