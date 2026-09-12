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

  // Queue the events themselves now, at real page-load time, so the timestamps
  // and ordering are right even though the libraries arrive later.
  window.gtag('js', new Date());
  window.gtag('config', GA4_ID);
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');

  var started = false;

  function inject(src, attrs) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
  }

  function load() {
    if (started) return;
    started = true;
    teardown();

    // GTM's own snippet, minus the stub work already done above.
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    inject('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID);
    inject('https://www.googletagmanager.com/gtag/js?id=' + GA4_ID);
    inject('https://connect.facebook.net/en_US/fbevents.js');
  }

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
