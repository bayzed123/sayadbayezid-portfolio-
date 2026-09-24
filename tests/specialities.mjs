/**
 * The specialities page, checked for the thing that actually decides whether
 * it ranks.
 *
 * WHY THIS SUITE EXISTS, AND WHAT IT IS GUARDING AGAINST.
 *
 * The source material was a flat list of 44 terms copied from an agency
 * directory profile. Pasting that list onto a page is keyword stuffing —
 * named in Google's own spam policies — and a tag cloud with no supporting
 * text ranks for none of its tags. The whole design of this page is the
 * opposite bet: every term carries a sentence, and the bare list lives in
 * `knowsAbout`, which is where a search engine reads a list as a statement
 * about an entity's expertise rather than as body copy.
 *
 * So the checks below are not "is the word on the page". They are:
 *
 *   1. Every supplied term is present and VISIBLE — not hidden in schema
 *      while the page shows something else. A page whose structured data
 *      claims more than its content is the exact shape of a spam signal.
 *   2. Every term in a technology list carries an explanation after it. This
 *      is what keeps the page from decaying back into a tag cloud the next
 *      time someone adds a row.
 *   3. The visible content and `knowsAbout` agree with each other.
 *   4. Every JSON-LD block on every touched page parses, and services.html
 *      has some at all — it shipped for months with none.
 *
 * No server needed; this reads the built files.
 *
 *   node tests/specialities.mjs
 */
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${String(detail).slice(0, 300)}` : ''}`); }
};

/** The list exactly as supplied. Order is not meaningful; membership is. */
const SERVICES = [
  'SEO', 'Advertising', 'Business Consulting', 'Logo Design', 'Product Design',
  'Direct Marketing', 'Digital Strategy', 'Graphic Design', 'E-Commerce Development',
  'Content Marketing', 'Affiliate Marketing', 'Marketing Strategy', 'Email Marketing',
  'Mobile & App Marketing', 'Digital Marketing', 'Other Marketing', 'Market Research',
];
const FOCUSES = [
  'Mobile optimization', 'Programmatic Display', 'Google Marketing Platform',
  'Programmatic Advertising', 'Windows server', 'Amazon', 'JavaScript', 'Weebly',
  'Wix', 'Laravel', 'WordPress', 'Reputation management', 'On site optimization',
  'Multilingual', 'Broadcast video advertising', 'Local search',
  'Link earning & development', 'Content development', 'Experiential Marketing',
  'Market Analysis', 'Data Reporting', 'Data Analysis', 'Surveys',
  'Observational Research', 'Other direct marketing', 'Radio advertising',
  'Out of home advertising',
];

/* Entity decoding matters here and is easy to get wrong: "Mobile & App
   Marketing" is written "Mobile &amp; App Marketing" in the HTML, so a naive
   substring search reports two perfectly present terms as missing. That
   false negative happened while writing this suite; decoding is the fix. */
const decode = (html) => html
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const spec = read('specialities.html');
const services = read('services.html');
const index = read('index.html');

const scripts = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
/** The page with all structured data stripped — what a reader actually sees. */
const visibleText = (html) => decode(
  html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
);

console.log('\nevery supplied term reaches the page, and is visible');

const visible = visibleText(spec);
const missing = [...SERVICES, ...FOCUSES].filter((term) => !visible.includes(term));
check(`all ${SERVICES.length + FOCUSES.length} supplied terms appear in the visible page`,
  missing.length === 0, `missing: ${missing.join(', ')}`);

console.log('\nthe technology list is explained, not just listed');

// Each <li><b>Term</b> — explanation</li>. The em dash and a real clause after
// it are what separate this page from the tag cloud it could have been.
const listItems = [...spec.matchAll(/<li><b>([^<]+)<\/b>\s*—\s*([^<]+)<\/li>/g)]
  .map(([, term, text]) => ({ term: decode(term), text: decode(text).trim() }));

check('the focus/technology entries were parsed', listItems.length >= 27, `found ${listItems.length}`);

const bare = listItems.filter((item) => item.text.length < 25);
check('every listed technology carries a real explanation, not a stub',
  bare.length === 0, bare.map((b) => `${b.term}: "${b.text}"`).join(' | '));

