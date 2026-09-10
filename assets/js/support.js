/**
 * Support dock — one always-visible button that opens the messaging channels.
 *
 * Deliberately NOT Meta's Customer Chat Plugin. That embeds a real Messenger
 * window, but costs ~100KB of third-party JavaScript from connect.facebook.net
 * on every page, sets cookies that profile the visitor, and needs the domain
 * whitelisted in Page settings or it fails silently. The automated replies run
 * on Meta's side either way — a visitor who arrives through m.me gets exactly
 * the same conversation. So: two plain links, zero third-party script, and
 * nothing to consent to.
 *
 * Not loaded on /admin — that console loads no third-party anything by design,
 * and a "contact support" button on your own ops dashboard is noise.
 */
(function () {
  'use strict';

  // A wa.me/message/<code> short link cannot carry ?text=. To pre-fill the
  // first message the plain-number form is needed instead:
  //   https://wa.me/8801XXXXXXXXX?text=Hello
  var WHATSAPP_URL = 'https://wa.me/message/TDYG575YENF6F1';

  // Facebook Page username. m.me resolves this to the Page, and the Page's
  // automated replies answer exactly as they would inside Messenger itself —
  // which is the whole reason this is a link and not Meta's chat SDK.
  //
  // Empty disables the button rather than shipping a guess: an m.me link built
  // from the wrong handle opens Messenger on an error screen, which is worse
  // than no button at all.
  var MESSENGER_HANDLE = 'bayezidDME';

  var CHANNELS = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: WHATSAPP_URL,
      // Paths are inlined rather than fetched: an icon that arrives late on a
      // slow connection makes the whole dock look broken.
      path: 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.69-2.77-1.09-4.55-3.92-4.69-4.1-.14-.19-1.13-1.5-1.13-2.87s.72-2.03.97-2.31c.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.57.8 1.97.87 2.11.07.14.12.31.02.5-.09.19-.14.3-.28.47-.14.16-.3.36-.42.49-.14.14-.29.29-.12.57.16.28.73 1.2 1.56 1.95 1.08.96 1.98 1.26 2.26 1.4.28.14.44.12.61-.07.16-.19.7-.82.89-1.1.19-.28.37-.23.62-.14.25.09 1.6.76 1.88.9.28.14.46.21.53.32.07.12.07.66-.17 1.34z',
    },
    {
      id: 'messenger',
      label: 'Messenger',
      href: MESSENGER_HANDLE ? 'https://m.me/' + encodeURIComponent(MESSENGER_HANDLE) : '',
      path: 'M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.19.16.15.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88c.17-.07.36-.09.54-.04 1 .28 2.06.42 3.15.42 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm5.8 7.42-2.9 4.6a1.5 1.5 0 0 1-2.17.4l-2.33-1.75a.6.6 0 0 0-.72 0l-3.13 2.38c-.42.32-.96-.18-.68-.62l2.9-4.6a1.5 1.5 0 0 1 2.17-.4l2.33 1.75c.21.16.5.16.72 0l3.13-2.38c.42-.32.97.18.68.62z',
    },
  ].filter(function (channel) { return channel.href; });

  if (!CHANNELS.length) return;

  function icon(path) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    node.setAttribute('d', path);
    node.setAttribute('fill', 'currentColor');
    svg.appendChild(node);
    return svg;
  }

  var CHAT_PATH = 'M12 3C7.03 3 3 6.58 3 11c0 2.1.92 4 2.42 5.42-.1 1.2-.5 2.3-1.2 3.2-.2.26 0 .63.32.57 1.6-.28 2.9-.9 3.86-1.58 1.1.38 2.32.59 3.6.59 4.97 0 9-3.58 9-8s-4.03-8-9-8z';
  var CLOSE_PATH = 'M18.3 5.71a1 1 0 0 0-1.42 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z';

  var dock = document.createElement('div');
  dock.className = 'support-dock';
  dock.setAttribute('data-support-dock', '');

  var panel = document.createElement('div');
  panel.className = 'support-channels';
  panel.id = 'support-channels';
  panel.hidden = true;

  CHANNELS.forEach(function (channel) {
    var link = document.createElement('a');
    link.className = 'support-channel is-' + channel.id;
    link.href = channel.href;
    link.target = '_blank';
    // noopener also stops the opened tab reaching back through window.opener.
    link.rel = 'noopener noreferrer';
    link.setAttribute('data-support-channel', channel.id);
    link.appendChild(icon(channel.path));
    link.appendChild(document.createElement('span')).textContent = channel.label;
    link.addEventListener('click', function () {
      // Someone opening a chat is a real contact, and worth counting as one.
      // firePixelEvent lives in main.js and sends browser + server copies of
      // the event under one id so Meta de-duplicates them; guarded because the
      // dock also runs on pages that do not load main.js.
      if (typeof firePixelEvent === 'function') {
        firePixelEvent('Contact', { contentName: channel.id });
      }
      close();
    });
    panel.appendChild(link);
  });

  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'support-launcher';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'support-channels');
  launcher.setAttribute('aria-label', 'Contact support');
  var openIcon = icon(CHAT_PATH);
  openIcon.setAttribute('class', 'support-icon-open');
  var closeIcon = icon(CLOSE_PATH);
  closeIcon.setAttribute('class', 'support-icon-close');
  launcher.appendChild(openIcon);
  launcher.appendChild(closeIcon);

  dock.appendChild(panel);
  dock.appendChild(launcher);

  function isOpen() { return launcher.getAttribute('aria-expanded') === 'true'; }

  function open() {
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    dock.classList.add('is-open');
  }

  function close(returnFocus) {
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
    dock.classList.remove('is-open');
    if (returnFocus) launcher.focus();
  }

  launcher.addEventListener('click', function () {
    if (isOpen()) close(); else open();
  });

  // Escape closes and puts focus back where it started, which is what someone
  // navigating by keyboard expects.
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) close(true);
  });

  // A click anywhere else closes it. Without this the panel stays open over
  // the page and there is no obvious way to dismiss it on a phone.
  document.addEventListener('click', function (event) {
    if (isOpen() && !dock.contains(event.target)) close();
  });

  document.body.appendChild(dock);
})();
