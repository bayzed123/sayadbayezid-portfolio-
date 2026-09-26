/**
 * Generates the product showcase: /showcase.html and /showcase/<slug>.html.
 *
 * WHY GENERATED AND NOT HAND-WRITTEN
 * Nine pages that must agree with each other, with content/showcase.json, and
 * with the screenshots on disk. Written by hand they drift within a month: a
 * product gets renamed in one place, a demo link rots in another, a screenshot
 * is recaptured under a new name and one page keeps pointing at the old file.
 * Generating them means the drift is impossible rather than merely discouraged.
 *
 * THE HEADER AND FOOTER ARE COPIED FROM products.html AT BUILD TIME, not
 * duplicated into this file. The site's navigation changes; a second copy of it
 * in a script is a second copy to forget.
 *
 * A SHOT THAT IS NOT ON DISK IS NOT LINKED. capture-showcase-shots.mjs reports
 * failures rather than writing a blank file, and this script skips anything
 * missing — so a failed capture costs a picture, never a broken image on a page
 * a client is looking at.
 *
 *   node scripts/build-showcase.mjs
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const SITE = 'https://sayadbayezid.com';
const OUT_DIR = join(ROOT, 'showcase');

const data = JSON.parse(await readFile(join(ROOT, 'content/showcase.json'), 'utf8'));
const HUB = data.hub.replace(/\/+$/, '');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

/* ------------------------------------- header, footer and head, from the site */

const template = await readFile(join(ROOT, 'products.html'), 'utf8');

function slice(html, startRe, endToken) {
  const start = html.search(startRe);
  if (start < 0) throw new Error(`build-showcase: could not find ${startRe} in products.html`);
  const end = html.indexOf(endToken, start);
  if (end < 0) throw new Error(`build-showcase: could not find ${endToken} in products.html`);
  return html.slice(start, end + endToken.length);
}

const HEADER = slice(template, /<a class="skip-link"/, '</header>');
const FOOTER = slice(template, /<footer class="site-footer">/, '</footer>');
const GTM_NOSCRIPT = slice(template, /<!-- Google Tag Manager \(noscript\) -->/, 'End Google Tag Manager (noscript) -->');

/** The <head> boilerplate every page on this site shares. */
function head({ title, description, canonical, image }) {
  return `<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,650&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.min.css" />
<link rel="stylesheet" href="/assets/showcase.min.css" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<script src="/assets/tags.min.js" defer></script>`;
}

