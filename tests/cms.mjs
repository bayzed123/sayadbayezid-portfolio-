/**
 * Publishing from the console, driven in a real browser.
 *
 * The checks that matter most here are about honesty rather than features:
 *
 *  - When publishing is not configured, the console must say which of the two
 *    problems it has (no token, or a token GitHub refused) and name the exact
 *    command, because those have different fixes.
 *  - Preview must work without any token, since it is the only way to see the
 *    slug your URL is built from and the date, before committing.
 *  - A title containing a colon must come out quoted. Unquoted, js-yaml throws
 *    and build-blog.js drops the post entirely — the post does not appear and
 *    nothing on the site says why.
 *
 * Nothing here commits: every call is a preview or a refused publish, so it is
 * safe to run against a Worker that holds a real token.
 *
 * Requires playwright, plus two servers:
 *
 *   # 1. the API, from the bayezid-agency-worker checkout, with NO GITHUB_TOKEN
 *   npx wrangler dev --local --port 8787 &
 *
 *   # 2. this repo, with API pointed at the local worker, served on :5601
 *   node tests/cms.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,240)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1440,height:1200} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout: 15000 });

await page.locator('[data-view="content"]').click();
await page.waitForSelector('[data-view-panel="content"]:visible');
await page.waitForFunction(() =>
  !/checking/i.test(document.querySelector('[data-content-status]')?.textContent || ''), null, { timeout: 15000 });

// With no GITHUB_TOKEN the console must say so plainly, and say what to set.
const status = await page.locator('[data-content-status]').innerText();
check('unconfigured publishing is stated, not hidden', /GITHUB_TOKEN/.test(status), status);
check('the message names the exact command', /wrangler secret put GITHUB_TOKEN/.test(status), status);
check('and names the repo it would write to', /sayadbayezid-portfolio/.test(status), status);

// Slug preview updates as you type, before anything is sent.
await page.fill('#c-title', 'WhatsApp Cloud API: the "real" costs');
await page.waitForTimeout(300);
let hint = await page.locator('[data-slug-preview]').innerText();
check('the URL is shown while typing the title',
  hint.includes('/blog/whatsapp-cloud-api-the-real-costs/'), hint);

await page.selectOption('#c-type', 'case-study');
await page.waitForTimeout(200);
hint = await page.locator('[data-slug-preview]').innerText();
check('switching type switches the URL shape', hint.includes('/case-studies/') && hint.endsWith('.html'), hint);
await page.selectOption('#c-type', 'blog');

await page.fill('#c-slug', 'My Custom Slug!!');
await page.waitForTimeout(200);
hint = await page.locator('[data-slug-preview]').innerText();
check('an explicit slug wins and is normalised', hint.includes('/blog/my-custom-slug/'), hint);
await page.fill('#c-slug', '');

// Preview must work with no token at all — that is the point of it.
await page.fill('#c-description', 'What Meta actually charges past the free tier.');
await page.fill('#c-category', 'Guide');
await page.fill('#c-body', '## Why this matters\n\nThe official Cloud API and Baileys are not the same trade-off.');
await page.locator('#previewBtn').click();
await page.waitForSelector('[data-publish-preview]:visible', { timeout: 15000 });
const file = await page.locator('[data-publish-preview]').innerText();
check('preview works without a GitHub token', file.length > 0);
check('the title is quoted so its colon cannot break YAML',
  file.includes('title: "WhatsApp Cloud API: the \\"real\\" costs"'), file.split('\n')[1]);
check('the date is filled in for you', /^date: "\d{4}-\d{2}-\d{2}"$/m.test(file), file);
check('the body follows the front matter', file.includes('## Why this matters'));

// Publishing without a token must refuse clearly rather than appear to work.
await page.locator('#publishForm button[type=submit]').click();
await page.waitForTimeout(2000);
const notice = await page.locator('#publishNotice').innerText();
check('publishing without a token refuses, and says why', /GITHUB_TOKEN/.test(notice), notice);
check('and points out that preview still works', /[Pp]review still works/.test(notice), notice);

// Validation the server owns.
await page.fill('#c-body', 'too short');
await page.locator('#previewBtn').click();
await page.waitForTimeout(1200);
check('a too-short body is rejected', /too short/i.test(await page.locator('#publishNotice').innerText()));

check('no JS errors', errs.length===0, errs.join('\n'));
await page.screenshot({ path: new URL('./cms.png', import.meta.url).pathname });
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
