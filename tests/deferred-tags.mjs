/**
 * The deferred third-party tag loader.
 *
 * Moving analytics off the critical path is only worth doing if the analytics
 * still arrive. A page that scores 100 and stops recording conversions is a
 * straight loss — so these checks are about the tags firing, not the speed.
 *
 * The three libraries are intercepted, so nothing reaches Google or Meta.
 *
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=... node tests/deferred-tags.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8901';

/* --------------------------------------------------------------------------
   Refuse to run against a stale build.

   The pages load assets/tags.min.js, not assets/tags.js. So editing the source
   and running these checks tests the PREVIOUS build — and it does not fail, it
   passes, which is worse. That happened here: a deliberate break to the
   deduplication id was introduced to prove this suite could catch it, and the
   suite reported 21 passed. The break was real; the browser had simply never
   seen it.

   Comparing mtimes costs nothing and makes that failure impossible to repeat.
   -------------------------------------------------------------------------- */
{
  const { statSync } = await import('node:fs');
  const stale = [
    ['assets/tags.js', 'assets/tags.min.js'],
    ['assets/main.js', 'assets/main.min.js'],
    ['assets/newsletter.js', 'assets/newsletter.min.js'],
    ['assets/js/engagement.js', 'assets/js/engagement.min.js'],
  ].filter(([src, out]) => {
    try { return statSync(src).mtimeMs > statSync(out).mtimeMs; } catch { return false; }
  });
  if (stale.length) {
    console.error('\nREFUSING TO RUN: these built files are older than their sources —');
    for (const [src, out] of stale) console.error(`  ${src}  ->  ${out}`);
    console.error('\nThe pages load the .min.js files, so this run would test the previous');
    console.error('build and pass while your change was never executed.\n');
    console.error('  npm run build:assets\n');
    process.exit(2);
  }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

/** The backend's own origin. The Pixel library is served from here now — see
 *  the note on PIXEL_SRC in assets/tags.js — so it has to be intercepted too,
 *  and its API calls answered as JSON rather than as JavaScript. */
const WORKER = '**://bayezid-agency-api.sayadmdbayezidhosan.workers.dev/**';

async function open({ blockPixel = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 412, height: 823 } });
  page.hits = [];
  page.tracked = [];

  // Serve a tiny stub in place of each real library and record that it was asked for.
  for (const pattern of ['**://connect.facebook.net/**', '**://www.googletagmanager.com/**']) {
    await page.route(pattern, (route) => {
      page.hits.push(new URL(route.request().url()).pathname);
      if (blockPixel) return route.abort('blockedbyclient');
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__loaded=(window.__loaded||0)+1;' });
    });
  }

  await page.route(WORKER, (route) => {
    const url = new URL(route.request().url());
    page.hits.push(url.pathname);

    if (url.pathname === '/api/pixel.js') {
      // An ad-blocker aborts the request; it does not answer it. Reproducing
      // that exactly is the point of this branch — a 200 with an empty body
      // would leave fbq.callMethod undefined too, and would pass the same
      // checks for the wrong reason.
      if (blockPixel) return route.abort('blockedbyclient');
      // Stand in for fbevents.js by doing the one thing the real library does
      // that anything here can observe: define callMethod, which is how the
      // page tells a live Pixel from the stub it installed at load time.
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'window.__loaded=(window.__loaded||0)+1;if(window.fbq){window.fbq.callMethod=function(){};}',
      });
    }

    if (url.pathname === '/api/track') {
      page.tracked.push(JSON.parse(route.request().postData() || '{}'));
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, fbp: 'fb.1.1700000000000.1234567890', firstParty: false }),
      });
    }

    route.fulfill({ status: 200, contentType: 'application/json', body: '{"events":[]}' });
  });

  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
  return page;
}

/** Where the Pixel library was asked for, under either name. */
const askedForPixel = (hits) => hits.some((h) => h.includes('fbevents') || h.includes('pixel.js'));

console.log('\n1. Nothing third-party is requested while the page is painting');
{
  const p = await open();
  await p.waitForTimeout(400);
  ok(p.hits.length === 0, `no tag requests in the first 400 ms (saw ${p.hits.length})`);
  ok(await p.evaluate(() => typeof window.fbq === 'function'), 'but fbq already exists, so nothing calling it throws');
  ok(await p.evaluate(() => Array.isArray(window.dataLayer)), 'and dataLayer exists');
  const queued = await p.evaluate(() => (window.fbq.queue || []).map((a) => Array.from(a)));
  ok(JSON.stringify(queued).includes('PageView'), 'the PageView is queued at real page-load time, not lost');
  ok(JSON.stringify(queued).includes('init'), 'and so is the pixel init');
  await p.close();
}

