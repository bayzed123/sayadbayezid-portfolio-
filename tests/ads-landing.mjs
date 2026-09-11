/**
 * The ad funnel, driven in a real browser.
 *
 * This is where paid traffic lands, so two things must be true and neither is
 * visible by reading the HTML: the tracking has to report what actually
 * happened, and the form has to be the only way a lead is created.
 *
 * The checks below exist because of specific ways this can go wrong:
 *
 *   - A browser event and its server copy that do NOT share an event_id are
 *     counted twice by Meta, and every cost-per-lead you read afterwards is
 *     half what it really is.
 *   - ViewContent gated on "50% of the section visible" never fires on a
 *     phone, because one column makes that section taller than the viewport.
 *     It is gated on a dwell instead, and a dwell is only worth having if
 *     scrolling straight past genuinely does not count.
 *   - fbc is what ties a conversion back to the ad click. The Pixel writes it
 *     to a cookie, but only once it has loaded — and it is the thing most
 *     often blocked. Built from the fbclid in the URL, it survives that.
 *   - utm parameters are gone from the URL by the time most people submit.
 *   - A page in the funnel with no tracking is a hole in the funnel: whoever
 *     opens the privacy policy or the demo hub and comes back is the warmest
 *     audience there is, and invisible if those pages report nothing.
 *   - A server error message rendered as HTML is a cross-site scripting hole
 *     on a page that collects phone numbers.
 *
 * Nothing real is called: fbq is stubbed, and /api/track and /api/contact are
 * intercepted. No event reaches Meta and no enquiry reaches the inbox.
 *
 * Serve the site first, then run this:
 *
 *   python3 -m http.server 8901
 *   node tests/ads-landing.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8901';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

async function scrollTo(page, sel) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel);
  await page.waitForFunction((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return r.top > -80 && r.top < 260;
  }, sel, { timeout: 5000 });
}

// Capture on the Node side. Doing it inside the route handler (page.evaluate
// while the request is paused) races the page and silently drops events.
async function newPage(path = '/ads/fullstack/', query = '', vp = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport: vp });
  page.capi = [];
  page.contact = [];
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.route('**://connect.facebook.net/**', (r) => r.abort());
  await page.addInitScript(() => {
    window.__fbq = [];
    window.fbq = (...a) => window.__fbq.push(a);
  });
  await page.route('**/api/track', (route) => {
    page.capi.push(route.request().postDataJSON());
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('**/api/contact', (route) => {
    page.contact.push(route.request().postDataJSON());
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(BASE + path + query, { waitUntil: 'load', timeout: 20000 });
  return page;
}

console.log('\n1. ViewContent needs a real dwell, at any viewport height');
{
  const page = await newPage();
  await page.waitForTimeout(300);
  ok(page.capi.filter((e) => e.event_name === 'ViewContent').length === 0, 'nothing before the packages are on screen');

  await scrollTo(page, '#packages');       // land on it, then leave under the dwell
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  ok(page.capi.filter((e) => e.event_name === 'ViewContent').length === 0, 'scrolling straight past does not count as a view');

  await scrollTo(page, '#packages');       // now stop and read it, twice
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await scrollTo(page, '#packages');
  await page.waitForTimeout(1500);

  const vc = page.capi.filter((e) => e.event_name === 'ViewContent');
  ok(vc.length === 1, `exactly one ViewContent after two passes (got ${vc.length})`);
  const browserVC = (await page.evaluate(() => window.__fbq)).filter((c) => c[1] === 'ViewContent');
  ok(browserVC.length === 1, 'the browser copy fired once too');
  ok(browserVC[0][3] && browserVC[0][3].eventID === vc[0].event_id,
     'browser and server copies share one event_id (Meta dedupes rather than double-counting)');
  await page.close();
}

console.log('\n2. fbc is built from fbclid when the Pixel never wrote the cookie');
{
  const page = await newPage('/ads/fullstack/', '?fbclid=TESTCLICK123&utm_source=facebook&utm_campaign=shop-sep');
  await scrollTo(page, '#packages');
  await page.waitForTimeout(1500);
  const vc = page.capi.find((e) => e.event_name === 'ViewContent');
  ok(!!vc, 'the event arrived');
  ok(/^fb\.1\.\d+\.TESTCLICK123$/.test(vc.user_data.fbc), `fbc is in Meta's fb.1.<ts>.<fbclid> shape (${vc.user_data.fbc})`);
  await page.close();
}

console.log('\n3. Order buttons are everywhere, and every one reports itself');
{
  const page = await newPage();
  const buttons = await page.$$eval('[data-order]', (els) => els.map((e) => e.getAttribute('data-order')));
  ok(buttons.length >= 9, `at least nine order buttons down the page (found ${buttons.length})`);
  ok(new Set(buttons).size === buttons.length, 'each one is named distinctly, so reporting can tell them apart');
  for (const where of ['hero', 'sticky-bar', 'after-faq', 'tier-starter', 'offer'])
    ok(buttons.includes(where), `there is an order button at "${where}"`);

  // every one of them actually goes to the form
  const hrefs = await page.$$eval('a[data-order]', (els) => els.map((e) => e.getAttribute('href')));
  ok(hrefs.every((h) => h === '#order'), 'every order link points at the form, none wander off');

  await page.click('a[data-order="hero"]');
  await page.waitForTimeout(300);
  const fbqCalls = await page.evaluate(() => window.__fbq);
  const intent = fbqCalls.filter((c) => c[0] === 'trackCustom' && c[1] === 'ContactIntent');
  ok(intent.length === 1, 'clicking one fires ContactIntent');
  ok(intent[0][2].placement === 'hero', 'and it names which button was pressed');
  ok(!page.capi.some((e) => e.event_name === 'ContactIntent'),
     'ContactIntent stays out of the Conversions API — it is not a lead and must not inflate one');
  await page.close();
}

console.log('\n4. The sticky order bar hides behind the hero and follows the rest');
{
  const page = await newPage('/ads/fullstack/', '', { width: 1280, height: 900 });
  await page.waitForTimeout(400);
  ok(!(await page.evaluate(() => document.getElementById('orderBar').classList.contains('is-up'))),
     'it stays down over the hero, instead of covering the headline that is doing the selling');
  await scrollTo(page, '#packages');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('orderBar').classList.contains('is-up')),
     'it comes up once the hero is gone');
  await page.close();
}

