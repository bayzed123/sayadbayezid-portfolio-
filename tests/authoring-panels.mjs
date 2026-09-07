/**
 * The image manager and the FAQ builder in the publish form.
 *
 * The point of both panels is that the *data* survives. Alt text has to reach
 * the publish payload, an inserted image has to land where the cursor was, and
 * a half-filled FAQ pair has to be visibly refused before it silently vanishes
 * at publish. So these checks read the JSON the console would send, not only
 * what is on screen.
 *
 * Two upload paths are covered:
 *   - against the real local Worker, which has no GITHUB_TOKEN, so a valid PNG
 *     gets as far as the commit and stops there. That error is the proof the
 *     bytes were read, encoded, and accepted by every check on the way.
 *   - against a stubbed success, so the rest of the client path — list row,
 *     alt field, insert at the cursor — can be driven without committing a
 *     file to the repository.
 *
 * Nothing here publishes. Requires playwright and two servers:
 *
 *   # the API, from the bayezid-agency-worker checkout
 *   npx wrangler dev --local --port 8787 &
 *   # this repo's console on :5601, API pointed at the local worker
 *   node tests/authoring-panels.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,300)}`:''}`);} };

const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000a49444154789c6360000002000100ffff03000006000557bfabd4000000' +
  '0049454e44ae426082', 'hex');

const UPLOADED = '/blog-posts/images/cover-photo-1a2b3c4d.png';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1500,height:1500} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

const uploads=[];
page.on('request', r => { if (r.url().includes('/api/admin/media')) uploads.push(r.postDataJSON()); });

const settled = () => page.waitForFunction(
  () => !/^Uploading/.test(document.querySelector('[data-media-status]')?.textContent || 'Uploading'),
  { timeout:20000 });

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });
await page.locator('[data-view="content"]').click();
await page.waitForSelector('#publishForm', { timeout:15000 });

console.log('== the Image + button ==');
const panel = page.locator('#imageManager');
check('the panel starts hidden', await panel.isHidden());
check('the button says it is collapsed',
  await page.locator('[data-image-toggle]').getAttribute('aria-expanded') === 'false');
check('the button reads "Image +"',
  (await page.locator('[data-image-toggle]').innerText()).replace(/\s+/g,' ').includes('Image +'));

// The first click also opens the OS file picker, which would block the run.
await page.evaluate(() => { document.querySelector('[data-media-file]').click = () => {}; });
await page.locator('[data-image-toggle]').click();
check('clicking it reveals the upload area', await panel.isVisible());
check('and the drop zone is inside', await page.locator('[data-media-drop]').isVisible());
check('the button now says it is expanded',
  await page.locator('[data-image-toggle]').getAttribute('aria-expanded') === 'true');

console.log('== a real upload against the local Worker ==');
await page.locator('[data-media-file]').setInputFiles([
  { name:'Cover Photo.png', mimeType:'image/png', buffer:PNG_BYTES },
]);
await settled();
const status = await page.locator('[data-media-status]').innerText();
check('the file reaches the Worker', uploads.length === 1, JSON.stringify(uploads).slice(0,200));
check('it is sent as base64 png', /^data:image\/png;base64,/.test(uploads[0]?.data || ''), uploads[0]?.data?.slice(0,40));
check('the filename is preserved', uploads[0]?.filename === 'Cover Photo.png', uploads[0]?.filename);
// No GITHUB_TOKEN locally: reaching that error means the bytes passed the
// extension, size and signature checks on the Worker.
check('the missing token is reported verbatim', /GITHUB_TOKEN is not set/.test(status), status);
check('and the failing file is named', /Cover Photo\.png/.test(status), status);
check('nothing is added to the list on failure', await page.locator('.media-item').count() === 0);

console.log('== an upload that succeeds ==');
await page.route('**/api/admin/media', route => route.fulfill({
  status:200, contentType:'application/json',
  body: JSON.stringify({ ok:true, path:UPLOADED.slice(1), url:UPLOADED, name:'cover-photo-1a2b3c4d.png', bytes:70, reused:false }),
}));
await page.locator('[data-media-file]').setInputFiles([
  { name:'Cover Photo.png', mimeType:'image/png', buffer:PNG_BYTES },
]);
await settled();
check('it appears in the list', await page.locator('.media-item').count() === 1);
check('showing the path it was given', (await page.locator('.media-path').innerText()) === UPLOADED,
  await page.locator('.media-path').innerText());
