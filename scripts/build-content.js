#!/usr/bin/env node
/**
 * Content generator — turns a folder into a page. One script, reused for
 * case studies, news, and blog (same shape, different content type), so
 * there's a single system to maintain instead of three.
 *
 * Plain Node.js, no dependencies — matches SmartGen's existing
 * build-blog.js approach, so there's one toolchain across your properties
 * instead of a second language to maintain here specifically.
 *
 * USAGE
 *   node scripts/build-content.js
 * Run it locally after adding a folder, or wire it into a GitHub Action
 * to run on every push (see the workflow snippet in the README section
 * at the bottom of this file).
 *
 * FOLDER SHAPE — one folder per entry:
 *   content/case-studies/<slug>/meta.json
 *   content/case-studies/<slug>/photo1.jpg   (optional — any images referenced in meta.json)
 *   content/case-studies/<slug>/case-study.md (optional — long-form Markdown body)
 *
 * meta.json fields (title is the only required one):
 * {
 *   "title": "How we launched X",
 *   "date": "2026-08-01",
 *   "summary": "One sentence shown on the listing page.",
 *   "body": ["First paragraph.", "Second paragraph.", "..."],
 *   "markdown": "case-study.md",                  // long-form Markdown body
 *   "cover": "photo1.jpg",                         // image used on the listing card
 *   "youtube": "dQw4w9WgXcQ",                    // YouTube video ID only, not the full URL
 *   "googleDriveVideoId": "1AbCdEfGhIjKlMnOpQr",  // the file ID from the Drive share link
 *   "soundcloud": "https://soundcloud.com/artist/track",
 *   "images": ["photo1.jpg", "photo2.jpg"]        // filenames living next to meta.json
 * }
 *
 * All media is embedded from where it already lives (YouTube, Google
 * Drive, SoundCloud) — nothing gets uploaded to Cloudflare or GitHub
 * storage. Images are the one exception: small ones can live right next
 * to meta.json and get copied alongside the generated page.
 *
 * OUTPUT
 *   <contentType>/<slug>.html   e.g. case-studies/example-entry.html
 *   <contentType>.html          regenerated listing/index page
 */

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

marked.setOptions({ gfm: true, breaks: false });

const ROOT = path.join(__dirname, "..");
const GTM_HEAD = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WN9DK67S');</script>
<!-- End Google Tag Manager -->
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HY9255GJYE"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HY9255GJYE');
</script>
<!-- End Google tag (gtag.js) -->`;
const GTM_NOSCRIPT = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WN9DK67S"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
const CONTENT_TYPES = [
  { dir: "case-studies", label: "Case study", indexTitle: "Case Studies", indexPage: "case-studies.html" },
  { dir: "news", label: "News", indexTitle: "News", indexPage: "news.html" },
  // No "blog" entry here on purpose — build-blog.js (a separate, more capable
  // system: Markdown + front-matter, tags, search, related posts) already
  // owns /blog/. Adding a second generator writing to the same path would
  // collide with it, which is exactly the confusion that came up. Blog
  // posts go through blog-posts/*.md + build-blog.js, not this script.
];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function readHead(title, description) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${GTM_HEAD}
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,650&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css" />
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1612338809888151');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=1612338809888151&ev=PageView&noscript=1"
/></noscript>
</head>
<body>
  ${GTM_NOSCRIPT}
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" id="siteHeader">
    <div class="header-inner">
      <a href="/" class="brand-mark">
        <span class="brand-pulse" aria-hidden="true"></span>
        <span class="brand-word">Connect<em>with</em>Bayezid</span>
      </a>
      <nav class="main-nav" id="mainNav">
        <a href="/services.html">Services</a>
        <a href="/products.html">Products</a>
        <a href="/work.html">Work</a>
        <a href="/about.html">About</a>
        <a href="/client-login.html" class="nav-login-link">Client Login</a>
        <a href="/contact.html" class="nav-cta" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project</a>
      </nav>
      <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>
  <main id="main">
`;
}

