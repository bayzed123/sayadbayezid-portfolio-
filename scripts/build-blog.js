#!/usr/bin/env node

/**
 * SayadBayezid Portfolio Blog Builder
 * Converts Markdown files from blog-posts/ into static HTML pages
 * Generates blog.json for dynamic frontend rendering
 * Includes SEO, Open Graph, and JSON-LD Schema
 */

const fs = require('fs');
const path = require('path');
const matter = require('front-matter');
const { marked } = require('marked');
const slugify = require('slugify');
const { engagementSection } = require('./engagement-section');

// Configuration
const BLOG_POSTS_DIR = path.join(__dirname, '../blog-posts');
const BLOG_OUTPUT_DIR = path.join(__dirname, '../blog');
const TEMPLATES_DIR = path.join(__dirname, '../templates');
const INCLUDES_DIR = path.join(__dirname, '../_includes');
/** How many related posts to show, and how much overlap earns a slot. */
const RELATED_MAX = 3;
const RELATED_MIN_SCORE = 3;

/** How many posts the homepage journal grid shows. Three fills the row. */
const HOMEPAGE_POST_COUNT = 3;
const AUTHOR_NAME = 'Sayad Md Bayezid Hosan';
const SITE_URL = 'https://sayadbayezid.com';
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

// Ensure directories exist
if (!fs.existsSync(BLOG_OUTPUT_DIR)) {
  fs.mkdirSync(BLOG_OUTPUT_DIR, { recursive: true });
}

// Configure marked for better HTML rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Read all markdown files from blog-posts directory
 */
function readBlogPosts() {
  if (!fs.existsSync(BLOG_POSTS_DIR)) {
    console.log('⚠️  blog-posts directory not found. Creating it...');
    fs.mkdirSync(BLOG_POSTS_DIR, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(BLOG_POSTS_DIR).filter(file => file.endsWith('.md'));
  const posts = [];

  const unreadable = [];

  files.forEach(file => {
    const filePath = path.join(BLOG_POSTS_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // One malformed file used to take the whole build down. js-yaml throws on
    // front matter it cannot parse — most often an unquoted value containing a
    // colon, like `title: WhatsApp Cloud API: costs` — and the throw escaped
    // this loop, so a single typo in one draft stopped every other post from
    // publishing. The author's symptom was "I wrote a post and nothing
    // appeared", with the cause buried in an Actions log they had no reason to
    // open.
    //
    // Now the bad file is skipped, every good post still ships, and the
    // failure is printed as a GitHub Actions error annotation so it shows on
    // the run summary without blocking the ones that are fine.
    let parsed;
    try {
      parsed = matter(fileContent);
    } catch (error) {
      unreadable.push({ file, message: error.message.split('\n')[0] });
      return;
    }
    const { attributes: rawAttributes, body } = parsed;
    // Front-matter keys are matched case-insensitively. One post was written
    // with "Title:" and "Description:" capitalised, which the parser treats as
    // different keys from "title" and "description" — so it published as
    // "Untitled" with an empty excerpt, and nothing flagged it. A capital
    // letter in a key is a typo, not a different field.
    const attributes = Object.fromEntries(
      Object.entries(rawAttributes).map(([key, value]) => [key.toLowerCase(), value]),
    );

    // An explicit `slug:` wins. Two posts already declare one, and it was
    // being ignored — which made every published URL a function of the title,
    // so correcting a title silently moved a live, indexed page. Deriving from
    // the filename (not the title) is the fallback, for the same reason.
    const slug = attributes.slug
      ? slugify(String(attributes.slug), { lower: true, strict: true })
      : slugify(file.replace('.md', ''), { lower: true, strict: true });

    posts.push({
      slug,
      title: attributes.title || 'Untitled',
      description: attributes.description || '',
      content: body,
      date: attributes.date || new Date().toISOString().split('T')[0],
      tags: attributes.tags || [],
      image: attributes.image || `${SITE_URL}/assets/images/blog-default.svg`,
      author: attributes.author || AUTHOR_NAME,
      category: attributes.category || 'General',
      // Alt text for the cover image. Falls back to the title, which is a
      // reasonable description of a post's own cover and beats an empty alt.
      imageAlt: attributes.imagealt || attributes.image_alt || '',
      // Last substantive edit. Google reads dateModified, and a post that is
      // updated but still claims its original date looks stale.
      updated: toW3CDate(attributes.updated || attributes.modified) || null,
      // [{ question, answer }] — rendered as an accordion and as FAQPage
      // schema. Only emitted when the author actually wrote FAQs; an empty
      // FAQPage is a structured-data error, not a neutral omission.
      faq: normaliseFaq(attributes.faq),
      // [{ url, alt, caption }] for images used in the body, so the sitemap
      // and schema can describe them.
      images: normaliseImages(attributes.images),
      video: attributes.video || null,
    });
  });

  if (unreadable.length) {
    console.log('');
    unreadable.forEach(({ file, message }) => {
      // ::error:: renders as a red annotation on the workflow run without
      // failing the job, so the good posts still get committed and pushed.
      console.log(`::error file=blog-posts/${file}::Front matter could not be parsed, so this post was NOT published. ${message}. Wrap any value containing a colon in double quotes, e.g. title: "A post: with a colon".`);
      console.log(`❌ Skipped blog-posts/${file} — ${message}`);
      console.log(`   Wrap values containing a colon in double quotes: title: "A post: with a colon"`);
    });
    console.log('');
  }

  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * FAQ entries from front matter. Accepts the two shapes people actually
 * write — a list of {question, answer} maps, or a list of single-key maps —
 * and drops anything without both halves, because a question with no answer
 * is an invalid FAQPage entry rather than a partial one.
 */
function normaliseFaq(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      if (entry.question && entry.answer) {
        return { question: String(entry.question).trim(), answer: String(entry.answer).trim() };
      }
      const keys = Object.keys(entry);
      if (keys.length === 1) {
        return { question: String(keys[0]).trim(), answer: String(entry[keys[0]]).trim() };
      }
      return null;
    })
    .filter((entry) => entry && entry.question && entry.answer);
}

/** Body images from front matter, each with its own alt text. */
function normaliseImages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'string') return { url: entry.trim(), alt: '', caption: '' };
      if (!entry || typeof entry !== 'object' || !entry.url) return null;
      return {
        url: String(entry.url).trim(),
        alt: String(entry.alt || '').trim(),
        caption: String(entry.caption || '').trim(),
      };
    })
    .filter((entry) => entry && entry.url);
}

