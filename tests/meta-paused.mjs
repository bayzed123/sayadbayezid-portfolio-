/**
 * Meta tracking while the ad account is restricted — and the moment it is not.
 *
 * THE SITUATION THIS IS WRITTEN FOR.
 * The ad account is restricted, so there is no Conversions API token to hold.
 * The instruction was: make everything else ready, so that adding the secret
 * later is the single step that brings tracking back. Two things stood in the
 * way, and both are checked below.
 *
 * 1. A MISSING TOKEN WAS BEING TREATED AS A FAULT.
 *    /api/track called Meta regardless, so every visitor produced a request to
 *    graph.facebook.com that could not succeed and a rejected row in the log —
 *    176 of them and climbing. Meanwhile health reported "misconfigured" for
 *    a state nobody could clear. A secret is never absent by accident, so an
 *    absent one means paused: no call, no row, health green.
 *
 * 2. RECOVERY WOULD HAVE TAKEN A WEEK TO SHOW.
 *    The verdict judged the whole 7-day window, so restoring the token on top
 *    of 176 rejections would have reported DEGRADED — with the fix text
 *    blaming the credential — for seven days after the credential was fixed.
 *    Long enough to conclude the fix had not worked. It now judges on the most
 *    recent events, so the panel turns green on the next accepted event.
 *
 * Both were reproduced against a real Worker before being fixed; the checks
 * below are the reproductions, kept.
 *
 *   # the API, from the bayezid-agency-worker checkout, WITHOUT a
 *   # META_CONVERSIONS_API_TOKEN in .dev.vars — that absence is the fixture
 *   npx wrangler dev --local --port 8787 &
 *
 *   # this site
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *
 *   CHROMIUM_PATH=... node tests/meta-paused.mjs
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

let pass = 0, fail = 0, skip = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${String(detail).slice(0, 300)}` : ''}`); }
};

function sql(command) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'bayezid-agency', '--local', '--command', command],
    { cwd: WORKER_DIR, stdio: 'ignore' });
}
/* `wrangler d1 execute --local` opens the sqlite file the dev server holds, and
   the server drops connections for a moment afterwards. A request sent into
   that window fails with "other side closed" and reads as a broken feature. */
