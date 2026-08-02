// Connect with Bayezid — interaction layer. Vanilla JS on purpose: the
// site is static-hosted (GitHub Pages, no build step), so no React/Framer
// Motion runtime — Intersection Observer + CSS transitions give the same
// scroll-reveal feel without a bundler.

document.getElementById('footerYear').textContent = new Date().getFullYear();

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
// Reviews marquee — placeholder copy until real reviews exist; swap this
// array for real testimonials as they come in (same shape).
// ---------------------------------------------------------------------------
const REVIEWS = [
  { quote: "Handed him a messy WordPress site and got back something that actually ranks.", who: "Local service business owner", stars: 5 },
  { quote: "Fast, direct, and he explains the technical stuff without the jargon.", who: "E-commerce client", stars: 5 },
  { quote: "Built exactly the tool we described, nothing over-engineered.", who: "Agency partner", stars: 5 },
  { quote: "SEO results showed up in weeks, not the usual vague 'give it 6 months.'", who: "SaaS founder", stars: 5 },
];
const track = document.getElementById('marqueeTrack');
if (track) {
  const cardsHtml = REVIEWS.map((r) => `
    <div class="review-card">
      <div class="review-stars">${'★'.repeat(r.stars)}</div>
      <p class="review-quote">"${r.quote}"</p>
      <span class="review-who">${r.who}</span>
    </div>
  `).join('');
  // duplicated once so the marquee can loop seamlessly at -50%
  track.innerHTML = cardsHtml + cardsHtml;
}
