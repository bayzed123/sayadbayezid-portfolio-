# Sayad Md Bayezid Hosan - Professional Portfolio

**Author:** Sayad Md Bayezid Hosan  
**All Rights Reserved © 2026**

---

## 🚀 Quick Start (5 Minutes)

**New to this portfolio?** Get started in just 5 minutes:

```bash
git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
cd sayadbayezid-portfolio-
bash setup.sh
```

For detailed setup instructions, see **[QUICK_START.md](QUICK_START.md)**.

---

## 🌐 Live Demo
Check out the live portfolio at: **[www.sayadbayezid.com](https://www.sayadbayezid.com)**

---

## 📖 Documentation

Choose the documentation that fits your needs:

*   **[QUICK_START.md](QUICK_START.md)** - Clone and customize in 5 minutes (START HERE!)
*   **[README.md](README.md)** - Project overview and features (this file)
*   **[WIKI.md](WIKI.md)** - Complete technical guide and troubleshooting
*   **[LICENSE](LICENSE)** - Open source license with attribution requirements

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
    *   **HTML:** Place your `.html` file (e.g., `my-blog-post.html`) in the [`blog_uploads/`](blog_uploads/) directory. Ensure proper HTML structure, including `<h1>` for the title, `<meta name="description">` for the excerpt, `<section class="toc">` for the Table of Contents, and `<button class="accordion">` / `<div class="panel">` for FAQs.
    *   **Markdown:** Place your `.md` file (e.g., `my-markdown-post.md`) in the [`blog_uploads/`](blog_uploads/) directory. Use `#` for the main title, `##` for primary sections, and `###` for sub-sections. The system will automatically generate a TOC from `##` and `###` headers.

2.  **Commit and Push:** Commit your new or updated file to the `main` branch of this repository.

3.  **Automated Processing:** A GitHub Action ([`.github/workflows/blog_automation.yml`](.github/workflows/blog_automation.yml)) will automatically detect the changes, execute the [`scripts/convert_blogs.py`](scripts/convert_blogs.py) script, and convert your content into a JSON file within the [`blogs/`](blogs/) directory. It will also update [`blogs/index.json`](blogs/index.json).

4.  **Website Display:** The website will then dynamically load and display your new blog post, complete with all the enhanced features.

## Key Files & Customization Guide

| File/Directory | Purpose | Customize For |
|---|---|---|
| [`index.html`](index.html) | Main portfolio homepage | Your bio, projects, services, hero section |
| [`blog.html`](blog.html) | Blog listing page | Blog page styling and layout |
| [`blog-loader.html`](blog-loader.html) | Individual blog post template | Blog post styling and features |
| [`blog_uploads/`](blog_uploads/) | Upload location for new blog posts | Add your `.html` or `.md` blog posts here |
| [`blogs/`](blogs/) | Generated JSON blog files | Auto-generated (do not edit manually) |
| [`scripts/convert_blogs.py`](scripts/convert_blogs.py) | Blog conversion script | Author name (line 108) |
| [`.github/workflows/blog_automation.yml`](.github/workflows/blog_automation.yml) | GitHub Actions automation | Workflow triggers and dependencies |
| [`LICENSE`](LICENSE) | Open source license | Your name and attribution terms |
| [`setup.sh`](setup.sh) | Automated personalization script | Run this after cloning to customize |
| [`README.md`](README.md) | Project overview | This file |
| [`WIKI.md`](WIKI.md) | Technical documentation | Complete guide and troubleshooting |
| [`QUICK_START.md`](QUICK_START.md) | Quick start guide | Getting started in 5 minutes |

---

## Development & Customization

### Local Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
    cd sayadbayezid-portfolio-
    ```

2.  Run the setup script to personalize all files:
    ```bash
    bash setup.sh
    ```
    This will prompt you for your name, website, GitHub, LinkedIn, and other details, then automatically update all files.

3.  Install Python dependencies for the conversion script:
    ```bash
    pip install beautifulsoup4 markdown
    ```

4.  To manually convert blog posts (useful for local testing):
    ```bash
    python scripts/convert_blogs.py
    ```

### Customization Steps (A-Z)

**A. Update Your Personal Information**
- Run `bash setup.sh` to automatically update all files
- Or manually edit [`index.html`](index.html) (lines 1-100) with your details

**B. Customize the Hero Section**
- Edit [`index.html`](index.html) (lines 200-300)
- Change headline, subheading, and call-to-action button

**C. Update About Section**
- Edit [`index.html`](index.html) (lines 300-400)
- Replace with your bio and background

**D. Add Your Projects**
- Edit [`index.html`](index.html) (lines 500-700)
- Update project titles, descriptions, and links

**E. Update Services**
- Edit [`index.html`](index.html) (lines 400-500)
- List your services and expertise

**F. Add Social Links**
- Edit [`index.html`](index.html) (lines 1098-1101)
- Update GitHub, LinkedIn, Blog, and other social profiles

**G. Create Your First Blog Post**
- Create a file in [`blog_uploads/`](blog_uploads/) (e.g., `my-first-post.md`)
- Use Markdown or HTML format
- Run `python scripts/convert_blogs.py`

**H. Deploy to GitHub Pages**
- Push your repository to GitHub
- Go to Settings → Pages
- Select `main` branch as source
- Your portfolio will be live at `https://yourusername.github.io/sayadbayezid-portfolio-`

**I. Deploy to Netlify**
- Go to [Netlify](https://www.netlify.com/)
- Click "New site from Git"
- Connect your GitHub repository
- Netlify will automatically deploy

**J. Use Custom Domain**
- Purchase a domain (GoDaddy, Namecheap, etc.)
- Update DNS records to point to your hosting
- Deploy your portfolio to your hosting provider

### Project Structure

```
sayadbayezid-portfolio-/
├── index.html                      # Main portfolio page
├── blog.html                       # Blog listing page
├── blog-loader.html                # Individual blog post template
├── setup.sh                        # Personalization script
├── README.md                       # Project overview (this file)
├── WIKI.md                         # Technical documentation
├── QUICK_START.md                  # Quick start guide
├── LICENSE                         # Open source license
│
├── blog_uploads/                   # Upload blog posts here
│   ├── Data-analyses.html
│   ├── unveiling-the-digital-ecosystem.html
│   └── youtube_monetization_mega_guide_2026.html
│
├── blogs/                          # Generated JSON blog files
│   ├── index.json                 # Index of all blog posts
│   ├── data-analytics-for-beginners.json
│   └── {blog-slug}.json           # Individual blog post JSON files
│
├── scripts/
│   ├── convert_blogs.py            # Blog conversion script
│   ├── extract_images.py           # Image extraction utility
│   └── convert_blogs.py            # Main conversion script
│
├── .github/
│   └── workflows/
│       └── blog_automation.yml     # GitHub Actions workflow
│
└── assets/
    ├── images/                     # Portfolio images
    ├── styles/                     # CSS files
    └── js/                         # JavaScript files
```

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

## How to Use This Portfolio

### For Beginners
1. Start with **[QUICK_START.md](QUICK_START.md)** - It's the easiest way to get started
2. Run `bash setup.sh` to automatically personalize everything
3. Add your content to [`index.html`](index.html)
4. Deploy to GitHub Pages or Netlify

### For Developers
1. Clone the repository
2. Review **[WIKI.md](WIKI.md)** for technical details
3. Customize the blog system in [`scripts/convert_blogs.py`](scripts/convert_blogs.py)
4. Modify the GitHub Actions workflow in [`.github/workflows/blog_automation.yml`](.github/workflows/blog_automation.yml)
5. Deploy to your preferred hosting

### For Content Creators
1. Use the blog system to create posts in Markdown or HTML
2. Place files in [`blog_uploads/`](blog_uploads/)
3. Run `python scripts/convert_blogs.py` or push to GitHub to trigger automation
4. Your posts will automatically appear on the blog page

## Contributing

Feel free to fork the repository, make improvements, and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

If you use this portfolio, please keep the footer credit to help others discover this amazing template!

---

## Professional Links
- **Official Website:** [www.sayadbayezid.com](https://www.sayadbayezid.com)
- **Projects Blog:** [sayadbayezid.com/blog.html](https://sayadbayezid.com/blog.html)
- **Blog:** [connectwithbayezid.blogspot.com](https://connectwithbayezid.blogspot.com)
- **GitHub:** [github.com/bayzed123](https://github.com/bayzed123)
- **LinkedIn:** [linkedin.com/in/sayadbayezid](https://www.linkedin.com/in/sayadbayezid)
- **Crunchbase:** [crunchbase.com/person/sayad-md-bayezid-hosan](https://www.crunchbase.com/person/sayad-md-bayezid-hosan)

---

## 💖 Support the Project

If you find this portfolio and blog system helpful, consider supporting its development. Your appreciation keeps the project alive and free for everyone!

<div align="left">
  <a href="https://www.paypal.me/connectwithbayezid" target="_blank">
    <img src="https://raw.githubusercontent.com/bayzed123/sayadbayezid-portfolio-/main/assets/images/paypal_logo.png" width="150" alt="Support via PayPal">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.payoneer.com/" target="_blank">
    <img src="https://raw.githubusercontent.com/bayzed123/sayadbayezid-portfolio-/main/assets/images/payoneer_logo.png" width="150" alt="Support via Payoneer">
  </a>
</div>

*   **PayPal:** [@connectwithbayezid](https://www.paypal.me/connectwithbayezid)
*   **Payoneer:** `cwb.agency@outlook.com`

---

## Support & Resources

*   **Quick Start:** [QUICK_START.md](QUICK_START.md)
*   **Technical Guide:** [WIKI.md](WIKI.md)
*   **Blog System:** See [Blog System Workflow](#blog-system-workflow) section
*   **File Locations:** See [Key Files & Customization Guide](#key-files--customization-guide) section
*   **Troubleshooting:** See [WIKI.md](WIKI.md#5-troubleshooting)

## Contact

- **WhatsApp:** +880 1519 601517
- **Email:** Contact through website
- **Location:** Auliyabad, Kalihati, Tangail, Bangladesh

---

## License

This project is **Open Source** and free to use! See [LICENSE](LICENSE) for details.

**Important:** If you use this portfolio, you must keep the footer credit:
```
Portfolio & Blog System by Sayad Md Bayezid Hosan (https://www.sayadbayezid.com)
```

This helps others discover this amazing portfolio template and gives credit to the original creator.

---

## Getting Started Right Now

**Ready to create your portfolio?** Run these commands:

```bash
git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
cd sayadbayezid-portfolio-
bash setup.sh
```

Then follow the prompts to personalize your portfolio in 5 minutes!

---

**© 2026 Sayad Md Bayezid Hosan. All Rights Reserved.**

**Portfolio & Blog System by [Sayad Md Bayezid Hosan](https://www.sayadbayezid.com) | [Open Source](LICENSE)**