async function settle() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`${LOCAL_API}/health`)).ok) return; } catch { /* restarting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('the local Worker did not come back after a database write');
}
const api = (path) => fetch(`${LOCAL_API}${path}`, { headers: H }).then((r) => r.json());

sql('DELETE FROM meta_capi_events;');
await settle();

const mode = (await api('/api/admin/meta/capi-log?limit=1')).mode;
const PAUSED = mode === 'paused';
if (!PAUSED) {
  console.log(`\n  note: the local Worker has a CAPI token set (mode=${mode}).`);
  console.log('        The paused-path checks need it ABSENT from .dev.vars and are skipped.');
}
const pausedCheck = (label, cond, detail) => {
  if (!PAUSED) { skip++; console.log(`  skip ${label} (needs no token configured)`); return; }
  check(label, cond, detail);
};

// ---------------------------------------------------------------------------
console.log('\npaused: nothing is sent, and nothing is recorded as failed');

const before = await api('/api/admin/meta/capi-log?limit=1');
const tracked = await fetch(`${LOCAL_API}/api/track`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    event_name: 'PageView', event_id: 'paused-suite-1',
    event_source_url: 'https://demu.sayadbayezid.com/', browser_fired: true,
  }),
}).then((r) => r.json());

pausedCheck('a visit during the pause is not reported to the caller as an error',
  tracked.ok === true, JSON.stringify(tracked));
pausedCheck('the reply says tracking is paused rather than implying it worked',
  tracked.tracking === 'paused', JSON.stringify(tracked));
/* The identifier still comes back. _fbp is ours to issue, not Meta's: it has to
   stay stable across a visit whether or not events are being sent, or every
   visitor who arrives during the restriction gets a fresh identity the moment
   it ends — fragmenting exactly the sessions the restriction already cost. */
pausedCheck('the visitor still gets an _fbp, so identity survives the pause',
  typeof tracked.fbp === 'string' && tracked.fbp.startsWith('fb.'), JSON.stringify(tracked));

const after = await api('/api/admin/meta/capi-log?limit=5');
pausedCheck('no row was written — the log does not fill with guaranteed failures',
  (after.events || []).length === (before.events || []).length,
  `${(before.events || []).length} -> ${(after.events || []).length}`);
pausedCheck('the state is reported as paused, not as an outage',
  after.delivery?.state === 'paused', JSON.stringify(after.delivery));
pausedCheck('the fix names the single command that resumes it',
  /wrangler secret put META_CONVERSIONS_API_TOKEN/.test(after.delivery?.fix || ''),
  after.delivery?.fix);

console.log('\npaused: old failures do not read as a current outage');
sql(`INSERT INTO meta_capi_events (id,event_name,event_id,status,http_status,error_code,error_message,created_at)
     VALUES ('old1','PageView','o1','rejected',400,'190','Error validating access token: session invalidated.',datetime('now','-2 days')),
            ('old2','Lead','o2','rejected',400,'190','Error validating access token: session invalidated.',datetime('now','-1 days'));`);
await settle();
const withHistory = await api('/api/admin/meta/capi-log?limit=5');
pausedCheck('176-style history from before the pause is not raised as DOWN',
  withHistory.delivery?.state === 'paused', JSON.stringify(withHistory.delivery));

console.log('\nreadiness: the token is the only outstanding item');
const readiness = await api('/api/admin/meta/readiness');
const outstanding = readiness.outstanding || [];
check('the readiness check answers',
  Array.isArray(readiness.items) && readiness.items.length > 0);
check('every prerequisite except the token is already in place',
  outstanding.every((key) => key === 'conversionsToken'),
  `outstanding: ${outstanding.join(', ')}`);
pausedCheck('readyForToken is true — adding the secret is genuinely the last step',
  readiness.readyForToken === true, JSON.stringify({ outstanding, summary: readiness.summary }));
check('the migrations are verified against the database, not assumed',
  readiness.items.some((i) => i.key === 'auditColumns' && i.ok) &&
  readiness.items.some((i) => i.key === 'eventRulesTable' && i.ok),
  JSON.stringify(readiness.items.map((i) => [i.key, i.ok])));

// ---------------------------------------------------------------------------
console.log('\nrecovery is judged on the newest events, not the 7-day ratio');

/* The exact shape of the real situation: a long run of rejections that STOPS,
   then acceptances. Judged over the window this is 98% failure; judged on what
   happened most recently it is working. Only the second is useful to a person
   deciding whether their fix landed. */
sql(`DELETE FROM meta_capi_events;
     INSERT INTO meta_capi_events (id,event_name,event_id,status,http_status,error_code,error_message,created_at)
     SELECT 'r'||value,'PageView','e'||value,'rejected',400,'190','Error validating access token: session invalidated.',
            datetime('now','-'||(2+(value%5))||' hours')
       FROM (WITH RECURSIVE c(value) AS (SELECT 1 UNION ALL SELECT value+1 FROM c WHERE value<176) SELECT value FROM c);
     INSERT INTO meta_capi_events (id,event_name,event_id,status,http_status,created_at) VALUES
       ('n1','PageView','x1','accepted',200,datetime('now','-40 minutes')),
       ('n2','Lead','x2','accepted',200,datetime('now','-30 minutes')),
       ('n3','PageView','x3','accepted',200,datetime('now','-20 minutes')),
       ('n4','ViewContent','x4','accepted',200,datetime('now','-10 minutes')),
       ('n5','PageView','x5','accepted',200,datetime('now'));`);
await settle();

const recovered = await api('/api/admin/meta/capi-log?limit=50');
if (PAUSED) {
  // With no token the verdict is "paused" whatever the rows say, which is
  // itself correct and already checked above. The recovery path needs a token.
  skip++;
  console.log('  skip recovery verdict (needs a token configured; paused outranks it)');
} else {
  check('a restored integration reads as working, not as 176 failures',
    recovered.delivery?.state === 'recovered', JSON.stringify(recovered.delivery));
  check('it does not blame the credential once events are being accepted',
    recovered.delivery?.credentialProblem === false, JSON.stringify(recovered.delivery));
  check('the older failures are still acknowledged, not hidden',
    /176/.test(recovered.delivery?.headline || ''), recovered.delivery?.headline);

  /* The front page calls this endpoint with limit=1. Deriving the recency
     sample from the log rows meant the Dashboard judged on ONE event while
     this screen judged on fifty, and the two disagreed about one database. */
  const atLimitOne = await api('/api/admin/meta/capi-log?limit=1');
  check('the Dashboard (limit=1) and the tracking screen (limit=50) agree',
    atLimitOne.delivery?.state === recovered.delivery?.state,
    `limit=1 ${atLimitOne.delivery?.state} vs limit=50 ${recovered.delivery?.state}`);
}

// ---------------------------------------------------------------------------
console.log('\nthe dashboard shows it the way a person should read it');

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const ctx = await browser.newContext({ viewport: { width: 420, height: 880 } });
const errors = [];
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

await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
await page.locator('#gate input').first().fill(USER);
await page.locator('#gate input[type=password]').fill(PASS);
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout: 15000 });

async function go(view) {
  const toggle = page.locator('#navToggle');
  if (await toggle.isVisible()) {
    const open = await page.locator('#sidebar').evaluate((n) => n.classList.contains('open'));
    if (!open) {
      await toggle.click();
      await page.waitForFunction(() => {
        const bar = document.getElementById('sidebar');
        return bar && bar.getBoundingClientRect().left >= 0;
      }, null, { timeout: 5000 });
    }
  }
  await page.locator(`.side-link[data-view="${view}"]`).click();
  await page.waitForSelector(`[data-view-panel="${view}"]:visible`, { timeout: 15000 });
}

await page.waitForTimeout(1500);
const attention = await page.locator('[data-attention]').innerText();
pausedCheck('a deliberate pause is NOT raised as something needing attention',
  !/tracking is down|token is dead/i.test(attention), attention);

await go('tracking');
await page.waitForSelector('[data-meta-readiness] .readiness-row', { timeout: 15000 });
const readinessText = await page.locator('[data-meta-readiness]').innerText();
check('the readiness checklist renders every prerequisite',
  (await page.locator('.readiness-row').count()) >= 8,
  `${await page.locator('.readiness-row').count()} rows`);
pausedCheck('it says the token is the only thing left',
  /only thing missing|Ready\./i.test(readinessText), readinessText.slice(0, 200));
check('the migrations show as done', /Audit columns exist/.test(readinessText));

await page.waitForSelector('[data-dedup] .alarm, [data-dedup] .field-hint', { timeout: 15000 });
const dedup = await page.locator('[data-dedup]').innerText();
pausedCheck('the tracking panel says PAUSED rather than showing a red outage',
  /PAUSED/.test(dedup) && !/TRACKING DOWN/.test(dedup), dedup.slice(0, 220));

check('no uncaught page errors', errors.length === 0, errors.join('\n'));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