function readFooter() {
  return `
  </main>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="brand-word"><span class="brand-pulse-sm"></span>Connect<em>with</em>Bayezid</span>
        <p>Founder-led digital systems — web, SEO, marketing, product.</p>
      </div>
      <div class="footer-cols">
        <div>
          <span class="footer-heading">Work</span>
          <a href="/services.html">Services</a>
          <a href="/products.html">Products</a>
          <a href="/work.html">Case studies</a>
        </div>
        <div>
          <span class="footer-heading">Studio</span>
          <a href="/about.html">About</a>
          <a href="https://sayadbayezid.com/verified-profiles/">Verified profiles</a>
          <a href="/contact.html">Contact</a>
        </div>
        <div>
          <span class="footer-heading">Elsewhere</span>
          <a href="https://www.smartgentools.com" target="_blank" rel="noopener">SmartGen</a>
          <a href="https://www.genzfrontir.com" target="_blank" rel="noopener">GenZ Frontier</a>
          <a href="https://github.com/Sayadbayezid" target="_blank" rel="noopener">GitHub</a>
          <a href="https://docs.smartgentools.com/" target="_blank" rel="noopener">SmartGen Docs</a>
        </div>
      </div>
    </div>
    <div class="footer-legal">
      <span>© <span id="footerYear"></span> Sayad Md Bayezid Hosan — Connect with Bayezid</span>
    </div>
  </footer>
  <script src="/assets/main.js"></script>
</body>
</html>
`;
}

function embedBlock(meta) {
  const blocks = [];
  if (meta.youtube) {
    blocks.push(`<div class="media-embed"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(meta.youtube)}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`);
  }
  if (meta.googleDriveVideoId) {
    blocks.push(`<div class="media-embed"><iframe src="https://drive.google.com/file/d/${encodeURIComponent(meta.googleDriveVideoId)}/preview" title="Video" loading="lazy" allow="autoplay"></iframe></div>`);
  }
  if (meta.soundcloud) {
    blocks.push(`<div class="media-embed media-embed-audio"><iframe src="https://w.soundcloud.com/player/?url=${encodeURIComponent(meta.soundcloud)}&color=%2300d084&auto_play=false&show_comments=false" title="SoundCloud audio" loading="lazy" allow="autoplay"></iframe></div>`);
  }
  return blocks.join("\n");
}

function imageGallery(meta) {
  if (!meta.images?.length) return "";
  const items = meta.images
    .map((img) => `<img src="${escapeHtml(img)}" alt="" loading="lazy" />`)
    .join("\n        ");
  return `<div class="content-gallery">\n        ${items}\n      </div>`;
}

