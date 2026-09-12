/**
 * Extract the CSS the homepage needs to paint its first screen.
 *
 * The full stylesheet is a render-blocking request — Lighthouse measured 380 ms
 * for it and 750 ms for Google Fonts, 2,380 ms of blocked rendering between
 * them. The fix is the standard one: inline the rules the first screen actually
 * uses, and load the rest without blocking.
 *
 * The rules are found by asking the browser, not by guessing: load the page,
 * walk every element whose box intersects the initial viewport, and keep every
 * rule that matches one of them. Guessing which selectors are "above the fold"
 * is how critical CSS ends up missing a rule and shipping a page that flashes
 * unstyled.
 *
 *   node scripts/build-critical-css.mjs            # writes assets/critical.css
 *   BASE_URL=http://localhost:8901 node scripts/...
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8901';
const VIEWPORT = { width: 412, height: 823 }; // Moto G Power, what PageSpeed emulates

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: VIEWPORT });
// Third-party origins are unreachable from here and irrelevant to layout.
await page.route('**://connect.facebook.net/**', (r) => r.abort());
await page.route('**://www.googletagmanager.com/**', (r) => r.abort());
await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(600);

const critical = await page.evaluate((vh) => {
  const keep = [];
  const seen = new Set();

  // Everything whose box reaches the first screen, plus <html>/<body>/<head>
  // descendants that carry no box of their own but still style what does.
  const inView = [...document.querySelectorAll('*')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top < vh && r.bottom > -1 && r.width > 0 && r.height > 0;
  });
  inView.push(document.documentElement, document.body);

  function matchesAnything(selector) {
    // A selector list is kept if ANY of its parts matches something on screen.
    return selector.split(',').some((part) => {
      const clean = part.replace(/::?(before|after|first-line|first-letter|placeholder|selection|-webkit-[a-z-]+)/g, '').trim();
      if (!clean) return true; // a bare ::before etc — keep, it belongs to its parent
      try { return inView.some((el) => el.matches(clean)); } catch { return false; }
    });
  }

  function walk(rules) {
    for (const rule of rules) {
      if (rule.type === CSSRule.STYLE_RULE) {
        if (matchesAnything(rule.selectorText) && !seen.has(rule.cssText)) {
          seen.add(rule.cssText);
          keep.push(rule.cssText);
        }
      } else if (rule.type === CSSRule.MEDIA_RULE) {
        // Media queries that can apply at this width; print and the like are
        // not needed to paint the first screen.
        const q = rule.conditionText || rule.media.mediaText;
        if (/print/.test(q)) continue;
        const inner = [...rule.cssRules].filter(
          (r) => r.type === CSSRule.STYLE_RULE && matchesAnything(r.selectorText),
        );
        if (inner.length) keep.push(`@media ${q}{${inner.map((r) => r.cssText).join('')}}`);
      } else if (rule.type === CSSRule.SUPPORTS_RULE) {
        walk(rule.cssRules);
      } else if (rule.type === CSSRule.KEYFRAMES_RULE || rule.type === CSSRule.FONT_FACE_RULE) {
        // Keyframes and font-faces are cheap and referenced by the rules above.
        if (!seen.has(rule.cssText)) { seen.add(rule.cssText); keep.push(rule.cssText); }
      }
    }
  }

  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; } // cross-origin (Google Fonts)
    if (rules) walk(rules);
  }
  return keep.join('\n');
}, VIEWPORT.height);

await browser.close();

// :root holds every custom property the whole page reads. If the viewport walk
// missed it the page would paint with every colour unset — so this is checked,
// not assumed.
if (!/:root\s*\{/.test(critical)) {
  console.error('FAILED: :root is not in the extracted CSS — the variables would all be undefined.');
  process.exit(1);
}

/* Selectors for things JavaScript injects AFTER load. The viewport walk above
   cannot see them — they do not exist yet — so with the full sheet now loading
   asynchronously they render unstyled, in flow, for a moment. That is exactly
   what happened to .support-dock: it briefly laid out as a full-width block and
   pushed the page down for 0.0197 of layout shift. Their positioning rules are
   pulled in explicitly here. Add to this list when something new is injected. */
const LATE_INJECTED = ['.support-dock', '.support-channels', '.support-launcher', '.support-channel'];

const lateRules = await (async () => {
  const css = (await import('node:fs')).readFileSync('assets/style.css', 'utf8');
  const out = [];
  for (const sel of LATE_INJECTED) {
    // The base rule for the selector on its own, which is the one carrying
    // position/inset — the variants (.is-open and friends) can wait.
    const re = new RegExp(`(^|\\})\\s*(${sel.replace('.', '\\.')})\\s*\\{([^}]*)\\}`, 'm');
    const m = css.match(re);
    if (m) out.push(`${m[2]}{${m[3]}}`);
  }
  return out.join('\n');
})();

if (!/position:\s*fixed/.test(lateRules)) {
  console.error('FAILED: the late-injected rules carry no fixed positioning — they would still shift the page.');
  process.exit(1);
}

writeFileSync('assets/critical.css', critical + '\n' + lateRules);
const full = (await import('node:fs')).readFileSync('assets/style.css', 'utf8').length;
console.log(`critical: ${(critical.length / 1024).toFixed(1)} KB of ${(full / 1024).toFixed(1)} KB full sheet`);