function page({ title, description, canonical, image, body, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head({ title, description, canonical, image })}
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
    ${GTM_NOSCRIPT}
${HEADER}

  <main id="main">
${body}
  </main>

  ${FOOTER}

  <script src="/assets/main.min.js"></script>
  <script src="/assets/js/support.min.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------- the shots - */

/** Resolves a product's shots to the files that actually exist. */
async function shotsFor(product) {
  const out = [];
  for (const shot of product.shots) {
    const rel = `/assets/showcase/${product.slug}/${shot.label}.webp`;
    if (await exists(join(ROOT, rel.slice(1)))) {
      out.push({ ...shot, src: rel, mobile: shot.viewport === 'mobile' });
    } else {
      console.warn(`  missing shot, skipped: ${rel}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------ index page - */

const products = data.products;
const withShots = new Map();
for (const p of products) withShots.set(p.slug, await shotsFor(p));

const categories = [...new Set(products.map((p) => p.category))];

const indexCards = products.map((p) => {
  const shots = withShots.get(p.slug);
  const hero = shots.find((s) => !s.mobile) || shots[0];
  return `        <article class="sc-card">
          ${hero ? `<a class="sc-card-media" href="/showcase/${p.slug}.html">
            <img src="${hero.src}" alt="${esc(p.title)} — ${esc(hero.caption)}" width="720" height="450" loading="lazy" decoding="async" />
          </a>` : ''}
          <div class="sc-card-body">
            <span class="sc-tag">${esc(p.category)}</span>
            <h3><a href="/showcase/${p.slug}.html">${esc(p.title)}</a></h3>
            <p>${esc(p.tagline)}</p>
            <ul class="sc-chips">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <div class="sc-card-actions">
              <a class="btn btn-primary" href="/showcase/${p.slug}.html">See what it does<span class="btn-arrow">→</span></a>
              <a class="btn btn-ghost" href="${HUB}/d/${p.slug}/" target="_blank" rel="noopener"
                 data-pixel-event="ViewContent" data-pixel-content="${esc(p.title)}">Open the live demo</a>
            </div>
          </div>
        </article>`;
}).join('\n');

const indexBody = `
    <section class="page-hero">
      <span class="section-eyebrow reveal" data-reveal>Showcase</span>
      <h1 class="reveal" data-reveal>Open any of these and click through it.</h1>
      <p class="reveal" data-reveal>${products.length} working builds — ${categories.join(', ').toLowerCase()} — deployed and running right now.
        Not mockups, not design files. Every screenshot below was taken from the demo you can open.</p>
    </section>

    <section class="section">
      <div class="sc-grid">
${indexCards}
      </div>
    </section>

    <section class="section sc-why">
      <div class="sc-why-inner">
        <span class="section-eyebrow">Why these, and not a slide deck</span>
        <h2>What you are actually being shown</h2>
        <div class="sc-why-grid">
${data.whyChoose.map((w) => `          <div class="sc-why-item">
            <h3>${esc(w.title)}</h3>
            <p>${esc(w.body)}</p>
          </div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section cta-band">
      <div class="cta-inner reveal" data-reveal>
        <h2>Want one of these, in your name?</h2>
        <p>Pick the closest demo, tell me what is different about your business, and you get a quote against something we have both already seen working.</p>
        <a href="/contact.html" class="btn btn-primary btn-lg" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project<span class="btn-arrow">→</span></a>
      </div>
    </section>
`;

const indexHero = (withShots.get(products[0].slug)[0] || {}).src || '/assets/social-preview.svg';

await writeFile(join(ROOT, 'showcase.html'), page({
  title: 'Product showcase — live demos you can open | Connect with Bayezid',
  description: `${products.length} working storefronts, admin dashboards and commerce tools by Sayad Md Bayezid Hosan. Every one is deployed — open it and click through it.`,
  canonical: `${SITE}/showcase.html`,
  image: SITE + indexHero,
  body: indexBody,
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Product showcase',
    url: `${SITE}/showcase.html`,
    description: 'Live, working demos — storefronts, admin dashboards and commerce tools.',
    hasPart: products.map((p) => ({
      '@type': 'WebApplication',
      name: p.title,
      applicationCategory: p.category,
      description: p.summary,
      url: `${SITE}/showcase/${p.slug}.html`,
      // The demo is the thing being described, so it is named as such rather
      // than left implied by a link.
      sameAs: `${HUB}/d/${p.slug}/`,
      offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
    })),
  },
}));
console.log('wrote showcase.html');

/* ------------------------------------------------------- per-product pages */

await mkdir(OUT_DIR, { recursive: true });

for (const p of products) {
  const shots = withShots.get(p.slug);
  const hero = shots.find((s) => !s.mobile) || shots[0];
  const rest = shots.filter((s) => s !== hero);
  const demoUrl = `${HUB}/d/${p.slug}/`;

  const gallery = rest.length ? `
    <section class="section sc-shots">
      <div class="sc-narrow">
        <span class="section-eyebrow">Screens</span>
        <h2>Every one of these is a page you can open</h2>
      </div>
      <div class="sc-shot-grid">
${rest.map((s) => `        <figure class="sc-shot${s.mobile ? ' is-mobile' : ''}">
          <img src="${s.src}" alt="${esc(p.title)} — ${esc(s.caption)}" loading="lazy" decoding="async" />
          <figcaption>${esc(s.caption)}</figcaption>
        </figure>`).join('\n')}
      </div>
    </section>` : '';

  const body = `
    <nav class="sc-crumbs" aria-label="Breadcrumb">
      <a href="/">Home</a> <span aria-hidden="true">/</span>
      <a href="/showcase.html">Showcase</a> <span aria-hidden="true">/</span>
      <span aria-current="page">${esc(p.title)}</span>
    </nav>

    <section class="page-hero sc-hero">
      <span class="section-eyebrow reveal" data-reveal>${esc(p.category)}</span>
      <h1 class="reveal" data-reveal>${esc(p.title)}</h1>
      <p class="reveal" data-reveal>${esc(p.tagline)}</p>
      <div class="sc-hero-actions reveal" data-reveal>
        <a class="btn btn-primary btn-lg" href="${demoUrl}" target="_blank" rel="noopener"
           data-pixel-event="ViewContent" data-pixel-content="${esc(p.title)}">Open the live demo<span class="btn-arrow">→</span></a>
        <a class="btn btn-ghost btn-lg" href="/contact.html"
           data-pixel-event="ContactIntent" data-pixel-custom="true">Ask for this, rebranded</a>
      </div>
      <ul class="sc-chips sc-chips-lg">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>

    ${hero ? `<section class="section sc-hero-shot">
      <figure>
        <a href="${demoUrl}" target="_blank" rel="noopener">
          <img src="${hero.src}" alt="${esc(p.title)} — ${esc(hero.caption)}" width="1440" height="900" decoding="async" />
        </a>
        <figcaption>${esc(hero.caption)} &middot; <a href="${demoUrl}" target="_blank" rel="noopener">open it yourself</a></figcaption>
      </figure>
    </section>` : ''}

    <section class="section sc-summary">
      <div class="sc-narrow">
        <p class="sc-lede">${esc(p.summary)}</p>
        <p class="sc-audience"><strong>Who it is for.</strong> ${esc(p.audience)}</p>
      </div>
    </section>

    <section class="section sc-features">
      <div class="sc-narrow">
        <span class="section-eyebrow">Core features</span>
        <h2>What it does</h2>
      </div>
      <div class="sc-feature-grid">
${p.features.map((f) => `        <div class="sc-feature">
          <h3>${esc(f.title)}</h3>
          <p>${esc(f.body)}</p>
        </div>`).join('\n')}
      </div>
    </section>
${gallery}

    <section class="section sc-why">
      <div class="sc-why-inner">
        <span class="section-eyebrow">Why choose this</span>
        <h2>What you get that a template does not give you</h2>
        <div class="sc-why-grid">
${data.whyChoose.map((w) => `          <div class="sc-why-item">
            <h3>${esc(w.title)}</h3>
            <p>${esc(w.body)}</p>
          </div>`).join('\n')}
        </div>
      </div>
    </section>

    <section class="section sc-more">
      <div class="sc-narrow">
        <span class="section-eyebrow">More in the showcase</span>
        <h2>Other builds you can open</h2>
      </div>
      <ul class="sc-more-list">
${products.filter((o) => o.slug !== p.slug).slice(0, 4).map((o) => `        <li>
          <a href="/showcase/${o.slug}.html">
            <strong>${esc(o.title)}</strong>
            <span>${esc(o.tagline)}</span>
          </a>
        </li>`).join('\n')}
      </ul>
      <p class="sc-more-all"><a href="/showcase.html">See all ${products.length} &rarr;</a></p>
    </section>

    <section class="section cta-band">
      <div class="cta-inner reveal" data-reveal>
        <h2>Build this for your business</h2>
        <p>Tell me what is different about how you sell, and you get a quote measured against a demo we have both already opened.</p>
        <a href="/contact.html" class="btn btn-primary btn-lg" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project<span class="btn-arrow">→</span></a>
      </div>
    </section>
`;

  await writeFile(join(OUT_DIR, `${p.slug}.html`), page({
    title: `${p.title} — ${p.tagline} | Connect with Bayezid`,
    description: p.summary.slice(0, 300),
    canonical: `${SITE}/showcase/${p.slug}.html`,
    image: hero ? SITE + hero.src : `${SITE}/assets/social-preview.svg`,
    body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: p.title,
      applicationCategory: p.category,
      description: p.summary,
      url: `${SITE}/showcase/${p.slug}.html`,
      sameAs: demoUrl,
      featureList: p.features.map((f) => f.title),
      screenshot: shots.map((s) => SITE + s.src),
      author: { '@type': 'Person', name: 'Sayad Md Bayezid Hosan', url: SITE },
      offers: { '@type': 'Offer', availability: 'https://schema.org/InStock' },
    },
  }));
  console.log(`wrote showcase/${p.slug}.html  (${shots.length} shot${shots.length === 1 ? '' : 's'})`);
}

console.log(`\n${products.length + 1} pages written.`);
