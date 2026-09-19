/**
 * The four things added after a morning spent reading a dashboard that was
 * quietly wrong, driven in a real browser against a local Worker.
 *
 * WHAT EACH ONE IS REALLY CHECKING.
 *
 *  - The tracking alarm. The production console showed ACCEPTED 0 beside
 *    REJECTED 133, in identical boxes, for five days, through a live ad
 *    campaign. Both numbers were correct. Nothing on the screen drew the
 *    conclusion, so nobody did. The check below is that a total failure now
 *    says so in words, names the token as the cause when Meta's error code is
 *    an auth code, and — the part that actually matters — reaches the front
 *    page, because the tracking screen is not the screen anyone opens first.
 *
 *  - Enquiry read state. An enquiry looked identical the moment it arrived
 *    and a week later, so the only record of whether one had been dealt with
 *    was somebody's memory. Checked as a round trip through the API, and for
 *    the unread badge appearing on a different screen than the one that set it.
 *
 *  - Copy. Asserted on the clipboard's actual contents, not on the button
 *    changing colour — a button that says "Copied" while copying nothing is
 *    exactly the failure worth catching, and it is invisible to a screenshot.
 *
 *  - Our own backend, separated from the clients'. A Cloudflare Worker cannot
 *    fetch its own hostname (error 1042), so the agency's own service could
 *    never be checked by the mechanism built to check it and sat in the client
 *    table reporting "misconfigured — HTTP 404" forever. The check is that the
 *    self-check does not make an HTTP request at all, and that the client
 *    uptime figures no longer include it.
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   for f in schema/0*.sql; do npx wrangler d1 execute bayezid-agency --local --file "$f"; done
 *   printf 'ENCRYPTION_KEY="k"\nADMIN_SECRET="local-admin-secret"\nADMIN_USER_NAME="bayezid"\nADMIN_PASSWORD="correct-horse-battery"\n' > .dev.vars
 *   npx wrangler dev --local --port 8787 &
 *
 *   # this site
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *
 *   CHROMIUM_PATH=... node tests/ops-console.mjs
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const API_HOST = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const LOCAL_API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const ADMIN = process.env.ADMIN_SECRET || 'local-admin-secret';
const USER = process.env.ADMIN_USER || 'bayezid';
const PASS = process.env.ADMIN_PASS || 'correct-horse-battery';
const WORKER_DIR = process.env.WORKER_DIR || '../bayezid-agency-worker';

const H = { 'content-type': 'application/json', 'X-Admin-Secret': ADMIN };

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${String(detail).slice(0, 300)}` : ''}`); }
};

function sql(command) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'bayezid-agency', '--local', '--command', command],
    { cwd: WORKER_DIR, stdio: 'ignore' });
}

/* `wrangler d1 execute --local` opens the same sqlite file `wrangler dev` is
   holding, and the dev server drops its connections for a moment afterwards.
   A request sent into that window fails with "other side closed" and reads as
   a broken feature rather than a busy file — which cost a confusing run. So
   every seeding step is followed by waiting for the server to answer again. */
