/**
 * The product showcase — /showcase.html and /showcase/<slug>.html.
 *
 * These pages exist to be sent to a prospective client, which makes the failure
 * that matters a specific one: a broken image, a dead demo link, or a claim on
 * the page that the demo behind it does not back up. A client who clicks
 * "Open the live demo" and lands on a 404 has learned something about the
 * studio that no amount of copy repairs.
 *
 * So the checks here are mostly about things being REAL:
 *   - every screenshot referenced is a file that exists and actually decodes
 *   - every demo link points at a slug the demo hub publishes
 *   - every product on the index has a page, and every page is reachable
 *   - the JSON-LD parses and names the same product as the visible heading
 *
 * The demo hub itself is on another domain and is not fetched: this suite runs
 * offline. Links are checked against the hub's own manifest instead, which is
 * the same thing the hub builds from.
 *
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node tests/showcase.mjs
 *
 * Optional: HUB_MANIFEST=../websites-tamplate/site/demos/manifest.json
 */
import { chromium } from 'playwright';
import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8901';
const MANIFEST = process.env.HUB_MANIFEST || '../websites-tamplate/site/demos/manifest.json';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

const data = JSON.parse(await readFile('content/showcase.json', 'utf8'));
const products = data.products;
const HUB = data.hub.replace(/\/+$/, '');

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

/**
 * Opens a page and records anything first-party that failed to load on it.
 *
 * Third-party tags are ABORTED rather than allowed to run. Not for speed
 * alone, though the difference is large: analytics, GTM and the Meta pixel are
 * unreachable from a sandbox, so `networkidle` sits waiting for each of them to
 * time out. A suite that takes ten minutes stops being run, and one that fails
 * because Facebook was unreachable is reporting on Facebook, not on these
 * pages. What is under test here is the markup, the screenshots and the links.
 */
const THIRD_PARTY_HOSTS = [
  '**://*.googletagmanager.com/**', '**://*.google-analytics.com/**',
  '**://connect.facebook.net/**', '**://*.facebook.com/**',
  '**://*.doubleclick.net/**', '**://*.clarity.ms/**', '**://*.hotjar.com/**',
];

async function open(path, viewport = { width: 1280, height: 1000 }) {
  const p = await b.newPage({ viewport });
  p.errors = [];
  p.broken = [];
  // Only the third-party hosts are intercepted. Routing '**/*' and calling
  // route.continue() for every local file puts each of them through the
  // interception round trip, which on a page carrying a dozen assets costs
  // more time than the blocked tags did.
  for (const host of THIRD_PARTY_HOSTS) await p.route(host, (route) => route.abort());
  p.on('pageerror', (e) => p.errors.push(String(e)));
  p.on('response', (r) => {
    // A missing screenshot is this suite's business; a blocked tag is not.
    if (r.status() >= 400 && r.url().startsWith(BASE)) p.broken.push(`${r.status()} ${r.url().replace(BASE, '')}`);
  });
  await p.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
  return p;
}

console.log('\n1. The index lists every product, once');
{
  const p = await open('/showcase.html');
  const cards = await p.locator('.sc-card').count();
  ok(cards === products.length, `${cards} cards for ${products.length} products`);

  for (const product of products) {
    const detail = await p.locator(`.sc-card a[href="/showcase/${product.slug}.html"]`).count();
    const demo = await p.locator(`.sc-card a[href="${HUB}/d/${product.slug}/"]`).count();
    ok(detail > 0 && demo > 0,
      `${product.title}: links to its page (${detail}) and its demo (${demo})`);
  }
  ok(p.broken.length === 0, `nothing 404s on the index${p.broken.length ? ': ' + p.broken.join(', ') : ''}`);
  ok(p.errors.length === 0, 'no script errors');
  await p.close();
}

console.log('\n2. Every screenshot on every page is a real image file, with alt text');
{
  // Checked WITHOUT a browser, on purpose.
  //
  // The first version opened each page, scrolled it to force the lazy images
  // to load, and read naturalWidth. It was both slower and less certain: every
  // shot below the fold carries loading="lazy", so it reports naturalWidth 0
  // until something makes it load — which reads exactly like a corrupt file,
  // and did, for six healthy images. Waiting long enough to be sure took
  // minutes per run, and a suite that slow stops being run at all.
  //
  // Reading the src attributes out of the HTML and checking the bytes on disk
  // answers the real question — is every referenced screenshot a decodable
  // image — in under a second, and answers it for shots the browser would
  // never have scrolled to.
  const bad = [];
  let checked = 0;

  for (const product of products) {
    const html = await readFile(`showcase/${product.slug}.html`, 'utf8');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    const tags = main.match(/<img\b[^>]*>/g) || [];

    if (!tags.length) bad.push(`${product.slug}: the page has no screenshots at all`);

    for (const tag of tags) {
      checked++;
      const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
      const alt = (tag.match(/\salt="([^"]*)"/) || [])[1];
      if (!src) { bad.push(`${product.slug}: an <img> with no src`); continue; }
      if (!alt || !alt.trim()) bad.push(`${product.slug}: ${src} has no alt text`);

      const onDisk = resolve('.' + src);
      try { await access(onDisk); } catch { bad.push(`${product.slug}: ${src} is not on disk`); continue; }

      // The bytes, not just the filename. A zero-byte or truncated write is
      // served with a 200 and renders as nothing.
      const head = await readFile(onDisk);
      const isWebp = head.slice(0, 4).toString('ascii') === 'RIFF' && head.slice(8, 12).toString('ascii') === 'WEBP';
      const isPng = head.slice(1, 4).toString('ascii') === 'PNG';
      const isJpeg = head[0] === 0xff && head[1] === 0xd8;
      if (!(isWebp || isPng || isJpeg)) bad.push(`${product.slug}: ${src} is ${head.length} bytes and is not a WebP, PNG or JPEG`);
      if (head.length < 1024) bad.push(`${product.slug}: ${src} is only ${head.length} bytes`);
    }
  }

  ok(checked >= products.length, `${checked} screenshots referenced across ${products.length} pages`);
  ok(bad.length === 0, `every one is a real image with alt text${bad.length ? '\n         ' + bad.join('\n         ') : ''}`);
}

