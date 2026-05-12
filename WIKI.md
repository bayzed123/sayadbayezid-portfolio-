# Project Wiki: Sayad Md Bayezid Hosan's Portfolio Blog System

This wiki provides comprehensive documentation for the automated blog system integrated into Sayad Md Bayezid Hosan's personal portfolio website. It covers the architecture, setup, content creation guidelines, and troubleshooting for both HTML and Markdown-based blog posts.

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Content Creation Guidelines](#2-content-creation-guidelines)
3. [Workflow for Publishing/Updating Blog Posts](#3-workflow-for-publishingupdating-blog-posts)
4. [Local Development and Testing](#4-local-development-and-testing)
5. [Troubleshooting](#5-troubleshooting)
6. [Complete File Reference Guide](#6-complete-file-reference-guide)
7. [Customization A-Z](#7-customization-a-z)
8. [Deployment Options](#8-deployment-options)

---

## 1. System Architecture

The blog system operates on a content-driven architecture, where raw blog posts (HTML or Markdown) are converted into a standardized JSON format. This JSON data is then dynamically loaded and rendered by the `blog-loader.html` page, ensuring a consistent and efficient display across the website.

### 1.1 Key Components

*   **[`blog_uploads/`](../blog_uploads/)**: This directory serves as the input for new or updated blog posts. Authors place their `.html` or `.md` files here.
*   **[`scripts/convert_blogs.py`](../scripts/convert_blogs.py)**: A Python script responsible for parsing the raw HTML or Markdown files, extracting relevant information (title, excerpt, content, TOC, FAQ), and converting them into individual JSON files.
*   **[`blogs/`](../blogs/)**: This directory stores the generated JSON files for each blog post (e.g., `my-blog-post.json`) and a central `index.json` file that lists all available blog posts.
*   **[`.github/workflows/blog_automation.yml`](../.github/workflows/blog_automation.yml)**: A GitHub Actions workflow that automates the conversion process. It triggers on pushes to `blog_uploads/` and executes `scripts/convert_blogs.py`.
*   **[`blog-loader.html`](../blog-loader.html)**: The front-end template responsible for fetching and rendering the JSON blog post data, including dynamic features like clickable links, Table of Contents, and interactive FAQs.

### 1.2 Data Flow

```
Raw Blog Post (.html or .md)
    ↓
[blog_uploads/] directory
    ↓
GitHub Action triggered (blog_automation.yml)
    ↓
scripts/convert_blogs.py executes
    ↓
JSON files generated
    ↓
[blogs/] directory (index.json + individual posts)
    ↓
blog-loader.html fetches and renders
    ↓
Live blog post on website
```

---

## 2. Content Creation Guidelines

Blog posts can be authored in either HTML or Markdown. Adhering to the following guidelines will ensure proper conversion and rendering.

### 2.1 HTML Blog Posts

When creating HTML blog posts in [`blog_uploads/`](../blog_uploads/), ensure the following structure:

**File Location:** `blog_uploads/your-blog-title.html`

**Required Elements:**

*   **Title (`<h1>`):** The main title of your blog post should be enclosed in an `<h1>` tag.
    ```html
    <h1>Your Blog Post Title</h1>
    ```

*   **Excerpt (`<meta name="description">`):** Provide a concise summary of your post within the `<meta name="description">` tag in the `<head>` section.
    ```html
    <meta name="description" content="A brief summary of your blog post">
    ```

*   **Table of Contents (`<section class="toc">`):** For an automatically generated Table of Contents, structure it as an unordered list (`<ul>`) within a `<section class="toc">`. Each list item (`<li>`) should contain an anchor tag (`<a>`) with an `href` attribute pointing to the corresponding section ID.
    ```html
    <section class="toc">
      <h3>Table of Contents</h3>
      <ul>
        <li><a href="#section1">Section 1</a></li>
        <li><a href="#section2">Section 2</a></li>
      </ul>
    </section>
    ```

*   **Content (`<p>`, `<h2>`, `<h3>`, `<li>`, `<blockquote>`):** Use standard HTML tags for your main content. The script will extract text from these elements. For sections you want linked in the TOC, ensure they have unique `id` attributes.
    ```html
    <section id="section1">
      <h2>Section 1</h2>
      <p>Your content here</p>
    </section>
    ```

*   **FAQ (`<button class="accordion">`, `<div class="panel">`):** For interactive FAQ sections, use the provided `accordion` button and `panel` div structure.
    ```html
    <button class="accordion">Q: Your Question Here?</button>
    <div class="panel"><p>A: Your answer here. You can include <a href="https://example.com">links</a>.</p></div>
    ```

*   **Links (`<a>`):** Ensure all links use standard `<a>` tags with `href` attributes. The system will automatically make them clickable.
    ```html
    <a href="https://example.com">Link Text</a>
    ```

**Example HTML Blog Post:**
See [`blog_uploads/Data-analyses.html`](../blog_uploads/Data-analyses.html) for a complete example.

### 2.2 Markdown (.md) Blog Posts

When creating Markdown blog posts in [`blog_uploads/`](../blog_uploads/), follow standard Markdown syntax:

**File Location:** `blog_uploads/your-blog-title.md`

**Structure:**

*   **Title (`#`):** Use a single `#` for the main title of your blog post.
    ```markdown
    # Your Blog Post Title
    ```

*   **Sections (`##`, `###`):** Use `##` for main sections and `###` for sub-sections. The system will automatically generate a Table of Contents from these headers.
    ```markdown
    ## Main Section
    Content here...

    ### Sub-section
    More content...
    ```

*   **Content:** Write your content using standard Markdown formatting for paragraphs, lists, code blocks, etc.
    ```markdown
    This is a paragraph.

    - Bullet point 1
    - Bullet point 2

    ```code block```
    ```

*   **Links:** Use standard Markdown link syntax. The system will automatically convert these to clickable HTML links.
    ```markdown
    [Link Text](https://example.com)
    ```

*   **Excerpt:** The first paragraph of your Markdown file will be used as the excerpt.

*   **FAQ:** Currently, there is no specific Markdown syntax for FAQ accordions. You can include FAQs as regular text or use a custom blockquote style to differentiate them.
    ```markdown
    > **Q: Your Question?**
    > A: Your answer here.
    ```

**Example Markdown Blog Post:**
```markdown
# Getting Started with Web Development

Web development is an exciting field that combines creativity with technical skills.

## HTML Basics

HTML is the foundation of web development. It provides the structure for web pages.

### Creating Your First HTML Page

Start with a simple HTML template and build from there.

## CSS Styling

CSS allows you to style your HTML elements beautifully.

### Colors and Fonts

Use CSS to customize colors, fonts, and layouts.
```

---

## 3. Workflow for Publishing/Updating Blog Posts

### Step-by-Step Process

1.  **Create/Edit File:** Write your blog post in `.html` or `.md` format and save it in the [`blog_uploads/`](../blog_uploads/) directory.

2.  **Commit Changes:** Use Git to commit your changes:
    ```bash
    git add blog_uploads/your-new-post.md
    git commit -m "Add new blog post: Your Post Title"
    ```

3.  **Push to GitHub:** Push your committed changes to the `main` branch of your GitHub repository:
    ```bash
    git push origin main
    ```

4.  **GitHub Action Trigger:** The [`blog_automation.yml`](../.github/workflows/blog_automation.yml) workflow will automatically detect the push to `blog_uploads/`.

5.  **Conversion:** The workflow will execute [`scripts/convert_blogs.py`](../scripts/convert_blogs.py), which converts your `.html` or `.md` file into a JSON file in the [`blogs/`](../blogs/) directory and updates [`blogs/index.json`](../blogs/index.json).

6.  **Website Update:** The changes will be reflected on your live portfolio website within a few seconds.

### GitHub Action Details

The workflow file is located at: [`.github/workflows/blog_automation.yml`](../.github/workflows/blog_automation.yml)

**Key Configuration:**
- **Triggers:** Pushes to `blog_uploads/` directory (`.html` or `.md` files)
- **Python Version:** 3.x
- **Dependencies:** `beautifulsoup4`, `markdown`
- **Script:** `python scripts/convert_blogs.py`

---

## 4. Local Development and Testing

To test the conversion script locally:

### 4.1 Clone Repository

```bash
git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
cd sayadbayezid-portfolio-
```

### 4.2 Install Dependencies

```bash
pip install beautifulsoup4 markdown
```

### 4.3 Run Conversion Script

```bash
python scripts/convert_blogs.py
```

This will process all files in [`blog_uploads/`](../blog_uploads/) and update the [`blogs/`](../blogs/) directory.

### 4.4 Test Blog Post

1. Create a test file: `blog_uploads/test-post.md`
2. Add content:
   ```markdown
   # Test Blog Post

   This is a test.

   ## Section 1
   Content here.
   ```
3. Run: `python scripts/convert_blogs.py`
4. Check: `blogs/test-blog-post.json` should be created

---

## 5. Troubleshooting

### Issue: Links not clickable

**Symptoms:** URLs in blog posts appear as plain text instead of clickable links.

**Solutions:**
- Ensure your URLs are properly formatted (e.g., `https://example.com`)
- For HTML, ensure `<a>` tags are correctly formed: `<a href="URL">Link Text</a>`
- For Markdown, ensure `[Link Text](URL)` syntax is correct
- Check that the `linkify()` function in [`blog-loader.html`](../blog-loader.html) is working (line ~555)

### Issue: TOC not appearing or incorrect

**Symptoms:** Table of Contents is missing or shows incorrect entries.

**Solutions:**
- **HTML:** Verify that your Table of Contents is within a `<section class="toc">` and that `<a>` tags correctly reference `id` attributes of your content sections
- **Markdown:** Ensure you are using `##` and `###` headers for sections you want in the TOC
- Check that section IDs match the href values in TOC links

### Issue: FAQ accordions not working

**Symptoms:** FAQ questions don't expand/collapse when clicked.

**Solutions:**
- Check that your HTML structure for FAQs matches the `<button class="accordion">` and `<div class="panel">` pattern
- Ensure there are no JavaScript errors in your browser console (F12 → Console)
- Verify that the `toggleFaq()` function in [`blog-loader.html`](../blog-loader.html) is being called (line ~746)

### Issue: Blog post not appearing after push

**Symptoms:** You pushed a blog post to `blog_uploads/` but it doesn't appear on the website.

**Solutions:**
- Verify that the file was pushed to `blog_uploads/` directory
- Check the GitHub Actions tab in your repository to see if the `Blog Automation` workflow ran successfully
- Look for any errors in the workflow logs
- Ensure the [`blog_automation.yml`](../.github/workflows/blog_automation.yml) workflow file is correctly configured
- Manually run `python scripts/convert_blogs.py` locally to test

### Issue: Conversion script errors

**Symptoms:** Running `python scripts/convert_blogs.py` produces errors.

**Solutions:**
- Ensure dependencies are installed: `pip install beautifulsoup4 markdown`
- Check that your HTML/Markdown files are valid
- Verify that the file encoding is UTF-8
- Check for special characters that might cause parsing issues

---

## 6. Complete File Reference Guide

### Main HTML Files

| File | Purpose | Key Sections |
|------|---------|--------------|
| [`index.html`](../index.html) | Main portfolio homepage | Hero, About, Projects, Services, Footer |
| [`blog.html`](../blog.html) | Blog listing page | Blog list, styling, navigation |
| [`blog-loader.html`](../blog-loader.html) | Blog post template | Blog content rendering, TOC, FAQ, Links |

### Blog System Files

| File | Purpose | Line Numbers |
|------|---------|--------------|
| [`blog_uploads/`](../blog_uploads/) | Input directory for blog posts | N/A |
| [`blogs/index.json`](../blogs/index.json) | Index of all blog posts | N/A |
| [`blogs/{slug}.json`](../blogs/) | Individual blog post JSON files | N/A |
| [`scripts/convert_blogs.py`](../scripts/convert_blogs.py) | Blog conversion script | 1-266 |

### Configuration Files

| File | Purpose | Key Settings |
|------|---------|--------------|
| [`.github/workflows/blog_automation.yml`](../.github/workflows/blog_automation.yml) | GitHub Actions workflow | Triggers, dependencies, script execution |
| [`LICENSE`](../LICENSE) | Open source license | Attribution requirements |
| [`setup.sh`](../setup.sh) | Personalization script | User input, file updates |

### Documentation Files

| File | Purpose |
|------|---------|
| [`README.md`](../README.md) | Project overview and quick start |
| [`WIKI.md`](../WIKI.md) | This file - complete technical guide |
| [`QUICK_START.md`](../QUICK_START.md) | 5-minute quick start guide |

---

## 7. Customization A-Z

### A. Update Your Name Throughout

**Files to update:**
- [`index.html`](../index.html) - Line ~1096
- [`blog.html`](../blog.html) - Line ~375
- [`blog-loader.html`](../blog-loader.html) - Line ~509
- [`scripts/convert_blogs.py`](../scripts/convert_blogs.py) - Line 108
- [`LICENSE`](../LICENSE) - Line ~3

**Or run:** `bash setup.sh`

### B. Update Your Website URL

**Files to update:**
- [`index.html`](../index.html) - Lines ~1103-1104
- [`blog.html`](../blog.html) - Line ~383
- [`blog-loader.html`](../blog-loader.html) - Line ~518
- [`LICENSE`](../LICENSE) - Line ~17

### C. Update Social Media Links

**File:** [`index.html`](../index.html) - Lines ~1098-1101

```html
<a href="https://github.com/yourusername">GitHub</a>
<a href="https://linkedin.com/in/yourprofile">LinkedIn</a>
```

### D. Customize Hero Section

**File:** [`index.html`](../index.html) - Lines ~200-300

Change:
- Main headline
- Subheading
- Call-to-action button text
- Background image

### E. Update About Section

**File:** [`index.html`](../index.html) - Lines ~300-400

Replace with your biography and background.

### F. Add Your Projects

**File:** [`index.html`](../index.html) - Lines ~500-700

Add project cards with:
- Project title
- Description
- Image
- Link

### G. Update Services

**File:** [`index.html`](../index.html) - Lines ~400-500

List your services and expertise.

### H. Customize Blog Styling

**File:** [`blog-loader.html`](../blog-loader.html) - Lines ~26-500 (CSS)

Modify:
- Colors
- Fonts
- Spacing
- Layout

### I. Add Custom JavaScript

**Files:** [`index.html`](../index.html), [`blog.html`](../blog.html), [`blog-loader.html`](../blog-loader.html)

Add custom scripts in the `<script>` tags at the end of each file.

### J. Update Footer

**Files to update:**
- [`index.html`](../index.html) - Lines ~1102-1107
- [`blog.html`](../blog.html) - Lines ~382-387
- [`blog-loader.html`](../blog-loader.html) - Lines ~517-521

**Important:** Keep the attribution credit to maintain open source compliance.

---

## 8. Deployment Options

### Option A: GitHub Pages (Free)

1. Push your repository to GitHub
2. Go to Settings → Pages
3. Select `main` branch as the source
4. Your portfolio will be live at `https://yourusername.github.io/sayadbayezid-portfolio-`

### Option B: Netlify (Free)

1. Go to [Netlify](https://www.netlify.com/)
2. Click "New site from Git"
3. Connect your GitHub repository
4. Netlify will automatically deploy your site

### Option C: Custom Domain (Paid)

1. Purchase a domain from a registrar (GoDaddy, Namecheap, etc.)
2. Deploy to your hosting provider (Bluehost, SiteGround, etc.)
3. Update DNS records to point to your hosting

### Option D: Vercel (Free)

1. Go to [Vercel](https://vercel.com/)
2. Import your GitHub repository
3. Vercel will automatically deploy your site

---

## Support the Project

If you find this portfolio system valuable, you can support the original creator:

<div align="left">
  <a href="https://www.paypal.me/connectwithbayezid" target="_blank">
    <img src="https://raw.githubusercontent.com/bayzed123/sayadbayezid-portfolio-/main/assets/images/paypal_logo.png" width="120" alt="Support via PayPal">
  </a>
  &nbsp;&nbsp;
  <a href="https://www.payoneer.com/" target="_blank">
    <img src="https://raw.githubusercontent.com/bayzed123/sayadbayezid-portfolio-/main/assets/images/payoneer_logo.png" width="120" alt="Support via Payoneer">
  </a>
</div>

*   **PayPal:** [@connectwithbayezid](https://www.paypal.me/connectwithbayezid)
*   **Payoneer:** `cwb.agency@outlook.com`

---

## Additional Resources

- **Quick Start Guide:** [QUICK_START.md](../QUICK_START.md)
- **README:** [README.md](../README.md)
- **License:** [LICENSE](../LICENSE)
- **Setup Script:** [`setup.sh`](../setup.sh)

For questions or issues, please open an issue on the GitHub repository.

---

**© 2026 Sayad Md Bayezid Hosan. All Rights Reserved.**

**Portfolio & Blog System by [Sayad Md Bayezid Hosan](https://www.sayadbayezid.com) | [Open Source](../LICENSE)**
