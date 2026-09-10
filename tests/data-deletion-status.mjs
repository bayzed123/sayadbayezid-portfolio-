/**
 * The page Meta's data deletion callback sends people to.
 *
 * Meta requires the confirmation code to lead somewhere that explains, in
 * words a person can read, what happened to their data — and will disable an
 * app whose Data Deletion Request URL does not behave. So the checks here are
 * about whether someone arriving with a code in the URL gets an answer without
 * doing anything, and about what the page must never do with values that came
 * from a URL or an API.
 *
 * The API is stubbed; nothing is deleted.
 *
 *   python3 -m http.server 5601 &
 *   node tests/data-deletion-status.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,240)}`:''}`);} };

const SITE = process.env.SITE_URL || 'http://127.0.0.1:5601';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:414,height:896} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

let lastUrl = '';
await page.route('**/api/facebook/data-deletion/status**', route => {
  lastUrl = route.request().url();
  const code = new URL(lastUrl).searchParams.get('code');
  if (code === 'DEL-DONE00000001') {
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      ok:true, request:{ code, status:'completed', removed:1,
        requested_at:'2026-09-10 21:55:00', completed_at:'2026-09-10 21:55:00' } }) });
  }
  if (code === 'DEL-NONE00000002') {
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      ok:true, request:{ code, status:'nothing_to_delete', removed:0,
        requested_at:'2026-09-10 21:56:00', completed_at:'2026-09-10 21:56:00' } }) });
  }
  if (code === 'DEL-XSS0000000003') {
    // A hostile value on the success path — the only path that renders API
    // fields. Sending it through the 404 branch tests nothing.
    return route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      ok:true, request:{ code:'<img src=x onerror="window.__xss=1">', status:'completed', removed:1,
        requested_at:'<b>2026</b>', completed_at:'2026-09-10 21:55:00' } }) });
  }
  return route.fulfill({ status:404, contentType:'application/json',
    body: JSON.stringify({ error:'No request with that confirmation code.', code:'NOT_FOUND' }) });
});

console.log('== a code in the URL is answered without touching anything ==');
// Meta hands the person a link with the code already in it.
await page.goto(`${SITE}/data-deletion-status.html?code=DEL-DONE00000001`, { waitUntil:'domcontentloaded' });
await page.waitForSelector('#result .state', { timeout:10000 });
let text = (await page.locator('#result').innerText()).replace(/\s+/g,' ');
check('the answer appears on load', /deleted/i.test(text), text);
check('the code is shown back', text.includes('DEL-DONE00000001'), text);
check('with when it happened', /2026/.test(text), text);
check('and how many records went', /Records removed/i.test(text), text);
check('marked as done', await page.locator('#result .is-done').count() === 1);
check('the field is prefilled from the URL',
  (await page.locator('#code').inputValue()) === 'DEL-DONE00000001',
  await page.locator('#code').inputValue());

console.log('== "we held nothing" is a different answer from "deleted" ==');
// Telling someone their data was deleted when we never had any would be a
// claim we cannot support.
await page.goto(`${SITE}/data-deletion-status.html?code=DEL-NONE00000002`, { waitUntil:'domcontentloaded' });
await page.waitForSelector('#result .state', { timeout:10000 });
text = (await page.locator('#result').innerText()).replace(/\s+/g,' ');
check('it says nothing was stored', /[Nn]othing was stored/.test(text), text);
check('and does not claim a deletion', !/has been deleted/.test(text), text);
check('shown as its own state', await page.locator('#result .is-none').count() === 1);

console.log('== an unknown code says so, and says what to do ==');
await page.goto(`${SITE}/data-deletion-status.html?code=DEL-UNKNOWN00003`, { waitUntil:'domcontentloaded' });
await page.waitForSelector('#result .state', { timeout:10000 });
text = (await page.locator('#result').innerText()).replace(/\s+/g,' ');
check('the server reason is shown', /No request with that confirmation code/.test(text), text);
const body = (await page.locator('body').innerText()).replace(/\s+/g,' ');
check('and a human is reachable', /support@sayadbayezid\.com/.test(body), body);

console.log('== typing a code works too ==');
await page.goto(`${SITE}/data-deletion-status.html`, { waitUntil:'domcontentloaded' });
check('nothing is claimed before asking', (await page.locator('#result').innerText()).trim() === '');
await page.fill('#code', 'del-done00000001');
await page.locator('#lookup button').click();
await page.waitForSelector('#result .is-done', { timeout:10000 });
// Codes are issued uppercase; someone retyping one should not be punished.
check('a lowercase code still resolves', /deleted/i.test(await page.locator('#result').innerText()));
check('it was sent uppercase', /code=DEL-DONE00000001/.test(lastUrl), lastUrl);

console.log('== nothing from a URL or an API becomes markup ==');
// The values rendered here come from an API reply, so that is where the test
// has to put the hostile value. An earlier version of this check sent it as a
// code that returned 404 — a path that renders nothing, so the check passed
// against a build using innerHTML.
await page.goto(`${SITE}/data-deletion-status.html?code=DEL-XSS0000000003`, { waitUntil:'domcontentloaded' });
await page.waitForSelector('#result .state', { timeout:10000 });
check('a hostile value from the API renders as text',
  await page.locator('#result img').count() === 0,
  String(await page.locator('#result img').count()));
check('and no injected script ran',
  await page.evaluate(() => window.__xss === undefined));
check('the markup is shown literally',
  (await page.locator('#result').innerText()).includes('<img src=x'),
  await page.locator('#result').innerText());
check('a bold tag in a date is not rendered either',
  await page.locator('#result b').count() === 0);

console.log('== it stays out of search results ==');
// Only useful to someone holding a code; it has no business being indexed.
await page.goto(`${SITE}/data-deletion-status.html`, { waitUntil:'domcontentloaded' });
check('noindex is set',
  (await page.locator('meta[name=robots]').getAttribute('content') || '').includes('noindex'));

check('no JS errors', errs.length === 0, errs.join(' | '));
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
