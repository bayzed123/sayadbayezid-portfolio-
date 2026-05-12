# Internationalization (i18n) System

This portfolio now supports **three languages**: English (EN), Spanish (ES), and Russian (RU).

## Features

- **Automatic Language Detection**: Detects user's browser language preference
- **Manual Language Switching**: Users can switch languages via language selector buttons
- **Persistent Preference**: Saves language choice in localStorage
- **SEO Optimized**: Updates hreflang tags for search engines
- **Dynamic Content Translation**: Translates dynamically loaded content (projects, blog)
- **URL Parameter Support**: Language can be set via `?lang=es` URL parameter

## File Structure

```
i18n/
├── translations.json          # All translations for EN, ES, RU
├── i18n.js                   # Core i18n library
├── dynamic-translator.js     # Handles dynamic content translation
└── README.md                 # This file
```

## How It Works

### 1. Core i18n System (i18n.js)

The `i18n.js` file provides:
- Language detection (browser language → localStorage → URL parameter → default EN)
- Translation lookup via dot-notation keys (e.g., `nav.about`)
- Automatic translation of all elements with `data-i18n` attributes
- Language switcher UI with EN, ES, RU buttons
- hreflang tag management for SEO

### 2. Translations File (translations.json)

Contains all translations organized by language and section:

```json
{
  "en": {
    "nav": { "about": "About", ... },
    "hero": { "title": "...", ... },
    ...
  },
  "es": { ... },
  "ru": { ... }
}
```

### 3. Dynamic Translator (dynamic-translator.js)

Handles translation of:
- Project titles and descriptions
- Blog posts and metadata
- Any dynamically loaded content

## Usage

### For Static Content

Add the `data-i18n` attribute to any HTML element:

```html
<!-- Navigation -->
<a href="#about" data-i18n="nav.about">About</a>

<!-- Headings -->
<h2 data-i18n="hero.title">Full-stack Web Developer & Tech Provider</h2>

<!-- Paragraphs -->
<p data-i18n="hero.description">Professional description...</p>

<!-- Buttons -->
<button data-i18n="hero.exploreWork">Explore My Work</button>
```

### For Dynamic Content

The system automatically translates:
- Projects loaded from `projects/projects.json`
- Blog posts loaded from `blogs/index.json`

When language changes, all dynamic content is re-rendered with new translations.

### Programmatic Usage

```javascript
// Get current language
const lang = window.i18n.getLanguage(); // 'en', 'es', or 'ru'

// Get translation
const text = window.i18n.t('nav.about'); // Returns translated text

// Change language
window.i18n.setLanguage('es');

// Listen for language changes
window.addEventListener('languageChanged', (e) => {
  console.log('Language changed to:', e.detail.language);
});
```

## Adding New Translations

### Step 1: Add to translations.json

```json
{
  "en": {
    "newSection": {
      "key": "English text"
    }
  },
  "es": {
    "newSection": {
      "key": "Texto en español"
    }
  },
  "ru": {
    "newSection": {
      "key": "Русский текст"
    }
  }
}
```

### Step 2: Use in HTML

```html
<element data-i18n="newSection.key">English text</element>
```

## Language Switcher

The language switcher appears in the navigation bar with three buttons:
- **EN** - English
- **ES** - Español (Spanish)
- **RU** - Русский (Russian)

Users can click any button to switch languages. The choice is saved and persists across page reloads.

## SEO Considerations

The system automatically:
1. Updates the `lang` attribute on `<html>` tag
2. Adds hreflang tags for all supported languages
3. Adds x-default hreflang for fallback
4. Maintains proper URL structure with `?lang=` parameter

Example hreflang tags:
```html
<link rel="alternate" hreflang="en" href="https://example.com?lang=en">
<link rel="alternate" hreflang="es" href="https://example.com?lang=es">
<link rel="alternate" hreflang="ru" href="https://example.com?lang=ru">
<link rel="alternate" hreflang="x-default" href="https://example.com">
```

## Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| en   | English  | English     |
| es   | Spanish  | Español     |
| ru   | Russian  | Русский     |

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ⚠️ Limited support (no localStorage in private mode)

## Performance

- Translations loaded once on page load
- Minimal DOM manipulation
- Efficient CSS class toggling for language switcher
- No external dependencies

## Troubleshooting

### Translations not appearing?
1. Check that `data-i18n` attribute matches key in translations.json
2. Verify translations.json is in `/i18n/` directory
3. Check browser console for errors

### Language not changing?
1. Verify localStorage is enabled
2. Check that language code is valid (en, es, ru)
3. Clear browser cache and reload

### hreflang tags not updating?
1. Ensure i18n.js is loaded before other scripts
2. Check that language change event is firing
3. Verify hreflang tags are in `<head>` section

## Future Enhancements

- Add more languages (French, German, Chinese, etc.)
- Implement RTL (right-to-left) support for Arabic, Hebrew
- Add language-specific date/time formatting
- Implement translation management UI
- Add fallback language support

## License

This i18n system is part of the Sayad Bayezid Portfolio project.
