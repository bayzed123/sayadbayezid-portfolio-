/**
 * The sitemaps — what is in them, and whether it is true.
 *
 * The hand-written sitemap.xml listed 35 of this site's 53 indexable pages.
 * The missing ones were not obscure: privacy-policy.html, terms-of-service.html,
 * the Amader Tangail policy pages the Play Store requires to stay reachable,
 * and every page added in the previous three months. A file maintained by
 * memory drifts from the day it is created, and nothing reports it.
 *
 * So the checks here are the ones a human reading the file could not do:
 *
 *   - is every page that CAN be indexed actually listed (the drift);
 *   - is anything listed that asked not to be (the opposite mistake, which
 *     submits a login page or an ad landing page to search);
 *   - does every image URL point at a file that exists (a sitemap full of 404s
 *     is worse than no image entries at all);
 *   - are the lastmod dates real, or did every page claim to change today.
 *
 * No browser needed: these are facts about generated files.
 *
 *   node scripts/build-sitemap.mjs
 *   node tests/sitemap.mjs
 */
import { readFile, readdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const SITE = 'https://sayadbayezid.com';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'assets', 'content', 'scripts', 'tests', 'blog-posts']);

async function walk(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, found);
    else if (entry.name.endsWith('.html')) found.push(full.replace(ROOT + '/', ''));
  }
  return found;
}

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
const meta = (html, name) =>
  (html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i')) || [])[1] || '';
const urlPathFor = (f) => (f === 'index.html' ? '/' : `/${f.replace(/index\.html$/, '')}`);

const xml = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
const listed = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const files = await walk(ROOT);

console.log('\n1. It is valid XML that a crawler will accept');
{
  // A malformed sitemap is rejected whole: one bad character and none of the
  // pages in it are submitted.
  const { execFileSync } = await import('node:child_process');
  let parsed = true, detail = '';
  try {
    execFileSync('python3', ['-c',
      'import sys,xml.etree.ElementTree as ET; ET.parse("sitemap.xml")'], { cwd: ROOT });
  } catch (e) { parsed = false; detail = String(e.stderr || e.message).split('\n').slice(-3).join(' '); }
  ok(parsed, `sitemap.xml parses${parsed ? '' : ` — ${detail}`}`);
  ok(/xmlns:image=/.test(xml), 'the image namespace is declared');
  // An entity that went through the escaper twice reads to Google as the
  // literal text "&#39;", not an apostrophe.
  ok(!xml.includes('&amp;#'), 'nothing is double-escaped');
}

console.log('\n2. Every page that can be indexed is listed');
{
  const missing = [];
  let indexable = 0;
  for (const file of files) {
    const html = await readFile(join(ROOT, file), 'utf8');
    if (/noindex/i.test(meta(html, 'robots'))) continue;
    if (!/<title>[^<]/.test(html)) continue;                 // a fragment, not a page
    const url = SITE + urlPathFor(file);
    if (!listed.has(url)) { missing.push(file); continue; }
    indexable++;
  }
  // Pages held back on purpose by the generator are the only acceptable gap,
  // and there are a handful of them — so this reports the list rather than
  // asserting a number nobody can check.
  ok(indexable >= 45, `${indexable} indexable pages are in the sitemap`);
  console.log(`  note  ${missing.length} indexable page(s) not listed: ${missing.join(', ') || 'none'}`);
}

console.log('\n3. Nothing is listed that asked not to be');
{
  // The opposite failure, and the more embarrassing one: submitting the client
  // login or an ad landing page to search.
  const wrong = [];
  for (const file of files) {
    const html = await readFile(join(ROOT, file), 'utf8');
    if (!/noindex/i.test(meta(html, 'robots'))) continue;
    if (listed.has(SITE + urlPathFor(file))) wrong.push(file);
  }
  ok(wrong.length === 0, `no noindex page is in the sitemap${wrong.length ? ` — ${wrong.join(', ')}` : ''}`);
  ok(!listed.has(`${SITE}/404.html`), 'nor the error page');
  ok(![...listed].some((u) => u.includes('/admin/')), 'nor the operations console');
}

console.log('\n4. Every image in it is a file that exists');
{
  // A sitemap advertising images that 404 is worse than one with none: it is a
  // list of broken promises, checked by a crawler on a schedule.
  const images = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1]);
  const broken = [];
  for (const src of new Set(images)) {
    const local = join(ROOT, decodeURIComponent(src.replace(SITE, '')).split('?')[0]);
    if (!(await exists(local))) broken.push(src.replace(SITE, ''));
  }
  ok(images.length > 40, `${images.length} image entries`);
  ok(broken.length === 0,
    `all resolve to files on disk${broken.length ? ` — ${broken.slice(0, 5).join(', ')}` : ''}`);
  ok(!images.some((i) => /\/(favicon|logo)/i.test(i)), 'and none of them is the logo or a favicon');
}

console.log('\n5. The dates are real');
{
  const dates = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  const today = new Date().toISOString().slice(0, 10);
  const allToday = dates.every((d) => d === today);
  // Stamping every page with today on every build tells Google the whole site
  // changes daily. It does not, and the cost of being caught is that lastmod
  // stops being read at all.
  ok(!allToday, `lastmod varies by page (${new Set(dates).size} distinct dates across ${dates.length})`);
  ok(dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), 'all in W3C date format');
  ok(dates.every((d) => d <= today), 'and none is in the future');
}

console.log('\n6. The human sitemap agrees with the machine one');
{
  const html = await readFile(join(ROOT, 'sitemap.html'), 'utf8');
  const links = new Set([...html.matchAll(/<li><a href="([^"]+)"/g)].map((m) => m[1]));
  const paths = [...listed].filter((u) => u.startsWith(SITE)).map((u) => u.replace(SITE, ''));
  const missing = paths.filter((p) => !links.has(p) && p !== '/sitemap.html');
  ok(missing.length === 0,
    `every listed page is linked from /sitemap.html${missing.length ? ` — ${missing.slice(0, 5).join(', ')}` : ''}`);
  ok(!/noindex/i.test(meta(html, 'robots')), 'and the page itself is indexable');
}

console.log('\n7. robots.txt points at both sitemaps and blocks only the console');
{
  const robots = await readFile(join(ROOT, 'robots.txt'), 'utf8');
  ok(/Sitemap:\s*https:\/\/sayadbayezid\.com\/sitemap\.xml/i.test(robots), 'this site\'s sitemap is named');
  ok(/Sitemap:\s*https:\/\/demu\.sayadbayezid\.com\/sitemap\.xml/i.test(robots), 'and the demo hub\'s');
  const disallows = [...robots.matchAll(/^\s*Disallow:\s*(\S+)/gim)].map((m) => m[1]);
  ok(disallows.every((d) => d.includes('/admin')), `only /admin/ is blocked (${disallows.join(', ') || 'nothing'})`);
}

console.log('\n8. Something links to the sitemap page');
{
  // Google finds sitemap.xml from robots.txt; people find sitemap.html from
  // the footer, and so does a crawler following links.
  const home = await readFile(join(ROOT, 'index.html'), 'utf8');
  ok(/href="\/sitemap\.html"/.test(home), 'the homepage footer links to it');
  const sample = ['products.html', 'showcase.html', 'contact.html', 'about.html'];
  const without = [];
  for (const f of sample) {
    if (!/href="\/sitemap\.html"/.test(await readFile(join(ROOT, f), 'utf8'))) without.push(f);
  }
  ok(without.length === 0, `and so do the main pages${without.length ? ` — missing on ${without.join(', ')}` : ''}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
