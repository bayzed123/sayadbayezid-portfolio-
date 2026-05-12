/**
 * Dynamic Translator
 * Handles translation of dynamically loaded content (projects, blog, etc.)
 */

class DynamicTranslator {
  constructor() {
    this.init();
  }

  init() {
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      this.onLanguageChanged(e.detail.language);
    });
  }

  /**
   * Handle language change event
   */
  onLanguageChanged(language) {
    // Re-translate projects if they're loaded
    if (window.projectsData) {
      this.translateProjects(window.projectsData, language);
    }

    // Re-translate blog if it's loaded
    if (window.blogData) {
      this.translateBlog(window.blogData, language);
    }
  }

  /**
   * Translate projects data
   */
  translateProjects(projectsData, language) {
    const projectsGrid = document.getElementById('projects-grid');
    const latestContainer = document.getElementById('latest-project-container');

    if (!projectsGrid || !projectsData) return;

    const projects = projectsData.projects || [];

    // Find latest project
    const latest = projects.find(p => p.is_latest) || projects[0];
    if (latest && latestContainer) {
      this.renderLatestProject(latest, latestContainer, language);
    }

    // Render featured projects
    const featuredProjects = projects.filter(p => !p.is_latest);
    projectsGrid.innerHTML = featuredProjects.map(project => 
      this.createProjectCard(project, language)
    ).join('');
  }

  /**
   * Render latest project
   */
  renderLatestProject(project, container, language) {
    let mediaHTML = '';
    
    if (project.video_url) {
      const isMov = project.video_url.toLowerCase().includes('.mov');
      const videoType = isMov ? 'video/quicktime' : 'video/mp4';
      mediaHTML = `
        <video width="100%" autoplay loop muted playsinline controls style="border-radius: 12px 12px 0 0; object-fit: cover; max-height: 500px; background: #000;">
          <source src="${project.video_url}" type="${videoType}">
        </video>
      `;
    } else if (project.images && project.images.length > 0) {
      mediaHTML = `
        <div class="slider-container">
          <div class="slider-wrapper" id="slider-wrapper">
            ${project.images.map(img => `<div class="slide"><img src="${img}" alt="${project.title}"></div>`).join('')}
          </div>
          ${project.images.length > 1 ? `
            <button class="slider-btn prev-btn" onclick="moveSlide(-1)">❮</button>
            <button class="slider-btn next-btn" onclick="moveSlide(1)">❯</button>
            <div class="slider-dots">
              ${project.images.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" onclick="currentSlide(${i})"></div>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } else if (project.image_url) {
      mediaHTML = `<img src="${project.image_url}" alt="${project.title}" style="border-radius: 12px 12px 0 0; object-fit: cover; max-height: 500px; width: 100%;">`;
    }

    const viewProjectText = window.i18n ? window.i18n.t('projects.viewProject', language) : 'View Project →';

    container.innerHTML = `
      <div class="project-card" style="display: flex; flex-direction: column; width: 100%; max-width: 1000px; margin: 0 auto;">
        ${mediaHTML}
        <div class="project-content">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <div class="project-tags">
            ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
          ${project.link ? `<a href="${project.link}" class="project-link" target="_blank" style="margin-top: 15px; display: inline-block;">${viewProjectText}</a>` : ''}
        </div>
      </div>
    `;

    if (project.images && project.images.length > 1) {
      initSlider();
    }
  }

  /**
   * Create project card HTML
   */
  createProjectCard(project, language) {
    let gridMediaHTML = '';
    
    if (project.video_url) {
      const isMov = project.video_url.toLowerCase().includes('.mov');
      const videoType = isMov ? 'video/quicktime' : 'video/mp4';
      gridMediaHTML = `
        <div class="grid-media" style="background: #000; border-radius: 12px 12px 0 0; overflow: hidden;">
          <video width="100%" controls muted playsinline style="display: block; object-fit: cover; height: 200px;">
            <source src="${project.video_url}" type="${videoType}">
            Your browser does not support the video tag.
          </video>
        </div>
      `;
    } else if (project.images && project.images.length > 0) {
      gridMediaHTML = `<div class="grid-media"><img src="${project.images[0]}" alt="${project.title}" style="border-radius: 12px 12px 0 0; object-fit: cover; height: 200px; width: 100%;"></div>`;
    } else if (project.image_url) {
      gridMediaHTML = `<div class="grid-media"><img src="${project.image_url}" alt="${project.title}" style="border-radius: 12px 12px 0 0; object-fit: cover; height: 200px; width: 100%;"></div>`;
    }

    let audioHTML = '';
    if (project.audio_links && project.audio_links.length > 0) {
      audioHTML = `
        <div class="project-audio" style="margin-top: 15px;">
          ${project.audio_links.map(audio => `
            <div style="margin-bottom: 10px;">
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 5px;">${audio.title}</p>
              <audio controls style="width: 100%; height: 30px;">
                <source src="${audio.url}" type="audio/mpeg">
                Your browser does not support the audio element.
              </audio>
            </div>
          `).join('')}
        </div>
      `;
    }

    const viewProjectText = window.i18n ? window.i18n.t('projects.viewProject', language) : 'View Project →';

    return `
      <div class="project-card">
        ${gridMediaHTML}
        <div class="project-content">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          ${audioHTML}
          <div class="project-tags" style="margin-top: 15px;">
            ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
          ${project.link ? `<a href="${project.link}" class="project-link" target="_blank" style="margin-top: 10px; display: inline-block;">${viewProjectText}</a>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Translate blog data
   */
  translateBlog(blogData, language) {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid) return;

    const blogs = blogData.blogs || [];
    const readMoreText = window.i18n ? window.i18n.t('blog.readMore', language) : 'Read More →';

    blogGrid.innerHTML = blogs.map(blog => `
      <div class="blog-card">
        <img src="${blog.image}" alt="${blog.title}" class="blog-image" />
        <div class="blog-content">
          <div class="blog-meta">
            <span class="blog-category">${blog.category}</span>
            <span>${blog.date}</span>
          </div>
          <h3>${blog.title}</h3>
          <p>${blog.excerpt}</p>
          <a href="/blog-loader.html?slug=${blog.slug}" class="blog-link">${readMoreText}</a>
        </div>
      </div>
    `).join('');
  }
}

// Initialize dynamic translator
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.dynamicTranslator = new DynamicTranslator();
  });
} else {
  window.dynamicTranslator = new DynamicTranslator();
}