console.log('\n5. Opening a demo is recorded — that is the retargeting audience');
{
  const page = await newPage();
  const demos = await page.$$eval('[data-demo]', (els) => els.map((e) => ({
    name: e.getAttribute('data-demo'), href: e.getAttribute('href'), target: e.getAttribute('target'), rel: e.getAttribute('rel'),
  })));
  ok(demos.length >= 4, `at least four demo links (found ${demos.length})`);
  ok(demos.every((d) => d.href.startsWith('https://demu.sayadbayezid.com')), 'all point at the live demo hub');
  ok(demos.every((d) => d.target === '_blank' && (d.rel || '').includes('noopener')),
     'each opens in a new tab with noopener, so the landing page is never lost or exposed');

  await page.evaluate(() => {
    // Follow the click for tracking, but do not actually leave in the test.
    document.querySelectorAll('[data-demo]').forEach((a) => a.removeAttribute('href'));
  });
  await page.click('[data-demo]');
  await page.waitForTimeout(400);
  const demoEvents = page.capi.filter((e) => e.custom_data && e.custom_data.content_category === 'Demo');
  ok(demoEvents.length === 1, 'opening a demo reports a ViewContent in the Demo category');
  await page.close();
}

console.log('\n6. The form refuses incomplete and unconsented requests');
{
  const page = await newPage();
  const submit = async () => { await page.click('#orderSubmit'); await page.waitForTimeout(200); };
  const banner = () => page.evaluate(() => document.getElementById('orderBanner').textContent.trim());

  await submit();
  ok((await banner()).includes('Name, phone and email'), 'an empty form is rejected');
  ok(page.contact.length === 0, 'nothing was sent');

  await page.fill('#oName', 'Rakib Hasan');
  await page.fill('#oPhone', '01712345678');
  await page.fill('#oEmail', 'not-an-email');
  await submit();
  ok((await banner()).includes("doesn't look right"), 'a malformed email is caught');

  await page.fill('#oEmail', 'rakib@example.com');
  await submit();
  ok((await banner()).includes('consent box'), 'no consent, no send');
  ok(page.contact.length === 0, 'still nothing sent');
  await page.close();
}

