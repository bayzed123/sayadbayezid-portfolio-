/* ===========================================================================
   Third-party tags, loaded late on purpose.

   WHY THIS FILE EXISTS.
   Google Tag Manager, gtag and the Meta Pixel were three inline blocks in the
   <head> of every page. Between them they cost, measured on the live site:

     Facebook  644 ms of long tasks, 244 KiB
     GTM/gtag  408 ms of long tasks, 280 KiB

   against a Total Blocking Time of 620 ms. They are the performance score.
   Nothing in them paints a pixel or answers a visitor's question — they are
   measurement, and measurement can wait a second and a half.

   WHEN THEY LOAD.
   The first of these to happen:
     - the visitor touches, scrolls, taps a key or moves a pointer, or
     - the browser goes idle, or
     - 3 seconds pass.

   The timeout is the important one. Interaction-only loading is the common
   advice and it quietly loses every visitor who reads the page and leaves
   without touching it — which on a phone is a lot of them. With the timeout,
   the tags always load; they just load after the page has painted, so they
   are no longer competing with it.

   WHAT THIS COSTS.
   Events are recorded a second or two later than before. Meta and GA both
   timestamp on receipt, so a PageView is still a PageView. What it would cost
   is a visitor who leaves in under three seconds AND never interacts — rare,
   and cheaper than a page that loads slowly for everyone.

   dataLayer and fbq are stubbed immediately, so code that pushes an event
   before the real libraries arrive is queued rather than lost.
   =========================================================================== */
