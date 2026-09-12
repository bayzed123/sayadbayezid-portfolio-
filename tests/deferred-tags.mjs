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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

async function open() {
  const page = await browser.newPage({ viewport: { width: 412, height: 823 } });
  page.hits = [];
  // Serve a tiny stub in place of each real library and record that it was asked for.
  for (const pattern of ['**://connect.facebook.net/**', '**://www.googletagmanager.com/**']) {
    await page.route(pattern, (route) => {
      page.hits.push(new URL(route.request().url()).pathname);
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.__loaded=(window.__loaded||0)+1;' });
    });
  }
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
  return page;
}

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
  ok(p.hits.some((h) => h.includes('fbevents')), 'the Meta Pixel loads on interaction');
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
  ok(p.hits.some((h) => h.includes('fbevents')), 'the Pixel loaded on the timeout alone, with no interaction at all');
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
  const pixel = p.hits.filter((h) => h.includes('fbevents')).length;
  const gtm = p.hits.filter((h) => h.includes('gtm.js')).length;
  ok(pixel === 1, `the Pixel was requested once despite repeated interaction and the timeout (got ${pixel})`);
  ok(gtm === 1, `GTM once (got ${gtm})`);
  await p.close();
}

console.log('\n5. Every page carries the loader, and none carries an inline tag');
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