console.log('\n7. A complete order: the request carries everything, Lead fires once');
{
  const page = await newPage('/ads/fullstack/', '?utm_source=facebook&utm_medium=paid&utm_campaign=shop-sep&fbclid=ABC999');
  await page.fill('#oName', 'Rakib Hasan');
  await page.fill('#oPhone', '01712345678');
  await page.fill('#oEmail', 'rakib@example.com');
  await page.fill('#oBusiness', 'phone accessories and smartwatches');
  await page.fill('#oWebsite', 'https://rakibshop.com');
  await page.selectOption('#oScope', 'Starter Shop');
  await page.fill('#oMessage', 'About 40 products, my brother will run the dashboard.');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(600);

  const [enquiry] = page.contact;
  ok(!!enquiry, 'the request reached /api/contact');
  ok(enquiry.name === 'Rakib Hasan' && enquiry.email === 'rakib@example.com', 'name and email are top-level, as the API requires');
  for (const bit of ['01712345678', 'Starter Shop', 'rakibshop.com', 'phone accessories', '40 products', 'utm_campaign=shop-sep'])
    ok(enquiry.message.includes(bit), `the request carries "${bit}"`);

  const leads = page.capi.filter((e) => e.event_name === 'Lead');
  ok(leads.length === 1, `exactly one Lead (got ${leads.length})`);
  ok(leads[0].user_data.em === 'rakib@example.com', 'email goes to my own worker for hashing, never to Meta raw');
  ok(leads[0].user_data.ph === '01712345678', 'phone likewise');
  ok(!!leads[0].user_data.fbc, 'the Lead carries fbc, so the sale ties back to the ad click');
  ok(leads[0].custom_data.content_category === 'Starter Shop', 'the chosen package rides along');
  ok(await page.evaluate(() => document.getElementById('orderForm').hidden), 'the form is hidden after success');
  ok((await page.evaluate(() => document.getElementById('orderBanner').textContent)).includes('Got it'), 'success is confirmed');
  await page.close();
}

console.log('\n8. A server error is shown, and never rendered as markup');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://connect.facebook.net/**', (r) => r.abort());
  await page.addInitScript(() => { window.fbq = () => {}; });
  await page.route('**/api/track', (r) => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/contact', (r) => r.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ error: '<img src=x onerror="window.__pwned=1">too many requests' }),
  }));
  await page.goto(BASE + '/ads/fullstack/', { waitUntil: 'load', timeout: 20000 });
  await page.fill('#oName', 'A'); await page.fill('#oPhone', '017'); await page.fill('#oEmail', 'a@b.co');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => window.__pwned === undefined), 'a hostile server message cannot execute script');
  ok((await page.evaluate(() => document.getElementById('orderBanner').textContent)).includes('too many requests'), 'it is still shown, as text');
  ok(!(await page.evaluate(() => document.getElementById('orderForm').hidden)), 'the form stays open so they can retry');
  ok(!(await page.evaluate(() => document.getElementById('orderSubmit').disabled)), 'the button is re-enabled');
  await page.close();
}

