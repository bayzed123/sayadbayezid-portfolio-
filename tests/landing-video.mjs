/**
 * The landing page's offer video, and the content it loads from the dashboard.
 *
 * Two things are being checked here, and both are ways this feature turns from
 * an asset into a liability:
 *
 *   1. THE PAGE MUST NEVER DEPEND ON THE API TO RENDER. Every visitor arrived
 *      from an ad that was paid for. If the content API is slow, rate-limited
 *      or down, they must still see a complete page — so the HTML ships with
 *      real content and the API only ever REPLACES it.
 *
 *   2. A POPUP THAT PLAYS ON SCROLL IS ONE STEP FROM THE THING EVERYONE HATES.
 *      It opens once per visit, never for someone who already pressed play,
 *      never when switched off in the dashboard, never for someone who asked
 *      for reduced motion, and always muted. Each of those is a separate check
 *      because each is a separate way to annoy a buyer into leaving.
 *
 * The `hidden` checks here are not padding. `[hidden]` is only `display:none`
 * in the browser's own stylesheet, so any author rule setting display beats
 * it — which is exactly what happened: the popup sat open over the page from
 * load, and Escape "closed" it by setting an attribute that changed nothing.
 *
 * The content API is stubbed; no real content and no real video is fetched.
 *
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node tests/landing-video.mjs
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE_URL || 'http://localhost:8901';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log('  PASS',m)):(fail++,console.log('  FAIL',m)); };

async function page(content, vp={width:390,height:844}) {
  const p = await b.newPage({ viewport: vp });
  p.errors=[]; p.on('pageerror', e=>p.errors.push(String(e)));
  await p.route('**://connect.facebook.net/**', r=>r.abort());
  await p.route('**/api/track', r=>r.fulfill({status:200,body:'{}'}));
  await p.route('**/api/landing/fullstack', r=>r.fulfill({
    status:200, contentType:'application/json',
    body: JSON.stringify(content===null ? {page:'fullstack',content:null} : {page:'fullstack',content}),
  }));
  await p.goto(BASE + '/ads/fullstack/', { waitUntil:'load', timeout:20000 });
  await p.waitForTimeout(500);
  return p;
}

console.log('\n1. With no video set, the page is still complete');
{
  const p = await page(null);
  ok(await p.isHidden('#videoFrame'), 'the player is hidden');
  ok(await p.isVisible('#videoMissing'), 'an explanation stands in its place, not a blank gap');
  ok((await p.textContent('[data-lp="video-title"]')).length > 20, 'the fallback heading is still there');
  ok(await p.isHidden('#videoModal'), 'nothing pops up when there is nothing to play');
  ok(p.errors.length===0, 'no script errors');
  ok(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth===0), 'no sideways scroll');
  await p.close();
}

console.log('\n2. With a video set, it renders and the section fills in');
{
  const p = await page({ video:{ src:'/api/media/video/demo-abc123.mp4', poster:'/api/media/image/p-1.png',
    title:'Watch an order land', caption:'Ninety seconds.', autoPopup:true } });
  ok(await p.isVisible('#videoFrame'), 'the player frame shows');
  ok(await p.isHidden('#videoMissing'), 'the placeholder is gone');
  ok((await p.textContent('[data-lp="video-title"]'))==='Watch an order land', 'the heading came from the dashboard');
  ok((await p.textContent('[data-lp="video-caption"]'))==='Ninety seconds.', 'so did the caption');
  const src = await p.getAttribute('#videoPlayer','src');
  ok(src && src.startsWith('https://bayezid-agency-api'), `the src is made absolute against the API (${src})`);
  await p.close();
}

console.log('\n3. The scroll-in popup, and every reason it must not fire');
{
  const p = await page({ video:{ src:'/api/media/video/demo-abc123.mp4', title:'T', autoPopup:true } });
  ok(await p.isHidden('#videoModal'), 'closed on arrival');
  await p.evaluate(()=>document.getElementById('video').scrollIntoView());
  await p.waitForTimeout(1400);
  ok(await p.isVisible('#videoModal'), 'opens when the section is reached');
  ok(await p.evaluate(()=>document.getElementById('videoModalPlayer').muted), 'starts muted — an unmuted autoplay is blocked anyway and startles people');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok(await p.isHidden('#videoModal'), 'Escape closes it');
  ok(await p.evaluate(()=>document.body.style.overflow===''), 'the page can scroll again afterwards');
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.evaluate(()=>document.getElementById('video').scrollIntoView());
  await p.waitForTimeout(1400);
  ok(await p.isHidden('#videoModal'), 'it does not come back a second time in the same visit');
  await p.close();
}

console.log('\n4. autoPopup off in the dashboard means off');
{
  const p = await page({ video:{ src:'/api/media/video/x.mp4', title:'T', autoPopup:false } });
  await p.evaluate(()=>document.getElementById('video').scrollIntoView());
  await p.waitForTimeout(1500);
  ok(await p.isHidden('#videoModal'), 'the switch is honoured');
  ok(await p.isVisible('#videoFrame'), 'but the video is still on the page to play by hand');
  await p.close();
}

console.log('\n5. Reduced motion is respected');
{
  const p = await b.newPage({ viewport:{width:390,height:844} });
  await p.emulateMedia({ reducedMotion:'reduce' });
  await p.route('**://connect.facebook.net/**', r=>r.abort());
  await p.route('**/api/track', r=>r.fulfill({status:200,body:'{}'}));
  await p.route('**/api/landing/fullstack', r=>r.fulfill({status:200,contentType:'application/json',
    body: JSON.stringify({page:'fullstack',content:{video:{src:'/api/media/video/x.mp4',title:'T',autoPopup:true}}})}));
  await p.goto(BASE + '/ads/fullstack/', { waitUntil:'load', timeout:20000 });
  await p.evaluate(()=>document.getElementById('video').scrollIntoView());
  await p.waitForTimeout(1500);
  ok(await p.isHidden('#videoModal'), 'no popup for someone who asked for reduced motion');
  await p.close();
}

console.log('\n6. Dashboard links and images reach the page, and are tracked');
{
  const p = await page({
    links:[{label:'Fashion demo',href:'https://demu.sayadbayezid.com/d/x/',note:'A clothing store'}],
    images:[{src:'/api/media/image/extra-1.png',alt:'An extra screen',caption:'Thirteen'}],
  });
  ok(await p.isVisible('#extraLinks'), 'the links block appears');
  const link = await p.$('#extraLinks a');
  ok(await link.getAttribute('href')==='https://demu.sayadbayezid.com/d/x/', 'the link points where it was told to');
  ok(await link.getAttribute('target')==='_blank' && (await link.getAttribute('rel')).includes('noopener'), 'it opens safely in a new tab');
  ok(await link.getAttribute('data-ads-wired')!==null, 'and it was wired for tracking after being injected');
  ok((await p.$$eval('#rail .shot', e=>e.length))===13, 'the extra image was appended to the gallery (13)');
  ok((await p.$eval('#rail .shot:last-child img', e=>e.alt))==='An extra screen', 'with its description');
  await p.close();
}

console.log('\n7. Content from the API is never treated as markup');
{
  const p = await page({ video:{ src:'/api/media/video/x.mp4',
    title:'<img src=x onerror="window.__pwned=1">Title', caption:'<b>bold?</b>', autoPopup:false } });
  ok(await p.evaluate(()=>window.__pwned===undefined), 'a script in a title cannot run');
  ok((await p.$eval('[data-lp="video-caption"]', e=>e.innerHTML)).includes('&lt;b&gt;'), 'markup arrives as visible text, not as HTML');
  await p.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail?1:0;
