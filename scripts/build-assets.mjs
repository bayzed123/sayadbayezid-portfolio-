/**
 * Minify the site's own CSS and JS.
 *
 * The sources stay readable — they are full of comments explaining why things
 * are the way they are, and those comments are worth more than the bytes. This
 * writes .min.* siblings that the pages actually load, so the repository keeps
 * the explanation and the visitor gets the small file.
 *
 * esbuild does the work rather than a regex. A regex CSS minifier eats a
 * `content: "}"` and a regex JS minifier eats a regex literal; both fail
 * silently and both are the kind of bug that reaches production.
 *
 *   node scripts/build-assets.mjs
 */
import { execFileSync } from 'node:child_process';
import { statSync, readFileSync } from 'node:fs';

const JOBS = [
  ['assets/style.css', 'assets/style.min.css'],
  ['assets/main.js', 'assets/main.min.js'],
  ['assets/tags.js', 'assets/tags.min.js'],
  ['assets/js/support.js', 'assets/js/support.min.js'],
  ['assets/js/engagement.js', 'assets/js/engagement.min.js'],
  ['assets/newsletter.js', 'assets/newsletter.min.js'],
];

let before = 0, after = 0;
for (const [src, out] of JOBS) {
  try { statSync(src); } catch { console.log(`  skip ${src} (missing)`); continue; }
  execFileSync('npx', ['--yes', 'esbuild', src, '--minify', `--outfile=${out}`, '--log-level=warning'], {
    stdio: 'inherit',
  });
  const a = statSync(src).size, b = statSync(out).size;
  before += a; after += b;
  console.log(`  ${src.padEnd(30)} ${(a / 1024).toFixed(1)} KB → ${(b / 1024).toFixed(1)} KB`);

  // A minifier that silently produced nothing is worse than no minifier: the
  // page would load an empty stylesheet and render unstyled.
  if (b < 200 || b > a) {
    console.error(`FAILED: ${out} is ${b} bytes from a ${a} byte source — that is not a minification.`);
    process.exit(1);
  }
}

// The minified JS must still parse. esbuild would have failed loudly, but a
// truncated write would not.
for (const [, out] of JOBS.filter(([s]) => s.endsWith('.js'))) {
  try { new Function(readFileSync(out, 'utf8')); } catch (e) {
    console.error(`FAILED: ${out} does not parse — ${e.message}`);
    process.exit(1);
  }
}

console.log(`\ntotal ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB ` +
            `(${Math.round((1 - after / before) * 100)}% smaller)`);
