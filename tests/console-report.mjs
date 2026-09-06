/**
 * The developer report and project editing, driven in a real browser against a
 * local `wrangler dev`.
 *
 * Two things here are worth more than the rest:
 *
 *  - A project nobody has checked must read "not measured", never 100%. The
 *    report replaced a Google-based one whose whole value was being trusted,
 *    and a fabricated uptime figure would be worse than no report at all.
 *  - Editing a project must not disturb its stored credentials. The API treats
 *    an explicit empty string as "clear this", so a form that posted its blank
 *    credential fields would wipe a client's API token as a side effect of
 *    fixing a URL. That is checked end to end, not by reading the code.
 *
 * Requires playwright, plus two servers:
 *
 *   # 1. the API, from the bayezid-agency-worker checkout
 *   for f in schema/00*.sql; do npx wrangler d1 execute bayezid-agency --local --file "$f"; done
 *   printf 'ENCRYPTION_KEY="k"\nADMIN_SECRET="local-admin-secret"\nADMIN_USER_NAME="bayezid"\nADMIN_PASSWORD="correct-horse-battery"\n' > .dev.vars
 *   npx wrangler dev --local --port 8787 &
 *
 *   # 2. this repo, with API pointed at the local worker, served on :5601
 *   node tests/console-report.mjs
 *
 * Seeds its own fixtures and deletes any it finds first, so two consecutive
 * runs mean the same thing.
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${d.slice(0,300)}`:''}`);} };

const API = 'http://127.0.0.1:8787';
const H = { 'content-type':'application/json', 'X-Admin-Secret':'local-admin-secret' };

// Self-seeding: wipe and rebuild the fixtures so a second run means the same
// as the first. Without this the report carries over checks from the last run.
const existing = await (await fetch(`${API}/api/admin/projects?archived=true`, { headers:H })).json();
for (const p of existing.projects) {
  await fetch(`${API}/api/admin/projects/${p.id}`, { method:'POST', headers:H, body: JSON.stringify({ action:'delete' }) });
}
const mk = (body) => fetch(`${API}/api/admin/projects`, { method:'POST', headers:H, body: JSON.stringify(body) }).then(r=>r.json());
const neel = await mk({ name:'NeeldigiTech', provider:'cloudflare', healthUrl:'https://example.invalid/health/',
  dashboardUrl:'https://example.invalid/', accountId:'acct-aaaa-5b45', apiToken:'tok-bbbb-955d', notes:'E-commerce site' });
await mk({ name:'Rinova BD', provider:'cloudflare', healthUrl:'https://example.invalid/health' });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1440,height:1100} });
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e));
// Only count errors from this origin. A blocked Google Fonts request in this
// sandbox says nothing about the console's own code.
page.on('requestfailed', r => { if (r.url().startsWith('http://127.0.0.1')) errors.push('failed request: '+r.url()); });

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout: 15000 });
check('signed in', true);

// ---------- the report ----------
await page.locator('[data-view="report"]').click();
await page.waitForSelector('[data-view-panel="report"]:visible');
// Wait for content, not a fixed delay.
// innerText comes back CSS-uppercased, so match case-insensitively.
await page.waitForFunction(() =>
  /never checked/i.test(document.querySelector('[data-report-summary]')?.innerText || ''), null, { timeout: 15000 });
check('Developer report opens as the only visible panel', (await page.locator('.view:visible').count()) === 1);

const summary = await page.locator('[data-report-summary]').innerText();
check('summary counts both projects', /Projects tracked\s*\n?\s*2/i.test(summary), summary);
check('"Never checked" is called out separately from up/down', /Never checked\s*\n?\s*2/i.test(summary), summary);

const tbl = await page.locator('[data-report-table]').innerText();
check('both projects listed', tbl.includes('NeeldigiTech') && tbl.includes('Rinova BD'));
check('unmeasured uptime reads "not measured", never 100%',
  tbl.includes('not measured') && !tbl.includes('100%'), tbl);
check('no incidents before any check ran',
  (await page.locator('[data-report-incidents]').innerText()).includes('No failures'));

// ---------- editing: the whole point of the PATCH route ----------
await page.locator('[data-view="projects"]').click();
await page.waitForSelector('[data-projects] table');
const row = page.locator('tr', { hasText:'NeeldigiTech' }).first();
const tokenBefore = (await row.innerText()).match(/••••\w+/g) || [];
await row.getByRole('button', { name:'Edit' }).click();
await page.waitForSelector('#drawer:visible');

check('the drawer says it is editing this project',
  (await page.locator('#drawerTitle').innerText()).includes('NeeldigiTech'));
check('existing values are pre-filled', await page.locator('#p-health').inputValue() === 'https://example.invalid/health/');
check('credential fields are left empty, never pre-filled',
  (await page.locator('#p-account').inputValue()) === '' && (await page.locator('#p-token').inputValue()) === '');
check('and say the stored one is kept if left blank',
  (await page.locator('#editingHint').innerText()).includes('blank to keep'));
check('the placeholder shows only the masked hint',
  (await page.locator('#p-token').getAttribute('placeholder')).includes('••••'));

// Fix the trailing slash — the exact real-world bug this route exists for.
await page.locator('#p-health').fill('https://example.invalid/health');
await page.locator('#projectForm button[type=submit]').click();
await page.waitForSelector('#drawer', { state:'hidden', timeout: 15000 });
await page.waitForTimeout(1200);

const rowAfter = page.locator('tr', { hasText:'NeeldigiTech' }).first();
const tokenAfter = (await rowAfter.innerText()).match(/••••\w+/g) || [];
check('the credential hints are unchanged by a URL edit',
  JSON.stringify(tokenAfter) === JSON.stringify(tokenBefore) && tokenAfter.length === 2,
  `before ${JSON.stringify(tokenBefore)} after ${JSON.stringify(tokenAfter)}`);

const fixed = await (await fetch(`${API}/api/admin/projects`, { headers:H })).json();
const saved = fixed.projects.find(p => p.name === 'NeeldigiTech');
check('the health URL was actually saved without the trailing slash',
  saved.health_url === 'https://example.invalid/health', saved.health_url);
check('the stored account credential survived', !!saved.account_hint);
check('the stored token credential survived', !!saved.token_hint);

// ---------- a real check feeds the report ----------
await page.locator('tr', { hasText:'NeeldigiTech' }).first().getByRole('button', { name:'Check' }).click();
await page.waitForTimeout(5000);
await page.locator('[data-view="report"]').click();
await page.waitForFunction(() =>
  /0%/.test(document.querySelector('[data-report-table]')?.innerText || ''), null, { timeout: 15000 });
check('the checked project now reports 0%, not "not measured"', true);
const inc = await page.locator('[data-report-incidents]').innerText();
check('the failure is named on screen, not just counted',
  inc.includes('NeeldigiTech') && !inc.includes('No failures'), inc);
check('the other project is still honestly "not measured"',
  (await page.locator('[data-report-table]').innerText()).includes('not measured'));

check('no first-party JS or request errors', errors.length===0, errors.join('\n'));
await page.screenshot({ path: new URL('./console-report.png', import.meta.url).pathname });
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
