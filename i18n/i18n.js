/**
 * i18n - Internationalization Module
 * Handles language detection, switching, and translation
 */

class I18n {
  constructor() {
    this.currentLanguage = this.detectLanguage();
    this.translations = {};
    this.supportedLanguages = ['en', 'es', 'ru'];
    this.init();
  }

  /**
   * Initialize i18n system
   */
  async init() {
    await this.loadTranslations();
    this.applyLanguage(this.currentLanguage);
    this.setupLanguageSwitcher();
  }

  /**
   * Detect user's preferred language
   */
  detectLanguage() {
    // Check localStorage first
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
      return savedLanguage;
    }

    // Check browser language
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    if (this.supportedLanguages.includes(browserLang)) {
      return browserLang;
    }

    // Check URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    if (urlLang && this.supportedLanguages.includes(urlLang)) {
      return urlLang;
    }

    // Default to English
    return 'en';
  }

  /**
   * Load translations from JSON file
   */
  async loadTranslations() {
    try {
      const response = await fetch('i18n/translations.json');
      if (!response.ok) throw new Error('Failed to load translations');
      this.translations = await response.json();
    } catch (error) {
      console.error('Error loading translations:', error);
      // Fallback to English if loading fails
      this.translations = { en: {}, es: {}, ru: {} };
    }
  }

  /**
   * Get translation value by key path
   * @param {string} key - Dot-separated key path (e.g., 'nav.about')
   * @param {string} lang - Language code
   */
  t(key, lang = this.currentLanguage) {
    const keys = key.split('.');
    let value = this.translations[lang];

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return value || key;
  }

  /**
   * Apply language to the entire page
   */
  applyLanguage(lang) {
    if (!this.supportedLanguages.includes(lang)) {
      lang = 'en';
    }

    this.currentLanguage = lang;
    localStorage.setItem('preferredLanguage', lang);

    // Update HTML lang attribute
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Translate all elements with data-i18n attribute
    this.translateElements();

    // Update hreflang tags for SEO
    this.updateHrefLang(lang);

    // Dispatch custom event for other scripts to listen
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
  }

  /**
   * Translate all elements with data-i18n attribute
   */
  translateElements() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key, this.currentLanguage);
      
      // Handle different element types
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.hasAttribute('placeholder')) {
          element.placeholder = translation;
        } else {
          element.value = translation;
        }
      } else if (element.hasAttribute('title')) {
        element.title = translation;
      } else if (element.hasAttribute('alt')) {
        element.alt = translation;
      } else {
        element.textContent = translation;
      }
    });
  }

  /**
   * Update hreflang tags for SEO
   */
  updateHrefLang(currentLang) {
    // Remove existing hreflang tags
    const existingTags = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingTags.forEach(tag => tag.remove());

    // Add new hreflang tags
    const baseUrl = window.location.origin + window.location.pathname;
    
    this.supportedLanguages.forEach(lang => {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = lang;
      link.href = `${baseUrl}?lang=${lang}`;
      document.head.appendChild(link);
    });

    // Add x-default
    const defaultLink = document.createElement('link');
    defaultLink.rel = 'alternate';
    defaultLink.hreflang = 'x-default';
    defaultLink.href = baseUrl;
    document.head.appendChild(defaultLink);
  }

  /**
   * Setup language switcher in navigation
   */
  setupLanguageSwitcher() {
    // Create language switcher if it doesn't exist
    const nav = document.querySelector('nav');
    if (!nav) return;

    // Add event listeners to hardcoded buttons
    const langBtns = document.querySelectorAll('.lang-btn');
    langBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.target.getAttribute('data-lang');
        this.applyLanguage(lang);
        this.updateActiveLangBtn();
      });
    });

    // Set initial active button
    this.updateActiveLangBtn();
  }

  /**
   * Update active language button
   */
  updateActiveLangBtn() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      const lang = btn.getAttribute('data-lang');
      if (lang === this.currentLanguage) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Add CSS styles for language switcher
   */
  addLanguageSwitcherStyles() {
    if (document.getElementById('i18nStyles')) return;

    const style = document.createElement('style');
    style.id = 'i18nStyles';
    style.textContent = `
      .lang-switcher-item {
        display: flex;
        align-items: center;
        padding: 0.5rem 1.5rem;
      }

      .language-switcher {
        display: flex;
        gap: 0.5rem;
      }

      .lang-btn {
        padding: 0.4rem 0.8rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        border-radius: 50px;
        cursor: pointer;
        font-size: 0.75rem;
        font-weight: 600;
        transition: all 0.3s ease;
        line-height: 1;
      }

      .lang-btn:hover {
        border-color: var(--primary);
        color: var(--primary);
        background: rgba(0, 217, 255, 0.1);
      }

      .lang-btn.active {
        background: var(--primary);
        color: var(--bg-dark);
        border-color: var(--primary);
      }

      @media (min-width: 768px) {
        .lang-switcher-item {
          padding: 0;
          margin-left: 1rem;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Translate dynamic content (e.g., from JSON)
   */
  translateObject(obj, lang = this.currentLanguage) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const translated = {};
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Check if it's a translation key (contains a dot)
        if (obj[key].includes('i18n.')) {
          const translationKey = obj[key].replace('i18n.', '');
          translated[key] = this.t(translationKey, lang);
        } else {
          translated[key] = obj[key];
        }
      } else if (typeof obj[key] === 'object') {
        translated[key] = this.translateObject(obj[key], lang);
      } else {
        translated[key] = obj[key];
      }
    }
    return translated;
  }

  /**
   * Change language
   */
  setLanguage(lang) {
    if (this.supportedLanguages.includes(lang)) {
      this.applyLanguage(lang);
      // Update URL without reloading
      const url = new URL(window.location);
      url.searchParams.set('lang', lang);
      window.history.pushState({}, '', url);
    }
  }

  /**
   * Get current language
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}

// Initialize i18n when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new I18n();
  });
} else {
  window.i18n = new I18n();
}
