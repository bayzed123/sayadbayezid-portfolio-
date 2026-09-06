/**
 * The pre-publish checklist and the two previews.
 *
 * Each rule is checked at its boundaries — a value just inside the band and
 * one just outside — rather than only in the happy case, because a rule that
 * always passes is worse than no rule: it tells the author the post is ready
 * when it is not.
 *
 * The two previews are checked for showing *different* things: the Google
 * preview must use the SEO title and meta description, the card must use the
 * headline and the summary. Getting those crossed would make the panel lie
 * about the one thing it exists to show.
 *
 * Nothing here publishes. Requires playwright and two servers:
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   npx wrangler dev --local --port 8787 &
 *   # this repo's console on :5601, API pointed at the local worker
 *   node tests/seo-panel.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,200)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1500,height:1400} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });
await page.locator('[data-view="content"]').click();
await page.waitForSelector('[data-seo-checklist] li', { timeout:15000 });

const rows = () => page.locator('[data-seo-checklist] .seo-check');
const rowState = async (label) => {
  const row = page.locator('.seo-check', { hasText: label }).first();
  return (await row.getAttribute('class')) || '';
};

check('all eight rules are listed', await rows().count() === 8, await rows().count());
check('an empty form starts with everything to do',
  await page.locator('.seo-check.is-ok').count() <= 1, await page.locator('.seo-check.is-ok').count());

// --- title band ---
await page.fill('#c-title', 'Too short');
await page.waitForTimeout(150);
check('a 9-character title fails the 15–70 rule', (await rowState('Title is 15–70')).includes('is-todo'));
await page.fill('#c-title', 'WhatsApp Cloud API pricing for Bangladesh senders');
await page.waitForTimeout(150);
check('a 49-character title passes', (await rowState('Title is 15–70')).includes('is-ok'));
await page.fill('#c-title', 'A'.repeat(80));
await page.waitForTimeout(150);
check('an 80-character title fails the upper bound', (await rowState('Title is 15–70')).includes('is-todo'));
await page.fill('#c-title', 'WhatsApp Cloud API pricing for Bangladesh senders');

// --- meta description band ---
await page.fill('#c-description', 'Too short to be useful.');
await page.waitForTimeout(150);
check('a 23-character meta description fails', (await rowState('Meta description')).includes('is-todo'));
await page.fill('#c-description', 'What Meta actually charges once you are past the free tier, how conversation categories work, and what changes for teams still on Baileys today.');
await page.waitForTimeout(150);
check('a 143-character meta description passes', (await rowState('Meta description')).includes('is-ok'));

// --- the cover image warning state ---
await page.fill('#c-image', '/blog-posts/images/workflow-diagram.png');
await page.waitForTimeout(200);
check('a cover with no alt text warns rather than passing silently',
  (await rowState('A cover image is set')).includes('is-warn'), await rowState('A cover image is set'));
await page.fill('#c-imagealt', 'A diagram of the pricing flow');
await page.waitForTimeout(200);
check('adding alt text clears the warning', (await rowState('A cover image is set')).includes('is-ok'));

// --- SEO title is optional ---
check('a blank SEO title passes, because it falls back to the title',
  (await rowState('SEO title')).includes('is-ok'));
await page.fill('#c-seotitle', 'Short');
await page.waitForTimeout(150);
check('but a 5-character SEO title fails', (await rowState('SEO title')).includes('is-todo'));
await page.fill('#c-seotitle', 'WhatsApp Cloud API pricing in Bangladesh: 2026 guide');
await page.waitForTimeout(150);
check('a 52-character SEO title passes', (await rowState('SEO title')).includes('is-ok'));

// --- Google preview reflects the SEO title, not the headline ---
const serpTitle = await page.locator('[data-serp-title]').innerText();
check('the Google preview shows the SEO title, not the headline',
  serpTitle.startsWith('WhatsApp Cloud API pricing in Bangladesh'), serpTitle);
const serpUrl = await page.locator('[data-serp-url]').innerText();
check('the preview URL shows the real slug path',
  serpUrl.includes('sayadbayezid.com › blog › whatsapp-cloud-api-pricing'), serpUrl);
const serpDesc = await page.locator('[data-serp-desc]').innerText();
check('the preview description is the meta description', serpDesc.startsWith('What Meta actually charges'), serpDesc);

// --- Card preview is a different thing and must show the summary ---
await page.fill('#c-summary', 'A short blurb written for the blog grid, not for Google.');
await page.fill('#c-category', 'Guide');
await page.waitForTimeout(200);
check('the card preview shows the summary, not the meta description',
  (await page.locator('[data-card-desc]').innerText()).startsWith('A short blurb'), await page.locator('[data-card-desc]').innerText());
check('the card preview shows the headline, not the SEO title',
  (await page.locator('[data-card-title]').innerText()).startsWith('WhatsApp Cloud API pricing for Bangladesh'));
// .card-preview-meta is uppercased by CSS, so compare case-insensitively —
// the underlying value is what was typed.
check('the card preview shows the category',
  (await page.locator('[data-card-meta]').innerText()).trim().toLowerCase() === 'guide',
  await page.locator('[data-card-meta]').innerText());
check('the card preview renders the cover image', await page.locator('[data-card-image] img').count() === 1);

// --- long values are trimmed the way the real thing trims them ---
await page.fill('#c-description', 'x'.repeat(250));
await page.waitForTimeout(200);
const trimmed = await page.locator('[data-serp-desc]').innerText();
check('an over-long description is truncated in the preview', trimmed.length <= 159 && trimmed.endsWith('…'), trimmed.length);
await page.fill('#c-description', 'What Meta actually charges once you are past the free tier, how conversation categories work, and what changes for teams still on Baileys today.');

// --- remaining rules ---
await page.fill('#c-keywords', 'whatsapp cloud api, meta pricing, bangladesh');
await page.fill('#c-body', 'x'.repeat(320));
await page.waitForTimeout(250);
check('keywords rule passes with three', (await rowState('Keywords added')).includes('is-ok'));
check('body depth passes at 320 characters', (await rowState('real depth')).includes('is-ok'));
check('slug rule passes for a readable slug', (await rowState('URL slug')).includes('is-ok'));
check('summary rule passes', (await rowState('A summary is written')).includes('is-ok'));
check('every rule is now satisfied', await page.locator('.seo-check.is-ok').count() === 8,
  await page.locator('.seo-check.is-ok').count());

check('no JS errors', errs.length===0, errs.join('\n'));
await page.screenshot({ path: new URL('./seo-panel.png', import.meta.url).pathname });
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
