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

// Configuration
const BLOG_POSTS_DIR = path.join(__dirname, '../blog-posts');
const BLOG_OUTPUT_DIR = path.join(__dirname, '../blog');
const TEMPLATES_DIR = path.join(__dirname, '../templates');
const INCLUDES_DIR = path.join(__dirname, '../_includes');
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

  files.forEach(file => {
    const filePath = path.join(BLOG_POSTS_DIR, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { attributes: rawAttributes, body } = matter(fileContent);
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
    });
  });

  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
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
function generatePostHTML(post) {
  let htmlContent = marked(post.content);
  const authorProfileBox = loadAuthorProfileBox();
  const authorFooterBox = loadAuthorFooterBox();
  
  const hasManualProfile = post.content.includes('');
  const hasManualFooter = post.content.includes('');
  
  htmlContent = replaceManualTags(htmlContent, authorProfileBox, authorFooterBox);
  
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
    <meta property="og:image" content="${post.image}">
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}/">
    <meta property="og:type" content="article">
    <meta property="article:published_time" content="${post.date}">
    <meta property="article:author" content="${post.author}">
    
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${post.title}">
    <meta name="twitter:description" content="${post.description}">
    <meta name="twitter:image" content="${post.image}">
    
    <link rel="canonical" href="${SITE_URL}/blog/${post.slug}/">
    <meta name="robots" content="index, follow, max-image-preview:large">
    
    <script>
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            location.replace('https:' + location.href.substring(location.protocol.length));
        }
    </script>
    
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${post.title}",
        "description": "${post.description}",
        "image": "${post.image}",
        "datePublished": "${post.date}",
        "author": {
            "@type": "Person",
            "name": "${post.author}",
            "url": "${SITE_URL}/about/"
        },
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
            <header class="blog-post-header">
                <div class="blog-post-meta">
                    <time datetime="${post.date}">${new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                    <span class="meta-separator">•</span>
                    <span class="blog-post-category">${post.category}</span>
                    <span class="meta-separator">•</span>
                    <span class="blog-post-author">By ${post.author}</span>
                </div>
                <h1 class="blog-post-title">${post.title}</h1>
                <p class="blog-post-excerpt">${post.description}</p>
            </header>

            ${autoProfileBox}

            <img src="${post.image}" alt="${post.title}" class="blog-post-featured-image reveal-up delay-100">

            <div class="blog-post-content reveal-up delay-200">
                ${htmlContent}
            </div>

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

        <section class="section cta-band reveal-up">
            <div class="cta-inner">
                <span class="section-eyebrow">Connect with Bayezid</span>
                <h2>Building something worth writing about?</h2>
                <p>These posts come out of real client builds. Tell me what you're trying to fix or launch and you'll get an honest answer about fit.</p>
                <a href="/contact.html" class="btn btn-primary btn-lg" data-pixel-event="ContactIntent" data-pixel-custom="true">Start a project<span class="btn-arrow">→</span></a>
            </div>
        </section>

        <section class="blog-related-posts reveal-up" data-post-slug="${post.slug}" data-post-tags="${post.tags.join(',')}">
            <h2 class="related-posts-title">📚 Related Posts</h2>
            <div id="related-posts-grid" class="blog-grid">
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
    const postDate = toW3CDate(post.date) || today;
    blogEntries += `  <url>
    <loc>${SITE_URL}/blog/${post.slug}/</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
  });

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

    let postHTML = generatePostHTML(post);
    
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

  console.log('🎉 Blog build completed successfully!');
  console.log(`📊 Total posts: ${posts.length}`);
  console.log(`🌐 Blog URL: ${SITE_URL}/blog/\n`);
}

buildBlog();