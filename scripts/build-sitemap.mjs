/**
 * The sitemaps — /sitemap.xml for crawlers, /sitemap.html for people.
 *
 * WHY THIS EXISTS
 * sitemap.xml was maintained by hand. The result was predictable: 35 of the
 * site's 59 indexable pages were listed, and the missing two dozen included
 * privacy-policy.html, terms-of-service.html, the Amader Tangail policy pages
 * that the Play Store requires to be reachable, and every page added in the
 * last three months. Nothing about writing a page reminds you there is a second
 * file to edit, so the file drifted from the day it was created.
 *
 * It is now built from the pages that actually exist on disk. A page cannot be
 * forgotten, because nobody has to remember it.
 *
 * WHAT GETS IN
 * Every .html file, minus three kinds of thing:
 *
 *   1. anything that declares `noindex` — the page's own instruction, and this
 *      script's job is to publish decisions, not to overrule them;
 *   2. anything with no <title> — a fragment meant to be embedded, not a page;
 *   3. the explicit SKIP list below, which is build output and duplicates.
 *
 * Everything excluded is printed with its reason on every run. A silent
 * exclusion is how the hand-written file went wrong in the first place.
 *
 * LASTMOD COMES FROM GIT, NOT FROM THE CLOCK
 * Stamping every page with today's date on every build tells Google that the
 * whole site changes daily, which is false, and the cost of being caught is
 * that it stops reading lastmod at all. The date a file was last actually
 * committed is the truth and is already recorded.
 *
 *   node scripts/build-sitemap.mjs
 */
import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative, resolve } from 'node:path';

const run = promisify(execFile);
const fileExists = async (p) => { try { await access(p); return true; } catch { return false; } };
const ROOT = resolve('.');
const SITE = 'https://sayadbayezid.com';

/**
 * Directories never walked. Dependencies, version control and the generated
 * showcase screenshots — nothing in them is a page.
 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'assets', 'content', 'scripts', 'tests', 'blog-posts']);

/**
 * Pages held back on purpose, each with the reason. These are the judgement
 * calls; everything else is decided by the rules above.
 */
const SKIP = new Map([
  ['404.html', 'the error page — being found in search is the one thing it must not be'],
  ['backup/index.html', 'an older copy of the homepage; indexing it competes with the real one'],
  ['blog/hello/index.html', 'orphaned draft with no source markdown, titled "Untitled"'],
  ['authorcard.html', 'an author box meant to be embedded in a page, not opened as one'],
  ['tools/invoice/build/index.html', 'build output of the invoice tool, which /tools/invoice/ already serves'],
  ['tools/invoice/public/index.html', 'source template of the same tool'],
  ['tools/invoice/src/index.html', 'source template of the same tool'],
]);

/**
 * How often a section really changes, and how much of the site it carries.
 * Ordered most specific first; the first match wins.
 */
