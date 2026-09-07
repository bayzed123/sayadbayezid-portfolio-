/**
 * Importing plain text, Markdown and HTML into the body.
 *
 * The conversion is the part that can be quietly wrong: a heading that comes
 * out as a paragraph, a list flattened onto one line, a table that loses a
 * column, a link that carries a javascript: URL into the post. So most of what
 * follows drives the real converter in the page and reads what it produced,
 * rather than checking that a panel opened.
 *
 * The converter is written in-house on purpose — this page holds the admin
 * session and loads no third-party JavaScript — so these checks are the only
 * thing standing behind it.
 *
 * Nothing here publishes. Requires playwright, the console on :5601 with the
 * API repointed at a local Worker, and that Worker running.
 *
 *   node tests/import-formats.mjs
 */
import { chromium } from 'playwright';
let pass=0,fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log(`  ok   ${n}`);} else {fail++;console.log(`  FAIL ${n}${d?`\n       ${String(d).slice(0,400)}`:''}`);} };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport:{width:1500,height:1400} });
const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

await page.goto('http://127.0.0.1:5601/admin/', { waitUntil:'domcontentloaded' });
await page.locator('#gate input').first().fill('bayezid');
await page.locator('#gate input[type=password]').fill('correct-horse-battery');
await page.locator('#gate button[type=submit]').click();
await page.waitForSelector('#shell:visible', { timeout:15000 });
await page.locator('[data-view="content"]').click();
await page.waitForSelector('#publishForm', { timeout:15000 });

// Everything below goes through the real UI rather than a test-only hook into
// the converter: nothing is exported for testing, and the path an author
// actually takes is the one worth pinning.
//
// Conversion runs in "replace" mode with the body emptied first, so the
// confirm never fires and #c-body ends up holding exactly the output.
const md = async (content, format) => {
  await page.fill('#c-body', '');
  await page.locator('[data-import-paste]').fill(content);
  await page.locator('[data-import-format]').selectOption(format);
  await page.locator('.import-modes input[value=replace]').check();
  await page.locator('[data-import-insert]').click();
  return page.inputValue('#c-body');
};

// The guess is only offered until the author picks a format themselves, so
// every sniff check has to run before the first selectOption above.
const sniff = async (content) => {
  await page.locator('[data-import-paste]').fill('');
  await page.locator('[data-import-paste]').fill(content);
  return page.locator('[data-import-format]').inputValue();
};

console.log('== the panel ==');
check('the Import button is there',
  (await page.locator('[data-import-toggle]').innerText()).replace(/\s+/g,' ').includes('Import +'));
check('it starts closed', await page.locator('#importPanel').isHidden());
await page.locator('[data-import-toggle]').click();
check('clicking opens it', await page.locator('#importPanel').isVisible());
check('and Image + still works alongside it',
  await page.locator('[data-image-toggle]').count() === 1);

console.log('== format guessing ==');
check('an html document is recognised', await sniff('<h1>Title</h1><p>Body text here.</p>') === 'html');
check('markdown is recognised', await sniff('# Title\n\nSome **bold** text.') === 'markdown');
check('prose is left as text', await sniff('Just a sentence with no markup in it at all.') === 'text');
// A stray angle bracket in prose is not a document.
check('a lone < does not make it html', await sniff('5 < 7 and that is that.') === 'text');

console.log('== plain text ==');
check('blank lines separate paragraphs',
  (await md('First para.\n\nSecond para.', 'text')) === 'First para.\n\nSecond para.');
// Hard-wrapped text is the case that goes wrong silently: without rejoining,
// every wrapped line becomes its own paragraph on the published page.
check('hard-wrapped lines rejoin into one paragraph',
  (await md('This sentence was\nwrapped at some column\nby the editor.\n\nNext one.', 'text'))
    === 'This sentence was wrapped at some column by the editor.\n\nNext one.');
check('a bullet block stays a list',
  (await md('- one\n- two\n- three', 'text')) === '- one\n- two\n- three');

console.log('== markdown passes through ==');
const source = '# Heading\n\nSome **bold** and a [link](https://example.com).';
check('unchanged apart from trimming', (await md(source, 'markdown')) === source);

console.log('== html to markdown ==');
const html = `<h2>Setup</h2><p>Install it with <code>npm i</code> first.</p>
<ul><li>One</li><li>Two <strong>bold</strong></li></ul>
<ol><li>First</li><li>Second</li></ol>
<blockquote><p>A quoted line.</p></blockquote>
<pre><code class="language-js">const x = 1;</code></pre>
<p>See <a href="https://example.com/docs">the docs</a>.</p>
<hr>`;
const got = await md(html, 'html');
check('headings keep their level', got.includes('## Setup'), got);
check('inline code survives', got.includes('`npm i`'), got);
check('bullets become a list', /- One\n- Two \*\*bold\*\*/.test(got), got);
check('numbered lists keep their numbers', /1\. First\n2\. Second/.test(got), got);
check('blockquotes are prefixed', got.includes('> A quoted line.'), got);
// The language matters: the built page uses it for the label and copy button.
check('fenced code keeps its language', got.includes('```js\nconst x = 1;\n```'), got);
check('links keep href and label', got.includes('[the docs](https://example.com/docs)'), got);
check('a horizontal rule survives', got.includes('---'), got);

