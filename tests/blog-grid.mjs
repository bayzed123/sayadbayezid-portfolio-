/**
 * The blog grids: the homepage journal, the /blog/ feed, and the related-post
 * strip at the foot of a post.
 *
 * These check the things that are wrong in a way nobody notices. A card image
 * whose alt text is the post title reads fine to a sighted visitor and makes a
 * screen reader announce the same sentence twice. A value interpolated into an
 * attribute without escaping looks identical until one contains a quote. A
 * missing date looks like a date.
 *
 * Requires playwright and the site served on :5601 with the build already run:
 *
 *   node scripts/build-blog.js && node tests/blog-grid.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const posts = JSON.parse(readFileSync(new URL('../blog/blog.json', import.meta.url)));

console.log('== reading time is computed once, at build ==');
check('every post carries readingMinutes',
  posts.every(p => Number.isInteger(p.readingMinutes) && p.readingMinutes >= 1),
  posts.map(p => `${p.slug}:${p.readingMinutes}`).join(' '));
// The homepage renders its cards at build time and /blog/ renders them in the
// browser. Two implementations of the same sum drift; one field cannot.
const longest = posts.reduce((a,b) => a.readingMinutes > b.readingMinutes ? a : b);
check('and it tracks the length of the post', longest.readingMinutes > 1, JSON.stringify(longest.readingMinutes));

console.log('== a post with no date is called out ==');
const build = execFileSync('node', ['scripts/build-blog.js'], {
  cwd: new URL('..', import.meta.url).pathname, encoding:'utf8' });
// The build has to say so out loud for each source file with no date: the
// fallback is today, so the post is re-dated on every single run.
const warned = [...build.matchAll(/::warning file=(blog-posts\/[^:]+)::No date/g)].map(m => m[1]);
const sourcesWithoutDate = execFileSync('bash', ['-c',
  'for f in blog-posts/*.md; do grep -q "^date:" "$f" || echo "$f"; done'],
  { cwd: new URL('..', import.meta.url).pathname, encoding:'utf8' })
  .split('\n').filter(Boolean);
check('every undated source gets a warning',
  sourcesWithoutDate.every(f => warned.includes(f)),
  `sources: ${sourcesWithoutDate.join(',')}  warned: ${warned.join(',')}`);
check('and no post with a date is warned about',
  warned.length === sourcesWithoutDate.length,
  `warned ${warned.length}, expected ${sourcesWithoutDate.length}`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1440,height:1400} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

console.log('== the homepage journal grid ==');
await page.goto('http://127.0.0.1:5601/', { waitUntil:'domcontentloaded' });
const cards = page.locator('#journal .post-card');
check('three cards', await cards.count() === 3, await cards.count());
check('each has a cover image', await page.locator('#journal .post-card-media img').count() === 3);
check('the meta line carries the reading time',
  /\d+ min read/i.test(await page.locator('#journal .post-meta').first().innerText()),
  await page.locator('#journal .post-meta').first().innerText());
// alt="" is the correct value here, not a missing attribute: the heading is
// inside the same link and already says where it goes.
const alts = await page.locator('#journal .post-card-media img').evaluateAll(
  els => els.map(e => ({ has: e.hasAttribute('alt'), value: e.getAttribute('alt') })));
check('every cover image has an alt attribute', alts.every(a => a.has), JSON.stringify(alts));
check('and none of them repeats the post title',
  alts.every(a => !posts.some(p => p.title === a.value)), JSON.stringify(alts));
check('covers are lazy-loaded, being below the fold',
  await page.locator('#journal .post-card-media img[loading=lazy]').count() === 3);

console.log('== the /blog/ feed ==');
await page.goto('http://127.0.0.1:5601/blog/', { waitUntil:'domcontentloaded' });
await page.waitForSelector('.blog-card', { timeout:15000 });
check('a card per post', await page.locator('.blog-card').count() === posts.length,
  `${await page.locator('.blog-card').count()} vs ${posts.length}`);
const feedAlts = await page.locator('.blog-card-image').evaluateAll(
  els => els.map(e => e.getAttribute('alt')));
check('no feed card uses the title as its alt text',
  feedAlts.every(a => !posts.some(p => p.title === a)), JSON.stringify(feedAlts));
check('no card renders src="undefined"',
  await page.locator('.blog-card-image[src="undefined"]').count() === 0);
check('the footer shows the reading time',
  /\d+ min read/.test(await page.locator('.blog-card-footer').first().innerText()),
  await page.locator('.blog-card-footer').first().innerText());

console.log('== attribute escaping ==');
// escapeHtml round-trips through textContent, which leaves a double quote
// alone. A title or image path containing one used to close the attribute
// early; escapeAttr is what stops that.
const escaped = await page.evaluate(() => {
  const probe = 'x" onerror="window.__pwned=1" data-x="';
  return { reachable: typeof window.escapeAttr === 'function',
           attr: typeof window.escapeAttr === 'function' ? window.escapeAttr(probe) : null };
});
check('escapeAttr is reachable on the page', escaped.reachable, JSON.stringify(escaped));
check('and it escapes the double quote',
  escaped.reachable && !escaped.attr.includes('"') && escaped.attr.includes('&quot;'),
  JSON.stringify(escaped));
check('nothing was executed out of an attribute',
  await page.evaluate(() => window.__pwned === undefined));

console.log('== no script errors ==');
check('the console stayed clean', errs.length === 0, errs.join(' | '));

console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
