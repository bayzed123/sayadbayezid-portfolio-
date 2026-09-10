/**
 * The policy pages, the login page, and the stray links an old page-stamping
 * script left on every page in the repo.
 *
 * Three separate faults are covered here, and each one shipped:
 *
 *   1. Three <div class="footer-case-studies-link"> blocks — Case Studies,
 *      Blog, Proofline Atlas — were appended to the footer of 17 pages,
 *      including every policy page. Unstyled, duplicated, and on pages whose
 *      whole job is to be readable by a Meta reviewer.
 *
 *   2. facebook-business-login.html set `body{display:flex}` back when the
 *      body held nothing but the login card. A site header was added later,
 *      which made the header and the card two items of the SAME FLEX ROW: on
 *      a phone the nav became a narrow left column and the card a narrow
 *      right one. This is the check that would have caught it — a page that
 *      scrolls sideways on a phone.
 *
 *   3. Two sign-in pages existed with two different Meta flows. Only the
 *      server-side code flow is kept; the JS SDK one now redirects to it.
 *
 * Serve the repo and run:
 *   python3 -m http.server 5601 &
 *   node tests/policy-pages.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log(`  ok   ${n}`); }
  else { fail++; console.log(`  FAIL ${n}${d ? `\n       ${String(d).slice(0, 300)}` : ''}`); }
};

const SITE = process.env.SITE_URL || 'http://127.0.0.1:5601';

// ---------------------------------------------------------------------------
// Source checks. These read the repo, so they cover every page at once rather
// than only the handful worth opening in a browser.
// ---------------------------------------------------------------------------
function everyHtmlFile(dir = '.', found = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) everyHtmlFile(path, found);
    else if (name.endsWith('.html')) found.push(path);
  }
  return found;
}
const pages = everyHtmlFile();

console.log('== the stamped-on footer links are gone, everywhere ==');
check('there are pages to check at all', pages.length > 20, `found ${pages.length}`);
const withStray = pages.filter(p => readFileSync(p, 'utf8').includes('footer-case-studies-link'));
check('no page carries the stamped footer block', withStray.length === 0, withStray.join(', '));

console.log('== and the nav they were stamped beside is no longer browser-default ==');
// The injected header set no colour, so its links rendered blue and
// visited-purple on pages that are otherwise nothing like that. These pages
// are a mix of light and dark, so the fix is `inherit`, not a fixed colour.
const withHeader = pages.filter(p => readFileSync(p, 'utf8').includes('legacy-site-header'));
const unstyled = withHeader.filter(p => !readFileSync(p, 'utf8').includes('.legacy-site-header a{'));
check('every stamped header has a colour of its own', unstyled.length === 0, unstyled.join(', '));

console.log('== one sign-in page, not two ==');
const stillLinking = pages.filter(p =>
  p !== './client-login.html' && readFileSync(p, 'utf8').includes('href="/client-login.html"'));
check('nothing links to the retired login page', stillLinking.length === 0, stillLinking.join(', '));
const stub = readFileSync('./client-login.html', 'utf8');
check('the retired page is not indexable', /name="robots"[^>]*noindex/.test(stub));
check('and points its canonical at the surviving page',
  stub.includes('rel="canonical" href="https://sayadbayezid.com/facebook-business-login.html"'));
check('it no longer loads the Facebook JS SDK', !stub.includes('connect.facebook.net/en_US/sdk.js'));
// Assert on the scripts, not the file: the comment at the top of that stub
// names the endpoint it used to call, and explaining a retired flow is not
// the same as still running it.
const stubScripts = [...stub.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
check('and its scripts call nothing at all',
  !/fetch\s*\(|XMLHttpRequest|FB\.|\/api\//.test(stubScripts), stubScripts.trim());

console.log('== the login flow itself is untouched ==');
// The Worker hardcodes this page's URL in its redirect allowlist and the App
// Dashboard has the same URL in Valid OAuth Redirect URIs. Restyling the page
// must not move any of it.
const login = readFileSync('./facebook-business-login.html', 'utf8');
check('the canonical URL has not moved',
  login.includes('rel="canonical" href="https://sayadbayezid.com/facebook-business-login.html"'));
check('the app id is unchanged', login.includes("APP_ID='1781926689123888'"));
check('it still uses the server-side code flow', login.includes("response_type:'code'"));
check('and still exchanges through the Worker',
  login.includes('/api/facebook/business-login/exchange'));
check('the state parameter is still generated and checked',
  login.includes('meta_business_login_state') && login.includes('expected!==actual'));
// A token in the page is the thing the code flow exists to avoid.
check('no access token is read in the browser',
  !/access_token/.test(login), 'the page mentions access_token');
check('no app secret anywhere near it', !/app_?secret/i.test(login));

console.log('== every internal link on a policy page resolves ==');
// A policy page that links to a 404 is worse than one that links nowhere: a
// reviewer reads it as an integration that does not exist.
const POLICY = [
  './privacy-policy.html', './terms-of-service.html',
  './business-integration-policy.html', './privacy-policy-meta-product.html',
  './amader-tangail/privacy-policy.html', './amader-tangail/user-account-data-delete.html',
  './facebook-business-login.html', './data-deletion-status.html',
];
const broken = [];
for (const page of POLICY) {
  const html = readFileSync(page, 'utf8');
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const target = href.endsWith('/') ? `.${href}index.html` : `.${href}`;
    if (!existsSync(target)) broken.push(`${page} → ${href}`);
  }
}
check('no policy page links to a missing file', broken.length === 0, broken.join('\n       '));

console.log('== the hub indexes every policy page that exists ==');
// The point of the hub is that a person who lands on it can reach whichever
// document applies to them. A policy page it does not name is unreachable.
const hub = readFileSync('./privacy-policy.html', 'utf8');
const shouldBeIndexed = [
  '/terms-of-service.html', '/business-integration-policy.html',
  '/privacy-policy-meta-product.html', '/editorial-policy.html',
  '/data-deletion-status.html', '/amader-tangail/privacy-policy.html',
  '/amader-tangail/user-account-data-delete.html', '/facebook-business-login.html',
];
const missing = shouldBeIndexed.filter(u => !hub.includes(`href="${u}"`));
check('the hub links to all of them', missing.length === 0, missing.join(', '));
// Every canonical on the site is the bare host; linking the other one from
// the hub contradicts them.
// Every canonical on this site is the bare host. The homepage address is
// also printed as a contact detail, which is fine; a deep link to the other
// host is not, because it contradicts the canonical of the page it opens.
check('and never deep-links the non-canonical host',
  !/href="https:\/\/www\.sayadbayezid\.com\/\w/.test(hub),
  (hub.match(/href="https:\/\/www\.sayadbayezid\.com\/[^"]*"/g) || []).join(', '));

// ---------------------------------------------------------------------------
// Browser checks, on a phone, which is where the layout broke.
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 400, height: 844 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));

console.log('== the login page fits a phone ==');
await page.goto(`${SITE}/facebook-business-login.html`, { waitUntil: 'domcontentloaded' });

const overflow = await page.evaluate(() =>
  ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
check('the page does not scroll sideways', overflow.scroll <= overflow.client + 1,
  `scrollWidth ${overflow.scroll} vs clientWidth ${overflow.client}`);

// The exact fault: header and card became two columns of one flex row.
const stacked = await page.evaluate(() => {
  const head = document.querySelector('header.site-header').getBoundingClientRect();
  const card = document.querySelector('main .card').getBoundingClientRect();
  return { headBottom: head.bottom, cardTop: card.top, headWidth: head.width, cardWidth: card.width };
});
check('the header sits above the card, not beside it', stacked.cardTop >= stacked.headBottom - 1,
  `header bottom ${stacked.headBottom}, card top ${stacked.cardTop}`);
check('the header spans the full width', stacked.headWidth >= 399, `${stacked.headWidth}px`);
check('and so does the card, near enough', stacked.cardWidth >= 340, `${stacked.cardWidth}px`);

const button = await page.locator('#businessLogin').boundingBox();
check('the sign-in button is a real tap target', button.height >= 44, `${button.height}px tall`);
check('and it is not off-screen', button.x >= 0 && button.x + button.width <= 401,
  `x ${button.x} width ${button.width}`);

console.log('== it reads as one page, in order ==');
check('exactly one h1', await page.locator('h1').count() === 1);
check('the nav is labelled', await page.locator('header.site-header nav[aria-label]').count() === 1);
check('the status region is announced',
  await page.locator('#status[role="status"][aria-live="polite"]').count() === 1);
check('the three assurances are stacked on a phone',
  await page.evaluate(() => {
    const [a, b] = document.querySelectorAll('.details .detail');
    return b.getBoundingClientRect().top >= a.getBoundingClientRect().bottom - 1;
  }));

console.log('== the same page on a desktop width ==');
await page.setViewportSize({ width: 1280, height: 900 });
check('the assurances go three across', await page.evaluate(() => {
  const [a, b] = document.querySelectorAll('.details .detail');
  return Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) < 2;
}));
check('and the card stays a readable width',
  (await page.locator('main .card').boundingBox()).width <= 760);

console.log('== the retired login page sends you on ==');
await page.setViewportSize({ width: 400, height: 844 });
await page.goto(`${SITE}/client-login.html`, { waitUntil: 'domcontentloaded' });
await page.waitForURL('**/facebook-business-login.html', { timeout: 5000 }).catch(() => {});
check('it lands on the business login', page.url().endsWith('/facebook-business-login.html'), page.url());

console.log('== nothing threw ==');
check('no page errors', errs.length === 0, errs.join('\n       '));

await browser.close();
console.log(`\npassed: ${pass}   failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
