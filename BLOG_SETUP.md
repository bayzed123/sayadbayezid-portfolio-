# Blog System Setup Guide (Folder-Based)

## Overview

Your portfolio now uses a **folder-based blog system**. Instead of one giant `blogs.json` file, each blog post is stored as its own individual file in the `blogs/` folder. This makes it much easier to manage, edit, and add new content without scrolling through a massive file.

- **Main Blog Page** (`blog.html`) - Loads the list of blogs from `blogs/index.json`.
- **Individual Blog Files** (`blogs/*.json`) - Each post is a separate JSON file.
- **Blog Loader** (`blog-loader.html`) - Dynamically loads the specific blog file based on the URL.
- **Easy Management** - Just add a new file to the `blogs/` folder and update the index.

## File Structure

```
/
├── blog.html                 # Main blog listing page
├── blog-loader.html          # Template that loads individual blog files
├── blogs/                    # Folder containing all blog data
│   ├── index.json            # List of all blogs (for the main page)
│   ├── your-first-blog.json  # Individual blog data
│   └── another-blog.json     # Individual blog data
└── index.html                # Main portfolio page
```

## How to Add a New Blog Post

### Step 1: Create the Blog File
Create a new JSON file inside the `blogs/` folder. Name it using a "slug" (lowercase, hyphens instead of spaces, e.g., `my-new-blog-post.json`).

Copy this template into your new file:

```json
{
  "id": 2,
  "title": "Your Blog Post Title",
  "excerpt": "A short summary of your blog post (150-200 characters)",
  "content": "Full blog post content. Use paragraph breaks (\\n\\n) to separate paragraphs.",
  "category": "Web Development",
  "date": "2026-05-12",
  "author": "Sayad Md Bayezid Hosan",
  "image": "https://example.com/image.jpg",
  "tags": ["tag1", "tag2"],
  "faq": [
    {
      "question": "What is this about?",
      "answer": "This is the answer."
    }
  ]
}
```

### Step 2: Update the Index
Open `blogs/index.json` and add your new blog's metadata to the `blogs` array. This is what shows up on the main blog listing page.

```json
{
  "blogs": [
    {
      "id": 2,
      "title": "Your Blog Post Title",
      "excerpt": "A short summary...",
      "category": "Web Development",
      "date": "2026-05-12",
      "image": "https://example.com/image.jpg",
      "slug": "your-blog-post-title"
    },
    ... existing blogs ...
  ]
}
```
*Note: The `slug` must match the filename (without .json).*

### Step 3: Push to GitHub
```bash
git add blogs/
git commit -m "Add new blog: Your Blog Title"
git push origin main
```

## Why this is better?
1. **No more giant files**: Each blog is separate.
2. **Easier Editing**: Open exactly the file you want to change.
3. **Faster Loading**: The browser only downloads the specific blog post you are reading.
4. **Better Organization**: Keep your project clean.

---
**Last Updated:** May 12, 2026
