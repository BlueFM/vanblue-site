/* Moonlit Grimoire: optional navigation and three visitor-triggered discoveries. */
(function (window, document) {
  'use strict';

  if (window.Grimoire && typeof window.Grimoire.destroy === 'function') {
    window.Grimoire.destroy();
  }

  var STORAGE_KEY = 'vanblue:grimoire:v1';
  var EGG_IDS = ['exlibris', 'margin-note', 'starlight'];
  var NOTES = [
    'Small steps, steady gradients.',
    'A cup of tea makes room for a question.',
    'Curiosity is welcome in the margins.',
    'Even a wandering thought may find a path.',
    'One gentle step, then another.'
  ];
  var instance = null;
  var readyHandler = null;

  function readFound() {
    var found = new Set();
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) {
        saved.forEach(function (id) {
          if (EGG_IDS.indexOf(id) !== -1) found.add(id);
        });
      }
    } catch (_) {
      // Discoveries still work when storage is unavailable or malformed.
    }
    return found;
  }

  function restoreAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  function removeReadyHandler() {
    if (!readyHandler) return;
    document.removeEventListener('DOMContentLoaded', readyHandler);
    readyHandler = null;
  }

  function destroy() {
    removeReadyHandler();
    if (instance) {
      var previous = instance;
      instance = null;
      previous.dispose();
    }
    return api;
  }

  function init() {
    destroy();
    if (document.readyState === 'loading') {
      readyHandler = function () {
        readyHandler = null;
        init();
      };
      document.addEventListener('DOMContentLoaded', readyHandler, { once: true });
      return api;
    }

    var active = true;
    var cleanups = [];
    var timers = new Set();
    var found = readFound();
    var awakeTimers = new Map();
    var awakeSnapshots = new Map();
    var noteSnapshots = new Map();
    var sparks = [];
    var starTimer = null;
    var statusTimer = null;
    var typed = '';

    var toggle = document.querySelector('.book-nav-toggle');
    var navigation = document.getElementById('site-navigation');
    var status = document.getElementById('grimoire-status');
    var starfall = document.querySelector('.starfall');
    var mobileQuery = window.matchMedia ? window.matchMedia('(max-width: 840px)') : null;
    var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var navSnapshot = toggle && navigation ? {
      toggleHidden: toggle.getAttribute('hidden'),
      navHidden: navigation.getAttribute('hidden'),
      expanded: toggle.getAttribute('aria-expanded'),
      controls: toggle.getAttribute('aria-controls')
    } : null;
    var statusSnapshot = status ? {
      children: Array.prototype.slice.call(status.childNodes),
      visible: status.classList.contains('is-visible'),
      role: status.getAttribute('role'),
      live: status.getAttribute('aria-live'),
      atomic: status.getAttribute('aria-atomic')
    } : null;
    var starSnapshot = starfall ? {
      lit: starfall.classList.contains('is-lit'),
      ariaHidden: starfall.getAttribute('aria-hidden')
    } : null;

    function listen(target, type, handler) {
      target.addEventListener(type, handler);
      cleanups.push(function () { target.removeEventListener(type, handler); });
    }

    function listenMedia(query, handler) {
      if (!query) return;
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handler);
        cleanups.push(function () { query.removeEventListener('change', handler); });
      } else if (typeof query.addListener === 'function') {
        query.addListener(handler);
        cleanups.push(function () { query.removeListener(handler); });
      }
    }

    function later(handler, delay) {
      var id = window.setTimeout(function () {
        timers.delete(id);
        if (active) handler();
      }, delay);
      timers.add(id);
      return id;
    }

    function cancel(id) {
      if (id === null) return;
      window.clearTimeout(id);
      timers.delete(id);
    }

    function isMobile() {
      return !!(mobileQuery && mobileQuery.matches);
    }

    function reducedMotion() {
      return !!(motionQuery && motionQuery.matches);
    }

    function setNavigation(open) {
      if (!navSnapshot) return;
      var mobile = isMobile();
      navigation.hidden = mobile && !open;
      toggle.hidden = !mobile;
      toggle.setAttribute('aria-expanded', navigation.hidden ? 'false' : 'true');
    }

    function resetNavigation() {
      // Breakpoint changes never move focus, including when hiding an open menu.
      setNavigation(false);
    }

    function recordFound(id) {
      if (found.has(id)) return;
      found.add(id);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(found).sort()));
      } catch (_) {
        // No other preferences, identifiers or visitor information are stored.
      }
    }

    function clearStatus() {
      cancel(statusTimer);
      statusTimer = null;
      if (!status) return;
      status.classList.remove('is-visible');
      status.textContent = '';
    }

    function announce(message) {
      if (!status || document.hidden) return;
      cancel(statusTimer);
      status.textContent = message;
      status.classList.add('is-visible');
      statusTimer = later(function () {
        statusTimer = null;
        status.classList.remove('is-visible');
        status.textContent = '';
      }, 2800);
    }

    function clearAwake() {
      awakeTimers.forEach(function (timer, element) {
        cancel(timer);
        element.classList.remove('is-awake');
      });
      awakeTimers.clear();
    }

    function awaken(button) {
      if (document.hidden) return;
      var bookplate = button.closest('.exlibris');
      if (bookplate && !reducedMotion()) {
        if (!awakeSnapshots.has(bookplate)) {
          awakeSnapshots.set(bookplate, bookplate.classList.contains('is-awake'));
        }
        if (awakeTimers.has(bookplate)) cancel(awakeTimers.get(bookplate));
        bookplate.classList.add('is-awake');
        awakeTimers.set(bookplate, later(function () {
          bookplate.classList.remove('is-awake');
          awakeTimers.delete(bookplate);
        }, 2600));
      }
      recordFound('exlibris');
      announce('Constellation found: curiosity.');
    }

    function turnNote(button) {
      if (document.hidden) return;
      var note = button.closest('.margin-note');
      var text = note && note.querySelector('.margin-note-text');
      if (!text) return;
      if (!noteSnapshots.has(text)) {
        var initialIndex = NOTES.indexOf(text.textContent.trim());
        noteSnapshots.set(text, {
          children: Array.prototype.slice.call(text.childNodes),
          index: initialIndex === -1 ? 0 : initialIndex
        });
      }
      var snapshot = noteSnapshots.get(text);
      snapshot.index = (snapshot.index + 1) % NOTES.length;
      text.textContent = NOTES[snapshot.index];
      recordFound('margin-note');
      announce(NOTES[snapshot.index]);
    }

    function clearStarfall() {
      cancel(starTimer);
      starTimer = null;
      if (starfall) starfall.classList.remove('is-lit');
      sparks.forEach(function (spark) { spark.remove(); });
      sparks = [];
    }

    function lightStarlight() {
      if (document.hidden) return;
      clearStarfall();
      recordFound('starlight');
      announce('A little starlight for the next question.');
      // The live message is the static alternative; reduced motion adds no effect.
      if (!starfall || reducedMotion()) return;

      var fragment = document.createDocumentFragment();
      for (var i = 0; i < 9; i++) {
        var spark = document.createElement('span');
        spark.className = 'starfall__spark';
        spark.setAttribute('aria-hidden', 'true');
        spark.textContent = i % 2 ? '\u2727' : '\u2726';
        spark.style.setProperty('--spark-x', (8 + Math.random() * 84).toFixed(2) + 'vw');
        spark.style.setProperty('--spark-y', (12 + Math.random() * 72).toFixed(2) + 'vh');
        spark.style.setProperty('--spark-delay', Math.round(Math.random() * 240) + 'ms');
        spark.style.setProperty('--spark-turn', Math.round(Math.random() * 90 - 45) + 'deg');
        sparks.push(spark);
        fragment.appendChild(spark);
      }
      starfall.appendChild(fragment);
      starfall.classList.add('is-lit');
      starTimer = later(function () {
        starTimer = null;
        clearStarfall();
      }, 2600);
    }

    function clearTyping() {
      typed = '';
    }

    function clearTransient() {
      clearAwake();
      clearStarfall();
      clearStatus();
      clearTyping();
      timers.forEach(function (id) { window.clearTimeout(id); });
      timers.clear();
    }

    function isEditableEvent(event) {
      var path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      return path.some(function (element) {
        return element && element.nodeType === 1 && (
          element.isContentEditable ||
          element.closest('input, textarea, select, [role~="textbox"], [contenteditable]:not([contenteditable="false"])')
        );
      });
    }

    function onKeyDown(event) {
      if (event.defaultPrevented) {
        clearTyping();
        return;
      }
      if (event.key === 'Escape' && navSnapshot && isMobile() && !navigation.hidden) {
        setNavigation(false);
        event.preventDefault();
        toggle.focus({ preventScroll: true });
        clearTyping();
        return;
      }
      if (document.hidden || event.isComposing || event.repeat || event.altKey || event.ctrlKey ||
          event.metaKey || event.shiftKey || isEditableEvent(event) || !event.key || event.key.length !== 1) {
        clearTyping();
        return;
      }
      var key = event.key.toLowerCase();
      var next = typed + key;
      typed = 'lumos'.indexOf(next) === 0 ? next : (key === 'l' ? 'l' : '');
      if (typed === 'lumos') {
        clearTyping();
        lightStarlight();
      }
    }

    function onClick(event) {
      var target = event.target;
      if (target && target.nodeType !== 1) target = target.parentElement;
      if (!target || typeof target.closest !== 'function') return;

      if (navSnapshot && isMobile() && !navigation.hidden) {
        var link = target.closest('a[href]');
        if ((!navigation.contains(target) && !toggle.contains(target)) ||
            (link && navigation.contains(link))) setNavigation(false);
      }
      if (event.defaultPrevented) return;

      var seal = target.closest('.exlibris-seal button, button.exlibris-seal');
      if (seal && !seal.disabled) {
        awaken(seal);
        return;
      }
      var noteButton = target.closest('.margin-note button, button.margin-note');
      if (noteButton && !noteButton.disabled) {
        turnNote(noteButton);
        return;
      }
      var lightButton = target.closest('button[data-starlight], [data-starlight] button');
      if (lightButton && !lightButton.disabled) lightStarlight();
    }

    if (navSnapshot) {
      toggle.setAttribute('aria-controls', 'site-navigation');
      listen(toggle, 'click', function () {
        if (isMobile()) setNavigation(navigation.hidden);
      });
      listenMedia(mobileQuery, resetNavigation);
      resetNavigation();
    }
    if (status) {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
    }
    if (starfall) starfall.setAttribute('aria-hidden', 'true');
    listen(document, 'click', onClick);
    listen(document, 'keydown', onKeyDown);
    listen(document, 'visibilitychange', function () {
      if (document.hidden) clearTransient();
    });
    listenMedia(motionQuery, function () {
      if (reducedMotion()) {
        clearAwake();
        clearStarfall();
      }
    });

    instance = {
      dispose: function () {
        active = false;
        cleanups.forEach(function (cleanup) { cleanup(); });
        clearTransient();
        if (navSnapshot) {
          restoreAttribute(toggle, 'hidden', navSnapshot.toggleHidden);
          restoreAttribute(navigation, 'hidden', navSnapshot.navHidden);
          restoreAttribute(toggle, 'aria-expanded', navSnapshot.expanded);
          restoreAttribute(toggle, 'aria-controls', navSnapshot.controls);
        }
        awakeSnapshots.forEach(function (wasAwake, element) {
          element.classList.toggle('is-awake', wasAwake);
        });
        noteSnapshots.forEach(function (snapshot, text) {
          text.replaceChildren.apply(text, snapshot.children);
        });
        if (statusSnapshot) {
          status.replaceChildren.apply(status, statusSnapshot.children);
          status.classList.toggle('is-visible', statusSnapshot.visible);
          restoreAttribute(status, 'role', statusSnapshot.role);
          restoreAttribute(status, 'aria-live', statusSnapshot.live);
          restoreAttribute(status, 'aria-atomic', statusSnapshot.atomic);
        }
        if (starSnapshot) {
          starfall.classList.toggle('is-lit', starSnapshot.lit);
          restoreAttribute(starfall, 'aria-hidden', starSnapshot.ariaHidden);
        }
      }
    };
    return api;
  }

  var api = { init: init, destroy: destroy };
  window.Grimoire = api;
  init();
})(window, document);
