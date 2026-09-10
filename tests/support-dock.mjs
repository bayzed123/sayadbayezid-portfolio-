/**
 * The support dock, in a real browser.
 *
 * Two things here are worth more than the rest. First: while no Facebook Page
 * handle is configured, the Messenger button must not exist at all — an m.me
 * link built from a guess opens Messenger on an error screen, which is worse
 * than no button. Second: opening a chat is a contact, and it has to reach the
 * Conversions API as one, or the dock is invisible to every report we built.
 *
 * Serve the repo and run:
 *   python3 -m http.server 5601 &
 *   node tests/support-dock.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const SITE = process.env.SITE_URL || 'http://127.0.0.1:5601';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:390,height:844} }); // a phone, where this matters most
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

// Catch the server-side copy of the event without letting it leave the machine.
const tracked=[];
await page.route('**/api/track', route => {
  try { tracked.push(JSON.parse(route.request().postData() || '{}')); } catch { tracked.push({}); }
  route.fulfill({ status:200, contentType:'application/json', body:'{"ok":true}' });
});

await page.goto(`${SITE}/index.html`, { waitUntil:'domcontentloaded' });
await page.waitForSelector('[data-support-dock]', { timeout:10000 });

console.log('== it is there, and it is closed ==');
check('the dock renders', await page.locator('[data-support-dock]').count() === 1);
check('the launcher is visible', await page.locator('.support-launcher').isVisible());
check('the channels start hidden', !(await page.locator('.support-channels').isVisible()));
check('and it says so to a screen reader',
  await page.locator('.support-launcher').getAttribute('aria-expanded') === 'false');
check('the launcher is labelled',
  (await page.locator('.support-launcher').getAttribute('aria-label') || '').length > 0);

console.log('== no half-configured channel ever ships ==');
// A channel is only offered when it has somewhere real to go. An m.me link
// built from a wrong or empty handle opens Messenger on an error screen, which
// is worse than no button — so the list is filtered on a truthy href, and this
// asserts the filter rather than the current configuration.
const guard = await page.evaluate(async () => {
  const source = await (await fetch('/assets/js/support.js')).text();
  return /\.filter\(function \(channel\) \{ return channel\.href; \}\)/.test(source);
});
check('channels without a destination are filtered out', guard);

console.log('== clicking opens it ==');

await page.locator('.support-launcher').click();
await page.waitForSelector('.support-channels:visible', { timeout:5000 });
check('the channels appear', await page.locator('.support-channels').isVisible());
check('aria-expanded follows', await page.locator('.support-launcher').getAttribute('aria-expanded') === 'true');
const wa = page.locator('[data-support-channel="whatsapp"]');
check('WhatsApp is offered', await wa.count() === 1);
check('pointing at the real link',
  (await wa.getAttribute('href')) === 'https://wa.me/message/TDYG575YENF6F1',
  await wa.getAttribute('href'));

console.log('== Messenger is offered too ==');
const fb = page.locator('[data-support-channel="messenger"]');
check('the Messenger button is there', await fb.count() === 1);
check('pointing at the configured Page',
  (await fb.getAttribute('href')) === 'https://m.me/bayezidDME', await fb.getAttribute('href'));
check('and it is labelled', (await fb.innerText()).trim() === 'Messenger', await fb.innerText());
check('both channels are offered', await page.locator('[data-support-channel]').count() === 2,
  String(await page.locator('[data-support-channel]').count()));

console.log('== an external link is opened safely ==');
check('it opens in a new tab', await wa.getAttribute('target') === '_blank');
// noopener stops the opened tab reaching back through window.opener.
const rel = (await wa.getAttribute('rel')) || '';
check('with noopener', rel.includes('noopener'), rel);
check('and noreferrer', rel.includes('noreferrer'), rel);

console.log('== opening a chat counts as a contact ==');
// Intercept the navigation: the click must fire the event, and the test must
// not actually leave for wa.me.
await page.route('https://wa.me/**', route => route.abort());
await wa.click({ modifiers: [] }).catch(() => {});
await page.waitForTimeout(600);
check('a Contact event was sent', tracked.some(e => e.event_name === 'Contact'),
  JSON.stringify(tracked));
check('naming which channel',
  tracked.some(e => e.custom_data && e.custom_data.content_name === 'whatsapp'),
  JSON.stringify(tracked));
check('with a dedup id', tracked.some(e => typeof e.event_id === 'string' && e.event_id.length > 8),
  JSON.stringify(tracked));
check('and the page it came from', tracked.some(e => /index\.html|127\.0\.0\.1/.test(e.event_source_url || '')),
  JSON.stringify(tracked));

console.log('== it can be dismissed ==');
await page.reload({ waitUntil:'domcontentloaded' });
await page.waitForSelector('[data-support-dock]');
await page.locator('.support-launcher').click();
await page.waitForSelector('.support-channels:visible');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Escape closes it', !(await page.locator('.support-channels').isVisible()));
// Focus has to come back, or a keyboard user is dropped at the top of the page.
check('and focus returns to the launcher',
  await page.evaluate(() => document.activeElement?.classList.contains('support-launcher')));

await page.locator('.support-launcher').click();
await page.waitForSelector('.support-channels:visible');
await page.locator('h1').first().click({ force:true });
await page.waitForTimeout(200);
check('clicking the page closes it', !(await page.locator('.support-channels').isVisible()));

console.log('== it reaches the pages that matter ==');
for (const path of ['/contact.html', '/blog/google-maps-lead-generation-google-sheets/index.html']) {
  await page.goto(SITE + path, { waitUntil:'domcontentloaded' });
  check(`present on ${path}`, await page.locator('[data-support-dock]').count() === 1);
}

console.log('== and stays off the admin console ==');
// That page loads no third-party anything by design, and a "contact support"
// button on your own ops dashboard is noise.
await page.goto(`${SITE}/admin/`, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(400);
check('absent from /admin', await page.locator('[data-support-dock]').count() === 0);
check('and its script is not loaded there',
  !/assets\/js\/support\.js/.test(await page.content()));

check('no JS errors', errs.length === 0, errs.join(' | '));
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
