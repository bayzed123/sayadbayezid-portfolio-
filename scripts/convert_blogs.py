import json
import os
import re
import markdown
from bs4 import BeautifulSoup
from datetime import datetime

def generate_slug(title):
    slug = title.lower().strip()
    # Remove emojis and other special characters
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace whitespace with hyphens
    slug = re.sub(r'\s+', '-', slug)
    # Collapse multiple hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug

def process_html_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')
        
        title_tag = soup.find('h1')
        if not title_tag:
            print(f"Skipping {file_path}: No <h1> found.")
            return None
        
        title = title_tag.get_text().strip()
        
        # Extract excerpt
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        excerpt = meta_desc['content'] if meta_desc else ""
        
        # Extract Table of Contents
        toc = []
        toc_section = soup.find('section', class_='toc')
        if toc_section:
            for link in toc_section.find_all('a'):
                toc.append({
                    "text": link.get_text().strip(),
                    "id": link.get('href', '').replace('#', '')
                })
        
        # Extract content
        content_parts = []
        # Try to find main content areas
        sections = soup.find_all(['section', 'div'], class_=['content', 'container', 'article'])
        if not sections:
            sections = [soup.body] if soup.body else [soup]
            
        for section in sections:
            # We want to preserve IDs for TOC links
            for elem in section.find_all(['p', 'h2', 'h3', 'li', 'blockquote', 'section']):
                if elem.name == 'section' and elem.get('id'):
                    # We'll use a marker for section IDs
                    content_parts.append(f"[[SECTION_ID:{elem.get('id')}]]")
                    continue
                
                if elem.parent.name in ['p', 'li', 'blockquote']:
                    continue
                
                # Convert <a> tags to text with URL if they aren't already URLs
                for a in elem.find_all('a'):
                    href = a.get('href', '')
                    if href and a.get_text().strip() != href and not href.startswith('#'):
                        if href not in a.get_text():
                            a.append(f" ({href})")
                
                text = elem.get_text().strip()
                if text:
                    if elem.name == 'h2':
                        content_parts.append(f"## {text}")
                    elif elem.name == 'h3':
                        content_parts.append(f"### {text}")
                    else:
                        content_parts.append(text)
        
        content = "\n\n".join(content_parts)
        
        # Extract FAQ
        faq = []
        accordions = soup.find_all(['button', 'div'], class_='accordion')
        panels = soup.find_all('div', class_='panel')
        for acc, panel in zip(accordions, panels):
            for a in panel.find_all('a'):
                href = a.get('href', '')
                if href and a.get_text().strip() != href and not href.startswith('#'):
                    if href not in a.get_text():
                        a.append(f" ({href})")
            
            question = acc.get_text().replace('+', '').replace('-', '').strip()
            answer = panel.get_text().strip()
            if question and answer:
                faq.append({"question": question, "answer": answer})
        
        # Extract tags
        meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
        tags = [t.strip() for t in meta_keywords['content'].split(',')] if meta_keywords else []
        
        # Date
        date = datetime.now().strftime('%Y-%m-%d')
        
        blog_data = {
            "id": int(datetime.now().timestamp()),
            "title": title,
            "excerpt": excerpt,
            "content": content,
            "toc": toc,
            "category": "General",
            "date": date,
            "author": "Sayad Md Bayezid Hosan",
            "image": "https://i.postimg.cc/8zs6Nvj1/27029CEE-5CD8-43AE-85D0-51C18A4BF0C8-Original.png",
            "tags": tags,
            "faq": faq
        }
        
        return blog_data
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def process_md_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # Parse frontmatter if exists, otherwise use simple parsing
        title = "Untitled Blog"
        excerpt = ""
        tags = []
        content = text
        
        # Simple title extraction from first # header
        title_match = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
        if title_match:
            title = title_match.group(1).strip()
            content = text.replace(title_match.group(0), "", 1).strip()
        
        # Extract excerpt (first paragraph)
        paragraphs = [p for p in content.split('\n\n') if p.strip() and not p.strip().startswith('#')]
        if paragraphs:
            excerpt = paragraphs[0][:160] + "..." if len(paragraphs[0]) > 160 else paragraphs[0]
        
        # Generate TOC from headers
        toc = []
        headers = re.findall(r'^(##|###)\s+(.+)$', content, re.MULTILINE)
        for level, header_text in headers:
            header_id = header_text.lower().strip().replace(' ', '-')
            header_id = re.sub(r'[^\w-]', '', header_id)
            toc.append({
                "text": header_text.strip(),
                "id": header_id
            })
            # Add ID markers to content
            content = content.replace(f"{level} {header_text}", f"[[SECTION_ID:{header_id}]]\n{level} {header_text}")

        blog_data = {
            "id": int(datetime.now().timestamp()),
            "title": title,
            "excerpt": excerpt,
            "content": content,
            "toc": toc,
            "category": "General",
            "date": datetime.now().strftime('%Y-%m-%d'),
            "author": "Sayad Md Bayezid Hosan",
            "image": "https://i.postimg.cc/8zs6Nvj1/27029CEE-5CD8-43AE-85D0-51C18A4BF0C8-Original.png",
            "tags": [],
            "faq": []
        }
        return blog_data
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None

