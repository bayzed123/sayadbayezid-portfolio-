/**
 * Drives the operations console in a real browser against a local
 * `wrangler dev`, and checks the things that would be expensive to get wrong:
 * that the console is unreachable without signing in, that a stored client
 * credential never appears in the page, and that the analytics panels show an
 * honest empty state rather than invented numbers.
 *
 * Requires playwright, plus two servers:
 *
 *   # 1. the API, from the bayezid-agency-worker checkout
 *   npx wrangler d1 execute bayezid-agency --local --file schema/003_admin.sql
 *   printf 'ENCRYPTION_KEY="k"\nADMIN_SECRET="local-admin-secret"\nADMIN_USER_NAME="bayezid"\nADMIN_PASSWORD="correct-horse-battery"\n' > .dev.vars
 *   npx wrangler dev --local --port 8787 &
 *
 *   # 2. this site
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *
 *   node tests/admin-console.mjs
 *
 * Override with SITE_URL, LOCAL_API, ADMIN_USER, ADMIN_PASS, CHROMIUM_PATH.
 * Clear admin_login_attempts between runs or the rate limit trips.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const API_HOST = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const LOCAL_API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const USER = process.env.ADMIN_USER || 'bayezid';
const PASS = process.env.ADMIN_PASS || 'correct-horse-battery';

const SECRET_ACCOUNT = '46bf056399139631a967566fdb0413fa';
const SECRET_TOKEN = 'cf-token-abcdefghijkl-SECRET9999';

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

async function newPage(viewport = { width: 1440, height: 950 }) {
  const ctx = await browser.newContext({ viewport });
  const errors = [];
  const failed = [];
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
      headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
      delete headers['content-encoding'];
      delete headers['content-length'];
      await route.fulfill({ status: upstream.status, headers, body: Buffer.from(await upstream.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const page = await ctx.newPage();
  const mine = (url) => url.startsWith(SITE) || url.startsWith(API_HOST);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (mine(r.url())) failed.push(`${r.url()} ${r.failure()?.errorText}`); });
  page.on('response', (r) => { if (mine(r.url()) && r.status() >= 400 && r.status() !== 401) failed.push(`${r.url()} HTTP ${r.status()}`); });
  return { ctx, page, errors, failed };
}

const signIn = async (page, user = USER, pw = PASS) => {
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('#loginBtn');
};

// --- the gate --------------------------------------------------------------
console.log('== sign-in gate ==');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });

  check('gate is shown', await page.locator('#gate').isVisible());
  check('console is not', !(await page.locator('#shell').isVisible()));
  check('no data on the page before sign-in',
    !(await page.locator('[data-projects] table').count()));

  await signIn(page, USER, 'wrong-password');
  await page.waitForFunction(() => document.querySelector('#loginNotice')?.textContent?.trim().length > 0, null, { timeout: 8000 });
  check('wrong password is refused', !(await page.locator('#shell').isVisible()));
  const msg = await page.locator('#loginNotice').textContent();
  check('and does not say which field was wrong',
    !/password|username/i.test(msg), msg);

  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])', { timeout: 10000 });
  check('correct details sign in', await page.locator('#shell').isVisible());
  check('gate is dismissed', !(await page.locator('#gate').isVisible()));

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  check('token is not in localStorage', !storage.local.some((k) => k.includes('console')), JSON.stringify(storage.local));
  check('token is in sessionStorage', storage.session.some((k) => k.includes('console')), JSON.stringify(storage.session));
  check('the password is not retained anywhere',
    !(await page.evaluate((pw) => JSON.stringify([localStorage, sessionStorage]).includes(pw), PASS)));

  check('no JS errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// --- navigation ------------------------------------------------------------
console.log('== navigation ==');
{
  const { ctx, page, errors, failed } = await newPage();
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])');

  const views = ['projects', 'content', 'reviews', 'comments', 'enquiries', 'leads', 'analytics', 'settings'];
  for (const view of views) {
    await page.click(`.side-link[data-view="${view}"]`);
    await page.waitForSelector(`[data-view-panel="${view}"]:not([hidden])`, { timeout: 8000 });
    const visible = await page.locator(`[data-view-panel="${view}"]`).isVisible();
    const others = await page.locator('[data-view-panel]:not([hidden])').count();
    check(`${view}: opens and is the only visible panel`, visible && others === 1);
  }
  check('sidebar marks the current view',
    (await page.getAttribute('.side-link[data-view="settings"]', 'aria-current')) === 'page');

  check('no JS errors', errors.length === 0, errors.join('; '));
  check('no failed first-party requests', failed.length === 0, failed.join('; '));
  await ctx.close();
}

// --- a stored credential must never reach the page -------------------------
console.log('== client credentials are never rendered ==');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])');
  await page.click('.side-link[data-view="projects"]');
  await page.waitForSelector('[data-view-panel="projects"]:not([hidden])');

  await page.click('#addProjectBtn');
  await page.waitForSelector('#drawer.open', { timeout: 5000 });
  await page.fill('#p-name', 'Rinova BD');
  await page.fill('#p-health', 'https://example.com/health');
  await page.fill('#p-account', SECRET_ACCOUNT);
  await page.fill('#p-token', SECRET_TOKEN);
  await page.click('#projectForm button[type="submit"]');
  await page.waitForSelector('[data-projects] table', { timeout: 10000 });

  check('project appears in the table',
    (await page.locator('[data-projects] td', { hasText: 'Rinova BD' }).count()) > 0);
  check('account shows as a masked hint',
    (await page.locator('.masked', { hasText: '13fa' }).count()) > 0);
  check('token shows as a masked hint',
    (await page.locator('.masked', { hasText: '9999' }).count()) > 0);

  const html = await page.content();
  check('the account id is nowhere in the page', !html.includes(SECRET_ACCOUNT));
  check('the api token is nowhere in the page', !html.includes(SECRET_TOKEN));
  check('no ciphertext in the page', !/ciphertext/i.test(html));
  check('the form was cleared after saving',
    (await page.inputValue('#p-account')) === '' && (await page.inputValue('#p-token')) === '');

  check('no JS errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// --- charts and honest empty states ---------------------------------------
console.log('== charts and empty states ==');
{
  const { ctx, page, errors } = await newPage();
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])');
  await page.waitForSelector('[data-stats] .stat', { timeout: 10000 });

  check('stat cards render', (await page.locator('[data-stats] .stat').count()) === 4);
  await page.waitForSelector('[data-chart="enquiries"] svg', { timeout: 8000 });
  check('the line chart renders as SVG', (await page.locator('[data-chart="enquiries"] svg path').count()) > 0);
  check('the funnel renders', (await page.locator('[data-funnel] .funnel-row').count()) > 0);
  check('the availability ring renders', (await page.locator('[data-health-summary] svg circle').count()) >= 2);

  await page.click('.side-link[data-view="analytics"]');
  await page.waitForSelector('[data-view-panel="analytics"]:not([hidden])');
  // Either it is connected and draws real panels, or it is not and says so.
  // What must never appear is a chart of numbers nobody measured.
  await page.waitForSelector('[data-analytics] .stat, [data-analytics] .pending-panel', { timeout: 20000 });
  const connected = (await page.locator('[data-analytics] .stat').count()) > 0;

  if (connected) {
    check('analytics renders real stat cards', (await page.locator('[data-analytics] .stat').count()) >= 4);
    check('traffic chart drawn', (await page.locator('[data-analytics] svg path.line-path').count()) > 0);
    check('range switch present', (await page.locator('[data-analytics] button', { hasText: '28 days' }).count()) > 0);
    check('diagnose available', (await page.locator('[data-analytics] button', { hasText: 'Diagnose' }).count()) > 0);

    // Range switching must actually refetch, not just restyle a button.
    await page.click('[data-analytics] button:has-text("7 days")');
    await page.waitForFunction(
      () => document.querySelector('[data-analytics] .stat-sub')?.textContent.includes('7 days'),
      null, { timeout: 20000 });
    check('switching range refetches', true);

    await page.click('[data-analytics] button:has-text("Diagnose")');
    await page.waitForSelector('[data-analytics] table', { timeout: 20000 });
    const diag = await page.locator('[data-analytics]').textContent();
    check('diagnosis lists every surface',
      diag.includes('Google Analytics') && diag.includes('Search Console') && diag.includes('Tag Manager'));
    // MII is the base64 prefix of any DER-encoded key, so this catches a leaked
    // key without embedding a fragment of a particular one.
    check('diagnosis never shows a private key', !/BEGIN PRIVATE KEY|\bMII[A-Za-z0-9+/]{20}/.test(await page.content()));
  } else {
    check('analytics states what is missing',
      (await page.locator('[data-analytics]').textContent()).includes('GOOGLE_SERVICE_ACCOUNT_JSON'));
    check('and shows no fabricated figures', (await page.locator('[data-analytics] svg').count()) === 0);
  }

  check('no JS errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// --- sign out --------------------------------------------------------------
console.log('== sign out ==');
{
  const { ctx, page } = await newPage();
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])');
  await page.click('#signOutBtn');
  await page.waitForSelector('#gate:not([hidden])', { timeout: 5000 });
  check('returns to the gate', await page.locator('#gate').isVisible());
  check('token is discarded',
    await page.evaluate(() => !sessionStorage.getItem('cwb.console.token')));
  await page.reload({ waitUntil: 'domcontentloaded' });
  check('and stays signed out after a reload', !(await page.locator('#shell').isVisible()));
  await ctx.close();
}

// --- layout ----------------------------------------------------------------
console.log('== layout ==');
for (const [label, width] of [['desktop 1440', 1440], ['laptop 1024', 1024], ['mobile 390', 390]]) {
  const { ctx, page } = await newPage({ width, height: 900 });
  await page.goto(`${SITE}/admin/`, { waitUntil: 'domcontentloaded' });
  await signIn(page);
  await page.waitForSelector('#shell:not([hidden])');
  await page.waitForSelector('[data-stats] .stat', { timeout: 10000 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);
  if (width === 390) {
    check('mobile: sidebar is off-canvas', await page.evaluate(() =>
      document.getElementById('sidebar').getBoundingClientRect().right <= 1));
    await page.click('#navToggle');
    await page.waitForTimeout(400);
    check('mobile: the toggle opens it', await page.evaluate(() =>
      document.getElementById('sidebar').getBoundingClientRect().left >= -1));
  }
  await ctx.close();
}

await browser.close();
console.log(`\npassed: ${pass}   failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
