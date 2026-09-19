/**
 * The switch that turns measurement off, checked on the pages that matter.
 *
 * WHY THIS SUITE EXISTS.
 * Measurement on this site runs on arrival. There is no banner gating it and
 * there never has been — which is a defensible choice only while the way out
 * is real. So these checks are not about a preference being stored; they are
 * about the tracking actually stopping.
 *
 * The specific failure being guarded against: the site has TWO trackers.
 * /assets/tags.js runs almost everywhere, and /ads/assets/ads-track.js runs on
 * the landing page, the terms page and — worst of all — the privacy policy,
 * where it bootstraps its own Pixel. An opt-out honoured by only one of them
 * would work on most of the site and be silently ignored on the one page a
 * visitor goes to in order to find the switch. Both files read the same key,
 * and the check below proves it on the privacy policy, which loads both.
 *
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *   CHROMIUM_PATH=... node tests/opt-out.mjs
 */
import { chromium } from 'playwright';
import { statSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';

/* The pages load tags.min.js, so a source edit that has not been built is
   invisible here — the same trap that let a deliberate break pass 21 checks. */
for (const [src, out] of [['assets/tags.js', 'assets/tags.min.js']]) {
  if (statSync(src).mtimeMs > statSync(out).mtimeMs) {
    console.error(`\nREFUSING TO RUN: ${out} is older than ${src}.\n  npm run build:assets\n`);
    process.exit(2);
  }
}

let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

const VENDOR = /googletagmanager\.com|google-analytics\.com|facebook\.(com|net)|\/api\/pixel\.js|\/api\/track/;

async function open(path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const hits = [];
  page.on('request', (r) => { if (VENDOR.test(r.url())) hits.push(r.url()); });
  // Nothing reaches a real vendor from a test run.
  await page.route(VENDOR, (route) => route.fulfill({
    status: 200, contentType: 'application/javascript', body: '/* stub */',
  }));
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  return { ctx, page, hits };
}

console.log('\n== measurement runs without being asked ==');
{
  const { ctx, page, hits } = await open('/index.html');
  await page.waitForTimeout(4200);
  ok('something was requested from a measurement vendor', hits.length > 0,
    'nothing at all was requested — measurement may be broken, not private');
  ok('no consent banner is in the way',
    (await page.locator('#hub-consent, [data-consent]').count()) === 0);
  await ctx.close();
}

console.log('\n== the switch stops it, on this browser, for good ==');
{
  const { ctx, page } = await open('/index.html');
  await page.waitForTimeout(3800);

  await page.evaluate(() => window.bzTags.optOut());
  await page.waitForTimeout(300);

  ok('it is remembered', await page.evaluate(() => window.bzTags.optedOut()) === true);
  const left = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[src]')).map((s) => s.src)
      .filter((s) => /fbevents|pixel\.js|googletagmanager/.test(s)));
  ok('the tracking scripts are removed from the page, not just disabled',
    left.length === 0, left.join('\n       '));

  // Nothing new goes out afterwards.
  const after = [];
  page.on('request', (r) => { if (VENDOR.test(r.url())) after.push(r.url()); });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  ok('nothing further is sent', after.length === 0, after.slice(0, 3).join('\n       '));

  const reload = [];
  page.on('request', (r) => { if (VENDOR.test(r.url())) reload.push(r.url()); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  ok('and a fresh page load starts nothing', reload.length === 0, reload.slice(0, 3).join('\n       '));
  ok('fbq is still callable, so nothing on the page throws',
    await page.evaluate(() => { try { window.fbq && window.fbq('track', 'X'); return true; } catch (e) { return false; } }));
  await ctx.close();
}

console.log('\n== and it holds on the page that loads the OTHER tracker ==');
{
  // privacy-policy.html loads BOTH /assets/tags.min.js and
  // /ads/assets/ads-track.js, and the second bootstraps its own Pixel. This is
  // the check that would have caught an opt-out honoured by only one of them —
  // on the exact page where someone goes to find the switch.
  const { ctx, page } = await open('/privacy-policy.html');
  await page.waitForTimeout(3800);
  ok('both trackers are on this page',
    (await page.locator('script[src*="ads-track"]').count()) === 1 &&
    (await page.locator('script[src*="tags.min"]').count()) === 1);

  await page.evaluate(() => window.bzTags.optOut());
  const reload = [];
  page.on('request', (r) => { if (VENDOR.test(r.url())) reload.push(r.url()); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4200);
  ok('neither tracker starts after opting out', reload.length === 0,
    reload.slice(0, 4).join('\n       '));
  await ctx.close();
}

console.log('\n== the link in the policy is the switch, and is not a trap for others ==');
{
  const { ctx, page } = await open('/privacy-policy.html');
  await page.waitForTimeout(2000);
  ok('the policy links to it', (await page.locator('a[href$="#stop-tracking"]').count()) >= 1);

  await page.locator('a[href$="#stop-tracking"]').first().click();
  await page.waitForTimeout(500);
  ok('clicking it opts out', await page.evaluate(() => window.bzTags.optedOut()) === true);
  ok('and says so, rather than doing nothing visible',
    (await page.locator('#cwb-optout-note').count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await open('/index.html#stop-tracking');
  await page.waitForTimeout(1500);
  ok('the URL alone works too', await page.evaluate(() => window.bzTags.optedOut()) === true);
  ok('and the hash is cleared, so a shared link does not opt out whoever opens it',
    await page.evaluate(() => location.hash) === '');
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