check('with an empty alt field waiting', (await page.locator('.media-alt').inputValue()) === '');

console.log('== the checklist notices the missing alt text ==');
const altRow = page.locator('.seo-check', { hasText:'body image has alt text' }).first();
check('an image with no alt is flagged', /1 of 1 still missing/i.test(await altRow.innerText()),
  await altRow.innerText());
await page.locator('.media-alt').fill('A lead list open in Google Sheets');
check('and clears once it is written', /1 described/i.test(await altRow.innerText()),
  await altRow.innerText());

console.log('== Insert puts it where the cursor was ==');
await page.fill('#c-body', 'First paragraph.\n\nSecond paragraph.');
await page.evaluate(() => {
  const body = document.getElementById('c-body');
  body.focus();
  // End of the first paragraph, not the end of the field.
  body.setSelectionRange(16, 16);
  body.dispatchEvent(new Event('keyup', { bubbles:true }));
});
await page.locator('.media-item .btn', { hasText:'Insert' }).click();
const withImage = await page.inputValue('#c-body');
check('the markdown carries the alt text',
  withImage.includes(`![A lead list open in Google Sheets](${UPLOADED})`), withImage);
check('it lands after the first paragraph, not at the end',
  withImage.indexOf('![') < withImage.indexOf('Second paragraph.'), JSON.stringify(withImage));
check('and sits on its own line',
  /\n\n!\[A lead list[^\n]*\)\n/.test(withImage), JSON.stringify(withImage));

console.log('== the FAQ builder ==');
await page.locator('[data-faq-add]').click();
check('adding a question creates a row', await page.locator('.faq-item').count() === 1);
await page.locator('[data-faq-question]').fill('Does a half-written pair get published?');
const faqRow = page.locator('.seo-check', { hasText:'FAQ entries are complete' }).first();
// The Worker drops an entry missing either half, so the author has to be told
// here rather than discover it missing from the live page.
check('an incomplete pair is flagged before publishing',
  /incomplete/i.test(await faqRow.innerText()), await faqRow.innerText());
await page.locator('[data-faq-answer]').fill('No. Both halves are required or the entry is left out.');
check('completing it clears the warning', /1 question/.test(await faqRow.innerText()), await faqRow.innerText());

console.log('== what the console would actually send ==');
let sent=null;
await page.route('**/api/admin/content', route => {
  sent = route.request().postDataJSON();
  return route.fulfill({ status:200, contentType:'application/json',
    body: JSON.stringify({ ok:true, preview:true, path:'blog-posts/x.md', contents:'---\n---\n' }) });
});
await page.fill('#c-title', 'Google Maps lead generation to Google Sheets');
await page.fill('#c-description', 'A long enough description to look like a real one in the preview panel below.');
await page.locator('#previewBtn').click();
await page.waitForFunction(() => !/Building the file/.test(document.getElementById('publishNotice')?.textContent || 'Building the file'), { timeout:15000 });
check('images travel with the post', sent?.images?.length === 1, JSON.stringify(sent?.images));
check('carrying url and alt', sent?.images?.[0]?.url === UPLOADED &&
  sent?.images?.[0]?.alt === 'A lead list open in Google Sheets', JSON.stringify(sent?.images));
check('the faq travels too', sent?.faq?.length === 1, JSON.stringify(sent?.faq));
check('with both halves', !!sent?.faq?.[0]?.question && !!sent?.faq?.[0]?.answer, JSON.stringify(sent?.faq));

// A pair the author left half-written must not reach the Worker at all, or the
// preview shows an entry that the commit then drops.
await page.locator('[data-faq-add]').click();
await page.locator('.faq-item').nth(1).locator('[data-faq-question]').fill('Only a question, no answer');
sent = null;
await page.locator('#previewBtn').click();
await page.waitForFunction(() => !/Building the file/.test(document.getElementById('publishNotice')?.textContent || 'Building the file'), { timeout:15000 });
check('a half-written pair is left out of the payload', sent?.faq?.length === 1, JSON.stringify(sent?.faq));

console.log('== no script errors ==');
check('the console stayed clean', errs.length === 0, errs.join(' | '));

console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
