/**
 * Connect with Bayezid - Portfolio Blog Frontend
 * Handles dynamic blog rendering, filtering, search, related posts, and scroll animations
 */

document.addEventListener('DOMContentLoaded', async () => {
  const blogGrid = document.getElementById('blog-grid');
  const filterContainer = document.getElementById('blog-filters');
  const relatedPostsGrid = document.getElementById('related-posts-grid');

  // Determine if we're on the archive page or a single post page
  if (blogGrid && filterContainer) {
    await initBlogArchive();
  } else if (relatedPostsGrid) {
    await initRelatedPosts();
  }

  // Initial trigger for elements already in viewport
  setTimeout(handleScrollReveal, 100);
});

/* ==========================================
   SCROLL REVEAL ANIMATION LOGIC
   ========================================== */
function handleScrollReveal() {
  const reveals = document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right');
  const windowHeight = window.innerHeight;
  const elementVisible = 100; // Trigger point (100px from bottom)

  reveals.forEach((reveal) => {
    const elementTop = reveal.getBoundingClientRect().top;
    if (elementTop < windowHeight - elementVisible) {
      reveal.classList.add('active');
    }
  });
}

// Listen to scroll events
window.addEventListener('scroll', handleScrollReveal);

/**
 * Fetch blog data from blog.json
 */
async function fetchBlogData() {
  try {
    const response = await fetch('/blog/blog.json');
    if (!response.ok) throw new Error('Failed to load blog data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching blog data:', error);
    return [];
  }
}

/**
 * Initialize the blog archive page
 */
async function initBlogArchive() {
  const blogGrid = document.getElementById('blog-grid');
  const filterContainer = document.getElementById('blog-filters');
  const blogSearchInput = document.getElementById('blog-search-input');
  const posts = await fetchBlogData();

  if (posts.length === 0) {
    blogGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 3rem;">No blog posts found yet. Check back soon!</p>';
    return;
  }

  // Custom Categories matching your portfolio niche + Dynamic Tags
  const allTags = new Set(['All', 'Digital Marketing', 'Web Development', 'Tech Tips']);
  posts.forEach(post => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => allTags.add(tag));
    }
  });

  // Render filter buttons
  renderFilters(Array.from(allTags));

  // Render all posts initially
  renderPosts(posts);

  // Filter event listeners
  filterContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tag')) {
      const selectedTag = e.target.getAttribute('data-tag');

      // Update active state
      document.querySelectorAll('.filter-tag').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');

      // Filter and render
      const filteredPosts = selectedTag === 'All'
        ? posts
        : posts.filter(post => post.tags && post.tags.includes(selectedTag));

      renderPosts(filteredPosts);
    }
  });

  // Search functionality
  if (blogSearchInput) {
    blogSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filteredPosts = posts.filter(post =>
        post.title.toLowerCase().includes(query) ||
        post.description.toLowerCase().includes(query) ||
        (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query)))
      );
      renderPosts(filteredPosts);
    });
  }
}

/**
 * Render filter buttons
 */
function renderFilters(tags) {
  const filterContainer = document.getElementById('blog-filters');
  filterContainer.innerHTML = tags.map(tag => `
    <button class="filter-tag ${tag === 'All' ? 'active' : ''}" data-tag="${tag}">
      ${tag}
    </button>
  `).join('');
}

/**
 * Render blog posts to the grid
 */
function renderPosts(posts) {
  const blogGrid = document.getElementById('blog-grid');

  if (posts.length === 0) {
    blogGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 3rem;">No posts match your search. Try a different query!</p>';
    return;
  }

  blogGrid.innerHTML = posts.map((post, index) => {
    // Staggered animation delay for cards (0ms, 100ms, 200ms)
    const delayClass = index % 3 === 0 ? '' : (index % 3 === 1 ? 'delay-100' : 'delay-200');

    return `
    <a href="/blog/${post.slug}/" class="blog-card reveal-up ${delayClass}">
      <img src="${post.image}" alt="${post.title}" class="blog-card-image" onerror="this.src='/assets/images/blog-default.jpg'">
      <div class="blog-card-content">
        <span class="blog-card-tag">${post.tags && post.tags.length > 0 ? post.tags[0] : 'General'}</span>
        <h3 class="blog-card-title">${escapeHtml(post.title)}</h3>
        <p class="blog-card-excerpt">${escapeHtml(post.description)}</p>
        
        <!-- Premium Animated Read Article Button -->
        <div class="premium-read-btn">
          Read Article 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>

      </div>
      <div class="blog-card-footer">
        <span>${escapeHtml(post.author)}</span>
        <span>${formatDate(post.date)}</span>
      </div>
    </a>
  `}).join('');

  // Trigger reveal animation for newly added posts
  setTimeout(handleScrollReveal, 50);
}

/**
 * Initialize related posts on single post page
 */
async function initRelatedPosts() {
  const relatedPostsSection = document.querySelector('.blog-related-posts');
  if (!relatedPostsSection) return;

  const posts = await fetchBlogData();
  const currentSlug = relatedPostsSection.getAttribute('data-post-slug');
  const currentTags = relatedPostsSection.getAttribute('data-post-tags').split(',').filter(t => t);

  // Find related posts
  const relatedPosts = posts
    .filter(p => p.slug !== currentSlug && p.tags && p.tags.some(t => currentTags.includes(t)))
    .slice(0, 3);

  const relatedPostsGrid = document.getElementById('related-posts-grid');

  if (relatedPosts.length === 0) {
    relatedPostsSection.style.display = 'none';
    return;
  }

  relatedPostsGrid.innerHTML = relatedPosts.map((post, index) => {
    const delayClass = index % 3 === 0 ? '' : (index % 3 === 1 ? 'delay-100' : 'delay-200');
    
    return `
    <a href="/blog/${post.slug}/" class="blog-card reveal-up ${delayClass}">
      <img src="${post.image}" alt="${post.title}" class="blog-card-image" onerror="this.src='/assets/images/blog-default.jpg'">
      <div class="blog-card-content">
        <h3 class="blog-card-title" style="font-size: 1.1rem;">${escapeHtml(post.title)}</h3>
        <div style="margin-top: 1rem;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--blog-primary);">Read Post →</span>
        </div>
      </div>
    </a>
  `}).join('');

  // Trigger reveal for related posts
  setTimeout(handleScrollReveal, 50);
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Utility: Format date
 */
function formatDate(dateStr) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}
