/**
 * Operations console.
 *
 * This file holds no credentials. Sign-in posts to the Worker, which returns a
 * short-lived signed token; that token is the only thing kept here, and it goes
 * in sessionStorage rather than localStorage so closing the tab ends the
 * session. Every render below draws from an authenticated API response — there
 * is no sample data anywhere in this file, deliberately: a plausible-looking
 * number in an operations console is worse than a blank panel, because someone
 * might act on it.
 */
(function () {
  'use strict';

  var API = 'https://bayezid-agency-api.sayadmdbayezidhosan.workers.dev';
  var TOKEN_KEY = 'cwb.console.token';
  var EXPIRY_KEY = 'cwb.console.expiry';

  var gate = document.getElementById('gate');
  var shell = document.getElementById('shell');
  var sidebar = document.getElementById('sidebar');
  var state = { view: 'overview', overview: null };

  // --- storage -------------------------------------------------------------
  function readToken() {
    try {
      var token = sessionStorage.getItem(TOKEN_KEY);
      var expiry = sessionStorage.getItem(EXPIRY_KEY);
      if (!token || !expiry || new Date(expiry).getTime() <= Date.now()) return null;
      return token;
    } catch (e) { return null; }
  }
  function storeToken(token, expiresAt) {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(EXPIRY_KEY, expiresAt);
    } catch (e) { /* private mode: the session lives only in memory */ }
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(EXPIRY_KEY); } catch (e) {}
  }

  // --- api -----------------------------------------------------------------
  function api(path, options) {
    var opts = options || {};
    var token = readToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (response) {
      // An expired or revoked token must drop straight back to the gate rather
      // than leaving half-rendered panels on screen.
      if (response.status === 401) { signOut(); throw new Error('Session expired. Sign in again.'); }
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok) throw new Error(payload.error || ('Request failed (' + response.status + ')'));
        return payload;
      });
    });
  }

  // --- dom helpers ---------------------------------------------------------
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function fmtDate(value) {
    if (!value) return '—';
    var d = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));
    return isNaN(d.getTime()) ? String(value)
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' +
        d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function num(value) { return Number(value || 0).toLocaleString(); }
  function skeleton(container, rows) {
    clear(container);
    for (var i = 0; i < (rows || 4); i++) container.appendChild(el('div', 'skeleton'));
  }
  function emptyState(container, title, detail) {
    clear(container);
    var wrap = el('div', 'empty');
    wrap.appendChild(el('strong', null, title));
    if (detail) wrap.appendChild(el('span', null, detail));
    container.appendChild(wrap);
  }
  function pill(status) {
    var known = { up: 'up', down: 'down', sent: 'up', failed: 'down', not_configured: 'warn' };
    var node = el('span', 'pill ' + (known[status] || 'unknown'));
    node.appendChild(el('i', 'dot'));
    node.appendChild(el('span', null, String(status || 'unknown').replace(/_/g, ' ')));
    return node;
  }

  /** Builds a table from rows of cells. Every cell is a text node or an element
   *  we constructed — nothing here interpolates a string into markup, because
   *  most of this content was typed by strangers. */
  function table(container, headers, rows, renderRow) {
    clear(container);
    if (!rows.length) { emptyState(container, 'Nothing here yet.'); return; }
    var t = el('table', 'data');
    var thead = el('thead'), tr = el('tr');
    headers.forEach(function (h) { tr.appendChild(el('th', null, h)); });
    thead.appendChild(tr); t.appendChild(thead);
    var tbody = el('tbody');
    rows.forEach(function (row) { tbody.appendChild(renderRow(row)); });
    t.appendChild(tbody); container.appendChild(t);
  }

  // --- charts (hand-rolled SVG; no library, no CDN) -------------------------
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  /** A filled line chart. Values are plotted against their own maximum, so a
   *  quiet fortnight still reads clearly instead of flattening to the axis. */
  function lineChart(container, series) {
    clear(container);
    var w = 640, h = 190, padL = 34, padR = 10, padT = 14, padB = 26;
    var max = Math.max.apply(null, series.map(function (p) { return p.value; }).concat([1]));
    var stepX = (w - padL - padR) / Math.max(series.length - 1, 1);
    var y = function (v) { return padT + (h - padT - padB) * (1 - v / max); };

    var chart = svg('svg', { class: 'chart', viewBox: '0 0 ' + w + ' ' + h, role: 'img' });
    chart.appendChild(el('title', null, 'Enquiries per day'));

    [0, 0.5, 1].forEach(function (f) {
      var gy = padT + (h - padT - padB) * f;
      chart.appendChild(svg('line', {
        x1: padL, x2: w - padR, y1: gy, y2: gy,
        stroke: 'rgba(237,239,236,0.07)', 'stroke-width': 1
      }));
      var label = svg('text', { x: 4, y: gy + 4, fill: '#5C6A62', 'font-size': 10 });
      label.textContent = String(Math.round(max * (1 - f)));
      chart.appendChild(label);
    });

    var pts = series.map(function (p, i) { return [padL + i * stepX, y(p.value)]; });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');

    var gradient = svg('linearGradient', { id: 'lineFill', x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.appendChild(svg('stop', { offset: '0%', 'stop-color': '#00D084', 'stop-opacity': 0.28 }));
    gradient.appendChild(svg('stop', { offset: '100%', 'stop-color': '#00D084', 'stop-opacity': 0 }));
    var defs = svg('defs'); defs.appendChild(gradient); chart.appendChild(defs);

    chart.appendChild(svg('path', {
      d: line + ' L' + (padL + (series.length - 1) * stepX).toFixed(1) + ' ' + (h - padB) + ' L' + padL + ' ' + (h - padB) + ' Z',
      fill: 'url(#lineFill)'
    }));
    var path = svg('path', {
      d: line, fill: 'none', stroke: '#00D084', 'stroke-width': 2.2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'line-path'
    });
    // The draw-in needs the real path length; guess if the browser cannot
    // measure it yet (a hidden panel reports zero).
    chart.appendChild(path);
    requestAnimationFrame(function () {
      var len = 0;
      try { len = path.getTotalLength(); } catch (e) {}
      path.style.setProperty('--len', (len || 1200).toFixed(0));
    });

    pts.forEach(function (p, i) {
      if (series[i].value === 0) return;
      chart.appendChild(svg('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3, fill: '#00D084' }));
    });

    series.forEach(function (p, i) {
      if (i % Math.ceil(series.length / 7) !== 0) return;
      var label = svg('text', { x: (padL + i * stepX).toFixed(1), y: h - 8, fill: '#5C6A62', 'font-size': 10, 'text-anchor': 'middle' });
      label.textContent = p.label;
      chart.appendChild(label);
    });

    container.appendChild(chart);
  }

  function funnel(container, steps) {
    clear(container);
    var max = Math.max.apply(null, steps.map(function (s) { return s.value; }).concat([1]));
    var wrap = el('div', 'funnel');
    steps.forEach(function (step) {
      var row = el('div', 'funnel-row');
      row.appendChild(el('span', null, step.label));
      var track = el('div', 'funnel-track');
      var fill = el('div', 'funnel-fill');
      fill.style.setProperty('--pct', Math.max((step.value / max) * 100, step.value ? 4 : 0) + '%');
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(el('span', 'funnel-value', num(step.value)));
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
  }

  function ring(container, up, total) {
    clear(container);
    var size = 132, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    var pct = total ? up / total : 0;
    var chart = svg('svg', { class: 'chart dial', viewBox: '0 0 ' + size + ' ' + size, width: size, height: size });
    chart.appendChild(svg('circle', {
      cx: size / 2, cy: size / 2, r: r, fill: 'none',
      stroke: 'rgba(237,239,236,0.08)', 'stroke-width': stroke
    }));
    chart.appendChild(svg('circle', {
      cx: size / 2, cy: size / 2, r: r, fill: 'none',
      stroke: pct === 1 ? '#00D084' : (pct >= 0.5 ? '#E5A23F' : '#E5735F'),
      'stroke-width': stroke, 'stroke-linecap': 'round',
      'stroke-dasharray': c, 'stroke-dashoffset': c * (1 - pct),
      transform: 'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')',
      style: 'transition: stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)'
    }));
    var value = svg('text', { x: size / 2, y: size / 2 + 2, fill: '#EDEFEC', 'font-size': 24, 'text-anchor': 'middle', 'font-family': 'Fraunces, Georgia, serif' });
    value.textContent = total ? Math.round(pct * 100) + '%' : '—';
    chart.appendChild(value);
    var caption = svg('text', { x: size / 2, y: size / 2 + 22, fill: '#5C6A62', 'font-size': 10, 'text-anchor': 'middle' });
    caption.textContent = total ? up + ' of ' + total + ' up' : 'no projects';
    chart.appendChild(caption);

    var box = el('div');
    box.style.cssText = 'display:flex;align-items:center;gap:20px;padding:4px 0';
    box.appendChild(chart);
    var legend = el('div');
    legend.style.cssText = 'font-size:0.82rem;color:var(--text-soft);line-height:1.7';
    legend.appendChild(el('div', null, total ? up + ' responding' : 'No projects tracked yet'));
    if (total) legend.appendChild(el('div', null, (total - up) + ' not responding'));
    legend.appendChild(el('div', 'mono', total ? 'checked on demand' : 'add one to begin'));
    legend.lastChild.style.cssText = 'font-size:0.72rem;color:var(--text-dim);margin-top:4px';
    box.appendChild(legend);
    container.appendChild(box);
  }

  // --- views ---------------------------------------------------------------
  var VIEWS = {
    overview: { title: 'Dashboard', crumb: 'Console', load: loadOverview },
    projects: { title: 'Project health', crumb: 'Clients', load: loadProjects },
    content: { title: 'Case studies & blog', crumb: 'Portfolio', load: loadContent },
    reviews: { title: 'Reviews', crumb: 'Portfolio', load: loadReviews },
    comments: { title: 'Comments', crumb: 'Portfolio', load: loadComments },
    enquiries: { title: 'Enquiries', crumb: 'Pipeline', load: loadEnquiries },
    leads: { title: 'Newsletter leads', crumb: 'Pipeline', load: loadLeads },
    analytics: { title: 'Analytics', crumb: 'Insight', load: loadAnalytics },
    settings: { title: 'System status', crumb: 'Insight', load: loadSettings }
  };

  function show(view) {
    if (!VIEWS[view]) view = 'overview';
    state.view = view;
    document.querySelectorAll('[data-view-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-view-panel') !== view;
    });
    document.querySelectorAll('.side-link').forEach(function (link) {
      if (link.getAttribute('data-view') === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('[data-title]').textContent = VIEWS[view].title;
    document.querySelector('[data-crumb]').textContent = VIEWS[view].crumb;
    sidebar.classList.remove('open');
    if (location.hash.slice(1) !== view) location.hash = view;
    VIEWS[view].load();
  }

  function loadOverview() {
    var stats = document.querySelector('[data-stats]');
    if (!state.overview) skeleton(stats, 4);

    api('/api/admin/overview').then(function (data) {
      state.overview = data;
      clear(stats);
      [
        { label: 'Projects up', value: num(data.projects.up || 0) + ' / ' + num(data.projects.total || 0),
          sub: (data.projects.down || 0) + ' reporting down', accent: (data.projects.down ? '#E5735F' : '#00D084') },
        { label: 'Enquiries', value: num(data.contacts.total), sub: num(data.contacts.last7) + ' in the last 7 days', accent: '#5AA9E6' },
        { label: 'Awaiting approval', value: num((data.reviews.pending || 0) + (data.comments.pending || 0)),
          sub: num(data.reviews.pending || 0) + ' reviews, ' + num(data.comments.pending || 0) + ' comments', accent: '#D4AF6A' },
        { label: 'Newsletter', value: num(data.leads ? data.leads.total : 0),
          sub: num(data.leads ? data.leads.last30 : 0) + ' in the last 30 days', accent: '#00A868' }
      ].forEach(function (s) {
        var card = el('div', 'stat');
        card.style.setProperty('--accent', s.accent);
        card.appendChild(el('div', 'stat-label', s.label));
        card.appendChild(el('div', 'stat-value', s.value));
        card.appendChild(el('div', 'stat-sub', s.sub));
        stats.appendChild(card);
      });

      updateBadges(data);
      ring(document.querySelector('[data-health-summary]'), data.projects.up || 0, data.projects.total || 0);

      funnel(document.querySelector('[data-funnel]'), [
        { label: 'Newsletter leads', value: data.leads ? data.leads.total : 0 },
        { label: 'Enquiries', value: data.contacts.total || 0 },
        { label: 'Recent (7d)', value: data.contacts.last7 || 0 }
      ]);

      var attention = document.querySelector('[data-attention]');
      clear(attention);
      var items = [];
      if (data.notifications.undelivered) items.push([data.notifications.undelivered + ' notification(s) never reached the inbox', 'enquiries']);
      if (data.projects.down) items.push([data.projects.down + ' client project reporting down', 'projects']);
      if (data.reviews.pending) items.push([data.reviews.pending + ' review(s) awaiting approval', 'reviews']);
      if (data.comments.pending) items.push([data.comments.pending + ' comment(s) awaiting approval', 'comments']);
      if (!data.analytics.configured) items.push(['Analytics not connected yet', 'analytics']);

      if (!items.length) { emptyState(attention, 'Nothing needs you.', 'Everything is approved, delivered and up.'); return; }
      var list = el('div');
      items.forEach(function (item) {
        var row = el('button', 'side-link');
        row.style.marginBottom = '4px';
        row.appendChild(el('span', null, item[0]));
        row.addEventListener('click', function () { show(item[1]); });
        list.appendChild(row);
      });
      attention.appendChild(list);
    }).catch(function (error) { emptyState(stats, 'Could not load the overview.', error.message); });

    // The daily series comes from the enquiry list rather than a dedicated
    // endpoint: one request already returns everything needed to bucket it.
    api('/api/admin/contact').then(function (data) {
      var days = [];
      for (var i = 13; i >= 0; i--) {
        var d = new Date(Date.now() - i * 86400000);
        days.push({ key: d.toISOString().slice(0, 10), label: String(d.getDate()), value: 0 });
      }
      (data.submissions || []).forEach(function (s) {
        var key = String(s.created_at || '').slice(0, 10);
        var bucket = days.find(function (d) { return d.key === key; });
        if (bucket) bucket.value++;
      });
      lineChart(document.querySelector('[data-chart="enquiries"]'), days);
    }).catch(function () {});
  }

  function updateBadges(data) {
    var map = {
      projectsDown: data.projects.down || 0,
      reviewsPending: data.reviews.pending || 0,
      commentsPending: data.comments.pending || 0,
      enquiriesNew: data.contacts.last7 || 0
    };
    Object.keys(map).forEach(function (key) {
      var node = document.querySelector('[data-badge="' + key + '"]');
      if (node) node.textContent = map[key] ? String(map[key]) : '';
    });
  }

  function loadProjects() {
    var container = document.querySelector('[data-projects]');
    skeleton(container, 3);
    api('/api/admin/projects').then(function (data) {
      table(container,
        ['Project', 'Provider', 'Account', 'Token', 'Status', 'Last checked', ''],
        data.projects,
        function (p) {
          var tr = el('tr');
          var nameCell = el('td');
          nameCell.appendChild(el('strong', null, p.name));
          if (p.dashboard_url) {
            var link = el('a', null, 'dashboard ↗');
            link.href = p.dashboard_url; link.target = '_blank'; link.rel = 'noopener';
            link.style.cssText = 'display:block;font-size:0.74rem;color:var(--text-dim);margin-top:3px';
            nameCell.appendChild(link);
          }
          tr.appendChild(nameCell);
          tr.appendChild(el('td', null, p.provider));
          var acc = el('td'); acc.appendChild(el('span', 'masked', p.account_hint || '')); tr.appendChild(acc);
          var tok = el('td'); tok.appendChild(el('span', 'masked', p.token_hint || '')); tr.appendChild(tok);
          var st = el('td'); st.appendChild(pill(p.status)); tr.appendChild(st);
          var checked = el('td', null, fmtDate(p.last_checked_at));
          if (p.last_latency_ms) checked.appendChild(el('div', 'mono', p.last_latency_ms + ' ms'));
          tr.appendChild(checked);

          var actions = el('td', 'actions');
          if (p.health_url) {
            var check = el('button', 'btn btn-ghost btn-sm', 'Check');
            check.addEventListener('click', function () {
              check.disabled = true; check.textContent = '…';
              api('/api/admin/projects/' + p.id + '/check', { method: 'POST' })
                .then(loadProjects)
                .catch(function (e) { check.disabled = false; check.textContent = 'Check'; alert(e.message); });
            });
            actions.appendChild(check);
          }
          var archive = el('button', 'btn btn-ghost btn-sm', 'Archive');
          archive.addEventListener('click', function () {
            api('/api/admin/projects/' + p.id, { method: 'POST', body: { action: 'archive' } }).then(loadProjects);
          });
          actions.appendChild(archive);
          tr.appendChild(actions);
          return tr;
        });
      if (!data.projects.length) {
        emptyState(container, 'No client projects yet.', 'Add one to start tracking its health.');
      }
    }).catch(function (e) { emptyState(container, 'Could not load projects.', e.message); });
  }

  function loadContent() {
    var blog = document.querySelector('[data-blog-list]');
    var cases = document.querySelector('[data-case-list]');
    skeleton(blog, 3); skeleton(cases, 3);

    fetch('/blog/blog.json').then(function (r) { return r.json(); }).then(function (data) {
      var posts = data.posts || data || [];
      document.querySelector('[data-count="blog"]').textContent = posts.length + ' published';
      table(blog, ['Title', 'Date'], posts, function (p) {
        var tr = el('tr');
        var cell = el('td');
        var link = el('a', null, p.title || p.slug);
        link.href = '/blog/' + p.slug + '/'; link.target = '_blank'; link.rel = 'noopener';
        cell.appendChild(link);
        tr.appendChild(cell);
        tr.appendChild(el('td', null, p.date || '—'));
        return tr;
      });
    }).catch(function () { emptyState(blog, 'Could not read blog.json.'); });

    // Case studies are static files with no index endpoint, so this links to
    // the generated index rather than inventing a listing that could drift.
    emptyState(cases, 'Case studies are generated from content/.',
      'Open /case-studies/ to see the published set. Rebuilt automatically on push.');
    document.querySelector('[data-count="cases"]').textContent = '';
  }

  function moderationTable(container, endpoint, status, kind) {
    skeleton(container, 3);
    api(endpoint + '?status=' + status).then(function (data) {
      var rows = data[kind] || [];
      table(container,
        kind === 'reviews' ? ['From', 'Rating', 'Comment', 'Received', ''] : ['From', 'Page', 'Comment', 'Received', ''],
        rows,
        function (row) {
          var tr = el('tr');
          tr.appendChild(el('td', null, row.name));
          tr.appendChild(el('td', null, kind === 'reviews' ? '★'.repeat(row.rating || 0) : (row.target || '—')));
          var body = el('td', null, row.comment || row.body || '');
          body.style.maxWidth = '340px';
          tr.appendChild(body);
          tr.appendChild(el('td', null, fmtDate(row.created_at)));
          var actions = el('td', 'actions');
          if (!row.approved) {
            var approve = el('button', 'btn btn-primary btn-sm', 'Approve');
            approve.addEventListener('click', function () {
              api(endpoint + '/' + row.id, { method: 'POST', body: { action: 'approve' } })
                .then(function () { moderationTable(container, endpoint, status, kind); })
                .catch(function (e) { alert(e.message); });
            });
            actions.appendChild(approve);
          }
          var del = el('button', 'btn btn-danger btn-sm', 'Delete');
          del.addEventListener('click', function () {
            if (!confirm('Delete this permanently?')) return;
            api(endpoint + '/' + row.id, { method: 'POST', body: { action: 'delete' } })
              .then(function () { moderationTable(container, endpoint, status, kind); })
              .catch(function (e) { alert(e.message); });
          });
          actions.appendChild(del);
          tr.appendChild(actions);
          return tr;
        });
      if (!rows.length) emptyState(container, 'Nothing awaiting approval.', 'New submissions appear here first.');
    }).catch(function (e) { emptyState(container, 'Could not load.', e.message); });
  }

  function loadReviews() {
    moderationTable(document.querySelector('[data-reviews]'), '/api/admin/reviews',
      document.getElementById('reviewFilter').value, 'reviews');
  }
  function loadComments() {
    moderationTable(document.querySelector('[data-comments]'), '/api/admin/comments',
      document.getElementById('commentFilter').value, 'comments');
  }

  function loadEnquiries() {
    var container = document.querySelector('[data-enquiries]');
    skeleton(container, 4);
    api('/api/admin/contact').then(function (data) {
      table(container, ['From', 'Email', 'Message', 'Received', 'Notified'], data.submissions, function (s) {
        var tr = el('tr');
        tr.appendChild(el('td', null, s.name));
        var mail = el('td');
        var link = el('a', null, s.email);
        link.href = 'mailto:' + s.email;
        link.style.color = 'var(--emerald)';
        mail.appendChild(link);
        tr.appendChild(mail);
        var body = el('td', null, s.message);
        body.style.maxWidth = '380px';
        tr.appendChild(body);
        tr.appendChild(el('td', null, fmtDate(s.created_at)));
        var st = el('td');
        st.appendChild(pill(s.notification_status));
        if (s.notification_detail) {
          var detail = el('div', 'mono', s.notification_detail);
          detail.style.cssText = 'font-size:0.7rem;color:var(--text-dim);margin-top:4px;max-width:280px';
          st.appendChild(detail);
        }
        tr.appendChild(st);
        return tr;
      });
      if (!data.submissions.length) emptyState(container, 'No enquiries yet.');
    }).catch(function (e) { emptyState(container, 'Could not load enquiries.', e.message); });
  }

  function loadLeads() {
    var container = document.querySelector('[data-leads]');
    skeleton(container, 4);
    api('/api/admin/leads').then(function (data) {
      document.querySelector('[data-count="leads"]').textContent = data.leads.length + ' subscribers';
      table(container, ['Email', 'Subscribed'], data.leads, function (l) {
        var tr = el('tr');
        tr.appendChild(el('td', null, l.email));
        tr.appendChild(el('td', null, fmtDate(l.created_at)));
        return tr;
      });
      if (!data.leads.length) emptyState(container, 'No subscribers yet.');
    }).catch(function (e) { emptyState(container, 'Could not load leads.', e.message); });
  }

  function loadAnalytics() {
    var container = document.querySelector('[data-analytics]');
    clear(container);
    var configured = state.overview && state.overview.analytics && state.overview.analytics.configured;

    if (!configured) {
      // No sample charts. An operations console that shows invented traffic is
      // actively harmful — this says plainly what is missing instead.
      [
        ['Google Analytics 4', 'Sessions, acquisition channels and conversion funnels for sayadbayezid.com.'],
        ['Search Console', 'Impressions, clicks, average position and the queries behind them.'],
        ['Tag Manager', 'Which tags are live, and when each last fired.']
      ].forEach(function (item) {
        var panel = el('div', 'pending-panel');
        panel.style.marginBottom = '14px';
        panel.appendChild(el('h3', null, item[0]));
        panel.appendChild(el('p', null, item[1]));
        var note = el('p');
        note.appendChild(document.createTextNode('Connects once '));
        note.appendChild(el('code', null, 'GOOGLE_SERVICE_ACCOUNT_JSON'));
        note.appendChild(document.createTextNode(' is set as a Worker secret and the service-account email is granted read access to each property.'));
        panel.appendChild(note);
        container.appendChild(panel);
      });
      return;
    }
    emptyState(container, 'Analytics connected.', 'Reporting panels land in the next change.');
  }

  function loadSettings() {
    var container = document.querySelector('[data-settings]');
    skeleton(container, 5);
    fetch(API + '/api/console/health').then(function (r) { return r.json(); }).then(function (data) {
      var console_ = data.console || {};
      var rows = [
        ['Database', console_.databaseReachable],
        ['Enquiry notifications', console_.notificationsConfigured],
        ['Meta business token', console_.metaBusinessTokenConfigured],
        ['Meta app secret', console_.metaAppSecretConfigured],
        ['Ad account', console_.adAccountConfigured]
      ];
      table(container, ['Component', 'Status'], rows, function (row) {
        var tr = el('tr');
        tr.appendChild(el('td', null, row[0]));
        var st = el('td');
        st.appendChild(pill(row[1] ? 'up' : 'unknown'));
        tr.appendChild(st);
        return tr;
      });
      var note = el('p', 'field-hint');
      note.style.marginTop = '14px';
      note.textContent = 'Reported by the Worker at runtime. This is what the running service can actually see, which is not always what a dashboard page shows.';
      container.appendChild(note);
    }).catch(function (e) { emptyState(container, 'Could not reach the API.', e.message); });
  }

  // --- auth flow -----------------------------------------------------------
  function enterConsole() {
    gate.hidden = true;
    shell.hidden = false;
    var expiry = null;
    try { expiry = sessionStorage.getItem(EXPIRY_KEY); } catch (e) {}
    var node = document.querySelector('[data-session-expiry]');
    if (node && expiry) {
      node.textContent = new Date(expiry).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    show(location.hash.slice(1) || 'overview');
  }

  function signOut() {
    clearToken();
    shell.hidden = true;
    gate.hidden = false;
    state.overview = null;
  }

  document.getElementById('loginForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var notice = document.getElementById('loginNotice');
    var button = document.getElementById('loginBtn');
    notice.textContent = 'Checking…';
    notice.setAttribute('data-kind', 'pending');
    button.disabled = true;

    fetch(API + '/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    }).then(function (response) {
      return response.json().then(function (payload) {
        if (!response.ok) throw new Error(payload.error || 'Sign-in failed.');
        return payload;
      });
    }).then(function (payload) {
      storeToken(payload.token, payload.expiresAt);
      document.getElementById('password').value = '';
      notice.textContent = '';
      notice.removeAttribute('data-kind');
      enterConsole();
    }).catch(function (error) {
      notice.textContent = error.message;
      notice.setAttribute('data-kind', 'error');
    }).then(function () { button.disabled = false; });
  });

  document.getElementById('signOutBtn').addEventListener('click', signOut);
  document.getElementById('refreshBtn').addEventListener('click', function () {
    state.overview = null;
    show(state.view);
  });
  document.getElementById('navToggle').addEventListener('click', function () {
    sidebar.classList.toggle('open');
  });
  document.querySelectorAll('.side-link[data-view]').forEach(function (link) {
    link.addEventListener('click', function () { show(link.getAttribute('data-view')); });
  });
  document.getElementById('reviewFilter').addEventListener('change', loadReviews);
  document.getElementById('commentFilter').addEventListener('change', loadComments);
  window.addEventListener('hashchange', function () {
    var view = location.hash.slice(1);
    if (view && view !== state.view && !shell.hidden) show(view);
  });

  // --- add-project drawer --------------------------------------------------
  var drawer = document.getElementById('drawer');
  var scrim = document.getElementById('drawerScrim');
  function openDrawer() {
    drawer.hidden = false; scrim.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('open'); scrim.classList.add('open'); });
    document.getElementById('p-name').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); scrim.classList.remove('open');
    setTimeout(function () { drawer.hidden = true; scrim.hidden = true; }, 260);
  }
  document.getElementById('addProjectBtn').addEventListener('click', openDrawer);
  document.getElementById('drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

  document.getElementById('projectForm').addEventListener('submit', function (event) {
    event.preventDefault();
    var form = event.target;
    var notice = document.getElementById('projectNotice');
    var data = new FormData(form);
    notice.textContent = 'Saving…';
    notice.setAttribute('data-kind', 'pending');

    api('/api/admin/projects', {
      method: 'POST',
      body: {
        name: data.get('name'), provider: data.get('provider'),
        healthUrl: data.get('healthUrl'), dashboardUrl: data.get('dashboardUrl'),
        accountId: data.get('accountId'), apiToken: data.get('apiToken'),
        notes: data.get('notes')
      }
    }).then(function () {
      // Clear immediately: the credential fields should not sit in the DOM
      // after the request that consumed them.
      form.reset();
      notice.textContent = '';
      notice.removeAttribute('data-kind');
      closeDrawer();
      loadProjects();
    }).catch(function (error) {
      notice.textContent = error.message;
      notice.setAttribute('data-kind', 'error');
    });
  });

  // --- start ---------------------------------------------------------------
  if (readToken()) {
    // Confirm with the server rather than trusting a token that merely looks
    // unexpired locally.
    api('/api/admin/session').then(enterConsole).catch(function () { signOut(); });
  }
})();
