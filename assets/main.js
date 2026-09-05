// Connect with Bayezid — interaction layer. Vanilla JS on purpose: the
// site is static-hosted (GitHub Pages, no build step), so no React/Framer
// Motion runtime — Intersection Observer + CSS transitions give the same
// scroll-reveal feel without a bundler.

const footerYearEl = document.getElementById('footerYear');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Meta Pixel — standard events on real interactions only. Deliberately NOT
// firing e-commerce events (AddToCart, Purchase, etc.) anywhere — this is a
// services site with no cart/checkout, so those would just be inaccurate.
//
// "Lead" fires ONLY on a real, successful contact-form submission (see the
// contact-form handler further down) — that's Meta's own strict definition,
// and it's what Meta will actually optimize ad delivery toward. "Start a
// project" CTA clicks fire a lighter CUSTOM event (ContactIntent) instead —
// useful for seeing click-through interest without inflating the real Lead
// count with people who clicked but never actually reached out.
//
// "ViewContent" fires on the featured-work rows, naming which piece of
// work was opened (data-pixel-content) — useful for seeing which product
// people care about most.
//
// Each fires TWICE on purpose: once in-browser via fbq() (blockable by
// ad-blockers/Safari ITP), and once server-side via the Conversions API
// worker (not blockable, since it never touches the visitor's browser).
// Both carry the SAME event_id so Meta de-duplicates them into one event
// rather than double-counting — this is Meta's own recommended setup, not
// a redundancy bug.
// ---------------------------------------------------------------------------
const CAPI_ENDPOINT = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/track';

function firePixelEvent(eventName, { custom = false, contentName, sendToServer = true } = {}) {
  const eventId = crypto.randomUUID();
  const customData = contentName ? { content_name: contentName } : {};

  if (typeof fbq === 'function') {
    if (custom) fbq('trackCustom', eventName, customData);
    else fbq('track', eventName, customData, { eventID: eventId });
  }

  if (!sendToServer) return; // custom, exploratory events don't need CAPI's extra delivery robustness

  fetch(CAPI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      custom_data: customData,
    }),
    keepalive: true, // lets this finish even if a click also navigates away
  }).catch(() => {}); // best-effort — a failed server echo shouldn't break the page
}

document.querySelectorAll('[data-pixel-event]').forEach((el) => {
  el.addEventListener('click', () => {
    const isCustom = el.dataset.pixelCustom === 'true';
    firePixelEvent(el.dataset.pixelEvent, {
      custom: isCustom,
      contentName: el.dataset.pixelContent,
      sendToServer: !isCustom,
    });
  });
});

// ---------------------------------------------------------------------------
// Mobile nav toggle
// ---------------------------------------------------------------------------
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// ---------------------------------------------------------------------------
// Header shrink-on-scroll (subtle, not a redesign of the header — just a
// slightly denser bar once you've moved past the hero)
// ---------------------------------------------------------------------------
const header = document.getElementById('siteHeader');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// Scroll reveal — same [data-reveal] pattern used across every page
// ---------------------------------------------------------------------------
const revealTargets = document.querySelectorAll('[data-reveal]');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // small stagger within a batch so grouped elements (hero lines, cards
      // in a row) don't all snap in at once
      setTimeout(() => entry.target.classList.add('is-visible'), i * 60);
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
revealTargets.forEach((el) => revealObserver.observe(el));

