/**
 * The fullstack ad landing page, driven in a real browser.
 *
 * This page is where paid traffic lands, so two things have to be true and
 * neither is visible by reading the HTML: the tracking has to report what
 * actually happened, and the form has to be the only way a lead is created.
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
const BASE = process.env.BASE_URL || 'http://localhost:8901';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
async function scrollToPrice(page) {
  await page.evaluate(() => document.getElementById('price').scrollIntoView());
  await page.waitForFunction(() => {
    const r = document.querySelector('#price .price-box').getBoundingClientRect();
    return r.top > -50 && r.top < 200;           // landed
  }, null, { timeout: 5000 });
}
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

// Capture on the Node side. Doing it inside the route handler (page.evaluate
// while the request is paused) races the page and silently drops events.
async function newPage(query = '') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.capi = [];
  page.contact = [];
  await page.route('**://connect.facebook.net/**', r => r.abort());
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
  await page.goto(BASE + '/ads/fullstack/' + query, { waitUntil: 'load', timeout: 20000 });
  return page;
}

console.log('\n1. ViewContent fires once, only when the price box is really seen');
{
  const page = await newPage();
  await page.waitForTimeout(400);
  let capi = page.capi;
  ok(capi.filter(e => e.event_name === 'ViewContent').length === 0, 'no ViewContent before the price box is on screen');

  // flick past it — under the dwell, so it must not count
  await scrollToPrice(page);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1500);
  ok(page.capi.filter(e => e.event_name === 'ViewContent').length === 0, 'scrolling straight past the price does not count as a view');

  // now actually stop and read it, twice
  await scrollToPrice(page);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await scrollToPrice(page);
  await page.waitForTimeout(1500);
  capi = page.capi;
  const vc = capi.filter(e => e.event_name === 'ViewContent');
  ok(vc.length === 1, `exactly one ViewContent after two passes (got ${vc.length})`);
  const fbqCalls = await page.evaluate(() => window.__fbq);
  const browserVC = fbqCalls.filter(c => c[1] === 'ViewContent');
  ok(browserVC.length === 1, 'browser copy fired once too');
  ok(browserVC[0][3] && browserVC[0][3].eventID === vc[0].event_id,
     'browser and server copies share one event_id (Meta will dedupe, not double-count)');
  await page.close();
}

console.log('\n2. fbc is built from fbclid when the Pixel never wrote the cookie');
{
  const page = await newPage('?fbclid=TESTCLICK123&utm_source=facebook&utm_campaign=fullstack-sep');
  await scrollToPrice(page);
  await page.waitForTimeout(1500);
  const capi = page.capi;
  const vc = capi.find(e => e.event_name === 'ViewContent');
  ok(!!vc.user_data.fbc, 'fbc present on the server copy');
  ok(/^fb\.1\.\d+\.TESTCLICK123$/.test(vc.user_data.fbc), `fbc is in Meta's fb.1.<ts>.<fbclid> shape (${vc.user_data.fbc})`);
  await page.close();
}

console.log('\n3. Custom ContactIntent stays out of the Conversions API');
{
  const page = await newPage();
  await page.click('a[data-cta="hero"]');
  await page.waitForTimeout(300);
  const fbqCalls = await page.evaluate(() => window.__fbq);
  const capi = page.capi;
  ok(fbqCalls.some(c => c[0] === 'trackCustom' && c[1] === 'ContactIntent'), 'ContactIntent fired in the browser');
  ok(!capi.some(e => e.event_name === 'ContactIntent'), 'ContactIntent NOT sent server-side');
  await page.close();
}

console.log('\n4. The form refuses to send incomplete or unconsented enquiries');
{
  const page = await newPage();
  const submit = async () => { await page.click('#orderSubmit'); await page.waitForTimeout(200); };
  const bannerText = () => page.evaluate(() => document.getElementById('orderBanner').textContent.trim());

  await submit();
  ok((await bannerText()).includes('Name, phone and email'), 'empty form is rejected');
  ok(page.contact.length === 0, 'nothing was sent');

  await page.fill('#oName', 'Rakib Hasan');
  await page.fill('#oPhone', '01712345678');
  await page.fill('#oEmail', 'not-an-email');
  await submit();
  ok((await bannerText()).includes("doesn't look right"), 'a malformed email is caught');

  await page.fill('#oEmail', 'rakib@example.com');
  await submit();
  ok((await bannerText()).includes('consent box'), 'no consent, no send');
  ok(page.contact.length === 0, 'still nothing sent');
  await page.close();
}

console.log('\n5. A complete submission: the enquiry carries everything, and Lead fires once');
{
  const page = await newPage('?utm_source=facebook&utm_medium=paid&utm_campaign=fullstack-sep&fbclid=ABC999');
  await page.fill('#oName', 'Rakib Hasan');
  await page.fill('#oPhone', '01712345678');
  await page.fill('#oEmail', 'rakib@example.com');
  await page.fill('#oWebsite', 'https://rakibshop.com');
  await page.selectOption('#oScope', 'Storefront only');
  await page.fill('#oMessage', 'I sell phone accessories, about 40 products.');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(500);

  const [enquiry] = page.contact;
  ok(!!enquiry, 'the enquiry reached /api/contact');
  ok(enquiry.name === 'Rakib Hasan' && enquiry.email === 'rakib@example.com', 'name and email are top-level, as the API requires');
  for (const bit of ['01712345678', 'Storefront only', 'rakibshop.com', 'phone accessories', 'utm_campaign=fullstack-sep', 'utm_source=facebook'])
    ok(enquiry.message.includes(bit), `message carries "${bit}"`);

  const capi = page.capi;
  const leads = capi.filter(e => e.event_name === 'Lead');
  ok(leads.length === 1, `exactly one Lead (got ${leads.length})`);
  ok(leads[0].user_data.em === 'rakib@example.com', 'email goes to my worker for hashing, not to Meta raw');
  ok(leads[0].user_data.ph === '01712345678', 'phone likewise');
  ok(!!leads[0].user_data.fbc, 'Lead carries fbc, so the conversion ties back to the ad click');
  ok(leads[0].custom_data.content_category === 'Storefront only', 'the chosen scope rides along');

  ok(await page.evaluate(() => document.getElementById('orderForm').hidden), 'the form is hidden after success');
  const banner = await page.evaluate(() => document.getElementById('orderBanner').textContent);
  ok(banner.includes('Got it'), 'success is confirmed to the visitor');
  await page.close();
}

console.log('\n6. A server error is shown, and never rendered as markup');
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**://connect.facebook.net/**', r => r.abort());
  await page.addInitScript(() => { window.fbq = () => {}; });
  await page.route('**/api/track', r => r.fulfill({ status: 200, body: '{}' }));
  await page.route('**/api/contact', r => r.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ error: '<img src=x onerror="window.__pwned=1">too many requests' }),
  }));
  await page.goto(BASE + '/ads/fullstack/', { waitUntil: 'load', timeout: 20000 });
  await page.fill('#oName', 'A'); await page.fill('#oPhone', '017'); await page.fill('#oEmail', 'a@b.co');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => window.__pwned === undefined), 'a hostile server message cannot execute script');
  ok((await page.evaluate(() => document.getElementById('orderBanner').textContent)).includes('too many requests'), 'the message is still shown as text');
  ok(!(await page.evaluate(() => document.getElementById('orderForm').hidden)), 'the form stays open so they can retry');
  ok(!(await page.evaluate(() => document.getElementById('orderSubmit').disabled)), 'the button is re-enabled');
  await page.close();
}

console.log('\n7. Attribution survives losing the query string mid-visit');
{
  const page = await newPage('?utm_campaign=fullstack-sep&utm_source=facebook');
  await page.evaluate(() => history.replaceState({}, '', '/ads/fullstack/')); // e.g. after a hash-link click cleanup
  await page.fill('#oName', 'Nadia'); await page.fill('#oPhone', '018'); await page.fill('#oEmail', 'n@b.co');
  await page.check('#oConsent');
  await page.click('#orderSubmit');
  await page.waitForTimeout(400);
  const [enquiry] = page.contact;
  ok(enquiry.message.includes('utm_campaign=fullstack-sep'), 'the campaign is still named on the enquiry');
  await page.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
