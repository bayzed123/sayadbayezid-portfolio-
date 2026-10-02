/**
 * The Demo orders screen in the operations console.
 *
 * What this screen is for: answering an order from a phone, in one tap, without
 * opening anything else. So the checks are not "does the list render" — they
 * are whether the things that make a reply possible are actually there and
 * actually correct:
 *
 *   - the reply link is a WhatsApp chat with the message already written, and
 *     the message quotes what they ticked;
 *   - a Bangladeshi number typed as 01XXXXXXXXX has the country code on it,
 *     because wa.me silently fails without one and the button would look fine
 *     while opening a chat with nobody;
 *   - replying files the order as contacted, so an answered order cannot sit
 *     in New looking unanswered;
 *   - an email contact gets a mail link instead, not a broken WhatsApp one.
 *
 * Runs against a real Worker, because half of what is being tested is the
 * round trip: the status moves, the list re-reads, the badge follows.
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   npx wrangler d1 execute bayezid-agency --local --file schema/003_admin.sql
 *   npx wrangler d1 execute bayezid-agency --local --file schema/018_demo_orders.sql
 *   npx wrangler dev --local --port 8787 &
 *
 *   # the site
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node tests/demo-orders-console.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8901';
const API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const LIVE_API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const USER = process.env.ADMIN_USER || 'bayezid';
const PASS = process.env.ADMIN_PASS || 'correct-horse-battery';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

const STAMP = Date.now().toString(36).slice(-5);
/* A fresh number each run. Re-using one trips the Worker's own throttle —
   three orders from the same contact within an hour are dropped — and the
   symptom is a row that simply never appears, which reads exactly like a
   broken screen. */
const PHONE = '017' + String(Date.now()).slice(-8);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

/**
 * The console ships with the production API baked in; point it at the local
 * one. Proxied through fetch and fulfilled rather than route.continue(), which
 * refuses to cross https to http, and with content-length dropped: forwarding
 * a length that no longer matches the body truncates it silently, producing a
 * page that renders perfectly and does nothing.
 */