async function settle() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${LOCAL_API}/health`);
      if (response.ok) return;
    } catch { /* still restarting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('the local Worker did not come back after a database write');
}

/* Every count below is an assertion about specific rows, so the suite seeds
   its own and removes anything it finds first. Two consecutive runs have to
   mean the same thing; a previous run's leftovers reading as a failure costs
   more time than clearing the tables ever will. Local D1 only — the command
   names --local and there is no path from here to the deployed database. */
sql('DELETE FROM meta_capi_events; DELETE FROM contact_submissions; DELETE FROM client_projects; DELETE FROM project_health_checks;');
await settle();

// The production failure, reproduced exactly: every event rejected, error 190.
sql(`INSERT INTO meta_capi_events (id,event_name,event_id,source_url,status,http_status,error_code,error_message,created_at) VALUES
 ('t1','PageView','e1','https://x/','rejected',400,'190','Error validating access token: The session has been invalidated because the user changed their password.',datetime('now','-4 days')),
 ('t2','Lead','e2','https://x/','rejected',400,'190','Error validating access token: The session has been invalidated.',datetime('now','-1 days'));`);
await settle();

const mk = (body) => fetch(`${LOCAL_API}/api/admin/projects`, { method: 'POST', headers: H, body: JSON.stringify(body) })
  .then((r) => r.json()).then((payload) => payload.project);
const client = await mk({ name: 'A Client Site', provider: 'cloudflare', healthUrl: 'https://example.invalid/health' });
const own = await mk({ name: 'Agency backend', provider: 'cloudflare', healthUrl: `${API_HOST}/health` });

await fetch(`${LOCAL_API}/api/contact`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Sidra Rahman', email: 'sidra@example.com', message: 'ORDER REQUEST — ecommerce build.\nBudget: fully custom.' }),
});

// ---------------------------------------------------------------------------
// API-level checks. These run before the browser because a UI check that fails
// for an API reason wastes the time of whoever reads the output.
// ---------------------------------------------------------------------------
console.log('\nthe agency\'s own backend is checked from the inside');

const ownCheck = await (await fetch(`${LOCAL_API}/api/admin/projects/${own.id}/check`, { method: 'POST', headers: H })).json();
// The load-bearing assertion of this whole file. A Worker cannot fetch its own
// hostname; if this check ever goes back over HTTP the status code returns and
// the row goes back to reporting 404 forever.
check('the self-check reports no HTTP status code, because it made no HTTP request',
  ownCheck.statusCode === null, JSON.stringify(ownCheck));
check('it is not reported as down — the service is running',
  ownCheck.status !== 'down', JSON.stringify(ownCheck));

const ownPayload = await (await fetch(`${LOCAL_API}/api/admin/projects/${own.id}/payload`, { headers: H })).json();
check('the stored evidence says where the check was run from',
  /inside the Worker/.test(ownPayload.payload?.body || ''), ownPayload.payload?.body);
check('it records a real database read, not just "ok"',
  /"name":"d1","ok":true/.test(ownPayload.payload?.body || ''), ownPayload.payload?.body);

await fetch(`${LOCAL_API}/api/admin/projects/${client.id}/check`, { method: 'POST', headers: H });
const report = await (await fetch(`${LOCAL_API}/api/admin/projects/report?days=7`, { headers: H })).json();
check('the report separates our own infrastructure from the clients',
  report.clientSummary?.total === 1 && report.ownSummary?.total === 1,
  JSON.stringify({ client: report.clientSummary, own: report.ownSummary }));
check('the client-facing total excludes our own backend',
  report.clientSummary.total < report.summary.total, JSON.stringify(report.clientSummary));

console.log('\nthe delivery verdict');
const log = await (await fetch(`${LOCAL_API}/api/admin/meta/capi-log?limit=5`, { headers: H })).json();
check('all-rejected is reported as down, not as a number to interpret',
  log.delivery?.state === 'down', JSON.stringify(log.delivery));
check('an auth error code is identified as a credential problem',
  log.delivery?.credentialProblem === true, JSON.stringify(log.delivery));
check('the fix names the secret to rotate',
  /META_CONVERSIONS_API_TOKEN/.test(log.delivery?.fix || ''), log.delivery?.fix);
check('it says when delivery stopped',
  Boolean(log.delivery?.failingSince), JSON.stringify(log.delivery));

// A data error must NOT be reported as a credential problem: that would send
// somebody to rotate a perfectly good token while the real fault stays.
sql(`DELETE FROM meta_capi_events; INSERT INTO meta_capi_events (id,event_name,event_id,status,http_status,error_code,error_message,created_at)
     VALUES ('d1','Purchase','e9','rejected',400,'100','Invalid parameter: currency',datetime('now','-1 days'));`);
await settle();
const dataErr = await (await fetch(`${LOCAL_API}/api/admin/meta/capi-log?limit=1`, { headers: H })).json();
check('a data error is down but NOT blamed on the token',
  dataErr.delivery?.state === 'down' && dataErr.delivery?.credentialProblem === false,
  JSON.stringify(dataErr.delivery));

// Restore the auth failure for the browser checks below.
sql(`DELETE FROM meta_capi_events; INSERT INTO meta_capi_events (id,event_name,event_id,status,http_status,error_code,error_message,created_at)
     VALUES ('t1','PageView','e1','rejected',400,'190','Error validating access token: The session has been invalidated.',datetime('now','-2 days'));`);
await settle();

// ---------------------------------------------------------------------------
// Browser.
// ---------------------------------------------------------------------------
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext({
  viewport: { width: 420, height: 880 },
  // Granted so the copy checks exercise navigator.clipboard, which is the path
  // a real browser takes. The manual fallback is a different code path and a
  // headless run cannot drive the OS copy menu that makes it work.
  permissions: ['clipboard-read', 'clipboard-write'],
});
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

/* A phone viewport, deliberately: this console is read on a phone, and the
   screenshots that started this work were all taken on one. At this width the
   sidebar is translated off-screen until the toggle opens it, so navigating
   means using the same control a person would — which also means a broken
   mobile nav fails this suite instead of hiding behind a 1440px viewport. */
async function go(view) {
  // The toggle is display:none above the breakpoint, so its visibility is the
  // reliable signal for "this layout has an off-screen sidebar" — more so than
  // measuring the link, which reports itself visible while translated out of
  // the viewport and makes the click hang for thirty seconds.
  const toggle = page.locator('#navToggle');
  if (await toggle.isVisible()) {
    const isOpen = await page.locator('#sidebar').evaluate((node) => node.classList.contains('open'));
    if (!isOpen) {
      await toggle.click();
      // Wait for the slide-in to finish; clicking mid-transform is the
      // "element is not stable" failure.
      await page.waitForFunction(() => {
        const bar = document.getElementById('sidebar');
        return bar && bar.getBoundingClientRect().left >= 0;
      }, null, { timeout: 5000 });
    }
  }
  await page.locator(`.side-link[data-view="${view}"]`).click();
  await page.waitForSelector(`[data-view-panel="${view}"]:visible`, { timeout: 15000 });
}

await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
await page.locator('#gate input').first().fill(USER);
await page.locator('#gate input[type=password]').fill(PASS);
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout: 15000 });

console.log('\nthe front page raises what is wrong');
// The overview fetches these itself; wait for the panel to settle rather than
// guessing at a delay.
await page.waitForFunction(
  () => (document.querySelector('[data-attention]')?.innerText || '').length > 0,
  null, { timeout: 15000 },
);
await page.waitForTimeout(1200);
const attention = await page.locator('[data-attention]').innerText();
check('a dead pixel is raised on the dashboard, not only on the tracking screen',
  /token is dead|accepting no events/i.test(attention), attention);
check('an unread enquiry is raised on the dashboard',
  /not read yet/i.test(attention), attention);
check('"Nothing needs you" is not shown beside real warnings',
  !/nothing needs you/i.test(attention), attention);

const badge = await page.locator('.side-link[data-view="enquiries"] [data-unread]').innerText().catch(() => '');
check('the unread count is on the sidebar, visible from every screen', badge === '1', `badge=${badge}`);

console.log('\nthe tracking alarm');
await go('tracking');
await page.waitForSelector('.alarm', { timeout: 15000 });
const alarm = await page.locator('.alarm').innerText();
check('the state is stated in words, not left to be inferred from a zero',
  /TRACKING DOWN/.test(alarm), alarm);
check('Meta\'s own words are quoted', /session has been invalidated/i.test(alarm), alarm);
check('the fix is printed where the problem is', /wrangler secret put/i.test(alarm), alarm);

console.log('\nenquiries: copy and read state');
await go('enquiries');
await page.waitForSelector('.enq', { timeout: 15000 });

check('the message is shown in full, not truncated into a table cell',
  (await page.locator('.enq-body').innerText()).includes('Budget: fully custom'));
check('an unread enquiry is marked with a word, not only a colour',
  (await page.locator('.enq-flag').innerText()) === 'UNREAD');

// Copy is asserted on the clipboard, not on the button's label. A button that
// reports success while copying nothing is the failure worth catching.
await page.getByRole('button', { name: 'Copy message' }).first().click();
const copiedMessage = await page.evaluate(() => navigator.clipboard.readText());
check('Copy message puts the message on the clipboard',
  copiedMessage.includes('ORDER REQUEST') && copiedMessage.includes('Budget: fully custom'), copiedMessage);

await page.getByRole('button', { name: 'Copy email' }).first().click();
const copiedEmail = await page.evaluate(() => navigator.clipboard.readText());
check('Copy email copies the address alone', copiedEmail.trim() === 'sidra@example.com', copiedEmail);

await page.getByRole('button', { name: 'Copy all' }).first().click();
const copiedAll = await page.evaluate(() => navigator.clipboard.readText());
check('Copy all copies a pasteable record',
  copiedAll.includes('Sidra Rahman') && copiedAll.includes('sidra@example.com') && copiedAll.includes('ORDER REQUEST'),
  copiedAll);
check('the button confirms it happened',
  (await page.locator('.copy-btn.copied').count()) > 0);

await page.getByRole('button', { name: 'Mark read' }).first().click();
await page.waitForSelector('.enq.is-read', { timeout: 10000 });
check('marking read turns the card green-flagged to read',
  (await page.locator('.enq.is-read').count()) === 1);
check('the UNREAD flag is gone once read',
  (await page.locator('.enq-flag').count()) === 0);
check('the sidebar badge clears when nothing is unread',
  (await page.locator('.side-link[data-view="enquiries"] [data-unread]').count()) === 0);

// The state has to survive a reload, or it was never stored.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#shell:visible', { timeout: 15000 });
await go('enquiries');
await page.waitForSelector('.enq', { timeout: 15000 });
check('read state survives a reload — it is stored, not just painted',
  (await page.locator('.enq.is-read').count()) === 1);

await page.getByRole('button', { name: '✓ Read' }).first().click();
await page.waitForSelector('.enq-flag', { timeout: 10000 });
check('it can be marked unread again — opening something must not file it',
  (await page.locator('.enq.is-read').count()) === 0);

console.log('\nthe report keeps our own backend out of the client figures');
await go('report');
await page.waitForFunction(
  () => /client projects/i.test(document.querySelector('[data-report-summary]')?.innerText || ''),
  null, { timeout: 15000 },
);
const summary = await page.locator('[data-report-summary]').innerText();
check('the summary counts one client, not two services',
  /Client projects\s*\n?\s*1\b/i.test(summary), summary);
const clientTable = await page.locator('[data-report-table]').innerText();
check('the client table lists the client', clientTable.includes('A Client Site'));
check('the client table does NOT list our own backend',
  !clientTable.includes('Agency backend'), clientTable);
const ownPanel = await page.locator('[data-own-infra]').innerText();
check('our own backend has its own section', ownPanel.includes('Agency backend'), ownPanel);
check('that section says why there is no status code',
  /cannot fetch itself/i.test(ownPanel), ownPanel);

console.log('\nbuild pipelines');
await go('pipelines');
await page.waitForFunction(
  () => (document.querySelector('[data-pipelines]')?.innerText || '').length > 0,
  null, { timeout: 15000 },
);
const pipelines = await page.locator('[data-pipelines]').innerText();
// No GITHUB_TOKEN locally, so the honest answer is "not connected" — and
// saying so beats an empty panel that looks like "no builds are failing".
check('with no GitHub token it says it is not connected rather than showing nothing',
  /not connected|GITHUB_TOKEN/i.test(pipelines), pipelines);

check('no uncaught page errors', errors.length === 0, errors.join('\n'));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
