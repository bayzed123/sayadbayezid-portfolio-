/**
 * Screenshots for the product showcase, taken from the real built demos.
 *
 * WHY THE RAW DEMO AND NOT /d/<slug>/
 * The demo hub serves each demo twice: at /demos/<slug>/... as the product
 * itself, and at /d/<slug>/ inside a review wrapper with its own chrome and an
 * iframe. The wrapper is the right thing to LINK a client to and the wrong thing
 * to photograph — a showcase full of screenshots of a frame around a product is
 * a showcase of the frame. So shots come from /demos/, links go to /d/.
 *
 * WHY IT WAITS FOR CONTENT RATHER THAN A TIMEOUT
 * Four of these demos are single-page apps (React, Vue). `load` fires before
 * they have rendered anything, so a fixed wait produces a folder of white
 * rectangles that look like a broken build and pass any check that only counts
 * files. Each shot therefore waits for the body to actually contain something,
 * and a shot that stays empty is reported as a failure instead of written out.
 *
 * WHY A SHOT CAN NAME ITS OWN DEMO
 * Five of these products are a pair: a storefront and the admin dashboard that
 * runs it, published as two demos sharing one set of orders. They are ONE thing
 * a client is buying, so they are one product here — and the shot that proves
 * the order arrived in the dashboard has to come from the other demo. A shot may
 * therefore carry its own `slug`, which overrides the product's.
 *
 * WHY SOME PRODUCTS ALSO GET AN ORDER WALK-THROUGH
 * A shop + admin pair is sold on one thing: a customer orders in the shop and
 * the order is waiting in the dashboard. Three still pictures of the home page
 * cannot show that, so products with `orderFlow` in content/showcase.json are
 * also driven through it — product page, checkout with the on-screen SMS code,
 * the order confirmation, the order arriving in the admin, and the logged call
 * that confirms it and issues the invoice number — and each stage is captured
 * as flow-<n>-<stage>. It is one browser context, so the order in the admin
 * shots is the order the shop shots just placed, not a different one.
 *
 * Usage, from a built demo hub (websites-tamplate: npm run build:demo-hub):
 *   node scripts/capture-showcase-shots.mjs ../websites-tamplate/site
 *
 * Optional: CHROMIUM_PATH, PORT, ONLY=<slug>[,<slug>]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const SITE_DIR = resolve(process.argv[2] || '../websites-tamplate/site');
const OUT_ROOT = resolve('assets/showcase');
const PORT = Number(process.env.PORT || 8912);
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 414, height: 896 },
};

if (!existsSync(SITE_DIR)) {
  console.error(`No built demo hub at ${SITE_DIR}.`);
  console.error('Build it first:  cd ../websites-tamplate && npm run build:demo-hub');
  process.exit(1);
}

const showcase = JSON.parse(await readFile('content/showcase.json', 'utf8'));
const products = showcase.products.filter((p) => !ONLY.length || ONLY.includes(p.slug));

/* ------------------------------------------------------- a static server - */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.map': 'application/json', '.mp4': 'video/mp4', '.avif': 'image/avif',
};

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(req.url.split('?')[0]);
    // No climbing out of the site directory, even from a local script.
    if (path.includes('..')) { res.writeHead(400).end(); return; }
    let file = join(SITE_DIR, path);
    if (path.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`serving ${SITE_DIR} on ${BASE}\n`);

/* ----------------------------------------------- the order walk-through - */

/**
 * Drives one order through a shop + admin pair and photographs each stage.
 * Any stage that fails stops the walk-through and is reported, and the stages
 * already captured are kept — build-showcase.mjs only shows the steps whose
 * shots are on disk, so a partial run costs pictures, never a broken page.
 */