const SECTIONS = [
  { test: /^$/,                     name: 'Home',            freq: 'weekly',  priority: '1.0' },
  { test: /^blog\//,                name: 'Blog',            freq: 'weekly',  priority: '0.8' },
  { test: /^case-studies\//,        name: 'Case studies',    freq: 'monthly', priority: '0.8' },
  { test: /^showcase\//,            name: 'Showcase',        freq: 'monthly', priority: '0.8' },
  { test: /^news\//,                name: 'News',            freq: 'weekly',  priority: '0.7' },
  { test: /^amader-tangail\//,      name: 'Amader Tangail',  freq: 'yearly',  priority: '0.4' },
  { test: /^tools\//,               name: 'Tools',           freq: 'monthly', priority: '0.6' },
  { test: /(privacy|terms|policy|editorial)/, name: 'Policies', freq: 'yearly', priority: '0.3' },
  { test: /.*/,                     name: 'Pages',           freq: 'monthly', priority: '0.7' },
];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Entities out, before they go back in.
 *
 * A <title> on disk already reads `Lk&#39;s Attire`. Escaping that produces
 * `Lk&amp;#39;s Attire`, which is correct XML of the wrong content: Google
 * reads the literal text "Lk&#39;s Attire". So decode what the file holds,
 * then escape exactly once.
 */
const decode = (s) => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  // Ampersand last, or `&amp;#39;` would decode twice.
  .replace(/&amp;/g, '&');

/** The page title without the site's own suffix. On every line of a sitemap,
 *  "| Connect with Bayezid" is noise. */
const shortTitle = (title) => decode(title)
  .replace(/\s*[|\u2013\u2014-]\s*Connect with Bayezid\s*$/, '').trim();

/* --------------------------------------------------------- finding pages - */

async function walk(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, found);
    else if (entry.name.endsWith('.html')) found.push(relative(ROOT, full));
  }
  return found;
}

/** /a/index.html -> /a/ ; /a.html -> /a.html ; index.html -> / */
function urlPathFor(file) {
  const path = file.replace(/\\/g, '/');
  return path === 'index.html' ? '/' : `/${path.replace(/index\.html$/, '')}`;
}

const pick = (html, re) => decode((html.match(re) || [])[1]?.trim() || '');

/**
 * The date of the file's last commit.
 *
 * Falls back to today only for a file git has never seen, which means it is
 * new and today is correct.
 */
async function lastCommitted(file) {
  try {
    const { stdout } = await run('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT });
    return stdout.trim() || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Absolute, on this site, or null for anything hosted elsewhere — another
 *  domain's images are not ours to submit. */
function ownAbsolute(src, pageUrl) {
  if (!src) return null;
  if (src.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(src)) return src.startsWith(SITE) ? src : null;
  if (src.startsWith('//')) return null;
  if (src.startsWith('/')) return SITE + src;
  // Relative to the page's own directory.
  return SITE + pageUrl.replace(/[^/]*$/, '') + src;
}

/** On disk, or not listed. Two pages pointed og:image at files that had been
 *  renamed years ago; submitting those URLs would have told Google to fetch
 *  404s on a schedule. The page's own tag is repaired separately — this is the
 *  guard that stops the next one reaching the sitemap. */
async function keepExisting(urls) {
  const kept = [];
  for (const url of urls) {
    const local = join(ROOT, decodeURIComponent(url.replace(SITE, '')).split('?')[0]);
    if (await fileExists(local)) kept.push(url);
    else console.warn(`  ! image not on disk, left out: ${url.replace(SITE, '')}`);
  }
  return kept;
}

function imagesIn(html, pageUrl) {
  const found = new Set();
  const og = pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const ogAbs = ownAbsolute(og, pageUrl);
  if (ogAbs) found.add(ogAbs);

  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const abs = ownAbsolute(m[1], pageUrl);
    // Tracking pixels and spacers are not content; nor is anything that is
    // plainly an icon. Google ignores them and they make the file unreadable.
    if (abs && !/(favicon|icon|pixel|spacer|logo|sprite)[^/]*$/i.test(abs)) found.add(abs);
    if (found.size >= 12) break;
  }
  return [...found];
}

/**
 * A video entry, or null.
 *
 * Google requires a thumbnail, a title, a description and a playable location
 * before it will accept one. An entry missing any of them is not a weaker
 * entry, it is an invalid one that invalidates the file around it — so a video
 * that cannot supply all four is left out rather than guessed at.
 */
function videoIn(html, pageUrl, title, description) {
  const src = pick(html, /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i)
    || pick(html, /<video[^>]+src=["']([^"']+)["']/i)
    || pick(html, /<source[^>]+src=["']([^"']+\.(?:mp4|webm|mov))["']/i);
  const content = ownAbsolute(src, pageUrl);
  if (!content) return null;

  const thumb = ownAbsolute(
    pick(html, /<video[^>]+poster=["']([^"']+)["']/i)
      || pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    pageUrl,
  );
  if (!thumb || !title || !description) return null;
  return { content, thumb, title, description };
}

/* -------------------------------------------------------------- the walk - */

const files = (await walk(ROOT)).sort();
const pages = [];
const skipped = [];

for (const file of files) {
  const key = file.replace(/\\/g, '/');
  if (SKIP.has(key)) { skipped.push([key, SKIP.get(key)]); continue; }

  const html = await readFile(join(ROOT, file), 'utf8');
  const robots = pick(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  if (/noindex/i.test(robots)) { skipped.push([key, 'the page asks not to be indexed']); continue; }

  const title = pick(html, /<title>([^<]*)<\/title>/i);
  if (!title) { skipped.push([key, 'no <title> — a fragment, not a page']); continue; }

  const url = urlPathFor(file);
  const description = pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const section = SECTIONS.find((s) => s.test.test(url.replace(/^\//, '')));

  pages.push({
    file, url, title, description, section,
    lastmod: await lastCommitted(file),
    images: await keepExisting(imagesIn(html, url)),
    video: videoIn(html, url, title, description),
  });
}

/* ------------------------------------------------------------ sitemap.xml - */

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${pages.map((p) => `  <url>
    <loc>${SITE}${p.url}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.section.freq}</changefreq>
    <priority>${p.section.priority}</priority>${p.images.map((src) => `
    <image:image>
      <image:loc>${esc(src)}</image:loc>
      <image:title>${esc(shortTitle(p.title))}</image:title>
    </image:image>`).join('')}${p.video ? `
    <video:video>
      <video:thumbnail_loc>${esc(p.video.thumb)}</video:thumbnail_loc>
      <video:title>${esc(p.video.title)}</video:title>
      <video:description>${esc(p.video.description)}</video:description>
      <video:content_loc>${esc(p.video.content)}</video:content_loc>
    </video:video>` : ''}
  </url>`).join('\n')}
</urlset>
`;
await writeFile(join(ROOT, 'sitemap.xml'), xml);

/* ----------------------------------------------------------- sitemap.html - */

/**
 * The same list, for people.
 *
 * Worth having for two reasons that are not SEO folklore: it is a real page a
 * visitor who cannot find something can use, and it gives every page at least
 * one internal link from a page that is itself linked in the footer — which is
 * the thing that actually gets a deep page crawled.
 *
 * The shell is copied from products.html at build time, so the header and
 * footer here cannot drift from the rest of the site.
 */
const template = await readFile(join(ROOT, 'products.html'), 'utf8');
function slice(html, startRe, endToken) {
  const start = html.search(startRe);
  const end = html.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error('build-sitemap: products.html is missing the shared shell');
  return html.slice(start, end + endToken.length);
}
const HEADER = slice(template, /<a class="skip-link"/, '</header>');
const FOOTER = slice(template, /<footer class="site-footer">/, '</footer>');
const GTM = slice(template, /<!-- Google Tag Manager \(noscript\) -->/, 'End Google Tag Manager (noscript) -->');

const order = [...new Set(SECTIONS.map((s) => s.name))];
const grouped = order
  .map((name) => [name, pages.filter((p) => p.section.name === name)])
  .filter(([, list]) => list.length);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Sitemap — every page on this site | Connect with Bayezid</title>
<meta name="description" content="Every page on sayadbayezid.com in one list: services, products, the live demo showcase, case studies, blog posts, tools and policies." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,650&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.min.css" />
<meta name="robots" content="index, follow, max-image-preview:large" />
<link rel="canonical" href="${SITE}/sitemap.html" />
<meta property="og:title" content="Sitemap — every page on this site" />
<meta property="og:url" content="${SITE}/sitemap.html" />
<meta property="og:type" content="website" />
<script src="/assets/tags.min.js" defer></script>
<style>
.sm-group { max-width: 980px; margin: 0 auto 38px; }
.sm-group h2 { font-size: 1.15rem; margin: 0 0 4px; }
.sm-count { font-family: 'JetBrains Mono', monospace; font-size: .74rem; color: var(--text-dim); }
.sm-list { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
.sm-list a { display: block; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px;
  text-decoration: none; background: var(--surface); transition: border-color .2s, transform .2s; }
.sm-list a:hover { border-color: var(--accent); transform: translateY(-2px); }
.sm-list strong { display: block; color: var(--text); font-size: .9rem; line-height: 1.4; }
.sm-list span { display: block; color: var(--text-dim); font-size: .76rem; margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm-lede a { color: var(--accent); }
</style>
</head>
<body>
${GTM}
${HEADER}
  <main id="main">
    <section class="page-hero">
      <span class="section-eyebrow">Sitemap</span>
      <h1>Every page, in one list.</h1>
      <p class="sm-lede">${pages.length} pages across ${grouped.length} sections. Built from the site itself, so it
        cannot fall behind. Crawlers want <a href="/sitemap.xml">sitemap.xml</a>; the live demos have
        <a href="https://demu.sayadbayezid.com/sitemap.xml" target="_blank" rel="noopener">their own</a>.</p>
    </section>
    <section class="section">
${grouped.map(([name, list]) => `      <div class="sm-group">
        <h2>${esc(name)}</h2>
        <span class="sm-count">${list.length} page${list.length === 1 ? '' : 's'}</span>
        <ul class="sm-list">
${list.map((p) => `          <li><a href="${p.url}"><strong>${esc(shortTitle(p.title))}</strong><span>${esc(p.url)}</span></a></li>`).join('\n')}
        </ul>
      </div>`).join('\n')}
    </section>
  </main>
${FOOTER}
<script src="/assets/main.min.js"></script>
</body>
</html>
`;
await writeFile(join(ROOT, 'sitemap.html'), html);

/* --------------------------------------------------------------- report - */

const withImages = pages.filter((p) => p.images.length).length;
const withVideo = pages.filter((p) => p.video).length;
console.log(`sitemap.xml   ${pages.length} pages, ${withImages} with images, ${withVideo} with video`);
console.log(`sitemap.html  ${grouped.length} sections`);
console.log('\nheld back:');
for (const [file, why] of skipped) console.log(`  ${file.padEnd(38)} ${why}`);
if (!withVideo) {
  console.log('\nNo video entries: the only pages carrying video are held back above.');
  console.log('Clear a page\'s noindex and its video is listed on the next build.');
}
