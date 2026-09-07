/**
 * Replying to a comment or a review from the dashboard.
 *
 * Two halves, and the second is the one that matters: a reply the owner can
 * write but a reader cannot attribute is worse than no reply at all. So the
 * public checks are about whether the reply reads as the author's answer —
 * nested under the comment, bylined, badged — not merely present.
 *
 * The console half drives the real Worker; the public half stubs the feed so
 * a reply can be rendered without one existing in the database.
 *
 * Requires playwright, the site on :5601 with the API repointed at the local
 * Worker, and that Worker running:
 *
 *   npx wrangler dev --local --port 8787 &
 *   node tests/replies.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1500,height:1300} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

const COMMENT = {
  id:'stub-1', target:'/blog/x/', name:'A Reader', email:null,
  body:'Does the owner ever answer these?', approved:1, reply:null, replied_at:null,
  created_at:'2026-09-01 10:00:00',
};

let sent=null;
await page.route('**/api/admin/comments?**', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({ status:'all', comments:[{ ...COMMENT, ...(sent ? { reply:sent.reply, replied_at:'2026-09-07T02:00:00Z' } : {}) }] }),
}));
await page.route('**/api/admin/comments/stub-1', route => {
  sent = route.request().postDataJSON();
  return route.fulfill({ status:200, contentType:'application/json',
    body: JSON.stringify({ ok:true, id:'stub-1', reply:sent.reply || null }) });
});

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });
await page.locator('[data-view="comments"]').click();
await page.waitForSelector('[data-comments] tbody tr', { timeout:15000 });

console.log('== the editor ==');
check('a Reply button is on the row',
  await page.locator('[data-comments] button', { hasText:/^Reply$/ }).count() === 1);
check('no editor until it is clicked', await page.locator('.reply-editor').count() === 0);

await page.locator('[data-comments] button', { hasText:/^Reply$/ }).click();
check('clicking it opens the editor', await page.locator('.reply-editor').isVisible());
// Opened inside the Comments card, not the Reviews one — both carry a host,
// and a document-wide lookup would put it off screen on the wrong panel.
check('inside the comments card, not reviews',
  await page.locator('[data-view-panel="comments"] .reply-editor').count() === 1,
  `comments:${await page.locator('[data-view-panel="comments"] .reply-editor').count()} reviews:${await page.locator('[data-view-panel="reviews"] .reply-editor').count()}`);
check('it quotes what is being answered',
  (await page.locator('.reply-quote').innerText()).includes('Does the owner ever answer these?'),
  await page.locator('.reply-quote').innerText());
check('with no Remove button, there being nothing to remove',
  await page.locator('.reply-editor button', { hasText:'Remove reply' }).count() === 0);

console.log('== an empty reply is refused, not silently a deletion ==');
await page.locator('.reply-editor button', { hasText:'Post reply' }).click();
check('the box says so', /Write something/.test(await page.locator('.reply-note').innerText()),
  await page.locator('.reply-note').innerText());
check('and nothing was sent', sent === null, JSON.stringify(sent));

console.log('== posting ==');
await page.locator('.reply-input').fill('Yes — always, usually within a day.');
await page.locator('.reply-editor button', { hasText:'Post reply' }).click();
await page.waitForFunction(() => document.querySelectorAll('.reply-editor').length === 0, { timeout:15000 });
check('the reply is sent as a reply action', sent?.action === 'reply', JSON.stringify(sent));
check('carrying the text typed', sent?.reply === 'Yes — always, usually within a day.', JSON.stringify(sent));
check('the editor closes', await page.locator('.reply-editor').count() === 0);
await page.waitForSelector('.reply-shown', { timeout:15000 });
check('and the row now shows it', (await page.locator('.reply-shown').innerText()).includes('Yes — always'),
  await page.locator('.reply-shown').innerText());
check('the button becomes Edit reply',
  await page.locator('[data-comments] button', { hasText:'Edit reply' }).count() === 1);

console.log('== removing is its own action ==');
await page.locator('[data-comments] button', { hasText:'Edit reply' }).click();
check('Remove reply appears once there is one',
  await page.locator('.reply-editor button', { hasText:'Remove reply' }).count() === 1);
page.once('dialog', d => d.accept());
sent = null;
await page.locator('.reply-editor button', { hasText:'Remove reply' }).click();
await page.waitForFunction(() => document.querySelectorAll('.reply-editor').length === 0, { timeout:15000 });
// An empty string, which the Worker turns into NULL — the same state as a
// comment never replied to.
check('removal sends an empty reply', sent?.action === 'reply' && sent?.reply === '', JSON.stringify(sent));

console.log('== how it reads on the public page ==');
await page.unrouteAll();
let requests = 0;
await page.route('**/api/engagement**', route => { requests++; return route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    target:'/blog/whatsapp-cloud-api-setup-guide-and-integration-costs/',
    rating:{ average:5, count:1, breakdown:{1:0,2:0,3:0,4:0,5:1} },
    comments:[{ id:'c1', name:'A Reader', body:'Does the owner ever answer these?',
                reply:'Yes — always, usually within a day.', replied_at:'2026-09-07T02:00:00Z',
                created_at:'2026-09-01 10:00:00' }],
    commentCount:1 }),
}); });
await page.goto('http://127.0.0.1:5601/blog/whatsapp-cloud-api-setup-guide-and-integration-costs/',
  { waitUntil:'domcontentloaded' });
// The section sits at the foot of a long article and defers its request until
// it is nearly on screen, so nothing loads until the reader gets there.
check('nothing is fetched while the reader is at the top', requests === 0, String(requests));
await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
await page.waitForSelector('.comment-reply', { timeout:15000 });
check('scrolling to it loads the thread', requests === 1, String(requests));
check('the reply renders', await page.locator('.comment-reply').count() === 1);
// Nested inside the comment, not a sibling: a reply that sits alongside reads
// as a second comment from someone else.
check('nested inside the comment it answers',
  await page.locator('.comment .comment-reply').count() === 1);
check('it is attributed to the author by name',
  (await page.locator('.comment-reply-author').innerText()).length > 3,
  await page.locator('.comment-reply-author').innerText());
check('and badged, so a reader can tell who is speaking',
  (await page.locator('.comment-reply-badge').innerText()).trim().toLowerCase() === 'author',
  await page.locator('.comment-reply-badge').innerText());
check('the reply text is there',
  (await page.locator('.comment-reply').innerText()).includes('Yes — always'),
  await page.locator('.comment-reply').innerText());

console.log('== a reply is text, never markup ==');
await page.unrouteAll();
await page.route('**/api/engagement**', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({ target:'/blog/x/', rating:{average:0,count:0,breakdown:{1:0,2:0,3:0,4:0,5:0}},
    comments:[{ id:'c1', name:'A Reader', body:'hi',
      reply:'<img src=x onerror="window.__pwned=1"><b>bold</b>', replied_at:null,
      created_at:'2026-09-01 10:00:00' }], commentCount:1 }),
}));
await page.reload({ waitUntil:'domcontentloaded' });
await page.locator('[data-engagement]').scrollIntoViewIfNeeded();
await page.waitForSelector('.comment-reply', { timeout:15000 });
check('no element was created from it', await page.locator('.comment-reply img, .comment-reply b').count() === 0);
check('it is shown as the literal text',
  (await page.locator('.comment-reply').innerText()).includes('<b>bold</b>'),
  await page.locator('.comment-reply').innerText());
check('and nothing executed', await page.evaluate(() => window.__pwned === undefined));

console.log('== no script errors ==');
check('the console stayed clean', errs.length === 0, errs.join(' | '));

console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
