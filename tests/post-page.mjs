/**
 * The post page: breadcrumbs, code samples and the things a reader touches.
 *
 * The copy button is checked against the real clipboard rather than by
 * asserting the button exists — a button that looks right and copies nothing
 * is the failure worth catching.
 *
 * Runs against a real published post rather than a committed fixture — a
 * test post in blog-posts/ would publish to the live site, appear in the
 * feed, the sitemap and the homepage grid. Needs the built site on :5610:
 *
 *   node scripts/build-blog.js
 *   python3 -m http.server 5610 --bind 127.0.0.1 &
 *   node tests/post-page.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,200)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await browser.newContext({ permissions: ['clipboard-read','clipboard-write'] });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

await page.goto('http://127.0.0.1:5610/blog/google-maps-lead-generation-google-sheets/', { waitUntil:'networkidle' });

check('breadcrumb trail is on the page', await page.locator('nav.post-breadcrumb li').count() === 3);
const crumbs = (await page.locator('nav.post-breadcrumb').innerText()).replace(/\s+/g,' ');
check('breadcrumbs read Home, Blog, then the title', /Home Blog Google Maps Lead Generation/i.test(crumbs), crumbs);
// The separators are CSS ::before content, so innerText cannot see them —
// read the generated content directly rather than asserting on text.
const sep = await page.evaluate(() =>
  getComputedStyle(document.querySelectorAll('.post-breadcrumb li')[1], '::before').content);
check('a separator is drawn between crumbs', sep.includes('/'), sep);
check('the current page is marked for assistive tech',
  await page.locator('.post-breadcrumb [aria-current="page"]').count() === 1);

check('every code block has a copy button', await page.locator('.code-copy').count() === 2);
check('the language is labelled from the fence',
  ['mermaid','html','bash','json','js'].includes((await page.locator('.code-block-lang').first().innerText()).toLowerCase().trim()));

// The actual behaviour, not just the button existing.
await page.locator('.code-copy').first().click();
await page.waitForTimeout(400);
const clip = await page.evaluate(() => navigator.clipboard.readText());
const firstBlock = (await page.locator('.code-block code').first().innerText()).trim();
check('clicking copy puts that exact sample on the clipboard',
  clip.trim() === firstBlock && clip.trim().length > 0, JSON.stringify(clip.slice(0, 80)));
check('the button confirms it copied',
  (await page.locator('.code-copy').first().innerText()).trim() === 'Copied');

// And that it resets, so a second block can be copied after the first.
await page.waitForTimeout(2200);
check('the button resets to Copy', (await page.locator('.code-copy').first().innerText()).trim() === 'Copy');
await page.locator('.code-copy').nth(1).click();
await page.waitForTimeout(400);
const secondBlock = (await page.locator('.code-block code').nth(1).innerText()).trim();
const secondClip = (await page.evaluate(() => navigator.clipboard.readText())).trim();
check('the second block copies its own text, not the first',
  secondClip === secondBlock && secondClip !== firstBlock, JSON.stringify(secondClip.slice(0, 60)));

check('no JS errors', errs.length===0, errs.join('\n'));
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
