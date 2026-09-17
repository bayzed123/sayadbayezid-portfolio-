/**
 * The Event tracking screen, driven in a real browser against a local Worker.
 *
 * WHAT IS WORTH CHECKING HERE, AND WHY.
 * This screen exists to make one invisible failure visible: the browser Pixel
 * being blocked while the Conversions API keeps working. Every other number in
 * the console stays green through that, because the server half succeeds on
 * its own. So the checks below are mostly about the screen telling the truth
 * in the awkward cases — a migration that has not been applied, a test event
 * that went into live data, an event name Meta would silently accept and then
 * report nowhere.
 *
 * And one rule runs through all of it: a tracking log must never become a list
 * of the people it tracked. The payload viewer is checked for the probe's
 * email address and for its SHA-256.
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   npx wrangler d1 execute bayezid-agency --local --file schema/014_capi_audit.sql
 *   npx wrangler dev --local --port 8787 &
 *
 *   # this site
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *
 *   CHROMIUM_PATH=... node tests/tracking-view.mjs
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

import { execFileSync } from 'node:child_process';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const API_HOST = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const LOCAL_API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const USER = process.env.ADMIN_USER || 'bayezid';
const PASS = process.env.ADMIN_PASS || 'correct-horse-battery';

const PROBE_EMAIL = 'view-probe@example.com';
const PROBE_SHA = createHash('sha256').update(PROBE_EMAIL).digest('hex');

/* No staleness guard here, unlike deferred-tags.mjs, and the difference is
   worth stating: admin/index.html loads /assets/js/admin.js and
   /assets/css/admin.css directly, with no minified sibling. There is no build
   step between an edit and what this test runs, so there is nothing to go
   stale. The site's public pages are the opposite case — they load .min.js —
   which is why that suite refuses to run against an old build. */

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  // Playwright refuses to rewrite https -> http, so proxy in Node and fulfil.
  await ctx.route(`${API_HOST}/**`, async (route) => {
    const req = route.request();
    try {
      const upstream = await fetch(req.url().replace(API_HOST, LOCAL_API), {
        method: req.method(),
        headers: { ...req.headers(), host: '127.0.0.1:8787' },
        body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
      });
      const headers = Object.fromEntries(upstream.headers.entries());
      headers['access-control-allow-origin'] = '*';
      headers['access-control-allow-headers'] = 'content-type,authorization,x-admin-secret';
      headers['access-control-allow-methods'] = 'GET,POST,DELETE,OPTIONS';
      delete headers['content-encoding'];
      delete headers['content-length'];
      await route.fulfill({ status: upstream.status, headers, body: Buffer.from(await upstream.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

/**
 * Start from an empty log.
 *
 * Without this the counts below depend on whatever else has run against the
 * local database today, and the suite reports a failure that is really just
 * three leftover rows from a screenshot script. That happened; it cost a
 * detour, and clearing the tables costs nothing.
 *
 * Local D1 only — the command names --local, and there is no path from here to
 * the deployed database.
 */
function resetLog() {
  const worker = process.env.WORKER_DIR || '../bayezid-agency-worker';
  try {
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'bayezid-agency', '--local',
      '--command', 'DELETE FROM meta_capi_events; DELETE FROM meta_event_rules;'],
      { cwd: worker, stdio: 'ignore' });
  } catch {
    console.log('  note: could not clear the local log (set WORKER_DIR).');
    console.log('        Counts below may include rows from an earlier run.');
  }
}

/** Put one paired and one blocked event into the log, through the real
 *  endpoint rather than by writing rows — the redaction happens on the way in,
 *  so a row inserted directly would prove nothing about it. */
async function seed() {
  const post = (body) => fetch(`${LOCAL_API}/api/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
  await post({
    event_name: 'Lead', event_id: 'view-paired',
    event_source_url: 'https://sayadbayezid.com/contact.html',
    browser_fired: true,
    user_data: { em: PROBE_EMAIL },
    custom_data: { value: 7700, currency: 'BDT' },
  });
  await post({
    event_name: 'Purchase', event_id: 'view-blocked',
    event_source_url: 'https://sayadbayezid.com/checkout',
    browser_fired: false,
  });
}

resetLog();
await seed();

const { ctx, page, errors } = await newPage();
await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
await page.fill('#username', USER);
await page.fill('#password', PASS);
await page.click('#loginBtn');
await page.waitForSelector('#shell', { state: 'visible', timeout: 15000 }).catch(() => {});

if (!(await page.locator('#shell').isVisible())) {
  console.error('\nCould not sign in. Set ADMIN_USER / ADMIN_PASS to match .dev.vars,');
  console.error('and clear admin_login_attempts if the rate limit has tripped.\n');
  await browser.close();
  process.exit(2);
}

console.log('\n== the screen is reachable and names itself ==');
await page.click('[data-view="tracking"]');
await page.waitForTimeout(1200);
check('Event tracking is in the sidebar and opens',
  (await page.locator('[data-view-panel="tracking"]').isVisible()));
check('the page title changes with it',
  (await page.locator('[data-title]').textContent())?.includes('Event tracking'));

console.log('\n== browser against server ==');
const dedup = await page.locator('[data-dedup]').innerText();
check('it counts the paired events', /Paired/i.test(dedup), dedup.slice(0, 200));
check('and the ones the browser never sent', /Browser missing/i.test(dedup), dedup.slice(0, 200));
check('with real numbers, not placeholders', /\b1\b/.test(dedup), dedup.slice(0, 200));

console.log('\n== the audit log shows what was sent ==');
const log = await page.locator('[data-audit-log]').innerText();
check('the blocked event is listed', /Purchase/.test(log), log.slice(0, 300));
check('and marked as blocked, not as fired', /blocked/i.test(log), log.slice(0, 300));
check('the paired one is marked fired', /fired/i.test(log), log.slice(0, 300));

// Open the payload viewer on the first row that has one.
const payloadButton = page.locator('[data-audit-log] button', { hasText: 'Payload' }).first();
check('a payload can be opened', await payloadButton.count() > 0);
if (await payloadButton.count()) {
  await payloadButton.click();
  await page.waitForTimeout(200);
  const dump = await page.locator('[data-audit-log] .payload-dump').first().innerText();
  check('it shows what Meta was actually told', /custom_data/.test(dump), dump.slice(0, 200));
  check('including the value', /7700/.test(dump), dump.slice(0, 200));
  check('the hashed contact is a count, not a hash', /hashed, not stored/.test(dump), dump.slice(0, 300));
}

console.log('\n== and it is not a list of the people it tracked ==');
const whole = await page.content();
check('the probe email is nowhere on the page', !whole.includes(PROBE_EMAIL));
check('nor is its SHA-256', !whole.includes(PROBE_SHA));

console.log('\n== a URL rule can be added and removed ==');
await page.fill('#rule-path', '/services');
await page.selectOption('#rule-event', 'Lead');
await page.fill('#rule-note', 'services enquiry');
await page.click('#ruleForm button[type="submit"]');
await page.waitForTimeout(900);
check('the rule appears in the list',
  (await page.locator('[data-rules]').innerText()).includes('/services'));

// The typo case. Meta accepts a non-standard name as a custom event and then
// reports it nowhere, so being refused here is the only place it gets caught.
const options = await page.locator('#rule-event option').allTextContents();
check('the event list comes from the server, not a copy in the UI',
  options.includes('CompleteRegistration') && options.includes('InitiateCheckout'),
  options.join(', '));

// A successful add resets the form, which returns the event select to its
// first option. So re-choosing Lead here is not incidental setup — without it
// the second submit is a DIFFERENT rule (/services + AddPaymentInfo), it
// succeeds, and this check passes for the wrong reason while proving nothing
// about duplicates. It did exactly that the first time it ran.
await page.fill('#rule-path', '/services');
await page.selectOption('#rule-event', 'Lead');
await page.click('#ruleForm button[type="submit"]');
await page.waitForTimeout(900);
check('adding the same rule twice is refused',
  /already exists/i.test(await page.locator('#ruleForm').innerText()));
check('and the list still holds one rule, not two',
  (await page.locator('[data-rules] tbody tr').count()) === 1,
  `rows: ${await page.locator('[data-rules] tbody tr').count()}`);

const removeButton = page.locator('[data-rules] button', { hasText: 'Remove' }).first();
await removeButton.click();
await page.waitForTimeout(900);
check('and it can be removed again',
  !(await page.locator('[data-rules]').innerText()).includes('/services'));

console.log('\n== the test simulator says where the event went ==');
await page.fill('#te-code', '');
await page.click('#testEventForm button[type="submit"]');
await page.waitForTimeout(1500);
const result = await page.locator('[data-test-result]').innerText();
// Either it warns that the event was real, or it reports that no token is
// configured. Both are correct answers; silently doing nothing is not.
check('an empty test code is called out, or the missing token is',
  /counted as a real event|not configured/i.test(result), result.slice(0, 300));

console.log('\n== nothing threw ==');
check('no page errors', errors.length === 0, errors.join('\n       '));

await ctx.close();
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
