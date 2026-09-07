/**
 * How the console shows a project whose health URL is wrong.
 *
 * Both registered projects spent days reading "Down" in red while their
 * servers were alive and answering 404 in under 200ms. Red sends someone to
 * check their servers; the thing that needed fixing was one field in this
 * console. So these checks are about whether the screen distinguishes "your
 * service is broken" from "your health URL is wrong" — not merely that a
 * status renders.
 *
 * The report and overview responses are stubbed, so no project is checked and
 * nothing is written.
 *
 *   node tests/health-status.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1500,height:1300} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

// One project genuinely down, one merely pointed at the wrong URL, one fine.
await page.route('**/api/admin/projects/report**', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    days:7,
    projects:[
      { id:'a', name:'Rinovabd', provider:'test', status:'misconfigured',
        healthUrl:'https://api-v2.example.test/', lastCheckedAt:'2026-09-07 09:54:03',
        checks:3, misconfiguredChecks:2, uptimePct:100, avgLatencyMs:162, worstLatencyMs:200,
        incidents:[
          { statusCode:404, status:'misconfigured', detail:'HTTP 404 — the server answered, so it is running',
            body:'{"ok":false,"error":{"code":"NOT_FOUND","message":"This API route does not exist."}}',
            at:'2026-09-07 09:54:03' },
        ], incidentCount:1 },
      { id:'b', name:'Broken thing', provider:'test', status:'down',
        healthUrl:'https://b.example.test/health', lastCheckedAt:'2026-09-07 09:00:00',
        checks:4, misconfiguredChecks:0, uptimePct:25, avgLatencyMs:900, worstLatencyMs:9000,
        incidents:[
          { statusCode:503, status:'down', detail:'HTTP 503',
            body:'upstream connect error', at:'2026-09-07 09:00:00' },
        ], incidentCount:3 },
      { id:'c', name:'Healthy', provider:'test', status:'up',
        healthUrl:'https://c.example.test/health', lastCheckedAt:'2026-09-07 09:50:00',
        checks:5, misconfiguredChecks:0, uptimePct:100, avgLatencyMs:80, worstLatencyMs:120,
        incidents:[], incidentCount:0 },
    ],
    summary:{ total:3, up:1, down:1, misconfigured:1, unmeasured:0, incidents:3 },
  }),
}));
await page.route('**/api/admin/overview', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({
    projects:{ total:3, up:1, down:1, misconfigured:1 },
    reviews:{ total:0, pending:0 }, comments:{ total:0, pending:0 },
    contacts:{ total:0, last7:0 }, notifications:{ undelivered:0 }, leads:{ total:0, last30:0 },
    // The overview render reads this too; without it the panel throws before
    // drawing anything and every check below fails for the wrong reason.
    analytics:{ configured:true },
  }),
}));

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });

console.log('== the dial does not blame a typo on the servers ==');
await page.waitForSelector('[data-health-summary] svg', { timeout:15000 });
const dial = await page.locator('[data-health-summary]').innerText();
// 1 up of 3, but one of those three was never actually reached. Counting it
// as a failure gives 33%; leaving it out of both halves gives the truth: of
// the two projects actually measured, one is up.
check('it reports 50%, not 33%', /50%/.test(dial), dial);
check('and says one of two, not one of three', /1 of 2 up/.test(dial), dial);

console.log('== the report separates the two kinds of not-up ==');
await page.locator('[data-view="report"]').click();
await page.waitForSelector('[data-report-table] tbody tr', { timeout:15000 });

const rowText = async (name) =>
  (await page.locator('tr', { hasText: name }).first().innerText()).replace(/\s+/g, ' ');

const rinova = await rowText('Rinovabd');
check('the misconfigured project is not called down', !/\bdown\b/i.test(rinova), rinova);
check('it is labelled misconfigured', /misconfigured/i.test(rinova), rinova);
// The uptime column has to agree with the status: the two checks that never
// reached the service are out of the sum, so the one real check reads 100%.
check('its uptime is not dragged down', /100(\.0)?%/.test(rinova), rinova);
check('and the wrong-URL checks are still shown', /2 wrong URL/i.test(rinova), rinova);

const broken = await rowText('Broken thing');
check('a genuinely failing service is still down', /\bdown\b/i.test(broken), broken);
check('and still shows its real uptime', /25(\.0)?%/.test(broken), broken);

console.log('== colour carries the distinction too ==');
const pillClass = async (name) =>
  (await page.locator('tr', { hasText: name }).first().locator('.pill').getAttribute('class')) || '';
// Amber, not red: nothing out there is broken.
check('misconfigured is a warning, not an error', (await pillClass('Rinovabd')).includes('warn'),
  await pillClass('Rinovabd'));
check('down is still an error', (await pillClass('Broken thing')).includes('down'),
  await pillClass('Broken thing'));
check('up is still up', (await pillClass('Healthy')).includes('up'), await pillClass('Healthy'));

console.log('== an incident says what the server actually replied ==');
// "HTTP 404" five times is a count, not an explanation. The response body was
// already being stored and simply was not shown, which is what left the reader
// asking what the error actually was.
const incidents = (await page.locator('[data-report-incidents]').innerText()).replace(/\s+/g,' ');
check('the response body is on the page', /This API route does not exist/.test(incidents), incidents);
check('and the downed one shows its body too', /upstream connect error/.test(incidents), incidents);
check('the status code is still shown', /HTTP 404/.test(incidents), incidents);
// A body is text the server chose; it must never become markup.
check('the body is rendered as text, not markup',
  await page.locator('[data-report-incidents] .incident-body').count() === 2,
  String(await page.locator('[data-report-incidents] .incident-body').count()));

console.log('== incident colour matches the status ==');
const codes = await page.locator('[data-report-incidents] .incident-code').evaluateAll(
  els => els.map(e => e.className));
// A wrong URL listed in red reads as an outage; it is not one.
check('a misconfigured incident is amber', codes.some(c => c.includes('is-warn')), JSON.stringify(codes));
check('a real failure stays red', codes.some(c => !c.includes('is-warn')), JSON.stringify(codes));

console.log('== the summary names it as its own state ==');
const summary = (await page.locator('[data-report-summary]').innerText()).replace(/\s+/g,' ');
check('a card counts the wrong health URLs', /Wrong health URL/i.test(summary), summary);
check('and tells the reader the server answered', /server answered/i.test(summary), summary);

console.log('== no script errors ==');
check('the console stayed clean', errs.length === 0, errs.join(' | '));

console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
