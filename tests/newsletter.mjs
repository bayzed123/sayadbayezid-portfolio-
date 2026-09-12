/**
 * The newsletter section and the marketing popup.
 *
 * An interstitial that covers the page is one of the most disliked things on
 * the web, and Google penalises intrusive ones on mobile. Every check below is
 * one of the rules that keeps this one on the right side of that line — which
 * means a bug in any of them is not cosmetic, it is the difference between a
 * useful popup and one that costs rankings and goodwill.
 *
 * The subscribe API is stubbed. No address is ever sent.
 *
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=... node tests/newsletter.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8901';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

async function open(opts = {}) {
  const page = await browser.newPage({
    viewport: opts.viewport || { width: 412, height: 823 },
    hasTouch: opts.touch === true,
    isMobile: opts.touch === true,
  });
  page.posted = [];
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.route('**://connect.facebook.net/**', (r) => r.abort());
  await page.route('**://www.googletagmanager.com/**', (r) => r.abort());
  await page.route('**/api/subscribe', (route) => {
    page.posted.push(route.request().postDataJSON());
    route.fulfill(opts.apiFails
      ? { status: 400, contentType: 'application/json', body: JSON.stringify({ error: "That email address doesn't look right." }) }
      : { status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(400);
  return page;
}

console.log('\n1. The inline section');
{
  const p = await open();
  ok(await p.isVisible('#newsletter'), 'the section is on the page');
  await p.fill('#newsEmail', 'not-an-email');
  await p.click('#newsSubmit');
  await p.waitForTimeout(250);
  ok(p.posted.length === 0, 'a malformed address is never sent to the server');
  ok((await p.textContent('#newsBanner')).includes("doesn't look right"), 'and it says so');

  await p.fill('#newsEmail', 'reader@example.com');
  await p.click('#newsSubmit');
  await p.waitForTimeout(400);
  ok(p.posted.length === 1, 'a good address is sent');
  ok(p.posted[0].email === 'reader@example.com', 'with the address');
  ok(p.posted[0].source === 'homepage-section', 'and where it came from, so the two forms can be told apart');
  ok((await p.textContent('#newsBanner')).includes("on the list"), 'and it confirms');
  ok((await p.inputValue('#newsEmail')) === '', 'the field is cleared');
  await p.close();
}

console.log('\n2. The popup stays shut until the visitor has actually read something');
{
  const p = await open();
  ok(await p.isHidden('#newsPop'), 'shut on arrival');
  await p.waitForTimeout(1200);
  ok(await p.isHidden('#newsPop'), 'still shut a second later — no instant interstitial');

  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
  await p.waitForTimeout(600);
  ok(await p.isVisible('#newsPop'), 'opens once 45% of the page is behind them');
  await p.close();
}

console.log('\n3. Dismissing it is remembered');
{
  const p = await open();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
  await p.waitForTimeout(600);
  await p.click('.np-dismiss');
  await p.waitForTimeout(200);
  ok(await p.isHidden('#newsPop'), '"No thanks" closes it');
  ok(await p.evaluate(() => document.body.style.overflow === ''), 'and the page scrolls again');
  const until = await p.evaluate(() => Number(localStorage.getItem('nl_snooze_until') || 0));
  const days = (until - Date.now()) / 864e5;
  ok(days > 44 && days < 46, `snoozed for ~45 days (${days.toFixed(0)})`);

  await p.reload({ waitUntil: 'load' });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
  await p.waitForTimeout(900);
  ok(await p.isHidden('#newsPop'), 'and it does not come back on the next visit');
  await p.close();
}

console.log('\n4. Someone already subscribed is never asked again');
{
  const p = await open();
  await p.evaluate(() => localStorage.setItem('nl_subscribed', '1'));
  await p.reload({ waitUntil: 'load' });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.9));
  await p.waitForTimeout(900);
  ok(await p.isHidden('#newsPop'), 'no popup for a subscriber');
  await p.close();
}

console.log('\n5. It never interrupts someone using the inline form');
{
  const p = await open();
  await p.focus('#newsEmail');                         // they are typing
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
  await p.waitForTimeout(700);
  ok(await p.isHidden('#newsPop'), 'no popup while the inline field has focus');
  await p.close();
}

console.log('\n6. Exit-intent is for pointers, not fingers');
{
  const touch = await open({ touch: true });
  await touch.evaluate(() => {
    document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, bubbles: true }));
  });
  await touch.waitForTimeout(300);
  ok(await touch.isHidden('#newsPop'),
     'a mouseout at the top of a touchscreen does not open it — that heuristic is meaningless there');
  await touch.close();
}

console.log('\n7. Subscribing from the popup');
{
  const p = await open();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
  await p.waitForTimeout(600);
  await p.fill('#npEmail', 'popup@example.com');
  await p.click('#npSubmit');
  await p.waitForTimeout(500);
  ok(p.posted.length === 1 && p.posted[0].source === 'homepage-popup', 'it posts, tagged as the popup');
  ok(await p.evaluate(() => localStorage.getItem('nl_subscribed') === '1'), 'and remembers they subscribed');
  await p.waitForTimeout(2400);
  ok(await p.isHidden('#newsPop'), 'then closes itself');
  await p.close();
}

console.log('\n8. A server error is shown, never rendered as markup');
{
  const p = await open({ apiFails: true });
  await p.evaluate(() => { window.__x = undefined; });
  await p.route('**/api/subscribe', (route) => route.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ error: '<img src=x onerror="window.__x=1">rate limited' }),
  }));
  await p.fill('#newsEmail', 'a@b.co');
  await p.click('#newsSubmit');
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => window.__x === undefined), 'a hostile message cannot execute script');
  ok((await p.textContent('#newsBanner')).includes('rate limited'), 'but is still shown as text');
  ok(!(await p.evaluate(() => document.getElementById('newsSubmit').disabled)), 'the button is re-enabled');
  ok(p.errors.length === 0, 'no script errors anywhere in the run');
  await p.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
