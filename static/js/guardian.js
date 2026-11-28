/* The spell cat — transparent, illustrated sprites; no framework or service.
 * Existing /guardian/status.json supplies the mood. Missing or stale snapshots
 * fall back to the visitor's clock. All magic is local to the browser.
 */
(function (global) {
  'use strict';

  var CELL = 384;
  var COLS = 4;
  var POLL_MS = 60000;
  var STALE_S = 600;
  var PREF_KEY = 'vanblue:spell-cat:v1';
  var SPELL_IDS = ['fish', 'stars', 'shield', 'puff'];
  var mounted = new WeakMap();
  var sequences = {
    idle: [[0, 2400], [1, 70], [2, 100], [1, 70]],
    sleep: [[3, 780], [4, 370], [5, 600], [4, 480]],
    walk: [[6, 130], [7, 130], [8, 130], [9, 130]],
    cast: [[10, 3400]]
  };
  var copy = {
    en: {
      label: 'The spell cat. Click for magic; drag to move.',
      name: 'THE SPELL CAT', hint: 'A little magic?',
      hide: 'Hide the cat', restore: 'Bring back the wizard cat', close: 'Close',
      cast: 'Another spell', stay: 'Stay here', wander: 'Wander a little',
      help: 'Click for magic · drag to move', touchHelp: 'Tap for magic · drag to move',
      spells: {
        fish: ['LITTLE FISH', 'Mew… one little fish, and a little extra luck.'],
        stars: ['STARDUST', 'Stars, assemble! A bright idea is on its way.'],
        shield: ['MOONSHIELD', 'A moonlit shield. May your next deadline be gentle.'],
        puff: ['OOPS, A PUFF', 'Poof… that was meant to be a fish. Nothing to see here.']
      },
      idle: 'Keeping a little magic in the margins.',
      sleep: 'Shh… collecting dreams for tomorrow.',
      busy: 'Watching over a very busy little server.',
      deploy: 'A fresh page, a fresh little spell.',
      stats: '%n visitors today', load: 'load'
    },
    zh: {
      label: '念咒猫。点我施法，拖动可以换个位置。',
      name: '巫师的念咒猫', hint: '要来一点魔法吗？',
      hide: '收起猫咪', restore: '请念咒猫回来', close: '关闭',
      cast: '再变一个', stay: '乖乖待着', wander: '去散散步',
      help: '点我施法 · 拖动换个位置', touchHelp: '轻点施法 · 拖动换个位置',
      spells: {
        fish: ['变小鱼', '喵呜……变出一条小鱼，再加一点点好运。'],
        stars: ['星星雨', '星星集合！愿你的下一个灵感闪闪发亮。'],
        shield: ['月光护盾', '月光护盾展开。愿下一个截止日期对你温柔一点。'],
        puff: ['施法翻车', '噗……本来想变小鱼的。这团烟你就当没看见。']
      },
      idle: '在页边，悄悄守着一点魔法。',
      sleep: '嘘……正在收集明天要用的好梦。',
      busy: '服务器忙碌中，本喵正在认真守护。',
      deploy: '新页面上线，补上一点新魔法。',
      stats: '今天有 %n 位访客', load: '负载'
    }
  };

  function clockMood() {
    var hour = new Date().getHours();
    return hour >= 1 && hour < 7 ? 'sleep' : 'idle';
  }

  function freshStatus(status, nowS) {
    return !!status && typeof status === 'object' &&
      Number.isFinite(status.ts) && nowS - status.ts >= -60 && nowS - status.ts < STALE_S;
  }

  function moodFromStatus(status, nowS) {
    if (!freshStatus(status, nowS)) return clockMood();
    return ['idle', 'sleep', 'busy', 'deploy'].indexOf(status.mood) !== -1
      ? status.mood : clockMood();
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(Math.max(min, max), n)); }
  function random(min, max) { return min + Math.random() * (max - min); }

  function readPrefs() {
    var prefs = { collapsed: false, roam: true, seen: false };
    try {
      var saved = JSON.parse(global.localStorage.getItem(PREF_KEY));
      if (saved && typeof saved === 'object') {
        Object.keys(prefs).forEach(function (key) {
          if (typeof saved[key] === 'boolean') prefs[key] = saved[key];
        });
      }
    } catch (err) { /* Storage may be disabled. The cat still works. */ }
    return prefs;
  }

  function sequenceFrame(name, time, reduced) {
    var seq = sequences[name];
    if (reduced) return seq[0][0];
    var duration = seq.reduce(function (sum, item) { return sum + item[1]; }, 0);
    var phase = time % duration;
    for (var i = 0; i < seq.length; i++) {
      if (phase < seq[i][1]) return seq[i][0];
      phase -= seq[i][1];
    }
    return seq[0][0];
  }

  function mount(el, options) {
    if (mounted.has(el)) return mounted.get(el);
    var opts = options || {};
    var btn = el.querySelector('.guardian-btn');
    var canvas = el.querySelector('.guardian-canvas');
    var pet = el.querySelector('.guardian-pet');
    var panel = el.querySelector('.guardian-bubble');
    var toggleBtn = el.querySelector('.guardian-toggle');
    if (!btn || !canvas || !pet || !panel || !toggleBtn) return null;

    var ctx = canvas.getContext && canvas.getContext('2d');
    var fallback = el.querySelector('.guardian-fallback');
    var magic = el.querySelector('.guardian-magic');
    var message = el.querySelector('.guardian-message');
    var spellName = el.querySelector('.guardian-spell-name');
    var stats = el.querySelector('.guardian-stats');
    var roamBtn = el.querySelector('.guardian-roam');
    var castBtn = el.querySelector('.guardian-cast');
    var closeBtn = el.querySelector('.guardian-panel-close');
    var zh = /^zh\b/i.test(document.documentElement.lang);
    var txt = copy[zh ? 'zh' : 'en'];
    var reduceQuery = global.matchMedia('(prefers-reduced-motion: reduce)');
    var compactQuery = global.matchMedia('(max-width: 640px)');
    var reduced = reduceQuery.matches;
    var compact = compactQuery.matches;
    var prefs = readPrefs();
    var atlas = new Image();
    var artRequested = false;
    var artReady = false;
    var ready = false;
    var destroyed = false;
    var raf = 0;
    var lastTick = 0;
    var drawnFrame = -1;
    var sequenceStart = 0;
    var castTimer = 0;
    var wakeTimer = 0;
    var introTimer = 0;
    var pollTimer = 0;
    var fetchTimeout = 0;
    var fetchController = null;
    var fetching = false;
    var lastPoll = 0;
    var casting = false;
    var wakeUntil = 0;
    var spellIndex = 0;
    var hovered = false;
    var focused = false;
    var pointer = null;
    var suppressClickUntil = 0;
    var DOCK_SIZE = 44;
    var DOCK_SPACING = 12;
    var creatureW = 164;
    var creatureH = 164;
    var safeBottom = 0;
    var gap = 16;
    var homeX = 0;
    var previousPos = null;
    var disposers = [];
    var pos = { x: 0, y: 0 };
    var state = { status: opts.status || null, mood: 'idle', pose: 'idle', spell: null, frame: 0, clock: opts.freeze || 0 };
    var motion = { mode: 'idle', target: 0, pauseUntil: 18000, velocity: 0 };

    function listen(target, type, fn, options) {
      target.addEventListener(type, fn, options);
      disposers.push(function () { target.removeEventListener(type, fn, options); });
    }

    function savePrefs() {
      try { global.localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }
      catch (err) { /* Private browsing and storage restrictions are harmless. */ }
    }

    function attr(name, fallbackValue) {
      return el.getAttribute('data-' + name) || fallbackValue;
    }

    function viewport() {
      var visual = global.visualViewport;
      return visual ? { w: visual.width, h: visual.height, x: visual.offsetLeft, y: visual.offsetTop }
        : { w: global.innerWidth, h: global.innerHeight, x: 0, y: 0 };
    }
    function minX() { return viewport().x + gap; }
    function minY() { return viewport().y + gap; }
    function floorY() { var vp = viewport(); return Math.max(minY(), vp.y + vp.h - creatureH - gap - safeBottom); }
    function maxX() {
      var vp = viewport();
      return Math.max(minX(), vp.x + vp.w - creatureW - gap - DOCK_SIZE - DOCK_SPACING);
    }

    function measure() {
      var vp = viewport();
      safeBottom = parseFloat(global.getComputedStyle(el).getPropertyValue('--pet-safe-bottom')) || 0;
      gap = compact ? 12 : 16;
      var room = Math.min(vp.w - gap * 2 - DOCK_SIZE - DOCK_SPACING, vp.h - gap * 2 - safeBottom);
      el.style.setProperty('--pet-room', Math.max(44, room) + 'px');
      el.style.setProperty('--pet-viewport-width', vp.w + 'px');
      creatureW = creatureH = parseFloat(global.getComputedStyle(pet).width) || (compact ? 108 : 164);
    }

    function facing(direction) { el.style.setProperty('--pet-facing', direction < 0 ? '-1' : '1'); }
    function faceInward() { var vp = viewport(); facing(pos.x + creatureW / 2 > vp.x + vp.w / 2 ? -1 : 1); }

    function place() {
      var vp = viewport();
      // Only the pet moves; the moon stays pinned to the visible bottom-right corner.
      pet.style.transform = 'translate3d(' + Math.round(pos.x) + 'px,' + Math.round(pos.y) + 'px,0)';
      var dockX = Math.max(vp.x + gap, vp.x + vp.w - DOCK_SIZE - gap);
      var dockY = Math.max(vp.y + gap, vp.y + vp.h - DOCK_SIZE - gap - safeBottom);
      toggleBtn.style.transform = 'translate3d(' + Math.round(dockX) + 'px,' + Math.round(dockY) + 'px,0)';
      el.classList.toggle('is-right', pos.x + creatureW / 2 > vp.x + vp.w / 2);
      el.classList.toggle('is-low', pos.y < vp.y + 80);
      if (!panel.hidden) {
        // Clamp to the visual viewport, including zoom and the on-screen keyboard.
        var width = Math.max(44, Math.min(264, vp.w - 24));
        panel.style.width = width + 'px';
        panel.style.maxHeight = Math.max(44, vp.h - 16) + 'px';
        var left = pos.x + creatureW / 2 > vp.x + vp.w / 2 ? creatureW - width : 0;
        panel.style.left = clamp(left, vp.x + 12 - pos.x, vp.x + vp.w - width - 12 - pos.x) + 'px';
        var height = panel.offsetHeight;
        var top = pos.y - height - 12;
        if (top < vp.y + 8) top = pos.y + creatureH + 12;
        panel.style.top = (clamp(top, vp.y + 8, vp.y + vp.h - height - 8) - pos.y) + 'px';
      }
    }

    function idleFor(ms) {
      motion.mode = 'idle';
      motion.velocity = 0;
      motion.pauseUntil = state.clock + (ms || random(16000, 30000));
      el.classList.remove('is-falling');
      faceInward();
    }

    function effectiveMood() {
      return state.mood === 'sleep' && performance.now() < wakeUntil ? 'idle' : state.mood;
    }

    function draw(force) {
      var pose = casting ? 'cast' : motion.mode === 'walk' ? 'walk' : effectiveMood() === 'sleep' ? 'sleep' : 'idle';
      if (pose !== state.pose) {
        state.pose = pose;
        sequenceStart = state.clock;
      }
      var index = sequenceFrame(pose, state.clock - sequenceStart, reduced);
      state.frame = index;
      el.dataset.pose = pose;
      el.dataset.mood = state.mood;
      el.classList.toggle('is-sleeping', pose === 'sleep');
      if (!artReady || !ctx || (!force && drawnFrame === index)) return;
      ctx.clearRect(0, 0, CELL, CELL);
      ctx.drawImage(atlas, (index % COLS) * CELL, Math.floor(index / COLS) * CELL,
        CELL, CELL, 0, 0, CELL, CELL);
      drawnFrame = index;
    }

    function canWander() {
      return artReady && prefs.roam && !compact && !reduced && !casting &&
        !hovered && !focused && panel.hidden &&
        (effectiveMood() === 'idle' || effectiveMood() === 'deploy');
    }

    function advance(dt) {
      state.clock += dt;
      if (motion.mode === 'drag') return;
      if (motion.mode === 'fall') {
        motion.velocity += 1100 * dt / 1000;
        pos.y += motion.velocity * dt / 1000;
        if (pos.y >= floorY()) { pos.y = floorY(); idleFor(12000); }
        place();
        return;
      }
      if (motion.mode === 'walk') {
        if (!canWander()) { idleFor(); return; }
        var distance = motion.target - pos.x;
        var stride = 28 * dt / 1000;
        if (Math.abs(distance) <= stride) { pos.x = motion.target; idleFor(); }
        else { facing(distance); pos.x += distance < 0 ? -stride : stride; }
        place();
        return;
      }
      if (canWander() && state.clock > motion.pauseUntil) {
        // Short strolls near its chosen spot, rather than crossing the article.
        motion.target = random(Math.max(minX(), homeX - 180), Math.min(maxX(), homeX + 180));
        if (Math.abs(motion.target - pos.x) > 32) motion.mode = 'walk';
        else idleFor();
      }
    }

    function tick(ts) {
      raf = 0;
      if (destroyed || document.hidden || prefs.collapsed || reduced || !ready) return;
      if (!lastTick) lastTick = ts;
      var dt = ts - lastTick;
      if (dt >= 32) {
        lastTick = ts;
        advance(clamp(dt, 0, 80));
        draw(false);
      }
      raf = global.requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = 0;
      lastTick = 0;
    }

    function start() {
      if (!raf && !destroyed && ready && !reduced && !prefs.collapsed && !document.hidden && opts.freeze == null) {
        lastTick = 0;
        raf = global.requestAnimationFrame(tick);
      }
    }

    function activate() {
      if (destroyed || ready) return;
      ready = true;
      el.hidden = false;
      measure();
      pos.x = maxX();
      pos.y = floorY();
      homeX = pos.x;
      faceInward();
      place();
      draw(true);
      start();
      if (!prefs.collapsed && !prefs.seen) {
        el.classList.add('is-new');
        introTimer = global.setTimeout(markSeen, 5000);
      }
    }

    function loadArt() {
      if (artRequested) return;
      artRequested = true;
      atlas.onload = function () {
        if (destroyed) return;
        artReady = true;
        canvas.hidden = !ctx;
        if (ctx) fallback.hidden = true;
        else showFallback();
        activate();
        draw(true);
      };
      atlas.onerror = showFallback;
      atlas.decoding = 'async';
      atlas.fetchPriority = 'low';
      atlas.src = attr('sprite', '/img/wizard-cat/sprites.webp');
    }

    function showFallback() {
      if (destroyed) return;
      canvas.hidden = true;
      fallback.hidden = false;
      fallback.onload = activate;
      fallback.onerror = function () {
        if (destroyed) return;
        artRequested = false;
        setCollapsed(true, false); // Keep the moon available so a later click can retry.
      };
      fallback.src = attr('idle', '/img/wizard-cat/idle.webp');
    }

    function markSeen() {
      global.clearTimeout(introTimer);
      el.classList.remove('is-new');
      if (!prefs.seen) { prefs.seen = true; savePrefs(); }
    }

    function updateStats() {
      var parts = [];
      var s = state.status;
      if (freshStatus(s, Date.now() / 1000)) {
        if (Number.isFinite(s.visitors) && s.visitors >= 0) parts.push(attr('stats', txt.stats).replace('%n', Math.floor(s.visitors)));
        if (Number.isFinite(s.load) && s.load >= 0) parts.push(attr('load', txt.load) + ' ' + s.load.toFixed(2));
      }
      stats.textContent = parts.join(' · ');
      stats.hidden = !parts.length;
    }

    function updateRoamButton() {
      roamBtn.textContent = prefs.roam ? txt.stay : txt.wander;
      roamBtn.hidden = compact || reduced;
    }

    function openPanel() {
      markSeen();
      if (!message.textContent) message.textContent = attr('mood-' + state.mood, txt[state.mood]);
      updateStats();
      panel.hidden = false;
      el.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      idleFor();
      place();
    }

    function closePanel(refocus) {
      panel.hidden = true;
      el.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      motion.pauseUntil = state.clock + 16000;
      if (refocus) btn.focus({ preventScroll: true });
    }

    function finishCast() {
      casting = false;
      el.classList.remove('is-casting');
      draw(true);
    }

    function cast(showPanel) {
      if (destroyed || prefs.collapsed || !ready) return;
      if (motion.mode === 'drag' || motion.mode === 'fall') return;
      markSeen();
      idleFor(16000);
      wakeUntil = performance.now() + 16000;
      casting = true;
      el.classList.remove('is-casting');
      // Cycle all four distinct effects, including across rapid repeat clicks.
      var index = spellIndex;
      var spell = SPELL_IDS[index];
      spellIndex = (spellIndex + 1) % SPELL_IDS.length;
      state.spell = spell;
      el.dataset.spell = spell;
      spellName.textContent = (index + 1) + ' / ' + SPELL_IDS.length + ' · ' + txt.spells[spell][0];
      spellName.hidden = false;
      message.textContent = txt.spells[spell][1];
      // Restart finite CSS effects on repeat clicks; there are no particle loops.
      void magic.getBoundingClientRect();
      el.classList.add('is-casting');
      if (showPanel !== false) openPanel();
      draw(true);
      global.clearTimeout(castTimer);
      global.clearTimeout(wakeTimer);
      castTimer = global.setTimeout(finishCast, reduced ? 1800 : 3400);
      wakeTimer = global.setTimeout(function () { draw(true); }, 16100);
    }

    function applyStatus(next) {
      if (destroyed) return;
      var oldMood = state.mood;
      state.status = next;
      state.mood = opts.mood || moodFromStatus(next, Date.now() / 1000);
      updateStats();
      if (oldMood !== state.mood && !casting && !panel.hidden) {
        spellName.hidden = true;
        message.textContent = attr('mood-' + state.mood, txt[state.mood]);
      }
      if (!canWander() && motion.mode === 'walk') idleFor();
      draw(true);
    }

    function loadStatus() {
      if (opts.demo || !global.fetch || fetching || destroyed || prefs.collapsed || document.hidden) return;
      fetching = true;
      lastPoll = Date.now();
      fetchController = global.AbortController ? new AbortController() : null;
      var controller = fetchController;
      if (controller) fetchTimeout = global.setTimeout(function () { controller.abort(); }, 8000);
      global.fetch('/guardian/status.json?t=' + Date.now(), {
        cache: 'no-store', signal: controller ? controller.signal : undefined
      }).then(function (res) { return res.ok ? res.json() : null; })
        .then(applyStatus)
        .catch(function () { applyStatus(null); })
        .finally(function () {
          fetching = false;
          fetchController = null;
          global.clearTimeout(fetchTimeout);
        });
    }

    function setCollapsed(collapsed, shouldFocus) {
      if (destroyed) return;
      if (collapsed && !prefs.collapsed) previousPos = { x: pos.x, y: pos.y };
      prefs.collapsed = collapsed;
      closePanel(false);
      finishCast();
      pointer = null;
      el.classList.remove('is-dragging', 'is-falling', 'is-new');
      el.hidden = false;
      pet.hidden = collapsed;
      el.classList.toggle('is-collapsed', collapsed);
      var label = collapsed ? txt.restore : txt.hide;
      toggleBtn.setAttribute('aria-label', label);
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.title = label;
      measure();
      if (collapsed) {
        stop();
      } else {
        pos.x = previousPos ? clamp(previousPos.x, minX(), maxX()) : maxX();
        pos.y = floorY();
        homeX = pos.x;
        idleFor(18000);
        loadArt();
        loadStatus();
        start();
      }
      savePrefs();
      place();
      if (shouldFocus) toggleBtn.focus({ preventScroll: true });
    }

    function onDown(ev) {
      if (!ev.isPrimary || ev.button !== 0 || pointer) return;
      suppressClickUntil = 0; // A new gesture must not inherit the previous drag's click guard.
      pointer = { id: ev.pointerId, startX: ev.clientX, startY: ev.clientY,
        dx: ev.clientX - pos.x, dy: ev.clientY - pos.y, dragging: false };
      idleFor();
      try { btn.setPointerCapture(ev.pointerId); } catch (err) { /* Optional pointer capture. */ }
    }

    function onMove(ev) {
      if (!pointer || ev.pointerId !== pointer.id) return;
      var distance = Math.hypot(ev.clientX - pointer.startX, ev.clientY - pointer.startY);
      if (!pointer.dragging && distance < 6) return;
      if (!pointer.dragging) {
        pointer.dragging = true;
        markSeen();
        closePanel(false);
        finishCast();
        motion.mode = 'drag';
        el.classList.add('is-dragging');
      }
      pos.x = clamp(ev.clientX - pointer.dx, minX(), maxX());
      pos.y = clamp(ev.clientY - pointer.dy, minY(), floorY());
      faceInward();
      place();
      draw(false);
    }

    function onUp(ev) {
      if (!pointer || ev.pointerId !== pointer.id) return;
      var dragged = pointer.dragging;
      pointer = null;
      try { if (btn.hasPointerCapture(ev.pointerId)) btn.releasePointerCapture(ev.pointerId); }
      catch (err) { /* The browser may have released capture already. */ }
      el.classList.remove('is-dragging');
      if (dragged || ev.type === 'pointercancel') suppressClickUntil = performance.now() + 500;
      homeX = pos.x;
      if (dragged && !reduced && pos.y < floorY() - 1) {
        motion.mode = 'fall';
        motion.velocity = 0;
        el.classList.add('is-falling');
      } else {
        pos.y = floorY();
        idleFor(16000);
      }
      place();
      draw(true);
    }

    function onResize() {
      compact = compactQuery.matches;
      measure();
      pos.x = prefs.collapsed ? maxX() : clamp(pos.x, minX(), maxX());
      pos.y = floorY();
      homeX = clamp(homeX, minX(), maxX());
      if (pointer) { pointer = null; suppressClickUntil = performance.now() + 500; }
      el.classList.remove('is-dragging');
      idleFor();
      updateRoamButton();
      el.querySelector('.guardian-help').textContent = compact ? txt.touchHelp : txt.help;
      place();
      draw(true);
    }

    function onMotionPreference() {
      reduced = reduceQuery.matches;
      if (reduced) stop();
      onResize();
      start();
    }

    btn.setAttribute('aria-label', attr('label', txt.label));
    panel.setAttribute('aria-label', txt.name);
    el.querySelector('.guardian-name').textContent = txt.name;
    el.querySelector('.guardian-hint').replaceChildren(document.createTextNode(txt.hint + '  ✧'));
    el.querySelector('.guardian-help').textContent = compact ? txt.touchHelp : txt.help;
    castBtn.replaceChildren(document.createTextNode(txt.cast + '  ✧'));
    closeBtn.setAttribute('aria-label', txt.close);
    closeBtn.title = txt.close;
    updateRoamButton();
    if (ctx) { canvas.width = canvas.height = CELL; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }

    listen(btn, 'pointerdown', onDown);
    listen(global, 'pointermove', onMove, { passive: true });
    listen(global, 'pointerup', onUp);
    listen(global, 'pointercancel', onUp);
    listen(btn, 'lostpointercapture', function (ev) {
      if (pointer && pointer.id === ev.pointerId) onUp(ev);
    });
    listen(btn, 'click', function (ev) {
      if (ev.detail !== 0 && performance.now() < suppressClickUntil) return;
      cast(true);
    });
    listen(castBtn, 'click', function () { cast(true); });
    listen(closeBtn, 'click', function () { closePanel(true); });
    listen(toggleBtn, 'click', function () { markSeen(); setCollapsed(!prefs.collapsed, true); });
    listen(roamBtn, 'click', function () {
      prefs.roam = !prefs.roam;
      savePrefs();
      updateRoamButton();
      idleFor();
    });
    listen(pet, 'pointerenter', function (ev) { if (ev.pointerType !== 'touch') { hovered = true; if (motion.mode === 'walk') idleFor(); } });
    listen(pet, 'pointerleave', function () { hovered = false; motion.pauseUntil = state.clock + 16000; });
    listen(el, 'focusin', function () { focused = true; if (motion.mode === 'walk') idleFor(); });
    listen(el, 'focusout', function (ev) { focused = el.contains(ev.relatedTarget); });
    listen(document, 'pointerdown', function (ev) { if (!el.contains(ev.target)) closePanel(false); }, { passive: true });
    listen(document, 'keydown', function (ev) {
      if (ev.key === 'Escape' && !panel.hidden) closePanel(el.contains(document.activeElement));
    });
    listen(global, 'resize', onResize);
    if (global.visualViewport) {
      listen(global.visualViewport, 'resize', onResize);
      listen(global.visualViewport, 'scroll', onResize);
    }
    listen(reduceQuery, 'change', onMotionPreference);
    listen(document, 'visibilitychange', function () {
      el.classList.toggle('is-paused', document.hidden);
      if (document.hidden) stop();
      else { start(); if (Date.now() - lastPoll > POLL_MS) loadStatus(); }
    });

    var api = {
      setStatus: applyStatus, paint: function () { draw(true); place(); },
      cast: cast, hide: function () { setCollapsed(true, false); },
      show: function () { setCollapsed(false, false); },
      state: state, pos: pos, motion: motion,
      destroy: function () {
        destroyed = true;
        stop();
        [castTimer, wakeTimer, introTimer, fetchTimeout].forEach(global.clearTimeout.bind(global));
        global.clearInterval(pollTimer);
        if (fetchController) fetchController.abort();
        disposers.forEach(function (dispose) { dispose(); });
        mounted.delete(el);
        el.hidden = true;
      }
    };
    mounted.set(el, api);
    applyStatus(opts.status || null);
    setCollapsed(prefs.collapsed, false);
    pollTimer = global.setInterval(function () { loadStatus(); }, POLL_MS);
    return api;
  }

  function autoMount() {
    document.querySelectorAll('[data-guardian]:not([data-demo])').forEach(function (el) { mount(el); });
  }

  global.Guardian = { mount: mount, moodFromStatus: moodFromStatus };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, { once: true });
  else autoMount();
})(window);
