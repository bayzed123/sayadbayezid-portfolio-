/**
 * The landing-page EDITOR in the operations console.
 *
 * tests/landing-video.mjs already covers the public page — what a visitor sees
 * once content exists. Nothing covered the half that produces that content,
 * and that is exactly where the feature was broken: four images were uploaded
 * on 24 Sep 2026 (they are still in R2 and in media_assets), and the save that
 * followed five minutes later wrote `"images":[]`. The upload worked, the save
 * worked, and the two never met.
 *
 * The cause: each upload handler pushed the new file into `landing.content`
 * and then called loadLanding() to refresh the file list. loadLanding()
 * re-fetches the saved document and REPLACES landing.content with it — so the
 * reference that had just been added was gone before "Save and publish" could
 * send it. The console said "Image added. Describe it, then Save and publish",
 * and publishing sent the old document back unchanged.
 *
 * So the check that matters is not "does the upload return 200" or "does the
 * save return 200" — both always did. It is: AFTER AN UPLOAD, DOES THE SAVE
 * BODY CONTAIN THE UPLOADED FILE. Every assertion below reads the PUT body the
 * console actually sent, because that request is the only place the bug was
 * visible.
 *
 *   python3 -m http.server 8901
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
 *     node tests/landing-editor.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8901';
const API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS', m)) : (fail++, console.log('  FAIL', m)); };

/** A real 1x1 PNG. The Worker sniffs magic bytes, so the stub takes a real one
 *  too — a test fixture that could not survive the real endpoint is not a
 *  fixture, it is a way to pass while the feature is broken. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
  'base64',
);

/**
 * Opens the console on the Landing page panel, with the Worker stubbed.
 *
 * `saved` is the document already in D1. `uploads` is the queue of urls the
 * stubbed upload endpoint hands back, one per call, so each test can tell its
 * own files apart. Every PUT to the save endpoint is recorded in `p.puts`.
 */
async function openEditor({ saved = null, assets = [], uploads = [] } = {}) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  p.errors = [];
  p.puts = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));

  // A session, so the gate opens. The console confirms the token with the
  // server rather than trusting it, so that call is stubbed too.
  await p.addInitScript(() => {
    const in1h = new Date(Date.now() + 3600e3).toISOString();
    sessionStorage.setItem('cwb.console.token', 'test-token');
    sessionStorage.setItem('cwb.console.expiry', in1h);
  });

  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // Playwright checks handlers newest-first, so the catch-all goes on FIRST and
  // every specific route below overrides it. Registering it last instead
  // swallows the save request and the test reads a passing save that never
  // happened — which is how a broken feature gets a green suite.
  await p.route(`${API}/api/**`, (r) => json(r, {}));

  await p.route(`${API}/api/admin/session`, (r) => json(r, { ok: true }));

  // The saved document, as the public endpoint returns it.
  await p.route(`${API}/api/landing/*`, (r) =>
    json(r, { page: 'fullstack', content: saved, updatedAt: saved ? '2026-09-24 20:51:31' : null }));

  // The file list. Mutable: an upload adds to it, the way the real one does.
  const assetList = assets.slice();
  await p.route(`${API}/api/admin/media/objects`, (r) => json(r, { assets: assetList }));

  let uploadIndex = 0;
  await p.route(`${API}/api/admin/media/object`, (r) => {
    if (r.request().method() === 'DELETE') return json(r, { ok: true });
    const url = uploads[uploadIndex++] || `/api/media/image/fallback-${uploadIndex}.png`;
    const key = url.replace('/api/media/', '');
    assetList.unshift({
      key,
      filename: key.split('/').pop(),
      kind: key.startsWith('video/') ? 'video' : 'image',
      bytes: 1024,
      content_type: 'image/png',
      created_at: '2026-09-26 10:00:00',
    });
    return json(r, { ok: true, key, kind: assetList[0].kind, bytes: 1024, url });
  });

  // The save. Recorded, then answered the way the Worker does: with what it
  // stored, so the console renders the server's version back.
  await p.route(`${API}/api/admin/landing/*`, (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    p.puts.push(body.content || {});
    return json(r, { ok: true, page: 'fullstack', content: body.content || {} });
  });

  await p.goto(`${BASE}/admin/#landing`, { waitUntil: 'load', timeout: 20000 });
  await p.waitForSelector('[data-view-panel="landing"]:not([hidden])', { timeout: 10000 });
  await p.waitForTimeout(400);
  return p;
}

/** Uploads through the real file input, so the console's own change handler
 *  runs — setting state directly would test nothing. */
