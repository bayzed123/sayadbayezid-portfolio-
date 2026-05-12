import json
import os
import re
from bs4 import BeautifulSoup
from datetime import datetime

def generate_slug(title):
    slug = title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug

def process_html_file(file_path):
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
    
    # Extract content
    content_parts = []
    # Try to find main content areas
    sections = soup.find_all(['section', 'div'], class_=['content', 'container', 'article'])
    if not sections:
        sections = [soup.body] if soup.body else [soup]
        
    for section in sections:
        for p in section.find_all(['p', 'h2', 'h3', 'li', 'blockquote']):
            # Avoid duplicate text from nested elements
            if p.parent.name in ['p', 'li', 'blockquote']:
                continue
            text = p.get_text().strip()
            if text:
                content_parts.append(text)
    
    content = "\n\n".join(content_parts)
    
    # Extract FAQ
    faq = []
    accordions = soup.find_all(['button', 'div'], class_='accordion')
    panels = soup.find_all('div', class_='panel')
    for acc, panel in zip(accordions, panels):
        question = acc.get_text().replace('+', '').replace('-', '').strip()
        answer = panel.get_text().strip()
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
        "category": "General", # Default
        "date": date,
        "author": "Sayad Md Bayezid Hosan",
        "image": "https://i.postimg.cc/8zs6Nvj1/27029CEE-5CD8-43AE-85D0-51C18A4BF0C8-Original.png",
        "tags": tags,
        "faq": faq
    }
    
    return blog_data

def main():
    # Updated to process HTML files from blogs directory
    blogs_dir = 'blogs'
    json_dir = os.path.join(blogs_dir, 'json')
    index_path = os.path.join(json_dir, 'index.json')
    
    # Create directories if they don't exist
    if not os.path.exists(blogs_dir):
        os.makedirs(blogs_dir)
    if not os.path.exists(json_dir):
        os.makedirs(json_dir)
        
    if not os.path.exists(index_path):
        with open(index_path, 'w') as f:
            json.dump({"blogs": []}, f)
            
    with open(index_path, 'r') as f:
        index_data = json.load(f)
    
    new_blogs_added = False
    
    # Process all HTML files in the blogs directory
    for filename in os.listdir(blogs_dir):
        if filename.endswith('.html'):
            file_path = os.path.join(blogs_dir, filename)
            blog_data = process_html_file(file_path)
            
            if blog_data:
                slug = generate_slug(blog_data['title'])
                json_filename = f"{slug}.json"
                json_path = os.path.join(json_dir, json_filename)
                
                # Save individual JSON
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(blog_data, f, indent=2, ensure_ascii=False)
                
                # Update index
                exists = False
                for i, b in enumerate(index_data['blogs']):
                    if b['slug'] == slug:
                        index_data['blogs'][i] = {
                            "id": blog_data["id"],
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
        # Sort index by date
        index_data['blogs'].sort(key=lambda x: x['date'], reverse=True)
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        print("Updated index.json")
    else:
        print("No new HTML files found to process.")

if __name__ == "__main__":
    main()
