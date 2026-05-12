# Project Wiki: Sayad Md Bayezid Hosan's Portfolio Blog System

This wiki provides comprehensive documentation for the automated blog system integrated into Sayad Md Bayezid Hosan's personal portfolio website. It covers the architecture, setup, content creation guidelines, and troubleshooting for both HTML and Markdown-based blog posts.

## 1. System Architecture

The blog system operates on a content-driven architecture, where raw blog posts (HTML or Markdown) are converted into a standardized JSON format. This JSON data is then dynamically loaded and rendered by the `blog-loader.html` page, ensuring a consistent and efficient display across the website.

### 1.1 Key Components

*   **`blog_uploads/`**: This directory serves as the input for new or updated blog posts. Authors place their `.html` or `.md` files here.
*   **`scripts/convert_blogs.py`**: A Python script responsible for parsing the raw HTML or Markdown files, extracting relevant information (title, excerpt, content, TOC, FAQ), and converting them into individual JSON files.
*   **`blogs/`**: This directory stores the generated JSON files for each blog post (e.g., `my-blog-post.json`) and a central `index.json` file that lists all available blog posts.
*   **`.github/workflows/blog_automation.yml`**: A GitHub Actions workflow that automates the conversion process. It triggers on pushes to `blog_uploads/` and executes `scripts/convert_blogs.py`.
*   **`blog-loader.html`**: The front-end template responsible for fetching and rendering the JSON blog post data, including dynamic features like clickable links, Table of Contents, and interactive FAQs.

## 2. Content Creation Guidelines

Blog posts can be authored in either HTML or Markdown. Adhering to the following guidelines will ensure proper conversion and rendering.

### 2.1 HTML Blog Posts

When creating HTML blog posts in `blog_uploads/`, ensure the following structure:

*   **Title (`<h1>`):** The main title of your blog post should be enclosed in an `<h1>` tag.
*   **Excerpt (`<meta name="description">`):** Provide a concise summary of your post within the `<meta name="description">` tag in the `<head>` section.
*   **Table of Contents (`<section class="toc">`):** For an automatically generated Table of Contents, structure it as an unordered list (`<ul>`) within a `<section class="toc">`. Each list item (`<li>`) should contain an anchor tag (`<a>`) with an `href` attribute pointing to the corresponding section ID (e.g., `<a href="#section-id">Section Title</a>`).
*   **Content (`<p>`, `<h2>`, `<h3>`, `<li>`, `<blockquote>`):** Use standard HTML tags for your main content. The script will extract text from these elements. For sections you want linked in the TOC, ensure they have unique `id` attributes (e.g., `<section id="section-id">`).
*   **FAQ (`<button class="accordion">`, `<div class="panel">`):** For interactive FAQ sections, use the provided `accordion` button and `panel` div structure. The script will extract questions from the button and answers from the panel.
*   **Links (`<a>`):** Ensure all links use standard `<a>` tags with `href` attributes. The system will automatically make them clickable.

### 2.2 Markdown (.md) Blog Posts

When creating Markdown blog posts in `blog_uploads/`, follow standard Markdown syntax:

*   **Title (`#`):** Use a single `#` for the main title of your blog post.
*   **Sections (`##`, `###`):** Use `##` for main sections and `###` for sub-sections. The system will automatically generate a Table of Contents from these headers.
*   **Content:** Write your content using standard Markdown formatting for paragraphs, lists, code blocks, etc.
*   **Links:** Use standard Markdown link syntax `[Link Text](URL)`. The system will automatically convert these to clickable HTML links.
*   **Excerpt:** The first paragraph of your Markdown file will be used as the excerpt.
*   **FAQ:** Currently, there is no specific Markdown syntax for FAQ accordions. You can include FAQs as regular text or use a custom blockquote style to differentiate them.

## 3. Workflow for Publishing/Updating Blog Posts

1.  **Create/Edit File:** Write your blog post in `.html` or `.md` format and save it in the `blog_uploads/` directory.
2.  **Commit Changes:** Use Git to commit your changes:
    ```bash
    git add blog_uploads/your-new-post.md
    git commit -m "Add new blog post: Your Post Title"
    ```
3.  **Push to GitHub:** Push your committed changes to the `main` branch of your GitHub repository:
    ```bash
    git push origin main
    ```
4.  **GitHub Action Trigger:** The `blog_automation.yml` workflow will automatically detect the push to `blog_uploads/`.
5.  **Conversion:** The workflow will execute `scripts/convert_blogs.py`, which converts your `.html` or `.md` file into a JSON file in the `blogs/` directory and updates `blogs/index.json`.
6.  **Website Update:** The changes will be reflected on your live portfolio website.

## 4. Local Development and Testing

To test the conversion script locally:

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
    cd sayadbayezid-portfolio-
    ```
2.  **Install Dependencies:**
    ```bash
    pip install beautifulsoup4 markdown
    ```
3.  **Run Conversion Script:**
    ```bash
    python scripts/convert_blogs.py
    ```
    This will process all files in `blog_uploads/` and update the `blogs/` directory.

## 5. Troubleshooting

*   **Links not clickable:** Ensure your URLs are properly formatted (e.g., `https://example.com`). The `blog-loader.html` script automatically converts these. If you're using HTML, ensure `<a>` tags are correctly formed. If using Markdown, ensure `[Link Text](URL)` syntax is correct.
*   **TOC not appearing/incorrect:**
    *   **HTML:** Verify that your Table of Contents is within a `<section class="toc">` and that `<a>` tags correctly reference `id` attributes of your content sections.
    *   **Markdown:** Ensure you are using `##` and `###` headers for sections you want in the TOC.
*   **FAQ accordions not working:** Check that your HTML structure for FAQs matches the `<button class="accordion">` and `<div class="panel">` pattern. Ensure there are no JavaScript errors in your browser console.
*   **Blog post not appearing after push:**
    *   Verify that the file was pushed to `blog_uploads/`.
    *   Check the GitHub Actions tab in your repository to see if the `Blog Automation` workflow ran successfully. Look for any errors in the workflow logs.
    *   Ensure the `blog_automation.yml` workflow file is correctly configured as provided in the README.

If you encounter persistent issues, please open an issue on the GitHub repository with a detailed description of the problem.
