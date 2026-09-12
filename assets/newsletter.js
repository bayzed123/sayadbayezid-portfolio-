/* ===========================================================================
   The newsletter section, and the popup.

   THE POPUP IS THE PART THAT NEEDS JUSTIFYING. An interstitial that covers the
   page is one of the most disliked things on the web, and Google penalises
   intrusive ones on mobile. So this one:

     - never shows on a first visit until the visitor has read something:
       either 45 % of the page scrolled, or 25 seconds spent;
     - never shows to someone already subscribed;
     - never shows again for 45 days after being dismissed, or ever again
       after someone subscribes;
     - never shows twice in one visit;
     - never shows while the visitor is typing in the inline form — being
       interrupted mid-signup by a box asking you to sign up is absurd;
     - never shows on exit-intent on touch devices, where "moving the pointer
       to the top of the screen" is not a thing and the heuristic misfires.

   All of that state is per-browser in localStorage. It is a convenience, not a
   record: if storage throws — private windows, cleared site data — the popup
   simply does not show. Failing closed is right for something that interrupts.
   =========================================================================== */
(function () {
  'use strict';

  var API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
  var KEY_DONE = 'nl_subscribed';
  var KEY_SNOOZE = 'nl_snooze_until';
  var SNOOZE_DAYS = 45;
  var SCROLL_TRIGGER = 0.45;
  var TIME_TRIGGER_MS = 25000;

  function store(op, key, value) {
    try {
      if (op === 'get') return localStorage.getItem(key);
      if (op === 'set') localStorage.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  function subscribed() { return store('get', KEY_DONE) === '1'; }
  function snoozed() {
    var until = Number(store('get', KEY_SNOOZE) || 0);
    return until > Date.now();
  }

  // --- shared submit -------------------------------------------------------
  function banner(node, kind, text) {
    node.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'nl-banner nl-banner-' + kind;
    div.textContent = text; // textContent — a server message is never markup
    node.appendChild(div);
  }

  function subscribe(email, source, bannerNode, button) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      banner(bannerNode, 'warn', "That email address doesn't look right.");
      return Promise.resolve(false);
    }
    var original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Joining…';
    return fetch(API + '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, source: source }),
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { banner(bannerNode, 'warn', res.d.error || 'That did not go through. Try again shortly.'); return false; }
        store('set', KEY_DONE, '1');
        banner(bannerNode, 'ok', "You're on the list. Nothing will arrive until it is worth sending.");
        if (window.fbq) window.fbq('track', 'Lead', { content_name: 'Newsletter · ' + source });
        return true;
      })
      .catch(function () {
        banner(bannerNode, 'warn', "Couldn't reach the server. Check your connection and try again.");
        return false;
      })
      .finally(function () { button.disabled = false; button.innerHTML = original; });
  }

  // --- the inline section --------------------------------------------------
  var form = document.getElementById('newsForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      subscribe(
        document.getElementById('newsEmail').value.trim(),
        'homepage-section',
        document.getElementById('newsBanner'),
        document.getElementById('newsSubmit')
      ).then(function (ok) { if (ok) form.reset(); });
    });
  }

  // --- the popup -----------------------------------------------------------
  var pop = document.getElementById('newsPop');
  if (!pop) return;

  var shown = false;
  var typing = false;

  // Someone filling in the inline form must never be interrupted by a popup
  // asking them to do the thing they are already doing.
  var inlineEmail = document.getElementById('newsEmail');
  if (inlineEmail) {
    inlineEmail.addEventListener('focus', function () { typing = true; });
    inlineEmail.addEventListener('blur', function () {
      setTimeout(function () { typing = false; }, 4000);
    });
  }

  function open() {
    if (shown || typing || subscribed() || snoozed()) return;
    shown = true;
    pop.hidden = false;
    document.body.style.overflow = 'hidden';
    teardown();
    var field = document.getElementById('npEmail');
    if (field) setTimeout(function () { field.focus(); }, 80);
    if (window.fbq) window.fbq('trackCustom', 'NewsletterPopupShown');
  }

  function close(snooze) {
    pop.hidden = true;
    document.body.style.overflow = '';
    if (snooze) store('set', KEY_SNOOZE, String(Date.now() + SNOOZE_DAYS * 864e5));
  }

  pop.querySelectorAll('[data-np-close]').forEach(function (el) {
    el.addEventListener('click', function () { close(true); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !pop.hidden) close(true);
  });

  document.getElementById('npForm').addEventListener('submit', function (e) {
    e.preventDefault();
    subscribe(
      document.getElementById('npEmail').value.trim(),
      'homepage-popup',
      document.getElementById('npBanner'),
      document.getElementById('npSubmit')
    ).then(function (ok) { if (ok) setTimeout(function () { close(false); }, 2200); });
  });

  // --- when it opens -------------------------------------------------------
  if (subscribed() || snoozed()) return; // nothing to arm at all

  var scrolled = function () {
    var max = document.body.scrollHeight - window.innerHeight;
    if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) open();
  };
  var timer = setTimeout(open, TIME_TRIGGER_MS);

  // Exit intent, pointer devices only. On a touchscreen the pointer leaving
  // the top of the window means nothing, and firing on it is how a popup ends
  // up ambushing someone who just scrolled.
  var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var onLeave = function (e) { if (e.clientY <= 0) open(); };

  window.addEventListener('scroll', scrolled, { passive: true });
  if (canHover) document.addEventListener('mouseout', onLeave);

  function teardown() {
    clearTimeout(timer);
    window.removeEventListener('scroll', scrolled, { passive: true });
    document.removeEventListener('mouseout', onLeave);
  }
})();
