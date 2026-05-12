from bs4 import BeautifulSoup
import os

def extract_images(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    images = []
    # Find all img tags
    for img in soup.find_all('img'):
        src = img.get('src')
        if src and src.startswith('http'):
            # Filter out small icons or manus logos
            if 'manus' not in src.lower() or 'postimg' in src:
                images.append(src)
    
    # Also look for background images in style attributes
    import re
    for tag in soup.find_all(style=True):
        style = tag['style']
        match = re.search(r'url\((.*?)\)', style)
        if match:
            url = match.group(1).strip("'\"")
            if url.startswith('http'):
                images.append(url)
    
    return list(set(images))

# Files to scan
files = [
    '/home/ubuntu/browser_html/bayezaarch-7cx7fyrv_manus_space_page_1778548511147.html',
    '/home/ubuntu/browser_html/bayezaarch-7cx7fyrv_manus_space_gallery_1778548528542.html'
]

all_images = []
for f in files:
    if os.path.exists(f):
        all_images.extend(extract_images(f))

# Remove duplicates and print
unique_images = list(set(all_images))
print("\n".join(unique_images))
