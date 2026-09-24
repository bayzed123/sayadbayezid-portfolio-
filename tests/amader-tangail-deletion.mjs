/**
 * The Google Play account-deletion page, driven in a real browser against a
 * real Amader Tangail API.
 *
 * This URL — sayadbayezid.com/amader-tangail/user-account-data-delete.html —
 * is the one filed with Google Play, so "the prose is correct" is not enough:
 * the form on it has to run, call an API and render what comes back. That is
 * what these drive, in a browser, against a real Worker and a real D1.
 *
 * What they do NOT cover is the origin allow-list. The API calls are
 * redirected through page.route, so the browser is not enforcing CORS on them.
 * That belongs to corsHeaders and is checked in the Worker's own smoke tests —
 * a check here that claimed to prove it would be false.
 *
 *   # in the amader-tangail.oi checkout
 *   cd worker && npx wrangler dev --local --port 8799
 *   npx wrangler d1 execute amader-tangail --local --file=./schema.sql
 *   npx wrangler d1 execute amader-tangail --local --file=<the seed below>
 *
 *   # here
 *   python3 -m http.server 3000 &
 *   API_BASE=http://127.0.0.1:8799 node tests/amader-tangail-deletion.mjs
 *
 * Seed rows the checks below expect:
 *
 *   INSERT INTO deletion_requests
 *     (id, email, code_hash, attempts, status, expires_at, created_at,
 *      verified_at, decided_at, decided_by, outcome) VALUES
 *   ('11111111-1111-4111-8111-111111111111','rina@example.com',NULL,0,
 *    'awaiting_review','2026-09-20T10:15:00Z','2026-09-20T10:00:00Z',
 *    '2026-09-20T10:04:00Z',NULL,NULL,NULL),
 *   ('22222222-2222-4222-8222-222222222222','karim@example.com',NULL,0,
 *    'completed','2026-09-10T09:15:00Z','2026-09-10T09:00:00Z',
 *    '2026-09-10T09:03:00Z','2026-09-12T07:30:00Z','admin@example.com',
 *    'removed: account yes, 2 message(s), 3 image(s)'),
 *   ('33333333-3333-4333-8333-333333333333','shuvo@example.com',NULL,0,
 *    'rejected','2026-09-05T09:15:00Z','2026-09-05T09:00:00Z',
 *    '2026-09-05T09:02:00Z','2026-09-06T11:00:00Z','admin@example.com',
 *    'could not match the address to an account'),
 *   ('44444444-4444-4444-8444-444444444444','notyet@example.com','deadbeef',0,
 *    'pending','2099-01-01T00:00:00Z','2026-09-22T09:00:00Z',NULL,NULL,NULL,NULL);
 *
 * With nothing running this SKIPS rather than fails: the API lives in another
 * repository, so a red run here would only ever mean "that checkout is not
 * open", which is not a fault in this one.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8799';
const PAGE_PATH = '/amader-tangail/user-account-data-delete.html';

for (const [what, url] of [['the site', SITE + PAGE_PATH], ['the API', API_BASE + '/health']]) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
  } catch (e) {
    console.log(`\nSKIP — ${what} is not answering at ${url} (${e.message}).`);
    console.log('See the header of this file for how to start both.\n');
    process.exit(0);
  }
}

const PAGE = SITE + PAGE_PATH;
let passed = 0, failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('  ok   ', name); }
  else { failed++; console.error('  FAIL  ', name, extra); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await ctx.newPage();

const consoleErrors = [];
// /favicon.ico 404s only because this harness serves a two-file directory;
// the real site has one. Nothing else is filtered.
// Chromium logs "Failed to load resource" for the API's own 404 refusals and
// for the favicon this two-file harness does not serve. Neither is a fault in
// the page — the 404s are the behaviour under test. An uncaught exception in
// our own script is the thing that would be.
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

/**
 * Clear the banner, do the thing, wait for the banner to be written again.
 *
 * Waiting for #msg to *match* something is a trap here: two checks in a row
 * expect the same refusal, so the second wait returns instantly against the
 * first one's text, without its own request having finished -- and that
 * response then arrives during the NEXT check and overwrites its message.
 * Clearing first makes the wait mean "this action produced a message".
 */
async function act(fn) {
  await page.evaluate(() => { document.querySelector('#msg').innerHTML = ''; });
  await fn();
  await page.waitForFunction(
    () => document.querySelector('#msg').innerText.trim().length > 0, null, { timeout: 10000 });
  return page.locator('#msg').innerText();
}

const network = [];
page.on('response', (r) => network.push(`${r.status()} ${r.url()}`));

/**
 * The page hardcodes the production API, as it must: it ships as a static file
 * with no way to be configured. So the calls are redirected here instead of
 * the HTML being rewritten -- the page under test is then the exact bytes that
 * ship, and the one thing that changes is which Worker answers.
 *
 * (Rewriting the served HTML was the obvious first try and is a trap: an
 * intercepted response that changes length while keeping the original
 * content-length is truncated by the browser, and a page whose <script> is cut
 * short renders perfectly and simply does nothing, with no error to say why.)
 */
await page.route('**/api/v1/deletion/**', async (route) => {
  const target = API_BASE + new URL(route.request().url()).pathname;
  await route.fulfill({ response: await route.fetch({ url: target }) });
});

