/**
 * Creating a landing page from the console, against a real Worker.
 *
 * This is the half of the complaint that was not a bug: there was no create
 * option at all. The Worker's list of editable pages was `new Set(["fullstack"])`
 * and the only page that rendered was a static file in the site repo, so adding
 * a landing page meant editing that line and deploying. Nothing in the console
 * could do it.
 *
 * The thing worth testing is therefore not "does the form submit" but DOES A
 * CREATED PAGE BECOME A REAL URL — because a create button that writes a row
 * nothing serves is the same failure in a nicer shape. So this test creates a
 * page in the browser, then fetches its public address and checks the words
 * typed into the form come back out of it.
 *
 * Unlike landing-editor.mjs this one does NOT stub the API. It needs a local
 * Worker, because half of what is being checked is server behaviour: the draft
 * 404, the published 200, and the content keyed by the new slug.
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   npx wrangler d1 execute bayezid-agency --local --file schema/003_admin.sql
 *   npx wrangler d1 execute bayezid-agency --local --file schema/014_landing_media.sql
 *   npx wrangler d1 execute bayezid-agency --local --file schema/017_landing_pages.sql
 *   printf 'ENCRYPTION_KEY="k"\nADMIN_SECRET="local-admin-secret"\nADMIN_USER_NAME="bayezid"\nADMIN_PASSWORD="correct-horse-battery"\n' > .dev.vars
 *   npx wrangler dev --local --port 8787 &
 *
 *   # the site
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tests/landing-pages.mjs
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8901';
const API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const LIVE_API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const USER = process.env.ADMIN_USER || 'bayezid';
const PASS = process.env.ADMIN_PASS || 'correct-horse-battery';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

// A name unique to this run, so re-running does not collide with its own rows.
const STAMP = Date.now().toString(36).slice(-6);
const NAME = `Test Offer ${STAMP}`;
const SLUG = `test-offer-${STAMP}`;
const HEADLINE = `Orders on the night you launch ${STAMP}`;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));

/**
 * The console ships with the production API baked in; point it at the local one.
 *
 * Proxied through fetch and fulfilled rather than redirected with
 * route.continue(), which refuses to cross from https to http. The response's
 * own content-length is dropped on the way back: forwarding a length that no
 * longer matches the body silently truncates it, which produces a page that
 * renders perfectly and does nothing.
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
    headers['access-control-allow-headers'] = 'content-type,authorization,x-admin-secret';
    headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    delete headers['content-encoding'];
    delete headers['content-length'];
    await route.fulfill({ status: upstream.status, headers, body: Buffer.from(await upstream.arrayBuffer()) });
  } catch (e) {
    await route.abort();
  }
});

await p.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
await p.fill('#username', USER);
await p.fill('#password', PASS);
await p.click('#loginBtn');
await p.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
await p.evaluate(() => { location.hash = '#landing'; });
await p.waitForSelector('[data-view-panel="landing"]:not([hidden])', { timeout: 10000 });
await p.waitForTimeout(900);

console.log('\n1. The panel offers a page list and a create form');
{
  ok(await p.locator('#landingPageSelect').count() === 1, 'there is a page selector');
  ok(await p.locator('#newLandingCreate').count() === 1, 'and a create button');
  const options = await p.locator('#landingPageSelect option').count();
  ok(options >= 1, `the existing page is listed (${options} option(s))`);
  const url = await p.textContent('[data-landing-page-url]');
  ok(/\/ads\/fullstack\//.test(url), `the static page reports its real path, not /l/fullstack (${url.trim()})`);
  ok(await p.locator('#landingPageDelete').isDisabled(), 'the static page cannot be deleted from here');
  ok(await p.locator('#landingPageStatus').isDisabled(), 'nor can its visibility be toggled here');
}

console.log('\n2. A headline is required, and says so before a round trip');
{
  await p.locator('.lp-new > summary').click();
  await p.fill('#newLandingTitle', NAME);
  await p.click('#newLandingCreate');
  await p.waitForTimeout(400);
  const banner = await p.textContent('[data-landing-pages-banner]');
  ok(/headline/i.test(banner), `it asks for a headline (${banner.trim()})`);
}

console.log('\n3. Creating a page');
{
  await p.fill('#newLandingHeadline', HEADLINE);
  await p.fill('#newLandingSubhead', 'Ad click to paid order, nothing in between.');
  await p.fill('#newLandingCtaLabel', 'Ask for a quote');
  await p.fill('#newLandingCtaHref', 'https://sayadbayezid.com/contact.html');
  await p.click('#newLandingCreate');
  await p.waitForTimeout(1500);

  const banner = await p.textContent('[data-landing-pages-banner]');
  ok(/draft/i.test(banner), `the console says it was created as a draft (${banner.trim().slice(0, 80)})`);
  ok(await p.inputValue('#landingPageSelect') === SLUG, `the editor switched to the new page (${SLUG})`);
  ok(await p.inputValue('#landingPageStatus') === 'draft', 'and it is a draft');
  ok(await p.inputValue('#newLandingTitle') === '', 'the form was cleared');
  const url = await p.textContent('[data-landing-page-url]');
  ok(url.includes(`/l/${SLUG}`), `its address is shown (${url.trim().slice(0, 90)})`);
}

console.log('\n4. A draft is NOT reachable by the public');
{
  const res = await p.request.get(`${API}/l/${SLUG}`);
  ok(res.status() === 404, `GET /l/${SLUG} answers ${res.status()} while it is a draft`);
}

console.log('\n5. Publishing makes it real, with the words that were typed');
{
  await p.selectOption('#landingPageStatus', 'published');
  await p.waitForTimeout(1200);
  const banner = await p.textContent('[data-landing-pages-banner]');
  ok(/live/i.test(banner), `the console confirms it is live (${banner.trim().slice(0, 70)})`);

  const res = await p.request.get(`${API}/l/${SLUG}`);
  ok(res.status() === 200, `GET /l/${SLUG} now answers 200`);
  const html = await res.text();
  ok(html.includes(HEADLINE), 'the rendered page carries the headline');
  ok(html.includes('Ad click to paid order, nothing in between.'), 'and the sub-heading');
  ok(html.includes('Ask for a quote'), 'and the button text');
  ok(html.includes('https://sayadbayezid.com/contact.html'), 'and the button link');
}

console.log('\n6. Content saves against the NEW page, not over the old one');
{
  // The bug this whole session started from was content going to the wrong
  // place. With more than one page that failure mode gets worse, so: edit the
  // new page, then confirm the static page's content was left alone.
  const before = await (await p.request.get(`${API}/api/landing/fullstack`)).json();

  await p.click('#landingAddLink');
  await p.waitForTimeout(200);
  const inputs = p.locator('[data-landing-links] input');
  await inputs.nth(0).fill('Live demo');
  await inputs.nth(1).fill('https://demu.sayadbayezid.com/d/smartgadget-demo/');
  await p.click('#landingSave');
  await p.waitForTimeout(1200);

  const mine = await (await p.request.get(`${API}/api/landing/${SLUG}`)).json();
  ok(mine.content?.links?.[0]?.label === 'Live demo', 'the link saved onto the new page');

  const after = await (await p.request.get(`${API}/api/landing/fullstack`)).json();
  ok(JSON.stringify(before.content) === JSON.stringify(after.content),
    "the static page's content was not touched");

  const html = await (await p.request.get(`${API}/l/${SLUG}`)).text();
  ok(html.includes('demu.sayadbayezid.com/d/smartgadget-demo/'), 'and the live page shows it');
}

console.log('\n7. Switching pages warns before losing unpublished work');
{
  await p.click('#landingAddLink');
  await p.waitForTimeout(200);
  const saved = await p.textContent('[data-landing-saved]');
  ok(/not published/i.test(saved), `the panel marks unpublished changes (${saved.trim()})`);

  p.once('dialog', (d) => d.dismiss());
  await p.selectOption('#landingPageSelect', 'fullstack');
  await p.waitForTimeout(500);
  ok(await p.inputValue('#landingPageSelect') === SLUG,
    'dismissing the warning keeps you on the page with unsaved work');
}

console.log('\n8. Deleting the page');
{
  p.once('dialog', (d) => d.accept());
  await p.click('#landingPageDelete');
  await p.waitForTimeout(1500);
  const res = await p.request.get(`${API}/l/${SLUG}`);
  ok(res.status() === 404, `its address stops working (${res.status()})`);
  const listed = await p.locator(`#landingPageSelect option[value="${SLUG}"]`).count();
  ok(listed === 0, 'and it is gone from the list');
  const gone = await (await p.request.get(`${API}/api/landing/${SLUG}`)).status();
  ok(gone === 404, 'its blocks went with it');
}

ok(errors.length === 0, `no script errors${errors.length ? ': ' + errors[0] : ''}`);

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