// ---------------------------------------------------------------------------
// Animated stat counters — trigger once, when the trust bar scrolls in
// ---------------------------------------------------------------------------
function animateCount(el) {
  const target = Number(el.dataset.count);
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const statEls = document.querySelectorAll('.stat-num');
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
statEls.forEach((el) => statObserver.observe(el));

// ---------------------------------------------------------------------------
// Avatar: show the placeholder if the real portrait file isn't there yet
// (it isn't, until a real photo is added at /assets/bayezid-portrait.jpg)
// ---------------------------------------------------------------------------
const avatarImg = document.getElementById('avatarImg');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
if (avatarImg && avatarPlaceholder) {
  avatarImg.addEventListener('error', () => {
    avatarImg.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  });
}

// ---------------------------------------------------------------------------
// Reviews — fetched from the agency Worker (real, admin-approved submissions).
// Falls back to a couple of placeholder cards only if none are approved yet,
// so the section never looks empty before the first real review lands.
// ---------------------------------------------------------------------------
const REVIEWS_API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/reviews';
const REVIEWS_CACHE_KEY = 'cwb.reviews.v1';
const REVIEWS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes — reviews are approved by hand, they don't change by the second
const FALLBACK_REVIEWS = [
  { name: 'A recent client', rating: 5, comment: 'Be the first to leave a review below — real ones replace this automatically.' },
];

function escapeHtmlAgency(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function reviewCardHtml(r) {
  const avatar = r.avatar_url
    ? `<img src="${escapeHtmlAgency(r.avatar_url)}" alt="" class="review-avatar" width="44" height="44" loading="lazy" decoding="async" onerror="this.style.display='none'" />`
    : '';
  return `
    <div class="review-card">
      ${avatar}
      <div class="review-stars">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
      <p class="review-quote">"${escapeHtmlAgency(r.comment)}"</p>
      <span class="review-who">${escapeHtmlAgency(r.name)}</span>
    </div>
  `;
}

// Placeholder cards painted synchronously, before any network work. The proof
// section used to render as an empty box until the Worker answered, which is
// what made this the slowest-feeling part of the page — now it has its final
// height and shape immediately, and real reviews swap in underneath.
function skeletonHtml() {
  const card = `
    <div class="review-card is-skeleton" aria-hidden="true">
      <div class="skeleton-line w-40"></div>
      <div class="skeleton-line w-90"></div>
      <div class="skeleton-line w-70"></div>
      <div class="skeleton-line w-40"></div>
    </div>`;
  return card.repeat(4);
}

function readCachedReviews() {
  try {
    const raw = sessionStorage.getItem(REVIEWS_CACHE_KEY);
    if (!raw) return null;
    const { at, reviews } = JSON.parse(raw);
    if (!Array.isArray(reviews) || Date.now() - at > REVIEWS_CACHE_TTL) return null;
    return reviews;
  } catch {
    return null; // private mode / blocked storage — just skip the cache
  }
}

function writeCachedReviews(reviews) {
  try {
    sessionStorage.setItem(REVIEWS_CACHE_KEY, JSON.stringify({ at: Date.now(), reviews }));
  } catch { /* storage full or blocked — the page works fine without it */ }
}

function paintReviews(track, reviews) {
  const cardsHtml = reviews.map(reviewCardHtml).join('');
  track.innerHTML = cardsHtml + cardsHtml; // duplicated once for a seamless marquee loop
}

(function initReviews() {
  const track = document.getElementById('marqueeTrack');
  if (!track) return;

  const cached = readCachedReviews();
  if (cached?.length) {
    paintReviews(track, cached);
    return; // already fresh this session — no request at all
  }
  track.innerHTML = skeletonHtml();

  async function load() {
    let reviews = FALLBACK_REVIEWS;
    try {
      const resp = await fetch(REVIEWS_API);
      const data = await resp.json();
      if (data.reviews?.length) {
        reviews = data.reviews;
        writeCachedReviews(reviews);
      }
    } catch { /* keep the fallback card — a failed fetch shouldn't blank the section */ }
    paintReviews(track, reviews);
  }

  // Deferred until the section is actually approaching the viewport, so the
  // request never competes with the hero's own critical resources.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        load();
      }
    }, { rootMargin: '400px 0px' });
    io.observe(track);
  } else {
    load();
  }
})();

// ---------------------------------------------------------------------------
// Review submission form
// ---------------------------------------------------------------------------
let selectedReviewRating = 0;
document.querySelectorAll('#reviewStarRow button').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedReviewRating = Number(btn.dataset.star);
    document.querySelectorAll('#reviewStarRow button').forEach((b) => {
      b.classList.toggle('selected', Number(b.dataset.star) <= selectedReviewRating);
    });
  });
});

const submitReviewBtn = document.getElementById('submitReviewBtn');
if (submitReviewBtn) {
  submitReviewBtn.addEventListener('click', async () => {
    const name = document.getElementById('reviewName').value.trim();
    const avatarUrl = document.getElementById('reviewAvatar').value.trim();
    const comment = document.getElementById('reviewComment').value.trim();
    const banner = document.getElementById('reviewBanner');

    if (!name || !comment) {
      banner.innerHTML = `<div class="slg-banner slg-banner-warn">Add your name and a short comment.</div>`;
      return;
    }
    if (!selectedReviewRating) {
      banner.innerHTML = `<div class="slg-banner slg-banner-warn">Pick a star rating first.</div>`;
      return;
    }

    try {
      const resp = await fetch('https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatarUrl, rating: selectedReviewRating, comment }),
      });
      const data = await resp.json();
      banner.innerHTML = resp.ok
        ? `<div class="slg-banner slg-banner-ok">${escapeHtmlAgency(data.note || 'Thanks for the review!')}</div>`
        : `<div class="slg-banner slg-banner-warn">${escapeHtmlAgency(data.error || 'Something went wrong.')}</div>`;
      if (resp.ok) {
        document.getElementById('reviewName').value = '';
        document.getElementById('reviewAvatar').value = '';
        document.getElementById('reviewComment').value = '';
        selectedReviewRating = 0;
        document.querySelectorAll('#reviewStarRow button').forEach((b) => b.classList.remove('selected'));
      }
    } catch {
      banner.innerHTML = `<div class="slg-banner slg-banner-warn">Couldn't reach the server — try again shortly.</div>`;
    }
  });
}