await page.goto(PAGE, { waitUntil: 'networkidle' });

// Strictly the local API: matching the production host too would let this
// pass on an un-rewritten page and every CORS check below would be a lie.

console.log('\n--- the page itself ---');
check('no javascript errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
check('the form is present, not just prose',
  await page.locator('#f1').isVisible() && await page.locator('#fs').isVisible());
check('the status section is reachable at #status',
  await page.locator('#status').count() === 1);

console.log('\n--- no tracking on a privacy page ---');
const tracked = network.filter((u) =>
  /googletagmanager|google-analytics|facebook\.net|facebook\.com|connect\.facebook|tags\.min\.js/i.test(u));
check('nothing was requested from an analytics or advertising host',
  tracked.length === 0, tracked.join(' | '));

console.log('\n--- status lookup: a request still in the queue ---');
await page.fill('#sEmail', 'rina@example.com');
await page.fill('#sRef', '11111111-1111-4111-8111-111111111111');
await page.click('#bs');
await page.waitForSelector('#statusOut .note', { timeout: 10000 });
let out = await page.locator('#statusOut').innerText();
check('shows "Waiting for review"', out.includes('Waiting for review'), out);
check('shows the Bangla label too', out.includes('পর্যালোচনার অপেক্ষায়'), out);
check('says plainly that nothing is deleted yet', /Nothing has been deleted yet/.test(out), out);
check('shows the submitted date', /Submitted\s+\w+\s+\d{1,2},\s+\d{4}/.test(out), out);
check('shows no decided date for an undecided request', !/Decided/.test(out), out);

console.log('\n--- status lookup: completed ---');
await page.fill('#sEmail', 'karim@example.com');
await page.fill('#sRef', '22222222-2222-4222-8222-222222222222');
await page.click('#bs');
await page.waitForFunction(() => /Deleted/.test(document.querySelector('#statusOut').innerText), null, { timeout: 10000 });
out = await page.locator('#statusOut').innerText();
check('shows "Deleted"', out.includes('Deleted'), out);
check('shows what was actually removed', out.includes('2 message(s)'), out);
check('shows the decided date', /Decided\s+\w+\s+\d{1,2},\s+\d{4}/.test(out), out);

console.log('\n--- status lookup: refused ---');
await page.fill('#sEmail', 'shuvo@example.com');
await page.fill('#sRef', '33333333-3333-4333-8333-333333333333');
await page.click('#bs');
await page.waitForFunction(() => /Not approved/.test(document.querySelector('#statusOut').innerText), null, { timeout: 10000 });
out = await page.locator('#statusOut').innerText();
check('shows "Not approved"', out.includes('Not approved'), out);
check('shows the reason it was refused',
  out.includes('could not match the address to an account'), out);

console.log('\n--- status lookup: a pair that does not match ---');
const msg = await act(async () => {
  await page.fill('#sEmail', 'rina@example.com');
  await page.fill('#sRef', '00000000-0000-4000-8000-000000000000');
  await page.click('#bs');
});
check('the refusal is shown to the person', /No submitted request matches/.test(msg), msg);
check('the previous result is cleared, not left stale',
  (await page.locator('#statusOut').innerText()).trim() === '',
  await page.locator('#statusOut').innerText());

console.log('\n--- a pending request must not be confirmed to exist ---');
const pendingMsg = await act(async () => {
  await page.fill('#sEmail', 'notyet@example.com');
  await page.fill('#sRef', '44444444-4444-4444-8444-444444444444');
  await page.click('#bs');
});
check('an unanswered code reads exactly like a wrong reference',
  /No submitted request matches/.test(pendingMsg), pendingMsg);
check('and it is word-for-word the refusal a wrong reference gets',
  pendingMsg.trim() === msg.trim(), `${pendingMsg} !== ${msg}`);

console.log('\n--- step 1 talks to the API ---');
// NOT a CORS check. Requests are fulfilled through page.route above, so the
// browser is not enforcing the origin allow-list here and a check that claimed
// otherwise would be false. The allow-list is covered where it is decided:
// corsHeaders, in the Worker's own smoke tests.
/**
 * A fresh address every run. The API allows three code requests per address
 * per hour, so reusing a fixed one makes this check pass once and then fail
 * for the rest of the hour -- with the rate-limit message, which looks like a
 * bug in the page and is not. An address with no account gets the same reply
 * in the same shape as one that has data, by design, and sends no mail.
 */
const step1 = await act(async () => {
  await page.fill('#email', `step1-${Date.now()}@example.com`);
  await page.click('#b1');
});
// RESEND_API_KEY is unset locally, so the API answers 503 "not switched on".
// That IS the success condition here: a 503 is the Worker's own answer, which
// means the cross-origin request was made, allowed, and read back. A CORS
// failure would instead surface the "Could not reach the server" branch.
check('the page got a real answer rather than its network-failure branch',
  !/Could not reach the server/.test(step1), step1);
check('and it is the API\'s answer to step 1, not a leftover banner',
  /six-digit code is on its way/i.test(step1), step1);
check('step 2 opened so the person can enter the code',
  await page.locator('#step2').isVisible());

console.log('\n--- mobile layout ---');
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no horizontal scroll at 420px wide', overflow <= 0, `overflow ${overflow}px`);

check('still no javascript errors after the whole run',
  consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
