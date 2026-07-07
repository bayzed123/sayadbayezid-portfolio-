  # 📁 Project Structure & Deployment Guide

  This document explains **every folder and file** in this repository, so anyone forking this project can understand the architecture and deploy it in minutes — no guesswork required.

  > 💡 New here? Start with **[QUICK_START.md](QUICK_START.md)** for the 5-minute setup. This document is for understanding *why* things are organized this way and how to deploy to production.

  ---

  ## 📂 Full Repository Structure

  ```text
  sayadbayezid-portfolio-/
  ├── .github/
  │   └── workflows/
  │       └── blog_automation.yml     # Auto-converts blog_uploads/ → blogs/*.json on push
  │
  ├── assets/                          # Images, icons, fonts, shared CSS/JS
  │   ├── css/
  │   ├── js/
  │   └── images/
  │
  ├── blog_uploads/                    # ✍️ WRITE new blog posts here (.html or .md)
  │
  ├── blogs/                           # ⚙️ AUTO-GENERATED — do not edit manually
  │   ├── index.json                   # List of all published posts
  │   └── your-post-slug.json          # One JSON file per blog post
  │
  ├── i18n/                            # Translation strings for multi-language support
  │
  ├── projects/                        # Individual project showcase pages/assets
  │
  ├── scripts/
  │   └── convert_blogs.py             # Python script: blog_uploads/ → blogs/*.json
  │
  ├── .gitignore
  ├── 404.html                         # Custom 404 error page
  ├── CNAME                            # Custom domain config (GitHub Pages)
  ├── LICENSE                          # Open-source license (attribution required)
  ├── README.md                        # Project overview (this repo's front page)
  ├── QUICK_START.md                    # 5-minute clone & customize guide
  ├── WIKI.md                           # Full technical documentation
  ├── setup.sh                          # Interactive personalization script
  ├── update_blog.sh                    # Helper script to trigger blog rebuild
  │
  ├── index.html                        # 🏠 Main portfolio homepage
  ├── blog.html                         # 📰 Blog listing page
  ├── blog-loader.html                  # 📄 Individual blog post template/renderer
  ├── blog-i18n.html                    # Blog page with translation support
  ├── contact.html                      # Contact form page
  ├── authorcard.html                   # Author bio card component
  ├── virtual-promote.html              # Promotional/landing page
  ├── privacy-policy.html               # Privacy policy page
  ├── Buymecoffe.html                   # "Buy me a coffee" support page
  │
  ├── robots.txt                        # SEO crawler rules
  └── sitemap.xml                       # SEO sitemap (auto-updated by blog automation)
  ```

  ---

  ## 🧩 How the Pieces Work Together

  ### 1. Static Pages (edit directly)

  These are hand-written HTML files you customize with your own content:

  | File | Purpose |
  |---|---|
  | `index.html` | Your main portfolio — hero, about, projects, services, contact |
  | `blog.html` | Blog listing/index page |
  | `contact.html` | Contact form |
  | `privacy-policy.html` | Legal page |
  | `404.html` | Custom error page |

  **You edit these directly** — no build step required.

  ### 2. The Blog System (automated pipeline)

  This is the only part of the site with a **build process**:

  ```text
  You write a .md or .html file
          ↓
  Place it in blog_uploads/
          ↓
  git push
          ↓
  GitHub Action (.github/workflows/blog_automation.yml) triggers
          ↓
  scripts/convert_blogs.py runs automatically
          ↓
  Generates JSON in blogs/
          ↓
  blog-loader.html fetches JSON and renders the live post
  ```

  **You never manually edit files inside `/blogs/`** — they're generated output, just like `/dist` in other frameworks.

  ### 3. `.github/workflows/blog_automation.yml`

  This GitHub Action is the "magic" that makes blogging effortless:

  - **Trigger:** Runs automatically on every `git push` that touches `blog_uploads/`
  - **Action:** Executes `python scripts/convert_blogs.py`
  - **Result:** Commits the generated JSON files back to the repo automatically

  You literally just write a Markdown file, push, and the blog updates itself.

  ---

  ## 🚀 Deployment Guide (Choose One)

  ### Option A — GitHub Pages (Recommended, Free, Zero Config)

  1. Fork this repository
  2. Go to **Settings → Pages**
  3. Under **Source**, select the `main` branch, root folder (`/`)
  4. Click **Save**
  5. Your site is live at:
     ```
     https://YOUR_USERNAME.github.io/sayadbayezid-portfolio-/
     ```

  **Using a custom domain?**
  - Edit the `CNAME` file and put your domain (e.g., `www.yourdomain.com`)
  - Add a `CNAME` DNS record at your domain registrar pointing to `YOUR_USERNAME.github.io`

  ---

  ### Option B — Netlify (Free, Auto-Deploy on Push)

  1. Go to [netlify.com](https://www.netlify.com/) → **New site from Git**
  2. Connect your forked GitHub repository
  3. Build settings:
     - **Build command:** *(leave empty — this is a static site)*
     - **Publish directory:** `/` (root)
  4. Click **Deploy**

  Every future `git push` will auto-redeploy.

  ---

  ### Option C — Vercel (Free, Fast CDN)

  1. Go to [vercel.com](https://vercel.com/) → **New Project**
  2. Import your forked repository
  3. Framework Preset: **Other** (static HTML)
  4. Click **Deploy**

  ---

  ### Option D — Custom Server / Own Hosting

  Since this is a **100% static site** (no server-side rendering, no database), you can deploy it anywhere that serves static files:

  ```bash
  # Example: deploy to any Linux server via rsync
  rsync -avz --exclude '.git' ./ user@yourserver.com:/var/www/html/
  ```

  Works on: Apache, Nginx, Cloudflare Pages, AWS S3 + CloudFront, Firebase Hosting, etc.

  ---

  ## ✅ Pre-Deployment Checklist

  Before going live, make sure you've done the following:

  - [ ] Ran `bash setup.sh` to personalize name, links, and social profiles
  - [ ] Updated `index.html` with your own About/Projects/Services content
  - [ ] Replaced placeholder images (`about.webp`, `home.webp`, `story.webp`, `gallery.webp`)
  - [ ] Updated `CNAME` file if using a custom domain (or deleted it if using default GitHub Pages URL)
  - [ ] Updated `LICENSE` with your name (required — see attribution terms)
  - [ ] Tested the blog system: added a test post to `blog_uploads/`, confirmed it built correctly
  - [ ] Checked `robots.txt` and `sitemap.xml` reference your correct domain
  - [ ] Removed/replaced `Backup before Ui-xi improve.html` and `index.html.backup` (development leftovers — safe to delete before going live)

  ---

  ## 🛠️ Local Development Setup

  ```bash
  # 1. Clone your fork
  git clone https://github.com/YOUR_USERNAME/sayadbayezid-portfolio-.git
  cd sayadbayezid-portfolio-

  # 2. Personalize everything interactively
  bash setup.sh

  # 3. Install blog system dependencies
  pip install beautifulsoup4 markdown

  # 4. Preview locally with any static server
  npx serve .
  # or
  python -m http.server 8000
  ```

  Visit `http://localhost:3000` (or `:8000`) to preview.

  ---

  ## ✍️ Adding Content — Quick Reference

  | I want to... | Do this |
  |---|---|
  | Edit my homepage | Open `index.html` directly |
  | Add a new blog post | Create `.md` or `.html` in `blog_uploads/`, then `git push` |
  | Add a new project | Add files to `projects/`, link it from `index.html` |
  | Change site-wide colors/fonts | Edit `assets/css/` |
  | Add a new language | Add translation file in `i18n/` |
  | Update contact info | Edit `contact.html` |

  ---

  ## 🤝 Contributing

  Found a bug or want to improve the blog automation script?

  1. Fork the repo
  2. Create a branch: `git checkout -b fix/your-fix-name`
  3. Commit your changes with a clear message
  4. Open a Pull Request

  Please **do not** submit PRs that remove the footer attribution credit — see `LICENSE` for attribution requirements.

  ---

  ## 📚 Further Reading

  | Document | When to Read It |
  |---|---|
  | **QUICK_START.md** | First time setting up — 5-minute walkthrough |
  | **WIKI.md** | Deep technical reference — blog system internals, troubleshooting |
  | **PROJECT_STRUCTURE.md** *(this file)* | Understanding architecture + deployment options |
  | **LICENSE** | Usage rights and attribution requirements |

  ---

  ## 🆘 Troubleshooting

  ### Blog post not showing up after push?
  Check the **Actions tab** on GitHub — confirm `blog_automation.yml` ran successfully (green ✅). If it failed, click into the log to see the Python error.

  ### GitHub Pages showing 404?
  Confirm **Settings → Pages** has the branch/folder set correctly, and wait 1–2 minutes for the first deploy to propagate.

  ### Custom domain not working?
  DNS changes can take up to 24 hours. Verify your `CNAME` file matches exactly what you set in your domain registrar's DNS records (no `https://`, no trailing slash).

  ---

  **Live demo:** [www.sayadbayezid.com](https://www.sayadbayezid.com)