const listed = new Set(listItems.map((item) => item.term));
const unexplained = FOCUSES.filter((term) => !listed.has(term));
check('every focus & technology term is one of those explained entries',
  unexplained.length === 0, `not in an explained list: ${unexplained.join(', ')}`);

// Services are cards rather than list rows, so they are checked their own way.
const cards = [...spec.matchAll(/<h3>([^<]+)<\/h3>\s*<p>([^<]+)<\/p>/g)]
  .map(([, term, text]) => ({ term: decode(term), text: decode(text).trim() }));
const carded = new Set(cards.map((c) => c.term));
const uncarded = SERVICES.filter((term) => !carded.has(term));
check('every service speciality has its own described card',
  uncarded.length === 0, `no card for: ${uncarded.join(', ')}`);
check('no service card is a stub',
  cards.every((c) => c.text.length >= 40),
  cards.filter((c) => c.text.length < 40).map((c) => c.term).join(', '));

console.log('\nstructured data parses, and agrees with the page');

for (const [name, html] of [['specialities.html', spec], ['services.html', services], ['index.html', index]]) {
  const blocks = scripts(html);
  check(`${name} carries structured data`, blocks.length > 0);
  blocks.forEach((block, i) => {
    let parsed = null;
    try { parsed = JSON.parse(block); } catch (e) { /* reported below */ }
    check(`${name} JSON-LD block ${i + 1} parses`, parsed !== null,
      parsed === null ? 'JSON.parse threw' : '');
  });
}

const specGraph = JSON.parse(scripts(spec)[0])['@graph'];
const professional = specGraph.find((n) => n['@type'] === 'ProfessionalService');
check('the page declares a ProfessionalService', Boolean(professional));

const knows = professional?.knowsAbout ?? [];
/* "Other Marketing" and "Other direct marketing" are deliberately absent from
   knowsAbout: they are catch-all rows in a directory taxonomy, not topics an
   entity can be expert in, and claiming them as expertise is noise. They are
   still described on the page, which is where they belong. */
const CATCH_ALL = new Set(['Other Marketing', 'Other direct marketing']);
const expected = [...SERVICES, ...FOCUSES].filter((t) => !CATCH_ALL.has(t));
const notClaimed = expected.filter((t) => !knows.includes(t));
check('knowsAbout covers every real speciality and technology',
  notClaimed.length === 0, `absent from knowsAbout: ${notClaimed.join(', ')}`);

// The direction that matters for spam signals: schema must not claim more
// than the page shows.
const overclaimed = knows.filter((t) => !visible.includes(t));
check('knowsAbout claims nothing the page does not also say out loud',
  overclaimed.length === 0, `in schema but not in the page: ${overclaimed.join(', ')}`);

const catalog = professional?.hasOfferCatalog?.itemListElement ?? [];
const offered = catalog.flatMap((group) => (group.itemListElement ?? []).map((o) => o.itemOffered?.name));
const notOffered = SERVICES.filter((s) => !offered.includes(s));
check('every service speciality is in the offer catalog',
  notOffered.length === 0, `missing from catalog: ${notOffered.join(', ')}`);

console.log('\nthe page is reachable');

check('services.html links to it', services.includes('/specialities.html'));
check('it is in the footer of both pages',
  spec.includes('href="/specialities.html"') && services.includes('href="/specialities.html"'));

const sitemap = read('sitemap.xml');
check('it is in the sitemap', sitemap.includes('https://sayadbayezid.com/specialities.html'));
check('it is indexable', /content="index, follow/.test(spec));
check('it has a canonical', spec.includes('rel="canonical" href="https://sayadbayezid.com/specialities.html"'));

/* A title over ~60 characters is truncated in results. This one is long on
   purpose — the tail carries the brand — but the front must hold the terms
   somebody actually searches. */
const title = spec.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
check('the title leads with the searched terms, not the brand',
  /^Specialities/.test(decode(title)) && /SEO/.test(title), title);

const desc = spec.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '';
check('the meta description is a sentence, not a keyword list',
  desc.length > 120 && desc.length < 320 && desc.split(',').length < 14,
  `${desc.length} chars: ${desc}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
