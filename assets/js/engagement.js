/**
 * Ratings and comments for blog posts and case studies.
 *
 * The markup ships in the page but starts hidden, and is only revealed once
 * the API has answered. Two reasons: without JavaScript the form could not be
 * submitted anyway, and if the API is unreachable an empty comment box that
 * silently swallows what someone typed is worse than no comment box at all.
 *
 * Nothing here writes user text with innerHTML. Comments are attacker-supplied
 * strings that get published under this domain, so every one of them goes in
 * through textContent.
 */
(function () {
  'use strict';

  var API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
  var section = document.querySelector('[data-engagement]');
  if (!section) return;

  var target = section.getAttribute('data-engagement');
  if (!target) return;

  var voteKey = 'cwb.rating.' + target;
  var summaryEl = section.querySelector('[data-rating-summary]');
  var starsEl = section.querySelector('[data-rating-stars]');
  var countEl = section.querySelector('[data-comment-count]');
  var listEl = section.querySelector('[data-comment-list]');
  var emptyEl = section.querySelector('[data-comment-empty]');
  var formEl = section.querySelector('[data-comment-form]');
  var statusEl = section.querySelector('[data-form-status]');

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function renderRating(rating) {
    if (!summaryEl) return;
    if (!rating || !rating.count) {
      summaryEl.textContent = 'No ratings yet — yours would be the first.';
      return;
    }
    summaryEl.textContent =
      rating.average.toFixed(1) + ' out of 5 · ' + plural(rating.count, 'rating', 'ratings');
  }

  /** Reflects the reader's own vote, which lives in their browser rather than
   *  in the shared API response — that is what keeps the response cacheable. */
  function markOwnVote(value) {
    if (!starsEl || !value) return;
    var input = starsEl.querySelector('input[value="' + String(value) + '"]');
    if (input) input.checked = true;
    starsEl.setAttribute('data-voted', 'true');
  }

  function formatDate(value) {
    var parsed = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));
    if (isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderComments(comments) {
    if (!listEl) return;
    listEl.textContent = '';

    if (countEl) {
      countEl.textContent = comments.length ? String(comments.length) : '';
    }
    if (emptyEl) {
      emptyEl.hidden = comments.length > 0;
    }

    comments.forEach(function (comment) {
      var item = document.createElement('li');
      item.className = 'comment';

      var head = document.createElement('div');
      head.className = 'comment-head';

      var name = document.createElement('span');
      name.className = 'comment-author';
      name.textContent = comment.name;
      head.appendChild(name);

      var when = formatDate(comment.created_at);
      if (when) {
        var time = document.createElement('time');
        time.className = 'comment-date';
        time.textContent = when;
        head.appendChild(time);
      }

      item.appendChild(head);

      // Blank-line-separated paragraphs, each one a text node. A comment is
      // untrusted input; it never becomes markup.
      String(comment.body)
        .split(/\n{2,}/)
        .forEach(function (para) {
          if (!para.trim()) return;
          var p = document.createElement('p');
          p.textContent = para.trim();
          item.appendChild(p);
        });

      listEl.appendChild(item);
    });
  }

  function setStatus(message, kind) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.setAttribute('data-kind', kind || '');
  }

  function load() {
    return fetch(API + '/api/engagement?target=' + encodeURIComponent(target))
      .then(function (response) {
        if (!response.ok) throw new Error('engagement unavailable');
        return response.json();
      })
      .then(function (data) {
        renderRating(data.rating);
        renderComments(Array.isArray(data.comments) ? data.comments : []);
        section.hidden = false;
      })
      .catch(function () {
        // Leave the section hidden. A visitor should never meet a comment box
        // that cannot reach anything.
        section.hidden = true;
      });
  }

  if (starsEl) {
    starsEl.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || input.name !== 'rating') return;

      var value = Number(input.value);
      starsEl.setAttribute('data-voted', 'true');
      if (summaryEl) summaryEl.textContent = 'Saving your rating…';

      fetch(API + '/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target, rating: value })
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw new Error(data.error || 'Could not save that.');
            return data;
          });
        })
        .then(function (data) {
          // The POST answers with the fresh aggregate, so the number updates
          // immediately instead of waiting out the GET's cache.
          renderRating(data.rating);
          try {
            localStorage.setItem(voteKey, String(value));
          } catch (e) {
            /* private mode — the vote is still recorded server-side */
          }
        })
        .catch(function (error) {
          if (summaryEl) summaryEl.textContent = error.message || 'Could not save that rating.';
        });
    });
  }

  if (formEl) {
    formEl.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(formEl);
      var button = formEl.querySelector('button[type="submit"]');

      setStatus('Sending…', 'pending');
      if (button) button.disabled = true;

      fetch(API + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: target,
          name: data.get('name') || '',
          email: data.get('email') || '',
          body: data.get('body') || '',
          website: data.get('website') || ''
        })
      })
        .then(function (response) {
          return response.json().then(function (payload) {
            if (!response.ok) throw new Error(payload.error || 'Could not post that comment.');
            return payload;
          });
        })
        .then(function (payload) {
          formEl.reset();
          setStatus(payload.note || 'Thanks — your comment will appear once it is approved.', 'ok');
        })
        .catch(function (error) {
          setStatus(error.message || 'Could not post that comment.', 'error');
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  }

  try {
    markOwnVote(localStorage.getItem(voteKey));
  } catch (e) {
    /* private mode */
  }

  // The section sits at the bottom of a long article, so there is no reason to
  // spend a request on it while the reader is still at the top. Same pattern as
  // the home page's review strip.
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        observer.disconnect();
        load();
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(section);
  } else {
    load();
  }
})();