console.log('== a link outside a block element keeps its href ==');
// How a copied fragment often arrives: no wrapping <p>. The block walker used
// to recurse into these and never reach the handler that reads href, so the
// link silently became plain text — and that also made the javascript: check
// below pass for the wrong reason.
const bare = await md('<a href="https://example.com/docs">the docs</a> and <strong>bold</strong> text.', 'html');
check('a bare <a> is still a link', bare.includes('[the docs](https://example.com/docs)'), bare);
check('and bare inline emphasis survives', bare.includes('**bold**'), bare);
const bareImg = await md('<img src="https://example.com/a.png" alt="A diagram">', 'html');
check('a bare <img> keeps its src and alt',
  bareImg.includes('![A diagram](https://example.com/a.png)'), bareImg);

console.log('== nested lists are indented, not flattened ==');
const nested = await md('<ul><li>Outer<ul><li>Inner one</li><li>Inner two</li></ul></li><li>Second</li></ul>', 'html');
check('the child list is indented under its parent',
  /- Outer\n {2}- Inner one\n {2}- Inner two\n- Second/.test(nested), JSON.stringify(nested));

console.log('== tables keep their shape ==');
const table = await md('<table><tr><th>Tool</th><th>Cost</th></tr><tr><td>A</td><td>Free</td></tr><tr><td>B</td><td>$9</td></tr></table>', 'html');
check('a header row and separator are emitted', /\| Tool \| Cost \|\n\|.*---.*\|/.test(table), JSON.stringify(table));
check('every body row is present', table.includes('| A | Free |') && table.includes('| B | $9 |'), JSON.stringify(table));

console.log('== a pasted document cannot smuggle anything in ==');
const hostile = await md(
  '<p>Before</p><script>window.__pwned=1</script><p>After</p>' +
  '<a href="javascript:alert(1)">click me</a>' +
  '<a href="data:text/html,<b>x</b>">data link</a>' +
  '<img src="javascript:alert(2)" alt="bad">' +
  '<iframe src="https://evil.test"></iframe>', 'html');
check('nothing executed while parsing', await page.evaluate(() => window.__pwned === undefined));
check('the script body is not transcribed', !hostile.includes('__pwned'), hostile);
// A javascript: link must lose its href, not keep it inside markdown syntax.
check('a javascript: link keeps only its text', hostile.includes('click me') && !hostile.includes('javascript:'), hostile);
check('a data: link is defanged too', !hostile.includes('data:text/html'), hostile);
check('an image with a script url is dropped', !hostile.includes('alert(2)'), hostile);
check('the iframe leaves nothing behind', !hostile.includes('evil.test'), hostile);
check('the real text around it survives', hostile.includes('Before') && hostile.includes('After'), hostile);

console.log('== inserting into the body ==');
await page.locator('.import-modes input[value=cursor]').check();
await page.fill('#c-body', 'First paragraph.\n\nSecond paragraph.');
await page.evaluate(() => {
  const b = document.getElementById('c-body');
  b.focus(); b.setSelectionRange(16, 16);
  b.dispatchEvent(new Event('keyup', { bubbles:true }));
});
await page.locator('[data-import-paste]').fill('<h3>Imported</h3><p>From HTML.</p>');
await page.locator('[data-import-format]').selectOption('html');
await page.locator('[data-import-insert]').click();
const afterInsert = await page.inputValue('#c-body');
check('the converted text lands in the body', afterInsert.includes('### Imported'), afterInsert);
check('at the cursor, not the end',
  afterInsert.indexOf('### Imported') < afterInsert.indexOf('Second paragraph.'), JSON.stringify(afterInsert));
check('the status says what happened',
  /characters of Markdown/.test(await page.locator('[data-import-status]').innerText()),
  await page.locator('[data-import-status]').innerText());

console.log('== replacing asks first ==');
await page.locator('[data-import-paste]').fill('Replacement body text, long enough to be real.');
await page.locator('[data-import-format]').selectOption('text');
await page.locator('.import-modes input[value=replace]').check();
page.once('dialog', d => d.dismiss());
await page.locator('[data-import-insert]').click();
check('declining the confirm changes nothing',
  (await page.inputValue('#c-body')) === afterInsert, await page.inputValue('#c-body'));
page.once('dialog', d => d.accept());
await page.locator('[data-import-insert]').click();
check('accepting replaces the body',
  (await page.inputValue('#c-body')) === 'Replacement body text, long enough to be real.',
  await page.inputValue('#c-body'));

console.log('== empty input is refused ==');
await page.locator('[data-import-paste]').fill('   ');
await page.locator('[data-import-insert]').click();
check('it says so rather than clearing the body',
  /Paste something first/.test(await page.locator('[data-import-status]').innerText()),
  await page.locator('[data-import-status]').innerText());

console.log('== no script errors ==');
check('the console stayed clean', errs.length === 0, errs.join(' | '));

console.log(`\npassed: ${pass}   failed: ${fail}`);
await browser.close();
process.exit(fail ? 1 : 0);