console.log('\n2. Touching the page loads them immediately');
{
  const p = await open();
  await p.waitForTimeout(300);
  await p.mouse.wheel(0, 200);
  await p.waitForTimeout(700);
  ok(askedForPixel(p.hits), 'the Meta Pixel loads on interaction');
  ok(p.hits.some((h) => h.includes('gtm.js')), 'GTM loads');
  ok(p.hits.some((h) => h.includes('gtag/js')), 'gtag loads');
  await p.close();
}

console.log('\n3. A visitor who never touches anything is still measured');
{
  // This is the check that matters most. "Load on interaction" is the common
  // advice and it silently loses every visitor who reads and leaves — which on
  // a phone is most of them. The timeout is what prevents that.
  const p = await open();
  await p.waitForTimeout(4200);
  ok(askedForPixel(p.hits), 'the Pixel loaded on the timeout alone, with no interaction at all');
  ok(p.hits.some((h) => h.includes('gtm.js')), 'so did GTM');
  await p.close();
}

console.log('\n4. They load exactly once');
{
  const p = await open();
  await p.mouse.wheel(0, 100);
  await p.waitForTimeout(200);
  await p.mouse.wheel(0, 100);
  await p.keyboard.press('Tab');
  await p.waitForTimeout(4500);
  const pixel = p.hits.filter((h) => h.includes('fbevents') || h.includes('pixel.js')).length;
  const gtm = p.hits.filter((h) => h.includes('gtm.js')).length;
  ok(pixel === 1, `the Pixel was requested once despite repeated interaction and the timeout (got ${pixel})`);
  ok(gtm === 1, `GTM once (got ${gtm})`);
  await p.close();
}

console.log('\n5. PageView goes twice, under one id');
{
  // The deduplication contract, checked end to end rather than assumed. If
  // these two ids ever differ, Meta counts one page view as two — and nothing
  // anywhere reports an error, which is why it has to be a test.
  const p = await open();
  await p.waitForTimeout(4500);

  const queued = await p.evaluate(() => (window.__fbqCalls || []).slice());
  const server = p.tracked.filter((t) => t.event_name === 'PageView');
  ok(server.length === 1, `the server half was sent exactly once (got ${server.length})`);

  const browserId = await p.evaluate(() => {
    const calls = (window.fbq.queue || []).map((a) => Array.from(a));
    const pv = calls.find((c) => c[0] === 'track' && c[1] === 'PageView');
    return pv && pv[3] ? pv[3].eventID : null;
  });
  // Once the library has "loaded", the queue has drained, so the id is read
  // from whichever side still has it. Either way the two must agree.
  if (browserId) {
    ok(server[0] && server[0].event_id === browserId,
      'the browser and server halves carry the same event_id');
  } else {
    ok(Boolean(server[0] && server[0].event_id),
      'the server half carries an event_id (the browser queue had already drained)');
  }
  ok(server[0] && server[0].browser_fired === true,
    'and it reports that the Pixel really fired');
  ok(server[0] && server[0].event_source_url.includes('/index.html'),
    'naming the page it happened on');
  void queued;
  await p.close();
}

console.log('\n6. A blocked Pixel is reported as blocked, not assumed fine');
{
  // The case the whole thing exists for. With the Pixel blocked the browser
  // half never happens, the server half still does, and Meta still reports a
  // conversion — so without browser_fired the dashboard cannot tell this
  // apart from a healthy setup. It reported "fired" for years because the
  // old test was `typeof fbq === 'function'`, and fbq is always a function.
  const p = await open({ blockPixel: true });
  await p.waitForTimeout(4500);
  const server = p.tracked.filter((t) => t.event_name === 'PageView');
  ok(server.length >= 1, 'the server half still goes when the Pixel is blocked');
  ok(server[0] && server[0].browser_fired === false,
    'and it says the browser half did not fire');
  ok(await p.evaluate(() => typeof window.fbq === 'function'),
    'fbq is still callable, so nothing on the page throws');
  await p.close();
}

console.log('\n7. Every page carries the loader, and none carries an inline tag');
{
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  const pages = [];
  (function walk(dir, depth) {
    if (depth > 3) return;
    for (const entry of readdirSync(dir)) {
      if (['node_modules', '.git', 'backup', 'Reference', 'tools'].includes(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, depth + 1);
      else if (entry.endsWith('.html') && !entry.endsWith('.backup')) pages.push(full);
    }
  })('.', 0);

  const inline = pages.filter((f) => {
    const s = readFileSync(f, 'utf8');
    return /fbq\(\s*['"]init|googletagmanager\.com\/gtm\.js|googletagmanager\.com\/gtag\/js/.test(s);
  });
  ok(inline.length === 0, `no page still loads a tag inline${inline.length ? ' — ' + inline.join(', ') : ''}`);
  ok(pages.length > 20, `checked ${pages.length} pages`);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