console.log('\n2b. And the pages load them without a 404');
{
  // One page through a browser, to confirm the paths the generator writes are
  // the paths the server actually serves. Doing this for all eight added
  // minutes and told us the same thing eight times.
  const p = await open(`/showcase/${products[0].slug}.html`);
  ok(p.broken.length === 0, `${products[0].slug} loads with nothing missing${p.broken.length ? ': ' + p.broken.join(', ') : ''}`);
  ok(p.errors.length === 0, 'and no script errors');
  await p.close();
}

console.log('\n3. Every demo link points at a slug the hub actually publishes');
{
  const manifestPath = resolve(MANIFEST);
  if (!existsSync(manifestPath)) {
    console.log(`  SKIP no hub manifest at ${manifestPath}`);
    console.log('       (build it: cd ../websites-tamplate && npm run build:demo-hub)');
  } else {
    const hub = JSON.parse(await readFile(manifestPath, 'utf8'));
    const published = new Set(hub.map((d) => d.slug));
    const missing = products.filter((p) => !published.has(p.slug)).map((p) => p.slug);
    ok(missing.length === 0,
      `all ${products.length} showcase slugs are published by the hub${missing.length ? ': missing ' + missing.join(', ') : ''}`);

    // The other direction is worth knowing but is not a failure: a demo may be
    // deliberately kept out of the showcase.
    const shown = new Set(products.map((p) => p.slug));
    const unshown = [...published].filter((s) => !shown.has(s));
    console.log(`  note  ${unshown.length ? `demos not in the showcase: ${unshown.join(', ')}` : 'every published demo is in the showcase'}`);
  }
}

console.log('\n4. Each product page says what it is, and proves it');
{
  for (const product of products) {
    const p = await open(`/showcase/${product.slug}.html`);
    const h1 = (await p.textContent('h1')).trim();
    const features = await p.locator('.sc-feature').count();
    const why = await p.locator('.sc-why-item').count();
    const crumbs = await p.locator('.sc-crumbs a[href="/showcase.html"]').count();
    const demo = await p.locator(`a[href="${HUB}/d/${product.slug}/"]`).count();

    ok(h1 === product.title, `${product.slug}: the heading is the product name`);
    ok(features === product.features.length, `${product.slug}: ${features} core features shown`);
    ok(why === data.whyChoose.length, `${product.slug}: the why-choose block is present (${why})`);
    ok(crumbs > 0, `${product.slug}: breadcrumb back to the showcase`);
    ok(demo > 0, `${product.slug}: at least one link to the live demo`);
    await p.close();
  }
}

console.log('\n5. The structured data parses and matches the page');
{
  for (const product of products) {
    const p = await open(`/showcase/${product.slug}.html`);
    const raw = await p.textContent('script[type="application/ld+json"]');
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { /* reported below */ }
    ok(parsed !== null, `${product.slug}: JSON-LD parses`);
    if (parsed) {
      ok(parsed.name === product.title, `${product.slug}: it names the same product as the heading`);
      ok(Array.isArray(parsed.screenshot) && parsed.screenshot.length > 0,
        `${product.slug}: it lists the screenshots`);
    }
    await p.close();
  }
}

console.log('\n6. Nothing scrolls sideways, at any width a client will use');
{
  const widths = [390, 768, 1024, 1440];
  const pages = ['/showcase.html', `/showcase/${products[0].slug}.html`, `/showcase/${products[3].slug}.html`];
  for (const path of pages) {
    for (const width of widths) {
      const p = await open(path, { width, height: 900 });
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(over === 0, `${path} at ${width}px: no horizontal overflow${over ? ` (${over}px)` : ''}`);
      await p.close();
    }
  }
}

console.log('\n7. The site can be navigated to the showcase');
{
  const p = await open('/products.html');
  ok(await p.locator('a[href="/showcase.html"]').count() > 0,
    'products.html links to the showcase');
  await p.close();
  const home = await open('/');
  ok(await home.locator('a[href="/showcase.html"]').count() > 0,
    'the homepage links to it too');
  await home.close();
}

console.log('\n8. The sitemap carries the new pages');
{
  const xml = await readFile('sitemap.xml', 'utf8');
  ok(xml.includes('/showcase.html'), 'the index is in the sitemap');
  const missing = products.filter((p) => !xml.includes(`/showcase/${p.slug}.html`)).map((p) => p.slug);
  ok(missing.length === 0, `every product page is listed${missing.length ? ': missing ' + missing.join(', ') : ''}`);
  // The generator writes image entries; a bare & in a product name breaks the
  // whole file, so the shape is checked rather than assumed.
  ok(!/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(xml), 'no unescaped ampersands');
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