// ---------------------------------------------------------------------------
// Contact form (contact.html only — no-ops elsewhere since the elements
// won't exist). This is the real "Lead" moment: a completed submission.
// ---------------------------------------------------------------------------
const contactSubmitBtn = document.getElementById('contactSubmitBtn');
if (contactSubmitBtn) {
  contactSubmitBtn.addEventListener('click', async () => {
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const message = document.getElementById('contactMessage').value.trim();
    const banner = document.getElementById('contactBanner');

    if (!name || !email || !message) {
      banner.innerHTML = `<div class="slg-banner slg-banner-warn">Fill in your name, email, and a message.</div>`;
      return;
    }

    contactSubmitBtn.disabled = true;
    try {
      const resp = await fetch('https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (resp.ok) {
        firePixelEvent('Lead'); // the one true Lead moment on this whole site
        banner.innerHTML = `<div class="slg-banner slg-banner-ok">Sent — I'll get back to you soon.</div>`;
        document.getElementById('contactName').value = '';
        document.getElementById('contactEmail').value = '';
        document.getElementById('contactMessage').value = '';
      } else {
        const data = await resp.json().catch(() => ({}));
        banner.innerHTML = `<div class="slg-banner slg-banner-warn">${data.error || 'Something went wrong — try again.'}</div>`;
      }
    } catch {
      banner.innerHTML = `<div class="slg-banner slg-banner-warn">Couldn't reach the server — try again shortly.</div>`;
    } finally {
      contactSubmitBtn.disabled = false;
    }
  });
}

// ---------------------------------------------------------------------------
// Project grid — category filter + cursor-tracked card glow.
//
// The cards are real anchors rendered in the HTML, not built from JSON at
// runtime: the grid is the point of the page, so it has to be in the first
// paint and in the crawler's view of the document. JS only filters and
// animates what's already there.
// ---------------------------------------------------------------------------
const projectGrid = document.getElementById('projectGrid');
if (projectGrid) {
  const cards = Array.from(projectGrid.querySelectorAll('.project-card'));
  const countEl = document.getElementById('filterCount');
  const filterBtns = Array.from(document.querySelectorAll('#projectToolbar .filter-btn'));

  const emptyEl = document.createElement('p');
  emptyEl.className = 'project-empty';
  emptyEl.hidden = true;
  emptyEl.textContent = 'Nothing in this category yet — check back shortly.';
  projectGrid.appendChild(emptyEl);

  function setCount(n) {
    if (countEl) countEl.textContent = `${n} live ${n === 1 ? 'project' : 'projects'}`;
  }

  function applyFilter(filter) {
    let shown = 0;
    cards.forEach((card) => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-filtered', !match);
      if (match) {
        shown += 1;
        // Restart the entry animation so a filter change reads as the grid
        // re-forming rather than as elements silently appearing.
        card.classList.remove('is-entering');
        void card.offsetWidth; // force reflow so the animation can replay
        card.classList.add('is-entering');
      }
    });
    emptyEl.hidden = shown > 0;
    setCount(shown);
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('is-active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      });
      applyFilter(btn.dataset.filter);
    });
  });

  setCount(cards.filter((c) => c.dataset.category !== 'soon').length);

  // Pointer-tracked highlight. Skipped entirely for coarse pointers and for
  // anyone who has asked for reduced motion — on touch the cards keep the
  // centred default from the stylesheet.
  const wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (wantsMotion && finePointer) {
    let queued = false;
    projectGrid.addEventListener('pointermove', (e) => {
      const card = e.target.closest('.project-card');
      if (!card || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
        queued = false;
      });
    }, { passive: true });
  }
}

// ---------------------------------------------------------------------------
// Offer slider — the products/services carousel on the home page. Scrolling
// is native (CSS scroll-snap), so the buttons only nudge it by one card and
// keep their own disabled state in sync with the scroll position.
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-slider]').forEach((wrap) => {
  const track = wrap.querySelector('.offer-slider');
  const prev = wrap.querySelector('[data-slide="prev"]');
  const next = wrap.querySelector('[data-slide="next"]');
  if (!track || !prev || !next) return;

  const step = () => {
    const card = track.querySelector('.offer-card');
    return card ? card.getBoundingClientRect().width + 18 : track.clientWidth * 0.8;
  };

  function syncButtons() {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', syncButtons, { passive: true });
  window.addEventListener('resize', syncButtons, { passive: true });
  syncButtons();
});

// ---------------------------------------------------------------------------
// Share button — the Web Share sheet where it exists (that's every mobile
// browser worth targeting), clipboard everywhere else.
// ---------------------------------------------------------------------------
const shareBtn = document.getElementById('shareBtn');
if (shareBtn) {
  shareBtn.addEventListener('click', async () => {
    const payload = { title: document.title, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(payload.url);
      const original = shareBtn.textContent;
      shareBtn.textContent = 'Link copied ✓';
      setTimeout(() => { shareBtn.textContent = original; }, 2000);
    } catch { /* the visitor dismissed the sheet, or clipboard access was denied */ }
  });
}

// ---------------------------------------------------------------------------
// FAQ accordion — the markup is native <details>, so it already works with
// JavaScript switched off. This only adds the "one open at a time" behaviour.
// ---------------------------------------------------------------------------
const faqItems = Array.from(document.querySelectorAll('.faq-list .faq-item'));
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    faqItems.forEach((other) => { if (other !== item) other.open = false; });
  });
});
