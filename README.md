# Sayad Md Bayezid Hosan - Professional Portfolio

**Author:** Sayad Md Bayezid Hosan  
**All Rights Reserved © 2026**

---

## 🌐 Live Demo
Check out the live portfolio at: **[www.sayadbayezid.com](https://www.sayadbayezid.com)**

---

## 📖 Documentation
For detailed information about the project architecture, blog system, and development workflow, please visit our **[Project Wiki](WIKI.md)**.

---

## About

I'm Sayad Md Bayezid Hosan, a technology entrepreneur, Tech Provider, and digital content creator based in Bangladesh. I specialize in integrating AI and modern web design to build efficient, scalable digital infrastructures.

Currently a final-year undergraduate student in the Department of English at Northern University Bangladesh (Expected Graduation: June 2026), I founded digital brands such as Connect With Bayezid and GenZ Frontier. I actively design websites and develop functional web tools, including utility applications like SmartGen advanced QR code generators.

As a professional within the digital ecosystem, I operate as a Technical Expert with a core focus on policy compliance, privacy, and transparency. I specialize in providing permission-based technical solutions and managing digital business assets with high integrity.

---

## Blog System Features

This portfolio website features a dynamic and automated blog system designed for ease of content management and enhanced user experience. Key features include:

*   **Automated Content Conversion:** Supports seamless conversion of blog posts from both HTML and Markdown (`.md`) formats into a structured JSON format, ready for display.
*   **Clickable Links:** All URLs embedded within blog post content and FAQ sections are automatically detected and rendered as clickable hyperlinks, improving navigability.
*   **Dynamic Table of Contents (TOC):** Blog posts are equipped with an automatically generated Table of Contents, allowing readers to quickly navigate through sections. For HTML-based posts, the TOC is extracted from a designated section; for Markdown posts, it's generated from `##` and `###` headers.
*   **Interactive FAQ Accordions:** Frequently Asked Questions are presented in an interactive accordion format, enhancing readability and user engagement.

## Blog System Workflow

To publish a new blog post or update an existing one, follow these steps:

1.  **Prepare Your Blog Post:** Create your blog content in either HTML or Markdown (`.md`) format.
    *   **HTML:** Place your `.html` file (e.g., `my-blog-post.html`) in the `blog_uploads/` directory. Ensure proper HTML structure, including `<h1>` for the title, `<meta name="description">` for the excerpt, `<section class="toc">` for the Table of Contents, and `<button class="accordion">` / `<div class="panel">` for FAQs.
    *   **Markdown:** Place your `.md` file (e.g., `my-markdown-post.md`) in the `blog_uploads/` directory. Use `#` for the main title, `##` for primary sections, and `###` for sub-sections. The system will automatically generate a TOC from `##` and `###` headers.

2.  **Commit and Push:** Commit your new or updated file to the `main` branch of this repository.

3.  **Automated Processing:** A GitHub Action (`.github/workflows/blog_automation.yml`) will automatically detect the changes, execute the `scripts/convert_blogs.py` script, and convert your content into a JSON file within the `blogs/` directory. It will also update `blogs/index.json`.

4.  **Website Display:** The website will then dynamically load and display your new blog post, complete with all the enhanced features.

---


---

## Services

- **Web Development** - Modern, responsive websites with React and Tailwind CSS
- **Digital Strategy** - SEO optimization and digital marketing
- **Social Media Management** - Content creation and community engagement
- **Technical Solutions** - Custom tools and applications for business needs

---

## Featured Projects

- **Connect With Bayezid** - Digital brand and content platform
- **GenZ Frontier** - Digital news portal for young audiences
- **SmartGen QR Tool** - Advanced QR code generator for business use

---

## Professional Links
- **Official Website:** [www.sayadbayezid.com](https://www.sayadbayezid.com)
- **Projects Blog:** [sayadbayezid.com/blog.html](https://sayadbayezid.com/blog.html)
- **Blog:** [connectwithbayezid.blogspot.com](https://connectwithbayezid.blogspot.com)
- **GitHub:** [github.com/bayzed123](https://github.com/bayzed123)
- **LinkedIn:** [linkedin.com/in/sayadbayezid](https://www.linkedin.com/in/sayadbayezid)
- **Crunchbase:** [crunchbase.com/person/sayad-md-bayezid-hosan](https://www.crunchbase.com/person/sayad-md-bayezid-hosan)

---

## Contact

- **WhatsApp:** +880 1519 601517
- **Email:** Contact through website
- **Location:** Auliyabad, Kalihati, Tangail, Bangladesh

---

## License

All content, design, and code in this portfolio are the exclusive property of **Sayad Md Bayezid Hosan**. All rights reserved. Unauthorized copying, reproduction, or commercial use is strictly prohibited.

---

**© 2026 Sayad Md Bayezid Hosan. All Rights Reserved.**