async function upload(p, inputId, name, buffer = PNG_1x1) {
  await p.setInputFiles(`#${inputId}`, { name, mimeType: 'image/png', buffer });
  await p.waitForTimeout(600);
}

async function save(p) {
  await p.click('#landingSave');
  await p.waitForTimeout(600);
  return p.puts[p.puts.length - 1];
}

console.log('\n1. An uploaded image survives to the save request');
{
  const p = await openEditor({ uploads: ['/api/media/image/shot-one-aaaa1111.png'] });
  await upload(p, 'landingImageFile', 'shot-one.png');
  const sent = await save(p);
  ok(Array.isArray(sent.images) && sent.images.length === 1,
    `one image is in the published document (got ${JSON.stringify(sent.images)})`);
  ok(sent.images?.[0]?.src === '/api/media/image/shot-one-aaaa1111.png',
    'and it is the file that was just uploaded');
  ok(p.errors.length === 0, 'no script errors');
  await p.close();
}

console.log('\n2. Four images in a row — the case that was reported');
{
  const p = await openEditor({
    uploads: [
      '/api/media/image/img-0999-1f9de18578a8.png',
      '/api/media/image/img-1003-74081a04ace1.png',
      '/api/media/image/img-1004-081be0878c44.png',
      '/api/media/image/img-1005-22368028c2c3.png',
    ],
  });
  for (const n of ['IMG_0999.png', 'IMG_1003.png', 'IMG_1004.png', 'IMG_1005.png']) {
    await upload(p, 'landingImageFile', n);
  }
  const sent = await save(p);
  ok(sent.images?.length === 4, `all four are published, not none (got ${sent.images?.length})`);
  ok(sent.images?.some((i) => i.src.includes('img-1005')), 'including the last one uploaded');
  await p.close();
}

console.log('\n3. An uploaded video and its poster both survive');
{
  const p = await openEditor({
    uploads: ['/api/media/video/offer-bbbb2222.mp4', '/api/media/image/poster-cccc3333.png'],
  });
  await p.fill('#landingVideoTitle', 'Watch an order land');
  await p.fill('#landingVideoCaption', 'Ninety seconds.');
  await upload(p, 'landingVideoFile', 'offer.mp4');
  await upload(p, 'landingPosterFile', 'poster.png');
  const sent = await save(p);
  ok(sent.video?.src === '/api/media/video/offer-bbbb2222.mp4', 'the video is published');
  ok(sent.video?.poster === '/api/media/image/poster-cccc3333.png', 'so is the poster');
  ok(sent.video?.title === 'Watch an order land', 'the heading typed before the upload was not lost');
  ok(sent.video?.caption === 'Ninety seconds.', 'nor the caption');
  await p.close();
}

console.log('\n4. An upload does not discard content already saved');
{
  const saved = {
    links: [{ label: 'Demu Sidra noor Fashion', href: 'https://demu.sayadbayezid.com/d/sidra-noor-fashion/', note: '' }],
    images: [{ src: '/api/media/image/old-dddd4444.png', alt: 'already there', caption: '' }],
  };
  const p = await openEditor({ saved, uploads: ['/api/media/image/new-eeee5555.png'] });
  await upload(p, 'landingImageFile', 'new.png');
  const sent = await save(p);
  ok(sent.images?.length === 2, `the saved image and the new one are both there (got ${sent.images?.length})`);
  ok(sent.links?.length === 1, 'the saved link is still published');
  await p.close();
}

console.log('\n5. A typed link is published, and the file list still refreshes');
{
  const p = await openEditor({ uploads: ['/api/media/image/shot-ffff6666.png'] });
  await upload(p, 'landingImageFile', 'shot.png');
  // The point of calling loadLanding() after an upload was to refresh this
  // table. Fixing the clobber must not cost that.
  const rows = await p.locator('[data-landing-media] tbody tr, [data-landing-media] tr').count();
  ok(rows >= 2, `the uploaded file appears in the media table (${rows} rows incl. header)`);
  await p.click('#landingAddLink');
  await p.waitForTimeout(150);
  const labels = p.locator('[data-landing-links] input');
  await labels.nth(0).fill('Live demo');
  await labels.nth(1).fill('https://demu.sayadbayezid.com/d/smartgadget-demo/');
  const sent = await save(p);
  ok(sent.links?.length === 1 && sent.links[0].href.startsWith('https://'), 'the link is published');
  ok(sent.images?.length === 1, 'and the image is still there alongside it');
  await p.close();
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