function renderMarkdown(markdownFile, slugDir) {
  const markdownPath = path.join(slugDir, markdownFile);
  if (!fs.existsSync(markdownPath)) {
    console.warn(`  ! Markdown body not found: ${markdownFile}`);
    return "";
  }

  let html = marked.parse(fs.readFileSync(markdownPath, "utf8"));
  html = html.replace(/src=["'](?:\.\/)?images\//g, 'src="/case-studies/images/');
  html = html.replace(/<img\s+([^>]*?)>/g, (full, attrs) => {
    if (!/\bloading=/.test(attrs)) attrs += ' loading="lazy"';
    return `<img ${attrs}>`;
  });
  return html;
}

function renderEntryPage(meta, type, slugDir) {
  const bodyHtml = (meta.body || [])
    .map((para) => `      <p>${escapeHtml(para)}</p>`)
    .join("\\n");
  const richBody = meta.markdown
    ? `<div class="content-rich">${renderMarkdown(meta.markdown, slugDir)}</div>`
    : bodyHtml;
  const gallery = meta.markdown ? "" : imageGallery(meta);

  return readHead(`${meta.title} — Connect with Bayezid`, meta.summary || meta.title) + `
    <article class="content-page">
      <span class="section-eyebrow">${escapeHtml(type.label)}${meta.date ? " · " + escapeHtml(meta.date) : ""}</span>
      <h1>${escapeHtml(meta.title)}</h1>
${richBody}
      ${embedBlock(meta)}
      ${gallery}
    </article>
` + readFooter();
}

function renderIndexPage(type, entries) {
  const cards = entries
    .map(
      (e) => `
        <a href="/${type.dir}/${e.slug}.html" class="work-row reveal" data-reveal>
          <div class="work-media">${e.meta.cover ? `<img src="/${type.dir}/${escapeHtml(e.meta.cover)}" alt="" loading="lazy" />` : ""}<div class="work-media-glow"></div></div>
          <div class="work-copy">
            <span class="work-tag">${escapeHtml(type.label)}${e.meta.date ? " · " + escapeHtml(e.meta.date) : ""}</span>
            <h3>${escapeHtml(e.meta.title)}</h3>
            <p>${escapeHtml(e.meta.summary || "")}</p>
          </div>
          <span class="work-link">Read <span class="btn-arrow">→</span></span>
        </a>`
    )
    .join("\n");

  return readHead(`${type.indexTitle} — Connect with Bayezid`, `${type.indexTitle} from Connect with Bayezid.`) + `
    <section class="page-hero">
      <span class="section-eyebrow reveal" data-reveal>${escapeHtml(type.indexTitle)}</span>
      <h1 class="reveal" data-reveal>${escapeHtml(type.indexTitle)}</h1>
    </section>
    <section class="section work">
      <div class="work-list">
${cards || '        <p style="text-align:center;color:var(--text-soft)">Nothing published here yet.</p>'}
      </div>
    </section>
` + readFooter();
}

function buildContentType(type) {
  const contentDir = path.join(ROOT, "content", type.dir);
  if (!fs.existsSync(contentDir)) {
    console.log(`  (no content/${type.dir}/ folder — skipping)`);
    return;
  }

  const slugs = fs.readdirSync(contentDir).filter((name) => fs.statSync(path.join(contentDir, name)).isDirectory());
  const entries = [];

  const outDir = path.join(ROOT, type.dir);
  fs.mkdirSync(outDir, { recursive: true });

  for (const slug of slugs) {
    const slugDir = path.join(contentDir, slug);
    const metaPath = path.join(slugDir, "meta.json");
    if (!fs.existsSync(metaPath)) {
      console.warn(`  ! ${slug}: no meta.json, skipping`);
      continue;
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (!meta.title) {
      console.warn(`  ! ${slug}: meta.json has no "title", skipping`);
      continue;
    }

    // Copy any referenced local images alongside the generated page.
    for (const img of meta.images || []) {
      const src = path.join(slugDir, img);
      if (fs.existsSync(src)) {
        const destination = path.join(outDir, img);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(src, destination);
      } else {
        console.warn(`  ! ${slug}: image "${img}" listed in meta.json but not found in the folder`);
      }
    }

    fs.writeFileSync(path.join(outDir, `${slug}.html`), renderEntryPage(meta, type, slugDir));
    entries.push({ slug, meta });
    console.log(`  ✓ ${type.dir}/${slug}.html`);
  }

  entries.sort((a, b) => (b.meta.date || "").localeCompare(a.meta.date || ""));
  fs.writeFileSync(path.join(ROOT, type.indexPage), renderIndexPage(type, entries));
  console.log(`  ✓ ${type.indexPage} (${entries.length} entries)`);
}

console.log("Building content...");
for (const type of CONTENT_TYPES) {
  console.log(`\n${type.label}:`);
  buildContentType(type);
}
console.log("\nDone. Generated pages are at the repo root (case-studies/, news/, and their index pages) — commit them alongside the rest of the site. Blog posts are a separate system: blog-posts/*.md via build-blog.js.");

/*
GITHUB ACTION (optional) — add as .github/workflows/build-content.yml in
the SITE repo to regenerate automatically on every push that touches
content/. Full, tested version delivered separately — this comment is
just a pointer, not a second copy to keep in sync by hand.
*/