def main():
    # Input directory where HTML files are uploaded
    uploads_dir = 'blog_uploads'
    # Output directory where JSON files and index.json are stored
    blogs_dir = 'blogs'
    index_path = os.path.join(blogs_dir, 'index.json')
    
    # Create directories if they don't exist
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    if not os.path.exists(blogs_dir):
        os.makedirs(blogs_dir)
        
    # Initialize or load index.json
    if not os.path.exists(index_path):
        index_data = {"blogs": []}
    else:
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                # Fix potential trailing characters or empty files
                if not content:
                    index_data = {"blogs": []}
                else:
                    # Try to find the last closing brace to fix corrupted JSON
                    last_brace = content.rfind('}')
                    if last_brace != -1:
                        content = content[:last_brace+1]
                    index_data = json.loads(content)
        except Exception as e:
            print(f"Error loading index.json: {e}. Resetting index.")
            index_data = {"blogs": []}
            
    new_blogs_added = False
    
    # Process all HTML and MD files in the uploads directory
    if os.path.exists(uploads_dir):
        for filename in os.listdir(uploads_dir):
            blog_data = None
            file_path = os.path.join(uploads_dir, filename)
            if filename.endswith('.html'):
                blog_data = process_html_file(file_path)
            elif filename.endswith('.md'):
                blog_data = process_md_file(file_path)
            
            if blog_data:
                slug = generate_slug(blog_data['title'])
                json_filename = f"{slug}.json"
                json_path = os.path.join(blogs_dir, json_filename)
                
                # Save individual JSON
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(blog_data, f, indent=2, ensure_ascii=False)
                
                # Update index
                exists = False
                for i, b in enumerate(index_data['blogs']):
                    if b['slug'] == slug:
                        index_data['blogs'][i] = {
                            "id": b.get("id", blog_data["id"]), # Keep original ID if exists
                            "title": blog_data["title"],
                            "excerpt": blog_data["excerpt"],
                            "category": blog_data["category"],
                            "date": blog_data["date"],
                            "image": blog_data["image"],
                            "slug": slug
                        }
                        exists = True
                        break
                
                if not exists:
                    index_data['blogs'].append({
                        "id": blog_data["id"],
                        "title": blog_data["title"],
                        "excerpt": blog_data["excerpt"],
                        "category": blog_data["category"],
                        "date": blog_data["date"],
                        "image": blog_data["image"],
                        "slug": slug
                    })
                
                new_blogs_added = True
                print(f"Processed: {filename} -> {json_filename}")
    
    if new_blogs_added:
        # Sort index by date (newest first)
        index_data['blogs'].sort(key=lambda x: x['date'], reverse=True)
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print(f"Updated {index_path}")
    else:
        print("No new HTML files found to process in blog_uploads/.")

if __name__ == "__main__":
    main()
