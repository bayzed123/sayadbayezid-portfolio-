/**
 * The Ads hub, driven in a real browser.
 *
 * The screen exists because a Meta token that does not work is
 * indistinguishable from one that does until something asks Meta directly.
 * Before this, when it went wrong the answer was a bare "META_ACCOUNT_READ_FAILED"
 * — an expired token, a missing permission and a wrong ad account id all
 * produced that same string. So the checks here are about whether the reason
 * survives the trip to the screen, and about what must never arrive with it.
 *
 * The API is stubbed: no token is used and no Meta call is made.
 *
 *   node tests/ads-hub.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1400,height:1300} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

// A token that is valid but under-permissioned, an ad account that is readable
// but not ACTIVE, a business read Meta refused, and a pixel that is fine. Four
// different problems, which is the whole reason the steps are independent.
await page.route('**/api/admin/meta/diagnose', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    ok:false,
    firstProblem:{ step:'token', detail:'Valid, and does not expire — expected for a system user token.' },
    steps:[
      { name:'token', ok:true, detail:'Valid, and does not expire — expected for a system user token.',
        data:{ type:'SYSTEM_USER', scopes:['ads_read','public_profile'], missingScopes:['ads_management','business_management'] } },
      { name:'adAccount', ok:false,
        detail:'Readable, but account_status is 2 — not active, so nothing will deliver until that is resolved in Business Manager.' },
      { name:'business', ok:false, detail:'Could not read the Business Portfolio.',
        metaError:{ message:'(#200) Requires business_management permission to manage the object', code:'200', type:'OAuthException', subcode:null } },
      { name:'pixel', ok:true, detail:'Visible to this token as "Bayezid Pixel".' },
    ],
  }),
}));
await page.route('**/api/admin/meta/capi-log**', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    configured:true,
    last7Days:{ accepted:412, rejected:7, unreachable:1 },
    events:[
      { id:'1', event_name:'Lead', event_id:'e1', source_url:'https://sayadbayezid.com/contact',
        status:'rejected', http_status:400, events_received:0, fbtrace_id:'Axb1',
        error_code:'190', error_message:'Error validating access token: Session has expired.',
        created_at:'2026-09-07 12:00:00' },
      { id:'2', event_name:'PageView', event_id:'e2', source_url:'https://sayadbayezid.com/',
        status:'accepted', http_status:200, events_received:1, fbtrace_id:'Axb2',
        error_code:null, error_message:null, created_at:'2026-09-07 11:00:00' },
    ],
  }),
}));
await page.route('**/api/admin/overview', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    projects:{ total:0, up:0, down:0, misconfigured:0 }, reviews:{ total:0, pending:0 },
    comments:{ total:0, pending:0 }, contacts:{ total:0, last7:0 },
    notifications:{ undelivered:0 }, leads:{ total:0, last30:0 }, analytics:{ configured:true },
  }),
}));

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });

console.log('== the hub is reachable ==');
await page.locator('[data-view="adshub"]').click();
await page.waitForSelector('[data-view-panel="adshub"]:visible', { timeout:15000 });
await page.waitForSelector('[data-meta-diagnose] .meta-step', { timeout:15000 });
check('every step is listed', await page.locator('[data-meta-diagnose] .meta-step').count() === 4,
  String(await page.locator('[data-meta-diagnose] .meta-step').count()));

const panel = (await page.locator('[data-view-panel="adshub"]').innerText()).replace(/\s+/g,' ');

console.log('== a failure says what Meta said ==');
check('Meta\'s own sentence is on the page',
  /Requires business_management permission/.test(panel), panel);
check('with its error code', /code 200/.test(panel), panel);
check('and its type', /OAuthException/.test(panel), panel);

console.log('== a missing permission is named, not hinted at ==');
check('the missing scopes are listed', /ads_management/.test(panel) && /business_management/.test(panel), panel);
check('and the fix is stated', /Business Settings/.test(panel), panel);
// Naming only what is missing is the point; listing what is present as if it
// were the problem would send someone the wrong way.
check('a granted scope is not called missing',
  !/Missing permissions?: [^.]*ads_read/.test(panel), panel);

console.log('== an inactive ad account is not silently fine ==');
check('account_status is spelled out', /account_status is 2/.test(panel), panel);
check('and says nothing will deliver', /nothing will deliver/.test(panel), panel);

console.log('== one step failing does not hide the others ==');
const pills = await page.locator('[data-meta-diagnose] .meta-step .pill').evaluateAll(els => els.map(e => e.className));
check('two steps pass and two fail',
  pills.filter(c => c.includes('up')).length === 2 && pills.filter(c => c.includes('down')).length === 2,
  JSON.stringify(pills));

console.log('== the Conversions API reports all three outcomes ==');
// The two cards load from separate requests. Read this one's text only once it
// has actually rendered, or the assertions race the fetch and pass or fail on
// timing rather than on behaviour.
await page.waitForSelector('[data-capi-log] table tbody tr', { timeout:15000 });
const capi = (await page.locator('[data-capi-log]').innerText()).replace(/\s+/g,' ');
check('accepted count', /412/.test(capi), capi);
check('rejected count', /\b7\b/.test(capi), capi);
check('unreachable count', /unreachable/i.test(capi), capi);
check('a rejection shows Meta\'s reason', /Session has expired/.test(capi), capi);
// A 200 carrying events_received: 0 is a silent drop; the column has to exist
// for anyone to notice it.
check('events_received is a column', /received/i.test(capi), capi);

const capiPills = await page.locator('[data-capi-log] .pill').evaluateAll(els => els.map(e => e.className));
check('a rejected event is red', capiPills.some(c => c.includes('down')), JSON.stringify(capiPills));
check('an accepted event is green', capiPills.some(c => c.includes('up')), JSON.stringify(capiPills));
check('none fall through to unknown', !capiPills.some(c => c.includes('unknown')), JSON.stringify(capiPills));

console.log('== nothing on this screen carries a credential ==');
check('no token anywhere', !/access_token|Bearer |appsecret/.test(panel), panel);

console.log('== the screen changes nothing ==');
// Read-only by construction: a button here would be a button that spends money.
check('no form controls in the hub',
  await page.locator('[data-view-panel="adshub"] button, [data-view-panel="adshub"] input').count() === 0,
  String(await page.locator('[data-view-panel="adshub"] button, [data-view-panel="adshub"] input').count()));

check('no JS errors', errs.length === 0, errs.join(' | '));
await page.screenshot({ path: new URL('./ads-hub.png', import.meta.url).pathname, fullPage:true });
console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close(); process.exit(fail?1:0);
