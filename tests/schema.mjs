/**
 * Structured data on every generated post.
 *
 * This exists because the failure it guards against is silent: the previous
 * template interpolated the title straight into a JSON literal, so an ordinary
 * title containing a quote produced invalid JSON. Nothing on the page looked
 * wrong — Google simply discarded the block, and there was no way to notice
 * from the site itself.
 *
 *   node scripts/build-blog.js && node tests/schema.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log(`  ok   ${n}`); }
  else { fail++; console.log(`  FAIL ${n}${d ? `\n       ${String(d).slice(0, 200)}` : ''}`); }
};

// Slugs that still have a source file. build-blog.js derives a post's slug
// from its filename unless the front matter declares one, so read both.
const sourced = new Set(
  readdirSync('blog-posts')
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) => {
      const body = readFileSync(`blog-posts/${f}`, 'utf8');
      const declared = body.match(/^\s*slug:\s*["']?([a-z0-9-]+)/im);
      return declared ? [declared[1], f.replace(/\.md$/, '')] : [f.replace(/\.md$/, '')];
    }),
);
const orphans = [];

const slugs = readdirSync('blog', { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(`blog/${e.name}/index.html`))
  .map((e) => e.name);

check('there are generated posts to check', slugs.length > 0, slugs.length);

let checkedGraphs = 0;
for (const slug of slugs) {
  const html = readFileSync(`blog/${slug}/index.html`, 'utf8');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)];
  for (const [, raw] of blocks) {
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (error) { check(`${slug}: JSON-LD parses`, false, error.message); continue; }
    checkedGraphs++;

    // Orphaned directories (no source .md) still serve their last build and
    // cannot be regenerated. build-blog.js reports them as a warning; this
    // suite checks the posts that actually have sources, so a known orphan
    // does not mask a real schema regression in a live post.
    if (!parsed['@graph']) {
      if (!sourced.has(slug)) { orphans.push(slug); continue; }
      check(`${slug}: uses the current @graph template`, false,
        `got a bare @type: ${parsed['@type']}`);
      continue;
    }
    const byType = Object.fromEntries(parsed['@graph'].map((n) => [n['@type'], n]));
    check(`${slug}: has BlogPosting and BreadcrumbList`,
      !!byType.BlogPosting && !!byType.BreadcrumbList, Object.keys(byType).join(', '));
    check(`${slug}: breadcrumb positions are 1,2,3`,
      JSON.stringify(byType.BreadcrumbList.itemListElement.map((i) => i.position)) === '[1,2,3]');
    check(`${slug}: headline is not empty`, !!byType.BlogPosting.headline);
    // An empty FAQPage is a structured-data error, not a neutral omission.
    if (byType.FAQPage) {
      check(`${slug}: FAQPage has questions`, byType.FAQPage.mainEntity.length > 0);
    }
    // Relative image URLs are ignored by every crawler that reads them.
    const img = byType.BlogPosting.image;
    if (img) check(`${slug}: image URL is absolute`, /^https?:\/\//.test(img.url), img.url);
  }
}
check('every sourced post carried a JSON-LD block',
  checkedGraphs >= slugs.length - orphans.length, `${checkedGraphs} graphs, ${orphans.length} orphans`);

if (orphans.length) {
  console.log(`\n  note: ${orphans.length} orphaned director${orphans.length === 1 ? 'y' : 'ies'} skipped — ` +
    `${orphans.join(', ')}. No source .md, so they cannot be regenerated; build-blog.js warns about them.`);
}

console.log(`\npassed: ${pass}   failed: ${fail}`);
process.exit(fail ? 1 : 0);
