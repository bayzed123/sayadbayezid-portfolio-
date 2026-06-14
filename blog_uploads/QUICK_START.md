# Quick Start Guide - Clone & Customize in 5 Minutes

Welcome! This guide will help you clone this portfolio and personalize it for your own use in just a few minutes.

## Prerequisites

Before you start, make sure you have:
- **Git** installed ([Download Git](https://git-scm.com/))
- **Python 3.x** installed ([Download Python](https://www.python.org/downloads/))
- A **GitHub account** (optional, but recommended for forking)
- A **text editor** (VS Code, Sublime Text, or any editor you prefer)

## Step 1: Clone the Repository

Open your terminal and run:

```bash
git clone https://github.com/bayzed123/sayadbayezid-portfolio-.git
cd sayadbayezid-portfolio-
```

This creates a local copy of the entire portfolio on your computer.

## Step 2: Run the Setup Script

The setup script will automatically personalize all files with your information.

### On macOS/Linux:
```bash
bash setup.sh
```

### On Windows (using Git Bash or WSL):
```bash
bash setup.sh
```

### What the script does:
- Prompts you for your name, website, GitHub, LinkedIn, and other details
- Automatically updates all HTML files with your information
- Updates the LICENSE file with your name
- Updates the Python conversion script with your name

### Example prompts:
```
Enter your full name: John Doe
Enter your website URL: www.johndoe.com
Enter your GitHub username: johndoe
Enter your LinkedIn profile URL: linkedin.com/in/johndoe
Enter your email address: john@example.com
Enter your blog URL: johndoe.blogspot.com
```

## Step 3: Install Dependencies

The blog system requires Python dependencies. Install them:

```bash
pip install beautifulsoup4 markdown
```

## Step 4: Test the Blog System

Create a test blog post to ensure everything works:

1. Create a file named `test-post.md` in the `blog_uploads/` directory:

```markdown
# My First Blog Post

This is my first blog post using the automated blog system.

## Section 1
Content for section 1 goes here.

## Section 2
Content for section 2 goes here.
```

2. Run the conversion script:

```bash
python scripts/convert_blogs.py
```

3. Check the `blogs/` directory - you should see a new JSON file for your post.

## Step 5: Deploy Your Portfolio

Now you're ready to deploy! Here are some popular options:

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
2. Deploy to your hosting provider
3. Update DNS records to point to your hosting

## File Locations & What to Customize

Here's where to find and customize key elements:

| Element | File | Line(s) | What to Change |
|---------|------|---------|----------------|
| Main Portfolio Page | `index.html` | ~1-50 | Title, meta tags, hero section |
| Portfolio Content | `index.html` | ~100-1000 | About, projects, services sections |
| Blog Listing Page | `blog.html` | ~1-50 | Blog page title and styling |
| Blog Post Template | `blog-loader.html` | ~1-100 | Blog post styling and layout |
| Footer Credit | `index.html` | ~1102-1107 | Keep your name here (required) |
| License | `LICENSE` | ~1-50 | Your name and terms |
| Python Script | `scripts/convert_blogs.py` | ~108 | Author name in generated JSON |

## Adding Your Own Content

### 1. Update the Main Portfolio (index.html)

Open `index.html` and customize:
- **Hero Section**: Change the main headline and description
- **About Section**: Write your bio
- **Projects Section**: Add your projects
- **Services Section**: List your services
- **Contact Section**: Add your contact information

### 2. Add Blog Posts

Create blog posts in either format:

**Markdown (.md):**
```markdown
# Your Blog Title

Your introduction paragraph here.

## Main Section
Content for main section.

### Sub-section
More detailed content.

Check out this video: https://www.image2url.com/r2/default/videos/1778234182274-27bf1cc3-fc30-483b-b4ec-0ed606effe74.mov
```

**HTML:**
```html
<h1>Your Blog Title</h1>
<meta name="description" content="Your blog excerpt">
<section class="toc">
  <h3>Table of Contents</h3>
  <ul>
    <li><a href="#section1">Section 1</a></li>
  </ul>
</section>
<section id="section1">
  <h2>Section 1</h2>
  <p>Your content here</p>
  <p>Watch this video: https://www.image2url.com/r2/default/videos/1778234182274-27bf1cc3-fc30-483b-b4ec-0ed606effe74.mov</p>
</section>
```

**Video Embedding:** Simply paste the direct URL of your video (e.g., `https://example.com/your-video.mov`) anywhere in your blog content. The system will automatically detect and render it as an interactive video player.

Save to `blog_uploads/` and run `python scripts/convert_blogs.py`.

### 3. Update Social Links

Find and update these in `index.html`:
- GitHub: `github.com/yourusername`
- LinkedIn: `linkedin.com/in/yourprofile`
- Blog: `yourblog.blogspot.com`
- Email: `your.email@example.com`

## Project Structure

```
sayadbayezid-portfolio-/
├── index.html                 # Main portfolio page
├── blog.html                  # Blog listing page
├── blog-loader.html           # Individual blog post template
├── setup.sh                   # Personalization script
├── README.md                  # Project overview
├── WIKI.md                    # Technical documentation
├── QUICK_START.md            # This file
├── LICENSE                    # Open source license
├── blog_uploads/              # Upload blog posts here (.html or .md)
├── blogs/                     # Generated JSON blog files
│   ├── index.json            # Index of all blog posts
│   └── {blog-slug}.json      # Individual blog post JSON
├── scripts/
│   └── convert_blogs.py       # Blog conversion script
├── .github/
│   └── workflows/
│       └── blog_automation.yml # GitHub Actions workflow
└── assets/                    # Images, CSS, and other assets
```

## Troubleshooting

### Blog posts not appearing?
1. Ensure files are in `blog_uploads/` directory
2. Run `python scripts/convert_blogs.py`
3. Check that JSON files were created in `blogs/`
4. Verify `blogs/index.json` was updated

### Links not clickable in blog posts?
1. Ensure URLs are properly formatted (e.g., `https://example.com`)
2. For HTML, use proper `<a>` tags
3. For Markdown, use `[Link Text](URL)` syntax

### Setup script not working?
1. Ensure you're in the repository directory: `cd sayadbayezid-portfolio-`
2. Make script executable: `chmod +x setup.sh`
3. Run with bash: `bash setup.sh`

## Next Steps

1. ✅ Clone the repository
2. ✅ Run the setup script
3. ✅ Customize your content
4. ✅ Add your blog posts
5. ✅ Deploy to your hosting
6. ✅ Share your portfolio!

## Need Help?

- Read the full [WIKI.md](WIKI.md) for technical details
- Check the [README.md](README.md) for project overview
- Review the [LICENSE](LICENSE) for usage terms

## Attribution

This portfolio is open source and free to use. If you use this code, please keep the footer credit:

**"Portfolio & Blog System by [Your Name](https://yourwebsite.com)"**

This helps others discover this amazing portfolio template!

---

**Happy coding! **

For questions or improvements, feel free to open an issue or contribute to the project.