/** Relative paths become absolute; schema and og:image both require it. */
function absoluteUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Load author profile box
 */
function loadAuthorProfileBox() {
  try {
    const profilePath = path.join(INCLUDES_DIR, 'author-profile-box.html');
    if (fs.existsSync(profilePath)) {
      return fs.readFileSync(profilePath, 'utf8');
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not load author profile box:', error.message);
  }
  return '';
}

/**
 * Load author footer box
 */
function loadAuthorFooterBox() {
  try {
    const footerPath = path.join(INCLUDES_DIR, 'author-blog-fotter-box.html');
    if (fs.existsSync(footerPath)) {
      return fs.readFileSync(footerPath, 'utf8');
    }
  } catch (error) {
    console.warn('⚠️  Warning: Could not load author footer box:', error.message);
  }
  return '';
}

/**
 * Replace manual tags with actual content
 */
function replaceManualTags(htmlContent, authorProfileBox, authorFooterBox) {
  let processedContent = htmlContent;
  
  if (processedContent.includes('')) {
    processedContent = processedContent.replace('', authorProfileBox);
  }
  
  if (processedContent.includes('')) {
    processedContent = processedContent.replace('', authorFooterBox);
  }
  
  return processedContent;
}

/**
 * Generate HTML for a single blog post
 */
/**
 * Words too common to signal that two posts are about the same thing. Without
 * this, "the guide to" matches "a guide for" and everything relates to
 * everything — which is the failure this whole function exists to avoid.
 */
const STOP_WORDS = new Set(`a an and are as at be but by for from how in into is it its of on or
that the this to what when where which who why with you your guide using use complete step steps
best top new
`.split(/\s+/).filter(Boolean));

/** Meaningful terms from a post's title, description and tags. */
function postTerms(post) {
  const text = `${post.title} ${post.description} ${(post.tags || []).join(' ')}`.toLowerCase();
  return new Set(
    text
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
  );
}

/**
 * Related posts, scored — never padded.
 *
 * The previous version matched on exact tag equality. Two of four posts had no
 * tags at all and the rest had none in common, so the section hid itself on
 * every post: honest, but useless. Loosening it to "any three recent posts"
 * would have been worse, because a reader who clicks a suggestion that turns
 * out to be unrelated stops trusting every suggestion after it.
 *
 * So: score real overlap, and show nothing when nothing scores. A post with no
 * genuine relatives gets no section, which is the correct answer.
 */
function findRelatedPosts(post, allPosts) {
  const terms = postTerms(post);
  const tags = new Set((post.tags || []).map((t) => String(t).toLowerCase()));

  const scored = allPosts
    .filter((other) => other.slug !== post.slug)
    .map((other) => {
      let score = 0;
      const reasons = [];

      const sharedTags = (other.tags || []).filter((t) => tags.has(String(t).toLowerCase()));
      if (sharedTags.length) {
        score += sharedTags.length * 3;
        reasons.push(`tags: ${sharedTags.join(', ')}`);
      }

      if (post.category && other.category &&
          post.category.toLowerCase() === other.category.toLowerCase() &&
          post.category.toLowerCase() !== 'general') {
        // "General" is the fallback category, so sharing it says nothing.
        score += 2;
        reasons.push(`category: ${other.category}`);
      }

      const shared = [...postTerms(other)].filter((word) => terms.has(word));
      if (shared.length) {
        score += shared.length;
        reasons.push(`terms: ${shared.slice(0, 4).join(', ')}`);
      }

      return { post: other, score, reasons };
    })
    .filter((entry) => entry.score >= RELATED_MIN_SCORE)
    .sort((a, b) => b.score - a.score || new Date(b.post.date) - new Date(a.post.date))
    .slice(0, RELATED_MAX);

  return scored;
}

/**
 * Related posts as real HTML, not a client-side fetch. Two reasons: internal
 * links only pass value to crawlers if they are in the markup, and a reader
 * with slow JS should still see where to go next.
 */
function buildRelatedHTML(post, allPosts) {
  const related = findRelatedPosts(post, allPosts);
  if (!related.length) return '';

  const cards = related.map(({ post: other }) => `
              <a href="/blog/${other.slug}/" class="related-card">
                <span class="related-card-meta">${escapeText(other.category || '')}</span>
                <h3>${escapeText(other.title)}</h3>
                <p>${escapeText(truncate(other.description || '', 120))}</p>
                <span class="related-card-link">Read this next <span class="btn-arrow">→</span></span>
              </a>`).join('');

  return `
        <section class="blog-related-posts reveal-up" aria-labelledby="related-heading">
          <h2 id="related-heading" class="related-posts-title">Related reading</h2>
          <div class="related-grid">${cards}
          </div>
        </section>`;
}

/**
 * Wraps every code block so it can be copied in one click.
 *
 * Done at build time rather than by walking the DOM on load: the button is in
 * the HTML, so it does not appear a moment late, and a reader whose JavaScript
 * fails still sees a normally formatted code block instead of a button that
 * does nothing.
 *
 * The language label comes from the fence (```bash), which marked renders as
 * class="language-bash". It is shown because a reader scanning a long post
 * needs to know whether a block is shell, JSON or JavaScript before reading it.
 */
function addCodeCopyButtons(html) {
  return html.replace(
    /<pre><code(?:\s+class="language-([a-z0-9+#-]+)")?>([\s\S]*?)<\/code><\/pre>/gi,
    (match, language, code) => {
      const label = language ? escapeText(language) : 'code';
      return `<div class="code-block" data-language="${escapeAttr(label)}">` +
             `<div class="code-block-bar"><span class="code-block-lang">${label}</span>` +
             `<button type="button" class="code-copy" aria-label="Copy this ${label} sample">Copy</button></div>` +
             `<pre><code${language ? ` class="language-${escapeAttr(language)}"` : ''}>${code}</code></pre>` +
             `</div>`;
    },
  );
}

/**
 * Post directories with no source file left.
 *
 * Renaming a post changes its slug, so the build writes a new directory and
 * simply stops touching the old one — which keeps serving whatever it last
 * contained, forever, with no source to regenerate it from. One such
 * directory was found live: titled "Untitled", absent from the sitemap,
 * linked from nowhere, still returning 200.
 *
 * Reported rather than deleted. A directory here is usually stale output, but
 * it could also be a hand-written page someone dropped under /blog/, and
 * silently removing that would be worse than leaving a stale one.
 */
function reportOrphanedPostDirs(posts) {
  if (!fs.existsSync(BLOG_OUTPUT_DIR)) return;
  const published = new Set(posts.map((post) => post.slug));
  const orphans = fs
    .readdirSync(BLOG_OUTPUT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !published.has(entry.name))
    .map((entry) => entry.name);

  if (!orphans.length) return;
  console.log('');
  orphans.forEach((slug) => {
    console.log(`::warning file=blog/${slug}/index.html::/blog/${slug}/ has no source in blog-posts/. It is still served but cannot be regenerated — delete it, or add the .md back if the post was renamed.`);
    console.log(`⚠️  Orphaned: /blog/${slug}/ has no source .md and will keep serving stale content.`);
  });
  console.log('');
}

/** XML text escaping. An unescaped & makes the whole sitemap unparseable. */
function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Reading time at 200 words a minute, floored at one. */
function readingTime(markdown) {
  const words = String(markdown || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Structured data for a post, as one @graph.
 *
 * Built with JSON.stringify rather than string interpolation. The previous
 * version interpolated the title straight into a JSON literal, so an ordinary
 * title — He said "hello" — produced invalid JSON and Google discarded the
 * whole block silently. Nothing on the page looked wrong; the post simply had
 * no structured data.
 *
 * Only blocks the post can actually support are emitted. An empty FAQPage or
 * an ImageObject with no image is a structured-data error, not a harmless
 * placeholder, and Search Console reports them as such.
 */
function buildStructuredData(post) {
  const url = `${SITE_URL}/blog/${post.slug}/`;
  const image = absoluteUrl(post.image);
  const graph = [];

  const article = {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    // Only claim a modification when there was one. Repeating datePublished
    // here tells Google the post is freshly updated every time it is built.
    ...(post.updated ? { dateModified: post.updated } : {}),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: post.author, url: `${SITE_URL}/about.html` },
    publisher: { '@type': 'Person', name: AUTHOR_NAME, url: SITE_URL },
    ...(post.tags && post.tags.length ? { keywords: post.tags.join(', ') } : {}),
    ...(post.category ? { articleSection: post.category } : {}),
  };
  if (image) {
    article.image = {
      '@type': 'ImageObject',
      url: image,
      // Alt text is what the image means; without it the ImageObject says a
      // file exists and nothing about it.
      ...(post.imageAlt || post.title ? { caption: post.imageAlt || post.title } : {}),
    };
  }
  graph.push(article);

  // Breadcrumbs mirror the visible trail exactly. A schema trail that does not
  // match what the reader sees is a structured-data violation.
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  });

  if (post.faq && post.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: post.faq.map((entry) => ({
        '@type': 'Question',
        name: entry.question,
        acceptedAnswer: { '@type': 'Answer', text: entry.answer },
      })),
    });
  }

  if (post.video && post.video.url) {
    graph.push({
      '@type': 'VideoObject',
      name: post.video.name || post.title,
      description: post.video.description || post.description,
      thumbnailUrl: absoluteUrl(post.video.thumbnail || post.image),
      uploadDate: post.video.uploadDate || post.date,
      contentUrl: absoluteUrl(post.video.url),
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

/**
 * The visible breadcrumb trail. Exists for readers as much as for search:
 * Google shows URL parts as breadcrumbs in results, and a reader landing
 * mid-site from search needs to know where they are.
 */
function buildBreadcrumbHTML(post) {
  return `<nav class="post-breadcrumb" aria-label="Breadcrumb">
              <ol>
                <li><a href="/">Home</a></li>
                <li><a href="/blog/">Blog</a></li>
                <li aria-current="page">${escapeText(post.title)}</li>
              </ol>
            </nav>`;
}

/**
 * The FAQ block, when the post declares one. Plain details/summary so it works
 * with no JavaScript and stays keyboard-accessible, and so the answer text is
 * in the HTML for crawlers rather than injected later.
 */
function buildFaqHTML(post) {
  if (!post.faq || !post.faq.length) return '';
  const items = post.faq.map((entry) => `
                <details class="faq-item">
                  <summary>${escapeText(entry.question)}</summary>
                  <div class="faq-answer">${marked(entry.answer)}</div>
                </details>`).join('');
  return `
        <section class="post-faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Frequently asked questions</h2>
          <div class="faq-list">${items}
          </div>
        </section>`;
}

function generatePostHTML(post, allPosts) {
  let htmlContent = marked(post.content);
  const authorProfileBox = loadAuthorProfileBox();
  const authorFooterBox = loadAuthorFooterBox();
  
  const hasManualProfile = post.content.includes('');
  const hasManualFooter = post.content.includes('');
  
  htmlContent = replaceManualTags(htmlContent, authorProfileBox, authorFooterBox);
  htmlContent = addCodeCopyButtons(htmlContent);
  
  const autoProfileBox = hasManualProfile ? '' : authorProfileBox;
  const autoFooterBox = hasManualFooter ? '' : authorFooterBox;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    ${GTM_HEAD}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${post.title} - ${AUTHOR_NAME}</title>
    <meta name="description" content="${post.description}">
    <meta name="author" content="${post.author}">
    <meta name="keywords" content="${post.tags.join(', ')}">
    
    <meta property="og:title" content="${post.title}">
    <meta property="og:description" content="${post.description}">
    <meta property="og:image" content="${absoluteUrl(post.image)}">
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}/">
    <meta property="og:image:alt" content="${escapeAttr(post.imageAlt || post.title)}">
    <meta property="og:type" content="article">
    <meta property="article:published_time" content="${post.date}">${post.updated ? `\n    <meta property="article:modified_time" content="${post.updated}">` : ''}
    <meta property="article:author" content="${post.author}">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${post.title}">
    <meta name="twitter:description" content="${post.description}">
    <meta name="twitter:image" content="${absoluteUrl(post.image)}">
    
    <link rel="canonical" href="${SITE_URL}/blog/${post.slug}/">
    <meta name="robots" content="index, follow, max-image-preview:large">
    
    <script>
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            location.replace('https:' + location.href.substring(location.protocol.length));
        }
    </script>
    
    <script type="application/ld+json">
${buildStructuredData(post)}
    </script>

    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,650&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">
    <link rel="stylesheet" href="/assets/css/blog.css">
    
    <style>
        /* Print Styles */
        @media print {
            header, footer, .newsletter-section, .blog-related-posts, #print-button, #share-button, #main-header, #main-footer, .share-modal {
                display: none !important;
            }
            body { background: white; color: black; }
            .blog-post-container { max-width: 100%; padding: 0; }
            .blog-post-article { box-shadow: none; border: none; }
            .blog-post-title { page-break-after: avoid; }
            .blog-post-content { color: black; }
            .blog-post-content a { color: #0066cc; text-decoration: underline; }
            img { max-width: 100%; height: auto; page-break-inside: avoid; }
            h2, h3, h4 { page-break-after: avoid; page-break-inside: avoid; }
            p { orphans: 3; widows: 3; }
            pre { background: #f5f5f5 !important; border: 1px solid #ddd !important; page-break-inside: avoid; }
        }

        /* Share Modal Styles */
        .share-modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        .share-modal.show {
            display: flex;
            opacity: 1;
        }
        .share-modal-content {
            background: var(--surface-raised, #161F1A);
            border: 1px solid var(--line, rgba(237,239,236,.1));
            padding: 2.5rem 2rem;
            border-radius: 16px;
            max-width: 350px;
            width: 90%;
            position: relative;
            text-align: center;
            box-shadow: 0 26px 64px rgba(0,0,0,.5);
            transform: translateY(20px);
            transition: transform 0.3s ease;
        }
        .share-modal.show .share-modal-content {
            transform: translateY(0);
        }
        .share-close {
            position: absolute;
            right: 15px;
            top: 10px;
            font-size: 28px;
            color: var(--text-dim, #5C6A62);
            cursor: pointer;
            transition: color 0.2s;
        }
        .share-close:hover { color: var(--emerald, #00D084); }
        .share-modal h3 {
            margin-top: 0;
            margin-bottom: 1.5rem;
            color: var(--paper, #EDEFEC);
            font-family: 'Fraunces', Georgia, serif;
            font-size: 1.5rem;
        }
        .share-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .share-btn {
            padding: 12px;
            border: none;
            border-radius: 8px;
            color: white;
            cursor: pointer;
            font-weight: 600;
            font-size: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            transition: transform 0.2s, opacity 0.2s;
        }
        .share-btn:hover { transform: translateY(-2px); opacity: 0.9; }
        .share-btn.fb { background: #1877F2; }
        .share-btn.tw { background: #000000; }
        .share-btn.li { background: #0A66C2; }
        .share-btn.wa { background: #25D366; }
        .share-btn.copy { background: #4b5563; }
    </style>
    
    <script src="/assets/js/blog.js" defer></script>
    <script src="/assets/js/engagement.js" defer></script>

    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9789336661158068" crossorigin="anonymous"></script>
</head>
<body>
    ${GTM_NOSCRIPT}
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" id="siteHeader">
      <div class="header-inner">
        <a href="/" class="brand-mark"><img src="/assets/connect-with-bayezid-logo.svg" alt="Connect with Bayezid" class="brand-logo" width="172" height="34" /></a>
        <nav class="main-nav" id="mainNav">
          <a href="/services.html">Services</a>
          <a href="/products.html">Products</a>
          <a href="/projects.html">Projects</a>
          <a href="/case-studies/">Case Studies</a>
          <a href="/blog/" aria-current="page">Blog</a>
          <a href="/about.html">About</a>
          <a href="/client-login.html" class="nav-login-link">Client Login</a>
          <a href="/contact.html" class="nav-cta" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project</a>
        </nav>
        <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <main class="blog-post-container">
        <article class="blog-post-article reveal-up">
            ${buildBreadcrumbHTML(post)}
            <header class="blog-post-header">
                <div class="blog-post-meta">
                    <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                    <span class="meta-separator">•</span>
                    <span class="blog-post-category">${post.category}</span>
                    <span class="meta-separator">•</span>
                    <span class="blog-post-author">By ${post.author}</span>
                    <span class="meta-separator">•</span>
                    <span class="blog-post-readtime">${readingTime(post.content)} min read</span>
                </div>
                <h1 class="blog-post-title">${post.title}</h1>
                <p class="blog-post-excerpt">${post.description}</p>
            </header>

            ${autoProfileBox}

            <img src="${post.image}" alt="${escapeAttr(post.imageAlt || post.title)}" class="blog-post-featured-image reveal-up delay-100" loading="lazy" decoding="async">

            <div class="blog-post-content reveal-up delay-200">
                ${htmlContent}
            </div>
${buildFaqHTML(post)}

            <footer class="blog-post-footer reveal-up delay-300">
                <div class="blog-post-tags">
                    ${post.tags.map(tag => `<span class="blog-tag">${tag}</span>`).join('')}
                </div>
                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button id="print-button" class="btn btn-ghost" title="Print or download this article as PDF">
                        <span>🖨️</span>
                        <span>Print / Download</span>
                    </button>
                    <button id="share-button" class="btn btn-ghost" title="Share this article">
                        <span>📤</span>
                        <span>Share</span>
                    </button>
                </div>
            </footer>
        </article>

        ${autoFooterBox ? autoFooterBox : ''}

${engagementSection(`/blog/${post.slug}/`, { noun: 'post' })}
        <section class="section cta-band reveal-up">
            <div class="cta-inner">
                <span class="section-eyebrow">Connect with Bayezid</span>
                <h2>Building something worth writing about?</h2>
                <p>These posts come out of real client builds. Tell me what you're trying to fix or launch and you'll get an honest answer about fit.</p>
                <a href="/contact.html" class="btn btn-primary btn-lg" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project<span class="btn-arrow">→</span></a>
            </div>
        </section>

${buildRelatedHTML(post, allPosts)}
    </main>

    <footer class="site-footer" id="main-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-word"><span class="brand-pulse-sm"></span>Connect<em>with</em>Bayezid</span>
          <p>Founder-led digital systems — web, SEO, marketing, product.</p>
          <address class="footer-address">Aulibad, Kalihati, Tangail — 1970<br />Parkhi Union, Kalihati Upazila, Tangail District, Bangladesh</address>
          <div class="social-row">
            <a class="social-link" href="https://github.com/Sayadbayezid" target="_blank" rel="noopener" aria-label="GitHub">GH</a>
            <a class="social-link" href="/verified-profiles/" aria-label="Verified profiles">ID</a>
            <a class="social-link" href="https://docs.smartgentools.com/" target="_blank" rel="noopener" aria-label="SmartGen Docs">DC</a>
            <a class="social-link" href="mailto:cwb.agency@outlook.com" aria-label="Email">@</a>
          </div>
        </div>
        <div class="footer-cols">
          <div>
            <span class="footer-heading">Work</span>
            <a href="/services.html">Services</a>
            <a href="/products.html">Products</a>
            <a href="/projects.html">All projects</a>
            <a href="/case-studies/">Case studies</a>
            <a href="/proofline-atlas.html">Proofline Atlas</a>
          </div>
          <div>
            <span class="footer-heading">Studio</span>
            <a href="/about.html">About</a>
            <a href="/blog/">Blog</a>
            <a href="/editorial-policy.html">Editorial guidelines</a>
            <a href="/authors.html">Authors &amp; team</a>
            <a href="/verified-profiles/">Verified profiles</a>
            <a href="/contact.html">Contact</a>
          </div>
          <div>
            <span class="footer-heading">Live builds</span>
            <a href="https://demu.sayadbayezid.com" target="_blank" rel="noopener">Developer demos</a>
            <a href="https://www.smartgentools.com" target="_blank" rel="noopener">SmartGen</a>
            <a href="https://docs.smartgentools.com/" target="_blank" rel="noopener">SmartGen Docs</a>
            <a href="https://leads.sayadbayezid.com/" target="_blank" rel="noopener">Boyok Leads</a>
          </div>
        </div>
      </div>
      <div class="footer-legal">
        <a href="/privacy-policy.html">Privacy Policy</a>
        <a href="/terms-of-service.html">Terms of Service</a>
        <a href="/business-integration-policy.html">Imprint &amp; business policy</a>
        <a href="/contact.html">Contact</a>
        <span>© <span id="footerYear"></span> Sayad Md Bayezid Hosan — Connect with Bayezid</span>
      </div>
    </footer>
    <script src="/assets/main.js" defer></script>

    <div id="shareModal" class="share-modal">
        <div class="share-modal-content">
            <span class="share-close">&times;</span>
            <h3>Share this article</h3>
            <div class="share-buttons">
                <button onclick="shareTo('facebook')" class="share-btn fb">📘 Facebook</button>
                <button onclick="shareTo('twitter')" class="share-btn tw">𝕏 Twitter</button>
                <button onclick="shareTo('linkedin')" class="share-btn li">💼 LinkedIn</button>
                <button onclick="shareTo('whatsapp')" class="share-btn wa">💬 WhatsApp</button>
                <button onclick="shareTo('copy')" class="share-btn copy">🔗 Copy Link</button>
            </div>
        </div>
    </div>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const printBtn = document.getElementById('print-button');
            if (printBtn) {
                printBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    window.print();
                });
            }
            
            const shareBtn = document.getElementById('share-button');
            const modal = document.getElementById('shareModal');
            const closeBtn = document.querySelector('.share-close');
            
            if (shareBtn && modal) {
                shareBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    modal.classList.add('show');
                });
                
                closeBtn.addEventListener('click', function() {
                    modal.classList.remove('show');
                });
                
                window.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        modal.classList.remove('show');
                    }
                });
            }
        });

        // Copy a code sample. Uses the async clipboard API with a
        // document.execCommand fallback, because the async one is unavailable
        // on any page not served over https — including a local preview.
        document.addEventListener('click', function (event) {
            const button = event.target.closest('.code-copy');
            if (!button) return;
            const code = button.closest('.code-block').querySelector('code');
            if (!code) return;
            const text = code.innerText;

            const done = function (ok) {
                button.textContent = ok ? 'Copied' : 'Press Ctrl+C';
                button.classList.toggle('is-copied', ok);
                setTimeout(function () {
                    button.textContent = 'Copy';
                    button.classList.remove('is-copied');
                }, 2000);
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
                return;
            }
            const scratch = document.createElement('textarea');
            scratch.value = text;
            scratch.setAttribute('readonly', '');
            scratch.style.position = 'fixed';
            scratch.style.opacity = '0';
            document.body.appendChild(scratch);
            scratch.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (error) { ok = false; }
            document.body.removeChild(scratch);
            done(ok);
        });

        function shareTo(platform) {
            const url = encodeURIComponent(window.location.href);
            const title = encodeURIComponent(document.title);
            let shareUrl = '';
            
            switch(platform) {
                case 'facebook':
                    shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
                    break;
                case 'twitter':
                    shareUrl = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + title;
                    break;
                case 'linkedin':
                    shareUrl = 'https://www.linkedin.com/shareArticle?mini=true&url=' + url + '&title=' + title;
                    break;
                case 'whatsapp':
                    shareUrl = 'https://api.whatsapp.com/send?text=' + title + ' ' + url;
                    break;
                case 'copy':
                    navigator.clipboard.writeText(window.location.href).then(() => {
                        alert('✅ Link copied to clipboard!');
                    }).catch(err => {
                        console.error('Failed to copy: ', err);
                    });
                    return; 
            }
            
            if (shareUrl) {
                window.open(shareUrl, '_blank', 'width=600,height=500,scrollbars=no,resizable=no');
            }
        }
    </script>
</body>
</html>`;

  return html;
}

/**
 * Generate the main Blog Archive page
 */
function generateArchiveHTML() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    ${GTM_HEAD}
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blog - ${AUTHOR_NAME} | Digital Marketing & Web Development Insights</title>
    <meta name="description" content="Explore the official blog of Sayad Md Bayezid Hosan for the latest tutorials, digital marketing insights, and full-stack web development updates.">
    
    <meta property="og:title" content="${AUTHOR_NAME} Blog - Tech & Marketing Insights">
    <meta property="og:description" content="Expert tutorials and insights on web utilities, SEO, and digital growth.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE_URL}/blog/">
    <meta property="og:image" content="${SITE_URL}/assets/images/blog-og.jpg">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${AUTHOR_NAME} Blog">
    <meta name="twitter:description" content="Expert tutorials and insights on web utilities, SEO, and digital growth.">
    
    <link rel="canonical" href="${SITE_URL}/blog/">
    <meta name="robots" content="index, follow, max-image-preview:large">
    
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": "${AUTHOR_NAME} Blog",
        "description": "Digital marketing and full-stack web development insights.",
        "url": "${SITE_URL}/blog/",
        "publisher": {
            "@type": "Person",
            "name": "${AUTHOR_NAME}",
            "url": "${SITE_URL}"
        }
    }
    </script>

    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,650&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/style.css">
    <link rel="stylesheet" href="/assets/css/blog.css">
    
    <script src="/assets/js/blog.js" defer></script>

    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9789336661158068" crossorigin="anonymous"></script>
</head>
<body>
    ${GTM_NOSCRIPT}
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" id="siteHeader">
      <div class="header-inner">
        <a href="/" class="brand-mark"><img src="/assets/connect-with-bayezid-logo.svg" alt="Connect with Bayezid" class="brand-logo" width="172" height="34" /></a>
        <nav class="main-nav" id="mainNav">
          <a href="/services.html">Services</a>
          <a href="/products.html">Products</a>
          <a href="/projects.html">Projects</a>
          <a href="/case-studies/">Case Studies</a>
          <a href="/blog/" aria-current="page">Blog</a>
          <a href="/about.html">About</a>
          <a href="/client-login.html" class="nav-login-link">Client Login</a>
          <a href="/contact.html" class="nav-cta" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project</a>
        </nav>
        <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>

    <main>
        <section class="blog-hero reveal-up">
            <div class="container">
                <h1 class="blog-hero-title">📖 Portfolio Blog</h1>
                <p class="blog-hero-subtitle">Discover expert insights, step-by-step tutorials, and the latest projects from Connect with Bayezid.</p>
                
                <div class="blog-search-bar reveal-up delay-100">
                    <input type="text" id="blog-search-input" placeholder="Search posts..." class="blog-search-input">
                </div>
                
                <div id="blog-filters" class="blog-filters reveal-up delay-200">
                    </div>
            </div>
        </section>

        <section class="container reveal-up delay-300">
            <div id="blog-grid" class="blog-grid">
                <div class="loading-spinner" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <p>✨ Loading amazing stories...</p>
                </div>
            </div>
        </section>
        
        <section class="section cta-band reveal-up">
            <div class="cta-inner">
                <span class="section-eyebrow">Connect with Bayezid</span>
                <h2>Building something worth writing about?</h2>
                <p>These posts come out of real client builds. Tell me what you're trying to fix or launch and you'll get an honest answer about fit.</p>
                <a href="/contact.html" class="btn btn-primary btn-lg" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project<span class="btn-arrow">→</span></a>
            </div>
        </section>

    </main>

    <footer class="site-footer" id="main-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-word"><span class="brand-pulse-sm"></span>Connect<em>with</em>Bayezid</span>
          <p>Founder-led digital systems — web, SEO, marketing, product.</p>
          <address class="footer-address">Aulibad, Kalihati, Tangail — 1970<br />Parkhi Union, Kalihati Upazila, Tangail District, Bangladesh</address>
          <div class="social-row">
            <a class="social-link" href="https://github.com/Sayadbayezid" target="_blank" rel="noopener" aria-label="GitHub">GH</a>
            <a class="social-link" href="/verified-profiles/" aria-label="Verified profiles">ID</a>
            <a class="social-link" href="https://docs.smartgentools.com/" target="_blank" rel="noopener" aria-label="SmartGen Docs">DC</a>
            <a class="social-link" href="mailto:cwb.agency@outlook.com" aria-label="Email">@</a>
          </div>
        </div>
        <div class="footer-cols">
          <div>
            <span class="footer-heading">Work</span>
            <a href="/services.html">Services</a>
            <a href="/products.html">Products</a>
            <a href="/projects.html">All projects</a>
            <a href="/case-studies/">Case studies</a>
            <a href="/proofline-atlas.html">Proofline Atlas</a>
          </div>
          <div>
            <span class="footer-heading">Studio</span>
            <a href="/about.html">About</a>
            <a href="/blog/">Blog</a>
            <a href="/editorial-policy.html">Editorial guidelines</a>
            <a href="/authors.html">Authors &amp; team</a>
            <a href="/verified-profiles/">Verified profiles</a>
            <a href="/contact.html">Contact</a>
          </div>
          <div>
            <span class="footer-heading">Live builds</span>
            <a href="https://demu.sayadbayezid.com" target="_blank" rel="noopener">Developer demos</a>
            <a href="https://www.smartgentools.com" target="_blank" rel="noopener">SmartGen</a>
            <a href="https://docs.smartgentools.com/" target="_blank" rel="noopener">SmartGen Docs</a>
            <a href="https://leads.sayadbayezid.com/" target="_blank" rel="noopener">Boyok Leads</a>
          </div>
        </div>
      </div>
      <div class="footer-legal">
        <a href="/privacy-policy.html">Privacy Policy</a>
        <a href="/terms-of-service.html">Terms of Service</a>
        <a href="/business-integration-policy.html">Imprint &amp; business policy</a>
        <a href="/contact.html">Contact</a>
        <span>© <span id="footerYear"></span> Sayad Md Bayezid Hosan — Connect with Bayezid</span>
      </div>
    </footer>
    <script src="/assets/main.js" defer></script>
</body>
</html>`;

  return html;
}

/**
 * Generate blog.json metadata file
 */
function generateBlogJSON(posts) {
  return JSON.stringify(posts, null, 2);
}

/**
 * Normalise a front-matter date to W3C YYYY-MM-DD, or return null if it can't
 * be parsed. Accepts a Date, an ISO string, or a human-written form such as
 * "July 27, 2026".
 */
function toW3CDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;          // already W3C
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.split('T')[0]; // ISO datetime
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}


/**
 * Rewrite the "Journal" grid on the homepage with the latest posts.
 *
 * That grid used to be hand-written HTML, so publishing a post updated
 * /blog/ and the sitemap but never the homepage — the newest post simply
 * never appeared where most visitors would look for it.
 *
 * Only the contents of <div class="post-grid"> inside <section id="journal">
 * are replaced. The heading, the eyebrow and the "All posts" link are left
 * alone: they are editorial copy, not generated content. Running this twice
 * produces the same file, because the grid is rebuilt from posts rather than
 * appended to.
 */
function updateHomepageJournal(posts) {
  const homepagePath = path.join(__dirname, '../index.html');
  if (!fs.existsSync(homepagePath)) {
    console.log('⚠️  index.html not found at root. Skipping homepage journal update.');
    return;
  }

  const latest = posts.slice(0, HOMEPAGE_POST_COUNT);
  if (!latest.length) {
    console.log('⚠️  No posts to show on the homepage. Leaving the journal grid as it is.');
    return;
  }

  const html = fs.readFileSync(homepagePath, 'utf8');

  // Anchored on the journal section so a .post-grid elsewhere on the page can
  // never be clobbered by accident.
  const sectionRegex = /(<section class="section" id="journal">[\s\S]*?<div class="post-grid">)([\s\S]*?)(<\/div>\s*<\/section>)/;
  const match = html.match(sectionRegex);
  if (!match) {
    console.log('⚠️  Could not find the journal post-grid in index.html. Skipping.');
    return;
  }

  const cards = latest.map(post => {
    const label = [titleCase(post.category), formatCardDate(post.date)].filter(Boolean).join(' · ');
    return `        <a href="/blog/${escapeAttr(post.slug)}/" class="post-card reveal" data-reveal>
          <span class="post-meta">${escapeText(label)}</span>
          <h3>${escapeText(post.title)}</h3>
          <p>${escapeText(truncate(post.description || '', 165))}</p>
          <span class="work-link">Read the post <span class="btn-arrow">→</span></span>
        </a>`;
  }).join('\n');

  const updated = html.replace(sectionRegex, `$1\n${cards}\n      $3`);
  if (updated === html) {
    console.log('ℹ️  Homepage journal already up to date.');
    return;
  }

  fs.writeFileSync(homepagePath, updated);
  console.log(`✅ Updated: / homepage journal grid (${latest.length} latest posts)`);
}

/**
 * "2026-09-06" -> "6 Sep 2026". Returns '' for anything unparseable.
 *
 * en-US rather than en-GB purely for the month abbreviation: en-GB renders
 * September as "Sept", which would sit next to the existing "Jul" and "Jun"
 * cards at a different width. en-US gives three letters for every month.
 */
function formatCardDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const [month, day, year] = parsed
    .toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .replace(',', '')
    .split(' ');
  return `${day} ${month} ${year}`;
}

/** Categories come from front matter in whatever case the author typed. */
function titleCase(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Cut on a word boundary so a card never ends mid-word. */
function truncate(text, max) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
}

function escapeText(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return escapeText(str).replace(/"/g, '&quot;');
}

/**
 * Update sitemap.xml with blog posts
 */
function updateSitemap(posts) {
  const sitemapPath = path.join(__dirname, '../sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    console.log('⚠️  sitemap.xml not found at root. Skipping sitemap update.');
    return;
  }

  let sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  const today = new Date().toISOString().split('T')[0];

  const urlRegex = /\s*<url>\s*<loc>https:\/\/sayadbayezid\.com\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>/g;
  sitemapContent = sitemapContent.replace(urlRegex, '');

  sitemapContent = sitemapContent.replace(/\n\s*\n/g, '\n');

  let blogEntries = '';
  
  if (!sitemapContent.includes('https://www.sayadbayezid.com/blog/')) {
    blogEntries += `  <url>
    <loc>${SITE_URL}/blog/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
  }

  posts.forEach(post => {
    // <lastmod> must be a W3C date (YYYY-MM-DD). A human-written front-matter
    // date like "July 27, 2026" is silently ignored by crawlers, so normalise
    // it here rather than trusting every post author to get the format right.
    // Prefer the last edit: <lastmod> is a claim about the content, and a
    // post that was revised but still reports its original date reads as
    // stale to a crawler deciding whether to recrawl.
    const postDate = toW3CDate(post.updated || post.date) || today;

    // Image and video entries, so the post's media can be discovered and
    // appear in image and video search. Only what the post actually declares:
    // an <image:image> pointing at a file that does not exist is worse than
    // no entry at all.
    const media = [];
    const cover = absoluteUrl(post.image);
    if (cover && !cover.endsWith('/assets/images/blog-default.svg')) {
      media.push(`    <image:image>
      <image:loc>${escapeXml(cover)}</image:loc>
      <image:title>${escapeXml(post.imageAlt || post.title)}</image:title>
    </image:image>`);
    }
    (post.images || []).forEach((img) => {
      const url = absoluteUrl(img.url);
      if (!url) return;
      media.push(`    <image:image>
      <image:loc>${escapeXml(url)}</image:loc>
      <image:title>${escapeXml(img.alt || img.caption || post.title)}</image:title>
    </image:image>`);
    });
    if (post.video && post.video.url) {
      const v = post.video;
      media.push(`    <video:video>
      <video:thumbnail_loc>${escapeXml(absoluteUrl(v.thumbnail || post.image))}</video:thumbnail_loc>
      <video:title>${escapeXml(v.name || post.title)}</video:title>
      <video:description>${escapeXml(v.description || post.description)}</video:description>
      <video:content_loc>${escapeXml(absoluteUrl(v.url))}</video:content_loc>
      <video:publication_date>${escapeXml(toW3CDate(v.uploadDate || post.date) || postDate)}</video:publication_date>
    </video:video>`);
    }

    blogEntries += `  <url>
    <loc>${SITE_URL}/blog/${post.slug}/</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
${media.length ? media.join('\n') + '\n' : ''}  </url>\n`;
  });

  // Declaring a namespace that is used nowhere is harmless; using one that is
  // not declared makes the entire sitemap invalid, and Search Console rejects
  // the file rather than the offending entry.
  if (!sitemapContent.includes('xmlns:video=')) {
    sitemapContent = sitemapContent.replace(
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"',
    );
  }

  if (sitemapContent.includes('</urlset>')) {
    sitemapContent = sitemapContent.replace('</urlset>', `${blogEntries}</urlset>`);
    sitemapContent = sitemapContent.replace(/<\/url>\s*<url>/g, '</url>\n  <url>');
    fs.writeFileSync(sitemapPath, sitemapContent);
    console.log(`✅ Updated: sitemap.xml with ${posts.length} blog posts\n`);
  } else {
    console.log('⚠️  Could not find </urlset> in sitemap.xml. Sitemap update failed.');
  }
}

/**
 * Main build function
 */
function buildBlog() {
  console.log('🚀 Starting Portfolio Blog Build...\n');

  const posts = readBlogPosts();
  console.log(`✅ Found ${posts.length} blog post(s)\n`);

  if (posts.length === 0) {
    console.log('⚠️  No blog posts found. Create .md files in blog-posts/ directory.');
    console.log('📝 Example: blog-posts/my-first-post.md\n');
  }

  posts.forEach(post => {
    const postDir = path.join(BLOG_OUTPUT_DIR, post.slug);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    let postHTML = generatePostHTML(post, posts);
    
    fs.writeFileSync(path.join(postDir, 'index.html'), postHTML);
    console.log(`✅ Generated: /blog/${post.slug}/index.html`);
  });

  const archiveHTML = generateArchiveHTML();
  fs.writeFileSync(path.join(BLOG_OUTPUT_DIR, 'index.html'), archiveHTML);
  console.log(`✅ Generated: /blog/index.html\n`);

  const blogJSON = generateBlogJSON(posts);
  fs.writeFileSync(path.join(BLOG_OUTPUT_DIR, 'blog.json'), blogJSON);
  console.log(`✅ Generated: /blog/blog.json\n`);

  updateSitemap(posts);
  updateHomepageJournal(posts);
  reportOrphanedPostDirs(posts);

  console.log('🎉 Blog build completed successfully!');
  console.log(`📊 Total posts: ${posts.length}`);
  console.log(`🌐 Blog URL: ${SITE_URL}/blog/\n`);
}

buildBlog();