await ctx.route(`${LIVE_API}/**`, async (route) => {
  const req = route.request();
  try {
    const upstream = await fetch(req.url().replace(LIVE_API, API), {
      method: req.method(),
      headers: { ...req.headers(), host: API.replace(/^https?:\/\//, '') },
      body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
    });
    const headers = Object.fromEntries(upstream.headers.entries());
    headers['access-control-allow-origin'] = '*';
    delete headers['content-encoding'];
    delete headers['content-length'];
    await route.fulfill({ status: upstream.status, headers, body: Buffer.from(await upstream.arrayBuffer()) });
  } catch { await route.abort(); }
});

/** Two orders placed the way the demo hub places them, so the screen under
 *  test is reading rows that arrived through the real public endpoint. */
async function placeOrder(body) {
  const response = await fetch(`${API}/api/demo-order`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json();
}

const PHONE_NAME = `Rahim ${STAMP}`;
const EMAIL_NAME = `Karim ${STAMP}`;

await placeOrder({
  demoSlug: 'lks-attire-shop', demoTitle: `Lk's Attire ${STAMP}`,
  name: PHONE_NAME, contact: PHONE,
  features: ['Admin dashboard', 'bKash · Nagad · Rocket'],
  budget: '৳20,000 – ৳50,000', timeline: 'This week',
  note: 'Bangla first, please.', source: 'popup',
  pageUrl: 'https://demu.sayadbayezid.com/d/lks-attire-shop/',
});
await placeOrder({
  demoSlug: 'zamil-shop-bd', demoTitle: `Zamil Shop BD ${STAMP}`,
  name: EMAIL_NAME, contact: `karim.${STAMP}@example.com`,
  features: ['Gift registry'], source: 'viewer-bar',
});
/* A name with no spaces in it. The Worker caps the length but cannot insert a
   word break, and an unbroken run that long widened the card past the viewport
   and pushed the status and date off the right edge — on every other order in
   the list too, not just this one. */
await placeOrder({
  demoSlug: 'sidra-jewellery', demoTitle: 'Sidra Jewellery',
  name: 'A'.repeat(200), contact: `wide.${STAMP}@example.com`, source: 'hub-card',
});

await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
await page.fill('#username', USER);
await page.fill('#password', PASS);
await page.click('#loginBtn');
await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });

console.log('\n1. The screen is reachable and counts what is waiting');
{
  const badge = page.locator('.side-link[data-view="orders"] [data-unread]');
  await page.evaluate(() => { location.hash = '#orders'; });
  await page.waitForSelector('[data-view-panel="orders"]:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(900);

  ok(await page.locator('.ord').count() >= 2, `the orders are listed (${await page.locator('.ord').count()})`);
  // An alert you only see once you are already on the screen is not an alert.
  ok(await badge.count() === 1, 'the sidebar carries an unread badge');
  ok(Number(await badge.textContent()) >= 2, `counting the unread ones (${await badge.textContent()})`);
}

const card = (name) => page.locator('.ord', { hasText: name }).first();

console.log('\n2. The whole order is on the card');
{
  const c = card(PHONE_NAME);
  const text = await c.textContent();
  ok(/Lk's Attire/.test(text), 'which demo they were looking at');
  ok(/Admin dashboard/.test(text) && /bKash/.test(text), 'what they ticked');
  ok(/৳20,000/.test(text), 'what they will spend');
  ok(/This week/.test(text), 'when they want it');
  ok(/Bangla first/.test(text), 'and what they said');
  ok(await c.locator('.ord-feat').count() === 2, 'the features are chips, not a sentence to parse');
}

console.log('\n3. The reply is one tap, with the message already written');
{
  const href = await card(PHONE_NAME).locator('.ord-reply').getAttribute('href');
  ok(href.startsWith('https://wa.me/'), 'it is a WhatsApp chat');

  // 01712345678 is how a Bangladeshi number is typed and written down. wa.me
  // needs the country code, and without it the button looks perfect while
  // opening a chat with nobody — a failure nothing on screen would report.
  ok(href.includes('wa.me/88' + PHONE),
    `the local number was given its country code (${href.split('?')[0]})`);

  const message = decodeURIComponent(href.split('?text=')[1] || '');
  ok(message.includes(PHONE_NAME.split(' ')[0]), 'the message greets them by name');
  ok(/Lk's Attire/.test(message), 'names the demo they ordered');
  ok(/You asked for: .*Admin dashboard/.test(message), 'and quotes what they ticked back to them');
}

console.log('\n4. An email contact gets a mail link, not a dead WhatsApp one');
{
  const href = await card(EMAIL_NAME).locator('.ord-reply').getAttribute('href');
  ok(href.startsWith('mailto:'), `it is a mail link (${href.slice(0, 28)}…)`);
  ok(href.includes(`karim.${STAMP}@example.com`), 'to the address they gave');
  ok(await card(EMAIL_NAME).locator('.ord-reply').textContent() === 'Reply by email',
    'and says so on the button');
}

console.log('\n5. Replying files the order as contacted');
{
  // The failure this prevents: an order that was answered an hour ago still
  // sitting in New, so it gets answered again or chased for no reason.
  ok((await card(PHONE_NAME).locator('.ord-status').textContent()).trim() === 'New', 'it starts in New');

  // target=_blank would open WhatsApp; the click handler is what is under test.
  await card(PHONE_NAME).locator('.ord-reply').evaluate((node) => {
    node.removeAttribute('target');
    node.setAttribute('href', 'javascript:void 0');
    node.click();
  });
  await page.waitForTimeout(1400);
  ok((await card(PHONE_NAME).locator('.ord-status').textContent()).trim() === 'Contacted',
    'opening the reply moves it to Contacted');
  ok(await card(PHONE_NAME).locator('.ord-flag').count() === 0, 'and it is no longer flagged new');
}

console.log('\n6. The pipeline moves, and the filters follow');
{
  await card(EMAIL_NAME).locator('.ord-move').selectOption('won');
  await page.waitForTimeout(1400);
  ok((await card(EMAIL_NAME).locator('.ord-status').textContent()).trim() === 'Won', 'an order can be marked won');

  const wonFilter = page.locator('.ord-filter', { hasText: 'Won' }).first();
  ok(Number(await wonFilter.locator('b').textContent()) >= 1, 'the Won count went up');

  await wonFilter.click();
  await page.waitForTimeout(400);
  ok(await page.locator('.ord').count() >= 1, 'filtering to Won shows it');
  ok(await page.locator('.ord', { hasText: PHONE_NAME }).count() === 0, 'and hides the others');

  // "Nothing in Quoted" and "nothing at all" are different facts, and a screen
  // that shows the same empty state for both hides the first.
  await page.locator('.ord-filter', { hasText: 'Quoted' }).first().click();
  await page.waitForTimeout(400);
  const empty = await page.locator('[data-orders] .empty').textContent();
  ok(/Nothing in Quoted/.test(empty), `an empty status says which one (${empty.trim().slice(0, 40)})`);
  ok(/under other statuses/.test(empty), 'and that there are orders elsewhere');

  await page.locator('.ord-filter', { hasText: 'All' }).first().click();
  await page.waitForTimeout(400);
}

console.log('\n7. One strange name does not break the list');
{
  await page.evaluate(() => { location.hash = '#orders'; });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, `the page does not scroll sideways (${overflow}px over)`);

  // The specific symptom: everything in .ord-when — the status and the date —
  // sat beyond the right edge of the window and could not be read at all.
  const offscreen = await page.evaluate(() =>
    [...document.querySelectorAll('.ord-when')]
      .filter((n) => n.getBoundingClientRect().right > window.innerWidth).length);
  ok(offscreen === 0, `every order's status and date are on screen (${offscreen} off)`);
}

console.log('\n8. Copy buttons hand over something pasteable');
{
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await card(PHONE_NAME).locator('button', { hasText: 'Copy all' }).click();
  await page.waitForTimeout(350);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  ok(/Demo:\s+Lk's Attire/.test(copied), 'the demo is in it');
  ok(/Wants:\s+Admin dashboard/.test(copied), 'so is what they asked for');
  ok(/Budget:/.test(copied) && /Received:/.test(copied), 'and the budget and the date');
}

ok(errors.length === 0, `no script errors${errors.length ? ': ' + errors[0] : ''}`);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
