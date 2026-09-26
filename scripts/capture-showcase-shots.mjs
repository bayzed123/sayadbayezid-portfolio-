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
    const url = `${BASE}/demos/${product.slug}/${shot.page}`;
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
      missing.push(`${product.slug}/${shot.label}`);
      failed++;
    }
    await page.close();
  }
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
