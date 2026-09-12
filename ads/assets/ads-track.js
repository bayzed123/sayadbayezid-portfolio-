/* ===========================================================================
   Tracking for every page in the ad funnel.

   WHY THIS IS A SHARED FILE AND NOT COPIED INTO EACH PAGE.
   An ad funnel is not one page. Someone lands on the offer, opens the demo
   hub, reads the privacy policy, comes back and orders. If only the landing
   page reports events, the three pages in the middle are invisible — you
   cannot retarget the people who browsed the demos and left, which is the
   warmest audience the funnel produces. Every page a visitor can reach from
   an ad loads this file, so the whole path is measured, not just the door.

   Include it on any page like this:

     <script src="/ads/assets/ads-track.js" defer></script>

   It is safe on pages that already carry the site Pixel: it never
   re-initialises a pixel that is already running.

   HOW EVENTS ARE REPORTED.
   Every standard event fires twice on purpose: once in the browser via fbq(),
   once server-side through the Conversions API worker, both carrying the SAME
   event_id so Meta collapses them into one event instead of counting two.
   The browser copy is what ad-blockers and iOS tracking prevention remove.
   The server copy is the one that survives them — and on Bangladeshi mobile
   traffic that is a large share of everything.
   =========================================================================== */
(function () {
  'use strict';

  var PIXEL_ID = '1612338809888151';
  var CAPI_ENDPOINT = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/track';
  var CONTACT_ENDPOINT = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/contact';

  // --- Pixel bootstrap, but only if nothing started one already -------------
  if (typeof window.fbq !== 'function') {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
    (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
    window.__adsPixelBootstrapped = true;
  }

  function cookie(name) {
    var hit = document.cookie.split('; ').filter(function (row) {
      return row.indexOf(name + '=') === 0;
    })[0];
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
  }

  /* fbc is the click identifier that ties a conversion back to the exact ad
     click. The Pixel writes it to a cookie — but only once it has loaded, and
     it is the most commonly blocked script on any page. Building it from the
     fbclid in the URL, in Meta's documented fb.1.<ts>.<fbclid> shape, is the
     single biggest match-quality win available on paid traffic, and it costs
     nothing. Stored, because fbclid is only on the URL of the first page. */
  function resolveFbc() {
    var fromCookie = cookie('_fbc');
    if (fromCookie) return fromCookie;
    var stored = store.get('fbc');
    if (stored) return stored;
    var fbclid = new URLSearchParams(location.search).get('fbclid');
    if (!fbclid) return null;
    var built = 'fb.1.' + Date.now() + '.' + fbclid;
    store.set('fbc', built);
    return built;
  }

  /* Storage is wrapped because it throws outright in a locked-down browser,
     and a tracking failure must never take the page down with it. */
  var store = {
    get: function (key) {
      try { return sessionStorage.getItem('ads_' + key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { sessionStorage.setItem('ads_' + key, value); } catch (e) { /* ignore */ }
    },
  };

  // --- campaign attribution, captured once and kept for the visit ----------
  var ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'placement', 'fbclid'];

  function captureAttribution() {
    var params = new URLSearchParams(location.search);
    var found = {};
    ATTRIBUTION_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) found[k] = v.slice(0, 120);
    });
    if (Object.keys(found).length) {
      store.set('attribution', JSON.stringify(found));
      return found;
    }
    try { return JSON.parse(store.get('attribution') || '{}'); } catch (e) { return {}; }
  }

  var attribution = captureAttribution();

  function attributionLine() {
    var keys = Object.keys(attribution);
    if (!keys.length) return 'direct / no campaign parameters';
    return keys.map(function (k) { return k + '=' + attribution[k]; }).join(' · ');
  }

  // --- the one way an event is reported ------------------------------------
  function fire(eventName, options) {
    options = options || {};
    var customData = options.customData || {};
    var eventId = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : String(Date.now()) + '-' + Math.random().toString(16).slice(2);

    if (typeof window.fbq === 'function') {
      if (options.custom) window.fbq('trackCustom', eventName, customData);
      else window.fbq('track', eventName, customData, { eventID: eventId });
    }

    // Custom, exploratory events stay in the browser. Only the standard events
    // that delivery is optimised against are worth the server round trip.
    if (options.custom) return;

    var userData = {};
    var fbp = cookie('_fbp');
    var fbc = resolveFbc();
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;
    /* Email and phone travel in plain text over HTTPS to our own Worker, which
       normalises and SHA-256 hashes them before anything goes to Meta. Meta
       never receives, and cannot receive, the raw value. */
    if (options.contact) {
      if (options.contact.em) userData.em = options.contact.em;
      if (options.contact.ph) userData.ph = options.contact.ph;
    }

    try {
      fetch(CAPI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          event_source_url: window.location.href,
          custom_data: customData,
          user_data: userData,
        }),
        keepalive: true, // survives the click that navigates away
      }).catch(function () { /* a failed echo must never break the page */ });
    } catch (e) { /* ignore */ }
  }

  /* --- ViewContent: a dwell, not a percentage --------------------------
     Gating this on "50% of the section visible" quietly never fires on a
     phone, because one column makes most sections taller than the viewport —
     so the event goes silent on exactly the devices the traffic arrives on.
     Any visibility plus a dwell works at every viewport height, and still
     ignores someone flicking past. */
  function watchDwell(el, ms, onSeen) {
    if (!el || !('IntersectionObserver' in window)) return;
    var timer = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (timer === null) timer = setTimeout(function () { io.disconnect(); onSeen(); }, ms);
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      });
    }, { threshold: 0 });
    io.observe(el);
  }

  // --- auto-wiring, so a new page needs no new JavaScript ------------------
  var WIRED = 'data-ads-wired';

  function wire() {
    /* Callable again after content arrives from the dashboard, which adds
       links and buttons long after this script first ran. Each element is
       marked once — wiring the same node twice would report every click
       twice, and a doubled ContactIntent is a doubled funnel. */
    /* Every order button on every page: <a data-order="hero">. The name is
       whatever you want to read in reporting later — it identifies which
       button on which page people actually press. */
    document.querySelectorAll('[data-order]').forEach(function (el) {
      if (el.hasAttribute(WIRED)) return;
      el.setAttribute(WIRED, '');
      el.addEventListener('click', function () {
        fire('ContactIntent', {
          custom: true,
          customData: {
            content_name: el.getAttribute('data-order-item') || document.title,
            placement: el.getAttribute('data-order'),
            page: location.pathname,
          },
        });
      });
    });

    /* <section data-view-content="Pricing"> reports itself once the visitor
       has genuinely stopped on it. */
    document.querySelectorAll('[data-view-content]').forEach(function (el) {
      if (el.hasAttribute(WIRED)) return;
      el.setAttribute(WIRED, '');
      watchDwell(el, 1200, function () {
        fire('ViewContent', {
          customData: {
            content_name: el.getAttribute('data-view-content'),
            content_category: el.getAttribute('data-view-category') || 'Ecommerce build',
          },
        });
      });
    });

    /* <a data-demo="Fashion store"> — opening a demo is a real interest
       signal, and it is the thing the retargeting audience is built from. */
    document.querySelectorAll('[data-demo]').forEach(function (el) {
      if (el.hasAttribute(WIRED)) return;
      el.setAttribute(WIRED, '');
      el.addEventListener('click', function () {
        fire('ViewContent', {
          customData: { content_name: el.getAttribute('data-demo'), content_category: 'Demo' },
        });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  // --- what pages may use --------------------------------------------------
  window.AdsTrack = {
    fire: fire,
    /* Re-run after injecting content, so links that did not exist at load
       are tracked like the ones that did. Safe to call repeatedly. */
    wire: wire,
    attribution: attribution,
    attributionLine: attributionLine,
    watchDwell: watchDwell,
    CONTACT_ENDPOINT: CONTACT_ENDPOINT,
  };
})();
