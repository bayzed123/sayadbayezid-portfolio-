/**
 * Drives the ratings + comments widget in a real browser, against a local
 * `wrangler dev` copy of the API, and checks the things that would be
 * expensive to get wrong: that a comment is never rendered as markup, that an
 * unapproved comment stays invisible, that the two URL shapes both work, and
 * that nothing overflows on a phone.
 *
 * Requires playwright, plus two servers:
 *
 *   # 1. the API, from the bayezid-agency-worker checkout
 *   npx wrangler d1 execute bayezid-agency --local --file schema/001_engagement.sql
 *   printf 'ENCRYPTION_KEY="k"\nADMIN_SECRET="local-admin-secret"\n' > .dev.vars
 *   npx wrangler dev --local --port 8787 &
 *
 *   # 2. this site
 *   python3 -m http.server 8080 --bind 127.0.0.1 &
 *
 *   node tests/engagement-widget.mjs
 *
 * Override with SITE_URL, LOCAL_API, ADMIN_SECRET and CHROMIUM_PATH.
 * Clear the local tables between runs or the per-hour comment limit trips.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://127.0.0.1:8080';
const API_HOST = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
const LOCAL_API = process.env.LOCAL_API || 'http://127.0.0.1:8787';
const ADMIN = process.env.ADMIN_SECRET || 'local-admin-secret';

const POST = `${SITE}/blog/whatsapp-cloud-api-setup-guide-and-integration-costs/`;
const STUDY = `${SITE}/case-studies/rinova-bd.html`;

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`); }
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

async function newPage(viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const errors = [];
  const failed = [];
  // Playwright refuses to rewrite https → http, so proxy the call in Node and
  // fulfil the route with what the local Worker actually returned. The page's
  // own code is untouched: it still requests the production URL.
  await ctx.route(`${API_HOST}/**`, async (route) => {
    const req = route.request();
    const url = req.url().replace(API_HOST, LOCAL_API);
    try {
      const upstream = await fetch(url, {
        method: req.method(),
        headers: { ...req.headers(), host: '127.0.0.1:8787' },
        body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(),
        redirect: 'manual',
      });
      const headers = Object.fromEntries(upstream.headers.entries());
      headers['access-control-allow-origin'] = '*';
      headers['access-control-allow-headers'] = 'content-type,x-admin-secret';
      headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
      delete headers['content-encoding'];
      delete headers['content-length'];
      await route.fulfill({
        status: upstream.status,
        headers,
        body: Buffer.from(await upstream.arrayBuffer()),
      });
    } catch (e) {
      await route.abort();
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // Only first-party assets and the API are this repo's problem. Analytics,
  // ad and font hosts are unreachable from the sandbox, and counting those as
  // failures would drown the signal — but a broken local asset or a dead API
  // call still has to fail the run.
  const mine = (url) => url.startsWith(SITE) || url.startsWith(API_HOST);
  page.on('requestfailed', (r) => {
    if (mine(r.url())) failed.push(`${r.url()} ${r.failure()?.errorText}`);
  });
  // A 404 is not a requestfailed event — it is a perfectly successful request
  // for a file that is not there. A mistyped asset path would otherwise sail
  // through this check.
  page.on('response', (r) => {
    if (mine(r.url()) && r.status() >= 400) failed.push(`${r.url()} HTTP ${r.status()}`);
  });
  return { ctx, page, errors, failed };
}

// --- a blog post -----------------------------------------------------------
console.log('== blog post ==');
{
  const { ctx, page, errors, failed } = await newPage();
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-engagement]:not([hidden])', { timeout: 10000 });

  check('section reveals after the API answers', await page.locator('[data-engagement]').isVisible());
  check('target is the canonical blog path',
    (await page.getAttribute('[data-engagement]', 'data-engagement')) === '/blog/whatsapp-cloud-api-setup-guide-and-integration-costs/');
  check('empty state shown before any rating',
    (await page.locator('[data-rating-summary]').textContent()).includes('No ratings yet'));

  // Stars must read left-to-right as 1..5 despite the reversed DOM order.
  const order = await page.$$eval('.rating-stars label', (els) =>
    els.map((el) => ({ id: el.getAttribute('for'), x: el.getBoundingClientRect().left }))
       .sort((a, b) => a.x - b.x).map((e) => e.id));
  check('stars render 1→5 left to right',
    JSON.stringify(order) === JSON.stringify(['rating-1','rating-2','rating-3','rating-4','rating-5']),
    JSON.stringify(order));

  await page.click('label[for="rating-4"]');
  await page.waitForFunction(
    () => /out of 5/.test(document.querySelector('[data-rating-summary]').textContent),
    null, { timeout: 8000 });
  const summary = await page.locator('[data-rating-summary]').textContent();
  check('rating saved and summary updates', summary.includes('4.0 out of 5') && summary.includes('1 rating'), summary);

  // Reload: the browser remembers which star this reader picked.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-engagement]:not([hidden])');
  check('own vote restored after reload', await page.isChecked('#rating-4'));

  // Comment.
  await page.fill('#comment-name', 'Test Reader');
  await page.fill('#comment-body', 'First line of the comment.\n\nSecond paragraph here.');
  await page.click('.comment-form button[type="submit"]');
  await page.waitForFunction(
    () => document.querySelector('[data-form-status]').getAttribute('data-kind') === 'ok',
    null, { timeout: 8000 });
  check('comment accepted',
    (await page.locator('[data-form-status]').textContent()).includes('approved'));
  check('form cleared after submit', (await page.inputValue('#comment-body')) === '');
  check('unapproved comment is not shown', (await page.locator('.comment').count()) === 0);
  check('empty-state message still visible', await page.locator('[data-comment-empty]').isVisible());

  check('no JS errors', errors.length === 0, errors.join('; '));
  check('no failed requests', failed.length === 0, failed.join('; '));
  await ctx.close();
}

// --- moderation, then the comment appears ---------------------------------
console.log('== after approval ==');
{
  const queue = await fetch(`${LOCAL_API}/api/admin/comments`, { headers: { 'X-Admin-Secret': ADMIN } }).then((r) => r.json());
  const mine = queue.comments.find((c) => c.name === 'Test Reader');
  check('comment reached the moderation queue', Boolean(mine));
  await fetch(`${LOCAL_API}/api/admin/comments/${mine.id}`, {
    method: 'POST',
    headers: { 'X-Admin-Secret': ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });

  const { ctx, page, errors } = await newPage();
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForSelector('.comment', { timeout: 10000 });
  check('approved comment now renders', (await page.locator('.comment').count()) === 1);
  check('author shown', (await page.locator('.comment-author').textContent()) === 'Test Reader');
  check('blank lines became separate paragraphs', (await page.locator('.comment p').count()) === 2);
  check('count badge updated', (await page.locator('[data-comment-count]').textContent()) === '1');
  check('empty-state hidden', !(await page.locator('[data-comment-empty]').isVisible()));
  check('no JS errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// --- a comment containing markup must never become markup -----------------
console.log('== comment text is never markup ==');
{
  await fetch(`${LOCAL_API}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'xss-probe/1.0' },
    body: JSON.stringify({
      target: '/blog/whatsapp-cloud-api-setup-guide-and-integration-costs/',
      name: '<img src=x onerror=window.__xss=1>',
      body: '<script>window.__xss=1<\/script> and <b>bold</b>',
    }),
  });
  const queue = await fetch(`${LOCAL_API}/api/admin/comments`, { headers: { 'X-Admin-Secret': ADMIN } }).then((r) => r.json());
  const evil = queue.comments.find((c) => c.name.includes('onerror'));
  await fetch(`${LOCAL_API}/api/admin/comments/${evil.id}`, {
    method: 'POST',
    headers: { 'X-Admin-Secret': ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });

  const { ctx, page, errors } = await newPage();
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelectorAll('.comment').length === 2, null, { timeout: 10000 });

  check('no script executed', (await page.evaluate(() => window.__xss)) === undefined);
  check('no img element injected', (await page.locator('.comment img').count()) === 0);
  check('no bold element injected', (await page.locator('.comment b').count()) === 0);
  check('markup rendered as literal text',
    (await page.locator('.comment').nth(1).textContent()).includes('<b>bold</b>'));
  check('no JS errors', errors.length === 0, errors.join('; '));
  await ctx.close();
}

// --- a case study, the .html-shaped URL ------------------------------------
console.log('== case study ==');
{
  const { ctx, page, errors, failed } = await newPage();
  await page.goto(STUDY, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-engagement]:not([hidden])', { timeout: 10000 });
  check('section reveals on a case study', await page.locator('[data-engagement]').isVisible());
  check('target is the .html path',
    (await page.getAttribute('[data-engagement]', 'data-engagement')) === '/case-studies/rinova-bd.html');
  check('heading says case study',
    (await page.locator('.rating-block h2').textContent()).includes('case study'));
  await page.click('label[for="rating-5"]');
  await page.waitForFunction(
    () => /out of 5/.test(document.querySelector('[data-rating-summary]').textContent),
    null, { timeout: 8000 });
  check('rating saves on a case study',
    (await page.locator('[data-rating-summary]').textContent()).includes('5.0 out of 5'));
  check('no JS errors', errors.length === 0, errors.join('; '));
  check('no failed requests', failed.length === 0, failed.join('; '));
  await ctx.close();
}

// --- layout ---------------------------------------------------------------
console.log('== layout ==');
for (const [label, width] of [['desktop 1440', 1440], ['mobile 390', 390]]) {
  const { ctx, page } = await newPage({ width, height: 900 });
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-engagement]:not([hidden])');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);
  const hp = await page.evaluate(() => {
    const el = document.querySelector('input[name="website"]');
    const r = el.getBoundingClientRect();
    return { onscreen: r.right > 0 && r.left < window.innerWidth };
  });
  check(`${label}: honeypot is off-screen`, !hp.onscreen);
  await ctx.close();
}

await browser.close();
console.log(`\npassed: ${pass}   failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