console.log('\n9. Attribution survives losing the query string mid-visit');
{
  const page = await newPage('/ads/fullstack/', '?utm_campaign=shop-sep&utm_source=facebook');
  await page.evaluate(() => history.replaceState({}, '', '/ads/fullstack/'));
  await page.fill('#oName', 'Nadia'); await page.fill('#oPhone', '018'); await page.fill('#oEmail', 'n@b.co');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(500);
  ok(page.contact[0].message.includes('utm_campaign=shop-sep'), 'the campaign is still named on the request');
  await page.close();
}

console.log('\n10. Every page the ad can reach reports something');
{
  for (const path of ['/privacy-policy.html', '/terms-of-service.html']) {
    const page = await newPage(path, '?fbclid=POLICYCLICK&utm_campaign=shop-sep');
    await page.waitForTimeout(500);
    const bootstrapped = await page.evaluate(() => !!window.AdsTrack);
    ok(bootstrapped, `${path} loads the funnel tracking script`);
    ok(page.errors.length === 0, `${path} raises no script error`);
    await page.close();
  }
  // and the shared script must not re-initialise a pixel a page already runs
  const page = await newPage('/services.html');
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => window.__adsPixelBootstrapped === undefined || !document.querySelector('script[src*="ads-track"]')),
     'a page that already carries the site Pixel is not double-initialised');
  await page.close();
}

console.log('\n11. The look is the ad funnel\'s, not the portfolio\'s');
{
  const css = readFileSync(new URL('../ads/assets/ads.css', import.meta.url), 'utf8');
  const page = await newPage();
  const cta = await page.evaluate(() => getComputedStyle(document.querySelector('.btn-order')).backgroundImage);
  ok(/gradient/.test(cta), 'the order button carries the flame gradient');
  ok(!/00D084|00A868/i.test(css), 'the site emerald is gone from the ad stylesheet');

  /* The gradient is what makes the order button read as "press this" with no
     instruction at all, and that only holds while nothing else on the page
     wears it as a SURFACE. Gradient-clipped text (the headline's "your
     requirement") paints letterforms, not a pressable box, so it cannot be
     mistaken for a button and is allowed — that is the one exception, and it
     is checked for rather than waved through. */
  const surfaces = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter((el) => /linear-gradient\(10[0-9]deg/.test(getComputedStyle(el).backgroundImage))
    .filter((el) => {
      const cs = getComputedStyle(el);
      return (cs.webkitBackgroundClip || cs.backgroundClip) !== 'text'; // painted box, not text
    })
    .filter((el) => !el.classList.contains('btn-order'))
    .map((el) => el.tagName.toLowerCase() + '.' + el.className));
  ok(surfaces.length === 0, `no painted surface except the order button wears that gradient${surfaces.length ? ' — found ' + surfaces.join(', ') : ''}`);

  const textUses = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter((el) => {
      const cs = getComputedStyle(el);
      return /linear-gradient\(10[0-9]deg/.test(cs.backgroundImage)
        && (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
    }).length);
  ok(textUses <= 1, `gradient text is used sparingly — once, in the headline (found ${textUses})`);
  await page.close();
}

console.log('\n12. It works at phone width, and the gallery works without JavaScript');
{
  const page = await newPage();
  ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth === 0),
     'no sideways scrolling at 390px');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('rail')).overflowX === 'auto'),
     'the gallery scrolls through CSS, so it survives a blocked script on a slow phone');
  const shots = await page.$$eval('#rail .shot', (els) => els.length);
  ok(shots === 12, `all twelve screens are in the gallery (found ${shots})`);
  ok(await page.$$eval('#rail img', (els) => els.every((i) => (i.getAttribute('alt') || '').length > 10)),
     'every screenshot has a real alt description');
  ok((await page.$$eval('.faq-item', (els) => els.length)) >= 6, 'the FAQ is there');
  await page.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