async function captureOrderFlow(product, outDir) {
  const flow = product.orderFlow;
  const addr = { division: 'Dhaka', district: 'Dhaka', upazila: 'Mirpur', area: 'House 12, Road 3, Section 10', ...(flow.address || {}) };
  const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop, deviceScaleFactor: 2 });
  ctx.on('dialog', (d) => d.accept('Called — she confirmed the size and the address').catch(() => {}));
  const shop = await ctx.newPage();
  // Leftover notices ("Added to cart") would cover the next shot; the SMS-code one is kept for its shot.
  const clearToasts = (page) => page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())).catch(() => {});
  // An order panel opens scrolled to wherever focus landed; the shot wants its top (status and actions).
  const toTop = (page) => page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollTop > 0) el.scrollTop = 0; })).catch(() => {});
  const snap = async (page, label) => {
    await page.evaluate(() => document.activeElement?.blur?.()).catch(() => {});
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(outDir, `${label}.png`), fullPage: false });
    console.log(`   ok   ${label}  (order walk-through)`);
    taken++;
  };
  let stage = 'product';
  try {
    await shop.goto(`${BASE}/demos/${product.slug}/index.html?lang=en#/product/${flow.product}`, { waitUntil: 'load' });
    await shop.locator('h1').first().waitFor({ timeout: 20000 });
    await shop.waitForFunction(() => [...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight).every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
    await snap(shop, 'flow-1-product');

    stage = 'checkout';
    // A product sold in sizes needs one picked first (`option`, e.g. "M").
    // (Matched by its text: size pickers are often marked up as radio buttons, not plain buttons.)
    if (flow.option) await shop.locator('button, [role="radio"], label').filter({ hasText: new RegExp(`^\\s*${flow.option}\\s*$`) }).first().click();
    await shop.getByRole('button', { name: /Add to cart/i }).first().click();
    await shop.waitForTimeout(500);
    await shop.keyboard.press('Escape');
    // Every one of these shops keeps its page in the hash, so this is how its own links get there too.
    await shop.evaluate(() => { location.hash = '#/checkout'; });
    await shop.getByLabel(/Full name/).waitFor({ timeout: 15000 });
    await shop.getByLabel(/Full name/).fill(flow.customer || 'Nusrat Jahan');
    await shop.getByLabel(/Mobile number/).fill(flow.phone || '01712345678');
    // Shops that check the number by SMS: photograph the code arriving. (In the demo it shows on screen.)
    const send = shop.getByRole('button', { name: /Send code/i });
    if (await send.count()) {
      await clearToasts(shop);
      await send.click();
      const toast = shop.locator('.toast', { hasText: /\d{6}/ }).last();
      await toast.waitFor({ timeout: 15000 });
      const code = (await toast.textContent()).match(/(\d{6})/)[1];
      const codeBox = shop.getByPlaceholder(/6-digit/);
      await codeBox.fill(code);
      await codeBox.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await snap(shop, 'flow-2-sms-code');
      stage = 'order';
      await shop.getByRole('button', { name: 'Verify', exact: true }).click();
      await shop.getByText(/Verified/).first().waitFor({ timeout: 10000 });
    }

    stage = 'order';
    await shop.getByLabel(/Division/).selectOption({ label: addr.division });
    await shop.getByLabel(/District/).selectOption({ label: addr.district });
    await shop.getByLabel(/Upazila/).selectOption({ label: addr.upazila });
    await shop.getByLabel(/House, road|Area, road/).fill(addr.area);
    await shop.waitForTimeout(600);
    await shop.getByRole('button', { name: /Place order/i }).click();
    // The thank-you page is #/order/<number> in every one of these shops, whatever its heading says.
    await shop.waitForFunction(() => /^#\/order\/[^?]+/.test(location.hash), null, { timeout: 20000 });
    const orderNo = decodeURIComponent((await shop.evaluate(() => location.hash)).match(/^#\/order\/([^?]+)/)[1]);
    await shop.locator('h1').first().waitFor({ timeout: 10000 });
    await shop.evaluate(() => scrollTo({ top: 0 }));
    await clearToasts(shop);
    await snap(shop, 'flow-3-order-placed');

    stage = 'admin';
    const admin = await ctx.newPage();
    await admin.goto(`${BASE}/demos/${product.adminSlug}/index.html#/orders?q=${encodeURIComponent(orderNo)}`, { waitUntil: 'load' });
    const row = admin.locator('[data-open]', { hasText: orderNo }).first();
    await row.waitFor({ timeout: 20000 });
    await row.click();
    await clearToasts(admin);
    await admin.waitForTimeout(1200);
    await toTop(admin);
    await snap(admin, 'flow-4-admin-order');

    stage = 'confirmed';
    // Log the confirmation call where the admin has one, then move the order to Confirmed.
    const called = admin.locator('[data-attempt="confirmed"]');
    if (await called.count()) await called.first().click();
    const next = admin.locator('[data-next="confirmed"]:not([disabled])');
    await next.first().waitFor({ timeout: 8000 }).then(() => next.first().click()).catch(() => {});
    // Some admins ask "Are you sure?" in their own dialog first.
    const yes = admin.getByRole('button', { name: /^(Yes|Continue|OK)$/ });
    await yes.first().waitFor({ state: 'visible', timeout: 2500 }).then(() => yes.first().click()).catch(() => {});
    // Confirmed once the "→ Confirmed" step is gone from the panel (it re-renders on the next status).
    await admin.waitForFunction(() => !document.querySelector('[data-next="confirmed"]'), null, { timeout: 15000 });
    // An admin that closes the panel after a status change: open the order again to show it confirmed.
    await admin.waitForTimeout(600);
    if (!(await admin.locator('[data-next]').count())) {
      await row.click();
      await admin.locator('[data-next]').first().waitFor({ timeout: 15000 });
    }
    await admin.waitForTimeout(800);
    await clearToasts(admin);
    await toTop(admin);
    await snap(admin, 'flow-5-confirmed');
  } catch (e) {
    console.log(`   FAIL order walk-through at "${stage}": ${e.message.split('\n')[0]}`);
    missing.push(`${product.slug}/order walk-through (stopped at ${stage})`);
    failed++;
  }
  await ctx.close();
}

/* ------------------------------------------------------------- capturing - */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let taken = 0, failed = 0;
const missing = [];

for (const product of products) {
  const outDir = join(OUT_ROOT, product.slug);
  await mkdir(outDir, { recursive: true });
  // Clear stale shots, so a renamed label cannot leave an orphan behind that
  // the build then happily links to.
  for (const f of await readdir(outDir).catch(() => [])) {
    if (f.endsWith('.png')) await rm(join(outDir, f));
  }

  console.log(`== ${product.title}`);
  for (const shot of product.shots) {
    const viewport = VIEWPORTS[shot.viewport || 'desktop'];
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    const url = `${BASE}/demos/${shot.slug || product.slug}/${shot.page}`;
    const out = join(outDir, `${shot.label}.png`);

    try {
      const res = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      if (!res || res.status() >= 400) throw new Error(`HTTP ${res ? res.status() : 'no response'}`);

      // An SPA has an empty body at `load`. Wait for it to put something there.
      await page.waitForFunction(
        () => document.body && document.body.innerText.trim().length > 40,
        { timeout: 15000 },
      ).catch(() => {});

      // Then let webfonts and above-the-fold images settle, or the shot catches
      // a fallback font mid-swap.
      await page.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
      await page.waitForTimeout(900);

      const text = await page.evaluate(() => (document.body?.innerText || '').trim().length);
      if (text < 40) throw new Error(`rendered blank (${text} chars of text)`);

      await page.screenshot({ path: out, fullPage: false });
      console.log(`   ok   ${shot.label}  (${viewport.width}x${viewport.height})`);
      taken++;
    } catch (e) {
      console.log(`   FAIL ${shot.label}: ${e.message}`);
      missing.push(`${product.slug}/${shot.label}  (from demos/${shot.slug || product.slug}/${shot.page})`);
      failed++;
    }
    await page.close();
  }
  if (product.orderFlow && product.adminSlug) await captureOrderFlow(product, outDir);
}

await browser.close();
server.close();

/* ------------------------------------------------------------- to WebP - */

/**
 * The PNGs are captured at deviceScaleFactor 2 and come to roughly 25 MB for a
 * set this size — too much to put in a repository and far too much to send to
 * a phone on a Bangladeshi mobile connection, which is the exact audience the
 * showcase is arguing it understands. WebP at 82 brings the same set under
 * 2 MB with no visible difference at the size these are displayed.
 *
 * Done with Pillow rather than sharp because sharp is not a dependency here and
 * adding a native module to a static site for one build step is a poor trade.
 */
if (taken) {
  const { execFileSync } = await import('node:child_process');
  const py = `
import pathlib, sys
from PIL import Image
root = pathlib.Path(${JSON.stringify(OUT_ROOT)})
before = after = 0
for png in sorted(root.rglob('*.png')):
    before += png.stat().st_size
    img = Image.open(png).convert('RGB')
    # Half the pixels: these were taken at 2x for sharpness, and the pages show
    # them at CSS width. Keeping 2x would be paying twice for the same picture.
    img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    out = png.with_suffix('.webp')
    img.save(out, 'WEBP', quality=82, method=6)
    after += out.stat().st_size
    png.unlink()
print(f'{before/1048576:.1f} MB of PNG -> {after/1048576:.2f} MB of WebP')
`;
  try {
    const out = execFileSync('python3', ['-c', py], { encoding: 'utf8' });
    console.log(`\n${out.trim()}`);
  } catch (e) {
    console.log('\nWebP conversion failed, leaving the PNGs in place:');
    console.log(`  ${e.message.split('\n')[0]}`);
    console.log('  Install Pillow (pip install Pillow) and re-run, or convert by hand.');
  }
}

console.log(`\n${taken} captured, ${failed} failed`);
if (failed) {
  console.log('\nThese shots were NOT written, so build-showcase.mjs will leave them out');
  console.log('rather than link a missing file:');
  missing.forEach((m) => console.log(`  ${m}`));
}
process.exit(0);
