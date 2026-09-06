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
    report: { title: 'Developer report', crumb: 'Clients', load: loadReport },
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
          var edit = el('button', 'btn btn-ghost btn-sm', 'Edit');
          edit.addEventListener('click', function () { openDrawer(p); });
          actions.appendChild(edit);
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


  // --- developer report ----------------------------------------------------
  //
  // The weekly report used to be written into a Google Doc and two Sheets by a
  // service account. It is assembled from this backend's own health rows now,
  // so there is no Google dependency and nothing to pay for.

  var reportDays = 7;

  /** Uptime is null when nothing was measured. Never render that as 100%. */
  function uptimeLabel(pct) {
    return pct === null || pct === undefined ? 'not measured' : pct + '%';
  }

  function loadReport() {
    var summary = document.querySelector('[data-report-summary]');
    var tableBox = document.querySelector('[data-report-table]');
    var incidents = document.querySelector('[data-report-incidents]');
    var rangeBox = document.querySelector('[data-report-range]');

    clear(rangeBox);
    var bar = el('div', 'comment-form-actions');
    bar.style.marginBottom = '18px';
    [[7, '7 days'], [30, '30 days'], [90, '90 days']].forEach(function (option) {
      var button = el('button', 'btn btn-sm ' + (reportDays === option[0] ? 'btn-primary' : 'btn-ghost'), option[1]);
      button.addEventListener('click', function () { reportDays = option[0]; loadReport(); });
      bar.appendChild(button);
    });
    rangeBox.appendChild(bar);

    skeleton(tableBox, 3);
    api('/api/admin/projects/report?days=' + reportDays).then(function (data) {
      document.querySelector('[data-report-generated]').textContent =
        'Generated ' + fmtDate(data.generatedAt);

      clear(summary);
      [
        { label: 'Projects tracked', value: num(data.summary.total),
          sub: num(data.summary.up) + ' up, ' + num(data.summary.down) + ' down', accent: '#5AA9E6' },
        // Called out on its own card rather than folded into "up": a project
        // nobody has checked is not a healthy one, and the old Google report
        // could not tell the two apart either.
        { label: 'Never checked', value: num(data.summary.unmeasured),
          sub: data.summary.unmeasured ? 'press Check to measure these' : 'every project has been measured',
          accent: data.summary.unmeasured ? '#D4AF6A' : '#00A868' },
        { label: 'Incidents', value: num(data.summary.incidents),
          sub: 'failed checks in the last ' + data.days + ' days',
          accent: data.summary.incidents ? '#E5735F' : '#00D084' },
        { label: 'Window', value: data.days + 'd', sub: 'health polls are on demand', accent: '#00A868' }
      ].forEach(function (stat) {
        var card = el('div', 'stat');
        card.style.setProperty('--accent', stat.accent);
        card.appendChild(el('div', 'stat-label', stat.label));
        card.appendChild(el('div', 'stat-value', stat.value));
        card.appendChild(el('div', 'stat-sub', stat.sub));
        summary.appendChild(card);
      });

      table(tableBox,
        ['Project', 'Status', 'Uptime', 'Checks', 'Avg latency', 'Worst', 'Last checked'],
        data.projects,
        function (row) {
          var tr = el('tr');
          tr.appendChild(el('td', null, row.name));
          var st = el('td'); st.appendChild(pill(row.status)); tr.appendChild(st);
          // "not measured" is dimmed so it reads as an absence rather than a
          // number — it is the row most likely to be misread as a good result.
          var up = el('td', null, uptimeLabel(row.uptimePct));
          if (row.uptimePct === null) up.className = 'unmeasured';
          tr.appendChild(up);
          tr.appendChild(el('td', 'mono', num(row.checks)));
          tr.appendChild(el('td', 'mono', row.avgLatencyMs === null ? '—' : row.avgLatencyMs + ' ms'));
          tr.appendChild(el('td', 'mono', row.worstLatencyMs === null ? '—' : row.worstLatencyMs + ' ms'));
          tr.appendChild(el('td', null, fmtDate(row.lastCheckedAt)));
          return tr;
        });
      if (!data.projects.length) {
        emptyState(tableBox, 'No client projects yet.', 'Add one on the Project health page.');
      }

      clear(incidents);
      var any = false;
      data.projects.forEach(function (row) {
        if (!row.incidents.length) return;
        any = true;
        var block = el('div', 'incident-block');
        block.appendChild(el('div', 'incident-name', row.name));
        row.incidents.forEach(function (incident) {
          var line = el('div', 'incident-line');
          line.appendChild(el('span', 'incident-code', incident.statusCode ? 'HTTP ' + incident.statusCode : 'no response'));
          // detail is the fetch error or status line the project returned —
          // textContent, never innerHTML, like everything else on this page.
          line.appendChild(el('span', 'incident-detail', incident.detail || ''));
          line.appendChild(el('span', 'incident-when', fmtDate(incident.at)));
          block.appendChild(line);
        });
        if (row.incidentCount > row.incidents.length) {
          block.appendChild(el('div', 'incident-more',
            'and ' + (row.incidentCount - row.incidents.length) + ' more'));
        }
        incidents.appendChild(block);
      });
      if (!any) emptyState(incidents, 'No failures in this window.', 'Every check that ran came back healthy.');
    }).catch(function (error) {
      emptyState(tableBox, 'Could not load the report.', error.message);
    });
  }

  function loadContent() {
    loadContentStatus();
    updateSlugPreview();
    renderSeoPanel();
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


  // --- publishing -----------------------------------------------------------
  //
  // Posts and case studies are Markdown files in this repository, turned into
  // HTML by a GitHub Actions workflow on push. Publishing from here is a
  // commit: the Worker writes the file, the existing pipeline does the rest.
  // Nothing new to keep in sync, and anything published this way can still be
  // edited or reverted as an ordinary commit.

  /** Mirrors the Worker's slug rule so the URL shown here is the one you get. */
  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

// --- the pre-publish checklist and the two previews ----------------------
  //
  // Every rule is a real constraint with a reason, not a score to chase. The
  // character ranges are where Google actually truncates and where a field
  // stops carrying enough information — a title of 12 characters is not a
  // style problem, it is a title that tells a searcher nothing.

  var SEO_RULES = [
    {
      label: 'Title is 15–70 characters',
      // Under 15 says nothing; over 70 is cut off in most results.
      test: function (v) { return v.title.length >= 15 && v.title.length <= 70; },
      detail: function (v) { return v.title.length + ' characters'; }
    },
    {
      label: 'SEO title is 30–65 characters',
      // Blank is fine — it falls back to the title, and that is checked above.
      test: function (v) {
        return !v.seoTitle || (v.seoTitle.length >= 30 && v.seoTitle.length <= 65);
      },
      detail: function (v) {
        return v.seoTitle ? v.seoTitle.length + ' characters' : 'blank — using the title';
      }
    },
    {
      label: 'Meta description is 70–158 characters',
      test: function (v) { return v.description.length >= 70 && v.description.length <= 158; },
      detail: function (v) { return v.description.length + ' characters'; }
    },
    {
      label: 'A cover image is set',
      test: function (v) { return !!v.image; },
      // Alt text is called out separately rather than failing the row: an
      // image with no alt still works for sighted readers, it just excludes
      // everyone else and says nothing to a crawler.
      detail: function (v) {
        if (!v.image) return 'none';
        return v.imageAlt ? 'set, with alt text' : 'set — but no alt text yet';
      },
      warn: function (v) { return !!v.image && !v.imageAlt; }
    },
    {
      label: 'A summary is written',
      test: function (v) { return (v.summary || v.description).length >= 40; },
      detail: function (v) {
        return v.summary ? v.summary.length + ' characters'
          : (v.description ? 'reusing the meta description' : 'none');
      }
    },
    {
      label: 'URL slug is short and readable',
      // Three to six words reads well in a result and survives being pasted
      // into a message. Longer still works; it just stops being readable.
      test: function (v) {
        var words = v.slug ? v.slug.split('-').filter(Boolean).length : 0;
        return v.slug.length > 0 && v.slug.length <= 60 && words <= 8;
      },
      detail: function (v) {
        if (!v.slug) return 'none yet';
        return v.slug.length + ' characters, ' + v.slug.split('-').filter(Boolean).length + ' words';
      }
    },
    {
      label: 'Keywords added',
      test: function (v) { return v.keywords.length >= 2; },
      detail: function (v) { return v.keywords.length ? v.keywords.length + ' added' : 'none'; }
    },
    {
      label: 'Article body has real depth (300+ characters)',
      test: function (v) { return v.body.length >= 300; },
      detail: function (v) { return v.body.length + ' characters'; }
    }
  ];

  function seoValues() {
    var get = function (id) { return (document.getElementById(id).value || '').trim(); };
    var explicit = get('c-slug');
    return {
      title: get('c-title'),
      seoTitle: get('c-seotitle'),
      description: get('c-description'),
      summary: get('c-summary'),
      image: get('c-image'),
      imageAlt: get('c-imagealt'),
      keywords: get('c-keywords').split(',').map(function (k) { return k.trim(); }).filter(Boolean),
      slug: slugify(explicit || get('c-title')),
      body: get('c-body'),
      type: document.getElementById('c-type').value
    };
  }

  /** Google trims on pixel width; character counts are the honest approximation. */
  function clip(text, max) {
    return text.length > max ? text.slice(0, max - 1).replace(/[\s,;:.]+$/, '') + '…' : text;
  }

  function renderSeoPanel() {
    var v = seoValues();
    var list = document.querySelector('[data-seo-checklist]');
    if (!list) return;

    clear(list);
    SEO_RULES.forEach(function (rule) {
      var ok = rule.test(v);
      var warn = ok && rule.warn && rule.warn(v);
      var li = el('li', 'seo-check ' + (ok ? (warn ? 'is-warn' : 'is-ok') : 'is-todo'));
      li.appendChild(el('span', 'seo-check-mark', ok ? (warn ? '!' : '✓') : '○'));
      var text = el('span', 'seo-check-text');
      text.appendChild(el('span', null, rule.label));
      text.appendChild(el('span', 'seo-check-detail', rule.detail(v)));
      li.appendChild(text);
      list.appendChild(li);
    });

    // --- Google preview ---
    var path = v.type === 'blog' ? 'blog' : 'case-studies';
    document.querySelector('[data-serp-url]').textContent =
      'sayadbayezid.com › ' + path + (v.slug ? ' › ' + v.slug : '');
    // Google shows the title tag, so the preview must too — otherwise the
    // preview lies about the one field this panel exists to get right.
    var serpTitle = v.seoTitle || (v.title ? v.title + ' - Sayad Md Bayezid Hosan' : '');
    document.querySelector('[data-serp-title]').textContent =
      serpTitle ? clip(serpTitle, 65) : 'Your title will appear here';
    document.querySelector('[data-serp-desc]').textContent =
      v.description ? clip(v.description, 158) : 'And the meta description underneath it.';

    // --- Card preview ---
    var cardImage = document.querySelector('[data-card-image]');
    clear(cardImage);
    if (v.image) {
      // The console is served from the same origin as the site, so a
      // site-relative path resolves on its own. An absolute URL passes
      // through untouched.
      var img = el('img');
      img.alt = v.imageAlt || '';
      // A path that does not resolve has to say so. A silently broken image
      // in a preview is worse than no preview: it looks like the cover is
      // fine right up until the post is published.
      img.addEventListener('error', function () {
        clear(cardImage);
        cardImage.appendChild(el('span', null, 'That image path did not load'));
      });
      img.src = v.image;
      cardImage.appendChild(img);
    } else {
      cardImage.appendChild(el('span', null, 'No cover image'));
    }
    document.querySelector('[data-card-meta]').textContent =
      (document.getElementById('c-category').value || 'General').trim();
    document.querySelector('[data-card-title]').textContent = v.title || 'Your title will appear here';
    document.querySelector('[data-card-desc]').textContent =
      clip(v.summary || v.description || 'The summary shown on the blog grid.', 165);

    // Live character counts next to the labels they belong to.
    ['c-title', 'c-seotitle', 'c-description', 'c-summary'].forEach(function (id) {
      var badge = document.querySelector('[data-count-for="' + id + '"]');
      if (badge) badge.textContent = (document.getElementById(id).value || '').trim().length;
    });
  }

  function publishPayload(preview) {
    var form = document.getElementById('publishForm');
    var data = new FormData(form);
    var payload = {
      type: data.get('type'),
      title: data.get('title'),
      seoTitle: data.get('seoTitle'),
      description: data.get('description'),
      summary: data.get('summary'),
      keywords: data.get('keywords'),
      category: data.get('category'),
      image: data.get('image'),
      imageAlt: data.get('imageAlt'),
      body: data.get('body')
    };
    var slug = String(data.get('slug') || '').trim();
    if (slug) payload.slug = slug;
    if (preview) payload.preview = true;
    return payload;
  }

  function updateSlugPreview() {
    var hint = document.querySelector('[data-slug-preview]');
    if (!hint) return;
    var explicit = document.getElementById('c-slug').value.trim();
    var slug = slugify(explicit || document.getElementById('c-title').value);
    var type = document.getElementById('c-type').value;
    if (!slug) { hint.textContent = 'The address is built from the title.'; return; }
    hint.textContent = type === 'blog'
      ? 'Will publish at /blog/' + slug + '/'
      : 'Will publish at /case-studies/' + slug + '.html';
  }

  function loadContentStatus() {
    var badge = document.querySelector('[data-content-status]');
    if (!badge) return;
    badge.textContent = 'checking…';
    api('/api/admin/content/status').then(function (data) {
      // Say what is wrong, not just that something is. A token set under the
      // wrong name has cost real time on this project more than once.
      if (data.ok) {
        badge.textContent = 'Publishing to ' + data.repo + ' (' + data.branch + ')';
        badge.removeAttribute('data-kind');
      } else {
        badge.textContent = data.error || 'Publishing is not configured.';
        badge.setAttribute('data-kind', 'error');
      }
    }).catch(function (error) {
      badge.textContent = error.message;
      badge.setAttribute('data-kind', 'error');
    });
  }

  function wirePublishForm() {
    var form = document.getElementById('publishForm');
    if (!form) return;
    var notice = document.getElementById('publishNotice');
    var preview = document.querySelector('[data-publish-preview]');

    var repaint = function () { updateSlugPreview(); renderSeoPanel(); };
    ['c-title', 'c-seotitle', 'c-slug', 'c-type', 'c-category', 'c-description',
     'c-summary', 'c-keywords', 'c-image', 'c-imagealt', 'c-body'].forEach(function (id) {
      var field = document.getElementById(id);
      if (!field) return;
      field.addEventListener('input', repaint);
      field.addEventListener('change', repaint);
    });
    repaint();

    document.getElementById('previewBtn').addEventListener('click', function () {
      notice.textContent = 'Building the file…';
      notice.setAttribute('data-kind', 'pending');
      api('/api/admin/content', { method: 'POST', body: publishPayload(true) })
        .then(function (data) {
          // textContent, never innerHTML — this is the author's own prose but
          // the rule holds everywhere on this page.
          preview.textContent = data.contents;
          preview.hidden = false;
          notice.textContent = 'This is exactly what would be committed to ' + data.path;
          notice.setAttribute('data-kind', 'pending');
        })
        .catch(function (error) {
          preview.hidden = true;
          notice.textContent = error.message;
          notice.setAttribute('data-kind', 'error');
        });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      notice.textContent = 'Committing…';
      notice.setAttribute('data-kind', 'pending');

      api('/api/admin/content', { method: 'POST', body: publishPayload(false) })
        .then(function (data) {
          preview.hidden = true;
          clear(notice);
          notice.removeAttribute('data-kind');
          notice.appendChild(el('span', null, 'Committed ' + data.path + '. '));
          var link = el('a', null, 'It will appear at ' + data.url + ' once the build finishes.');
          link.href = data.url; link.target = '_blank'; link.rel = 'noopener';
          notice.appendChild(link);
          form.reset();
          updateSlugPreview();
          loadContent();
        })
        .catch(function (error) {
          notice.textContent = error.message;
          notice.setAttribute('data-kind', 'error');
        })
        .finally(function () { submit.disabled = false; });
    });
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

  // --- analytics -----------------------------------------------------------

  var analyticsRange = '28d';

  /** Horizontal bars for a categorical breakdown. Sorted by the API, drawn in
   *  the order given, widths relative to the largest — a share-of-total scale
   *  would render a long tail as invisible slivers. */
  function barList(container, rows, labelKey, valueKey, unit) {
    clear(container);
    if (!rows.length) { emptyState(container, 'No data in this range.'); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r[valueKey]; }).concat([1]));
    var wrap = el('div', 'funnel');
    rows.forEach(function (row) {
      var line = el('div', 'funnel-row');
      var label = el('span', null, row[labelKey] || '—');
      label.title = row[labelKey] || '';
      line.appendChild(label);
      var track = el('div', 'funnel-track');
      var fill = el('div', 'funnel-fill');
      fill.style.setProperty('--pct', Math.max((row[valueKey] / max) * 100, row[valueKey] ? 4 : 0) + '%');
      track.appendChild(fill);
      line.appendChild(track);
      line.appendChild(el('span', 'funnel-value', num(row[valueKey]) + (unit || '')));
      wrap.appendChild(line);
    });
    container.appendChild(wrap);
  }

  /** Two series on one set of axes, each scaled to its own maximum. Clicks and
   *  impressions differ by an order of magnitude; a shared scale would flatten
   *  clicks onto the axis and say nothing. The legend states the scaling so the
   *  chart is not quietly misleading about relative size. */
  function dualLineChart(container, points, aKey, bKey, aLabel, bLabel) {
    clear(container);
    if (!points.length) { emptyState(container, 'No data in this range.'); return; }
    var w = 640, h = 200, padL = 34, padR = 34, padT = 14, padB = 26;
    var maxA = Math.max.apply(null, points.map(function (p) { return p[aKey]; }).concat([1]));
    var maxB = Math.max.apply(null, points.map(function (p) { return p[bKey]; }).concat([1]));
    var stepX = (w - padL - padR) / Math.max(points.length - 1, 1);
    var yFor = function (v, max) { return padT + (h - padT - padB) * (1 - v / max); };

    var chart = svg('svg', { class: 'chart', viewBox: '0 0 ' + w + ' ' + h, role: 'img' });
    [0, 0.5, 1].forEach(function (f) {
      var gy = padT + (h - padT - padB) * f;
      chart.appendChild(svg('line', { x1: padL, x2: w - padR, y1: gy, y2: gy, stroke: 'rgba(237,239,236,0.07)', 'stroke-width': 1 }));
    });

    [[aKey, maxA, '#00D084'], [bKey, maxB, '#5AA9E6']].forEach(function (series) {
      var d = points.map(function (p, i) {
        return (i ? 'L' : 'M') + (padL + i * stepX).toFixed(1) + ' ' + yFor(p[series[0]], series[1]).toFixed(1);
      }).join(' ');
      var path = svg('path', {
        d: d, fill: 'none', stroke: series[2], 'stroke-width': 2.1,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'line-path'
      });
      chart.appendChild(path);
      requestAnimationFrame(function () {
        var len = 0;
        try { len = path.getTotalLength(); } catch (e) {}
        path.style.setProperty('--len', (len || 1200).toFixed(0));
      });
    });

    points.forEach(function (p, i) {
      if (i % Math.ceil(points.length / 7) !== 0) return;
      var label = svg('text', {
        x: (padL + i * stepX).toFixed(1), y: h - 8,
        fill: '#5C6A62', 'font-size': 10, 'text-anchor': 'middle'
      });
      label.textContent = String(p.date || '').slice(8) || '';
      chart.appendChild(label);
    });
    container.appendChild(chart);

    var legend = el('div', 'chart-legend');
    [[aLabel, '#00D084', maxA], [bLabel, '#5AA9E6', maxB]].forEach(function (item) {
      var span = el('span');
      var swatch = el('i');
      swatch.style.background = item[1];
      span.appendChild(swatch);
      span.appendChild(document.createTextNode(item[0] + ' (peak ' + num(item[2]) + ')'));
      legend.appendChild(span);
    });
    container.appendChild(legend);
  }

  function loadAnalytics() {
    var container = document.querySelector('[data-analytics]');
    skeleton(container, 6);

    api('/api/admin/analytics?range=' + analyticsRange).then(function (data) {
      clear(container);

      if (!data.configured) {
        var panel = el('div', 'pending-panel');
        panel.appendChild(el('h3', null, 'Analytics is not connected'));
        panel.appendChild(el('p', null, data.note || ''));
        container.appendChild(panel);
        return;
      }

      // Range switch.
      var bar = el('div', 'comment-form-actions');
      bar.style.marginBottom = '18px';
      [['7d', '7 days'], ['28d', '28 days'], ['90d', '90 days']].forEach(function (option) {
        var button = el('button', 'btn btn-sm ' + (analyticsRange === option[0] ? 'btn-primary' : 'btn-ghost'), option[1]);
        button.addEventListener('click', function () { analyticsRange = option[0]; loadAnalytics(); });
        bar.appendChild(button);
      });
      var diagnose = el('button', 'btn btn-ghost btn-sm', 'Diagnose connection');
      diagnose.style.marginLeft = 'auto';
      diagnose.addEventListener('click', showDiagnosis);
      bar.appendChild(diagnose);
      container.appendChild(bar);

      // --- GA4 ---------------------------------------------------------
      if (data.analyticsError) {
        container.appendChild(sourceError('Google Analytics', data.analyticsError));
      } else if (data.analytics) {
        var a = data.analytics;
        var stats = el('div', 'stat-grid');
        [
          ['Sessions', num(a.totals.sessions), 'in the last ' + data.days + ' days', '#00D084'],
          ['Users', num(a.totals.users), 'unique visitors', '#5AA9E6'],
          ['Page views', num(a.totals.pageViews), 'across the site', '#D4AF6A'],
          ['Engagement', (a.totals.engagementRate * 100).toFixed(1) + '%', 'of sessions engaged', '#00A868']
        ].forEach(function (s) {
          var card = el('div', 'stat');
          card.style.setProperty('--accent', s[3]);
          card.appendChild(el('div', 'stat-label', s[0]));
          card.appendChild(el('div', 'stat-value', s[1]));
          card.appendChild(el('div', 'stat-sub', s[2]));
          stats.appendChild(card);
        });
        container.appendChild(stats);

        var traffic = card('Traffic', 'sessions and users per day');
        dualLineChart(traffic.body, a.timeseries, 'sessions', 'users', 'Sessions', 'Users');
        container.appendChild(traffic.root);

        var split = el('div', 'grid-halves');
        split.style.marginTop = '16px';

        var channels = card('Acquisition', 'sessions by channel');
        barList(channels.body, a.channels, 'channel', 'sessions');
        split.appendChild(channels.root);

        var geo = card('Geography', 'users by country');
        barList(geo.body, a.countries.filter(function (c) { return c.users > 0; }).slice(0, 8), 'country', 'users');
        split.appendChild(geo.root);
        container.appendChild(split);

        var pages = card('Top pages', 'by views');
        table(pages.body, ['Page', 'Views', 'Users'], a.pages, function (p) {
          var tr = el('tr');
          var cell = el('td');
          var link = el('a', null, p.path);
          link.href = 'https://sayadbayezid.com' + p.path;
          link.target = '_blank';
          link.rel = 'noopener';
          cell.appendChild(link);
          tr.appendChild(cell);
          tr.appendChild(el('td', 'mono', num(p.views)));
          tr.appendChild(el('td', 'mono', num(p.users)));
          return tr;
        });
        pages.root.style.marginTop = '16px';
        container.appendChild(pages.root);
      }

      // --- Search Console ----------------------------------------------
      if (data.searchError) {
        container.appendChild(sourceError('Search Console', data.searchError));
      } else if (data.search) {
        var s = data.search;
        var searchStats = el('div', 'stat-grid');
        searchStats.style.marginTop = '22px';
        [
          ['Clicks', num(s.totals.clicks), 'from Google search', '#00D084'],
          ['Impressions', num(s.totals.impressions), 'times shown', '#5AA9E6'],
          ['CTR', (s.totals.ctr * 100).toFixed(2) + '%', 'clicks per impression', '#D4AF6A'],
          ['Avg position', s.totals.position.toFixed(1), 'lower is better', '#E5A23F']
        ].forEach(function (stat) {
          var card_ = el('div', 'stat');
          card_.style.setProperty('--accent', stat[3]);
          card_.appendChild(el('div', 'stat-label', stat[0]));
          card_.appendChild(el('div', 'stat-value', stat[1]));
          card_.appendChild(el('div', 'stat-sub', stat[2]));
          searchStats.appendChild(card_);
        });
        container.appendChild(searchStats);

        var searchChart = card('Search performance', s.site);
        dualLineChart(searchChart.body, s.timeseries, 'clicks', 'impressions', 'Clicks', 'Impressions');
        container.appendChild(searchChart.root);

        var queries = card('Queries', 'what people searched to find you');
        queries.root.style.marginTop = '16px';
        table(queries.body, ['Query', 'Clicks', 'Impressions', 'Position'], s.queries, function (q) {
          var tr = el('tr');
          tr.appendChild(el('td', null, q.query));
          tr.appendChild(el('td', 'mono', num(q.clicks)));
          tr.appendChild(el('td', 'mono', num(q.impressions)));
          tr.appendChild(el('td', 'mono', q.position.toFixed(1)));
          return tr;
        });
        container.appendChild(queries.root);
      }
    }).catch(function (error) {
      emptyState(container, 'Could not load analytics.', error.message);
    });
  }

  /** A card shell, so each panel does not rebuild the same four elements. */
  function card(title, meta) {
    var root = el('div', 'card');
    var head = el('div', 'card-head');
    head.appendChild(el('h2', null, title));
    if (meta) head.appendChild(el('span', 'meta', meta));
    root.appendChild(head);
    var body = el('div');
    root.appendChild(body);
    return { root: root, body: body };
  }

  /** One source failing must not look like the whole section failing, and the
   *  reason has to be Google's own words — those name the actual cause. */
  function sourceError(name, detail) {
    var panel = el('div', 'pending-panel');
    panel.style.marginTop = '16px';
    panel.style.textAlign = 'left';
    panel.appendChild(el('h3', null, name + ' could not be read'));
    var p = el('p', null, detail);
    p.style.margin = '0 0 12px';
    panel.appendChild(p);
    var hint = el('p');
    hint.style.margin = '0';
    hint.appendChild(document.createTextNode('Use '));
    hint.appendChild(el('code', null, 'Diagnose connection'));
    hint.appendChild(document.createTextNode(' above to see which properties the service account can actually reach.'));
    panel.appendChild(hint);
    return panel;
  }

  function showDiagnosis() {
    var container = document.querySelector('[data-analytics]');
    skeleton(container, 5);
    api('/api/admin/analytics/diagnose').then(function (d) {
      clear(container);
      var back = el('button', 'btn btn-ghost btn-sm', '← Back to analytics');
      back.style.marginBottom = '16px';
      back.addEventListener('click', loadAnalytics);
      container.appendChild(back);

      var head = card('Connection', 'what the service account can reach');
      var who = el('p', 'field-hint');
      who.style.margin = '0 0 14px';
      who.appendChild(document.createTextNode('Share each property with '));
      who.appendChild(el('code', null, d.serviceAccount || 'the service account'));
      who.appendChild(document.createTextNode(' at read access.'));
      head.body.appendChild(who);

      var rows = [
        ['Google Analytics', d.ga4],
        ['Search Console', d.searchConsole],
        ['Tag Manager', d.tagManager]
      ];
      table(head.body, ['Surface', 'Status', 'Detail'], rows, function (row) {
        var tr = el('tr');
        tr.appendChild(el('td', null, row[0]));
        var st = el('td');
        st.appendChild(pill(row[1] && row[1].ok ? 'up' : 'down'));
        tr.appendChild(st);
        var detail = el('td');
        detail.style.maxWidth = '520px';
        if (row[1] && row[1].ok) {
          if (row[1].propertyId) detail.appendChild(el('div', 'mono', 'property ' + row[1].propertyId));
          if (typeof row[1].sessionsLast7Days === 'number') {
            detail.appendChild(el('div', null, num(row[1].sessionsLast7Days) + ' sessions in the last 7 days'));
          }
          if (row[1].visible) {
            detail.appendChild(el('div', null, row[1].shared ? 'Reading ' + row[1].expecting : 'Configured site is not among those visible'));
            (row[1].visible || []).forEach(function (site) { detail.appendChild(el('div', 'mono', site)); });
          }
          if (row[1].accounts) (row[1].accounts).forEach(function (a) { detail.appendChild(el('div', 'mono', a)); });
        } else {
          detail.appendChild(el('div', null, (row[1] && row[1].error) || d.detail || 'Not reachable'));
        }
        tr.appendChild(detail);
        return tr;
      });
      container.appendChild(head.root);
    }).catch(function (error) {
      emptyState(container, 'Could not run the diagnosis.', error.message);
    });
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
  // The id being edited, or '' when adding. The same drawer serves both: an
  // edit form that looked different would drift from the add form.
  var editingProject = '';

  /**
   * Opens the drawer. Pass a project to edit it.
   *
   * Credential fields are never pre-filled, because there is nothing to
   * pre-fill them with — the API stores ciphertext and does not hand it back.
   * Left blank on an edit they are omitted from the request entirely, so the
   * stored value survives; that is what the hint above them says, and it is
   * why the submit handler below deletes empty credential keys rather than
   * sending "".
   */
  function openDrawer(project) {
    var form = document.getElementById('projectForm');
    var hint = document.getElementById('editingHint');
    form.reset();
    editingProject = project ? project.id : '';

    document.getElementById('drawerTitle').textContent =
      project ? 'Edit ' + project.name : 'Add a client project';
    document.querySelector('#projectForm button[type=submit]').textContent =
      project ? 'Save changes' : 'Save project';

    if (project) {
      document.getElementById('p-name').value = project.name || '';
      document.getElementById('p-provider').value = project.provider || 'other';
      document.getElementById('p-health').value = project.health_url || '';
      document.getElementById('p-dash').value = project.dashboard_url || '';
      document.getElementById('p-notes').value = project.notes || '';
      hint.textContent = 'Leave the two credential fields blank to keep the stored ones — '
        + 'they cannot be shown here. Fill one in only to replace it.';
      hint.hidden = false;
      document.getElementById('p-account').placeholder = 'Unchanged (' + (project.account_hint || 'not set') + ')';
      document.getElementById('p-token').placeholder = 'Unchanged (' + (project.token_hint || 'not set') + ')';
    } else {
      hint.hidden = true;
      document.getElementById('p-account').placeholder = 'Stored encrypted';
      document.getElementById('p-token').placeholder = 'Stored encrypted';
    }

    drawer.hidden = false; scrim.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add('open'); scrim.classList.add('open'); });
    document.getElementById('p-name').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); scrim.classList.remove('open');
    setTimeout(function () {
      drawer.hidden = true; scrim.hidden = true;
      // Never leave a typed credential sitting in the DOM after the drawer
      // closes, cancelled or not.
      document.getElementById('projectForm').reset();
      editingProject = '';
    }, 260);
  }
  document.getElementById('addProjectBtn').addEventListener('click', function () { openDrawer(null); });
  wirePublishForm();
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

    var body = {
      name: data.get('name'), provider: data.get('provider'),
      healthUrl: data.get('healthUrl'), dashboardUrl: data.get('dashboardUrl'),
      notes: data.get('notes')
    };

    // Credentials are sent only when something was actually typed. On an edit
    // this is what protects the stored value: the API treats an explicit ""
    // as "clear this", so sending an untouched empty field would wipe a
    // client's API token as a side effect of fixing a URL.
    var account = data.get('accountId');
    var token = data.get('apiToken');
    if (account) body.accountId = account;
    if (token) body.apiToken = token;

    api(editingProject ? '/api/admin/projects/' + editingProject : '/api/admin/projects', {
      method: editingProject ? 'PATCH' : 'POST',
      body: body
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