(function () {
  'use strict';

  var GTM_ID = 'GTM-WN9DK67S';
  var GA4_ID = 'G-HY9255GJYE';
  var PIXEL_ID = '1612338809888151';
  var MAX_WAIT_MS = 3000;

  var API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
  /* The Pixel library, served from our own backend rather than
     connect.facebook.net — see /api/pixel.js. Every mainstream blocklist has
     an entry for that hostname, and when it matches, fbq() stays a stub and
     the browser half of every event is gone with no error anywhere. */
  var PIXEL_SRC = API + '/api/pixel.js';
  /* If our proxy is down, Meta's own copy is better than no Pixel at all.
     A blocked fallback is the situation we were already in. */
  var PIXEL_FALLBACK = 'https://connect.facebook.net/en_US/fbevents.js';

  /* ----------------------------------------------------------------------
     The way out.

     Measurement on this site runs on arrival — there is no banner gating it,
     and there never has been. That is only defensible with a real way to stop
     it, so this is it: any URL on this site ending #stop-tracking, a link with
     that href anywhere (the privacy policy has one), or bzTags.optOut().

     It is checked FIRST, before a single stub is installed, because a visitor
     who has opted out should get a page with no tracking apparatus on it at
     all — not one where the apparatus exists and is politely asked not to
     fire.

     Remembered with no expiry. Asking again in six months is how a refusal
     gets worn down.
     ---------------------------------------------------------------------- */
  var OPTOUT_KEY = 'cwb.optout.v1';

  function optedOut() {
    try { return localStorage.getItem(OPTOUT_KEY) === '1'; } catch (e) { return false; }
  }

  function confirmOptOut() {
    var note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.id = 'cwb-optout-note';
    note.textContent = 'Measurement is off for this browser. Nothing more is sent.';
    note.style.cssText =
      'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;' +
      'background:#111;color:#fff;border-radius:10px;padding:11px 18px;' +
      'font:500 14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100% - 32px);text-align:center';
    document.body.appendChild(note);
    setTimeout(function () { if (note.parentNode) note.parentNode.removeChild(note); }, 6000);
  }

  function optOut() {
    try { localStorage.setItem(OPTOUT_KEY, '1'); } catch (e) { /* nothing to remember it with */ }
    try {
      // Remove the libraries, not just the flag: a script element left in the
      // page means the next fbq() or gtag() call from anywhere still reaches
      // out, and the flag would be a promise this file cannot keep.
      var scripts = document.querySelectorAll(
        'script[src*="fbevents.js"],script[src*="/api/pixel.js"],script[src*="googletagmanager.com"]');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].parentNode) scripts[i].parentNode.removeChild(scripts[i]);
      }
      // Left callable so unrelated code does not throw; they simply do nothing.
      window.fbq = function () {}; window.fbq.queue = [];
      window.gtag = function () {};
    } catch (e) { /* a page that will not let us tidy up is still opted out */ }
    return true;
  }

  /** Wired even when opted out, so the link still works and still confirms. */
  function wireOptOut() {
    function viaHash() {
      if (location.hash !== '#stop-tracking') return;
      optOut();
      confirmOptOut();
      if (window.history && history.replaceState) {
        // So a shared link does not silently opt out whoever opens it.
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', viaHash);
    } else { viaHash(); }
    window.addEventListener('hashchange', viaHash);
    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href$="#stop-tracking"]') : null;
      if (!link) return;
      event.preventDefault();
      optOut();
      confirmOptOut();
    }, true);
  }

  window.bzTags = { optOut: optOut, optedOut: optedOut };
  wireOptOut();

  // Nothing below this line runs for someone who asked not to be measured: no
  // stub, no queued event, no library, no server call.
  if (optedOut()) return;

  // Stubs first, so anything firing an event before the libraries land is
  // queued instead of throwing or vanishing.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  if (typeof window.fbq !== 'function') {
    var stub = function () {
      stub.callMethod ? stub.callMethod.apply(stub, arguments) : stub.queue.push(arguments);
    };
    stub.queue = [];
    stub.loaded = true;
    stub.version = '2.0';
    stub.push = stub;
    window.fbq = stub;
    window._fbq = stub;
  }

  /* ----------------------------------------------------------------------
     Deduplication.

     Every Meta event is sent twice on purpose: once here by fbq(), once by the
     Worker through the Conversions API. Both carry the SAME event_id, which is
     the whole mechanism — Meta collapses the pair into one conversion. Without
     it each purchase is counted twice, the reported cost per purchase is half
     the real number, and every bid decision made from it is wrong in the
     direction that costs money.

     The reason for sending twice at all is that the two halves fail
     independently: an ad-blocker stops fbq(), a Meta outage stops the server
     call, and a visitor who leaves in two seconds stops neither if the server
     half has already gone.
     ---------------------------------------------------------------------- */

  function newEventId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    // Not a UUID and it does not need to be. The only requirement is that the
    // browser and server halves of ONE event agree, and that two events do not
    // collide — which would make Meta drop the second as a duplicate.
    return 'e' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function readCookie(name) {
    var parts = ('; ' + document.cookie).split('; ' + name + '=');
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }

  /* Whether fbevents.js is actually running, as opposed to our stub pretending
     to be it. The real library defines callMethod; the stub deliberately does
     not, so that events fired before it arrives are queued instead of lost.
     That difference is what makes this a usable signal. */
  function pixelIsLive() {
    return typeof window.fbq === 'function' && typeof window.fbq.callMethod === 'function';
  }

  /* The server half. Never throws into the page: a measurement failure must
     not be visible to a visitor, and must not break the page it is measuring. */
  function sendServerCopy(eventName, eventId, customData) {
    try {
      fetch(API + '/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        /* The request may outlive the page — a click on an outbound link is
           exactly when an event matters most. keepalive lets it finish. */
        keepalive: true,
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          event_source_url: location.href,
          custom_data: customData || {},
          user_data: { fbp: readCookie('_fbp'), fbc: readCookie('_fbc') },
          browser_fired: pixelIsLive(),
          source: 'browser'
        })
      }).then(function (r) { return r.json(); }).then(function (data) {
        /* If fbevents.js never loaded there is no _fbp on this domain, and
           every event this visit would otherwise look like a different person.
           The Worker hands back the identifier it used; keeping it means the
           rest of the visit is at least internally consistent.
           Safari will cap this at seven days because JavaScript wrote it —
           which is precisely what the Worker's own Set-Cookie avoids, once the
           Worker answers on this domain. */
        if (data && data.fbp && !readCookie('_fbp')) {
          document.cookie = '_fbp=' + data.fbp + ';path=/;max-age=63072000;samesite=lax;secure';
        }
      }).catch(function () {});
    } catch (e) { /* no fetch, or a CSP that blocks it */ }
  }

  /* Both halves of one event, with one id. The only function that should be
     used to send anything from this file. */
  function track(eventName, customData) {
    var eventId = newEventId();
    try { window.fbq('track', eventName, customData || {}, { eventID: eventId }); } catch (e) {}
    sendServerCopy(eventName, eventId, customData);
  }

  // Queue the events themselves now, at real page-load time, so the timestamps
  // and ordering are right even though the libraries arrive later.
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
  window.fbq('init', PIXEL_ID);

  /* The browser half of PageView is queued at once — real page-load time, and
     it survives in the stub's queue until the library lands. The SERVER half
     waits, because browser_fired cannot be answered until the library has
     either loaded or failed, and reporting "unknown" for every page view would
     make the mismatch report useless on the one event that matters most. */
  var pageViewId = newEventId();
  window.fbq('track', 'PageView', {}, { eventID: pageViewId });

  var started = false;
  var pageViewSent = false;

  function sendPageView() {
    if (pageViewSent) return;
    pageViewSent = true;
    sendServerCopy('PageView', pageViewId, {});
  }

  function inject(src, attrs, onload, onerror) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    if (onload) s.onload = onload;
    if (onerror) s.onerror = onerror;
    document.head.appendChild(s);
  }

  /* Events configured in the dashboard for this path, rather than written
     here. Asked for once per page load, after the tags are already loading, so
     it never competes with the page itself. */
  function fireConfiguredEvents() {
    try {
      fetch(API + '/api/meta/rules?path=' + encodeURIComponent(location.pathname))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          (data && data.events ? data.events : []).forEach(function (name) {
            // PageView is already sent above. A rule that repeats it would
            // double it, and Meta would count two page views for one page.
            if (name !== 'PageView') track(name, {});
          });
        })
        .catch(function () {});
    } catch (e) {}
  }

  function load() {
    if (started) return;
    started = true;
    teardown();

    // GTM's own snippet, minus the stub work already done above.
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    inject('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
    inject('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);

    inject(PIXEL_SRC, null, function () {
      // Loaded from our own origin. fbq() is real; the queued PageView drains.
      sendPageView();
      fireConfiguredEvents();
    }, function () {
      // Our proxy failed. Try Meta's own copy before giving up on the browser
      // half — and either way, send the server half, which is the one that
      // survives a blocker.
      inject(PIXEL_FALLBACK, null, function () {
        sendPageView();
        fireConfiguredEvents();
      }, function () {
        sendPageView();
        fireConfiguredEvents();
      });
    });
  }

  /* The safety net, and the reason the coverage is better than it was.
     If the visitor leaves before the tags load — a bounce, a back button, two
     seconds on a phone — nothing above has fired yet. This sends the server
     half on the way out, with browser_fired reporting the truth: false,
     because the Pixel never got the chance.

     pagehide rather than unload: unload is ignored by browsers that keep the
     page in the back/forward cache, which is most of them now. */
  window.addEventListener('pagehide', sendPageView);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendPageView();
  });

  var EVENTS = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'mousemove'];
  function teardown() {
    EVENTS.forEach(function (e) { window.removeEventListener(e, load, { passive: true }); });
  }
  EVENTS.forEach(function (e) { window.addEventListener(e, load, { passive: true, once: true }); });

  /* A plain timer, deliberately NOT requestIdleCallback.
     The first version used requestIdleCallback with this as its timeout, which
     looked more considerate and did the opposite: a page that has finished
     painting IS idle, so the callback fired immediately after load and the tags
     went straight back onto the critical path. A test caught it asking for all
     three within 400 ms.
     What is wanted is a MINIMUM delay, not "as soon as convenient" — the point
     is to be outside the window where the page is still becoming interactive.
     So: whichever comes first, a real interaction or this timer. */
  setTimeout(load, MAX_WAIT_MS);
})();
