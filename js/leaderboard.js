/* Golf Creator Tour — live leaderboard widget.
   Renders the season standings from the production app's public API into
   any element carrying [data-leaderboard]. No dependencies.

   Options (data attributes on the element):
     data-limit="10"        rows to show (max 50)
     data-compact           hide the challenges column (tight placements)

   If the API is unreachable (local preview, ad blockers, app deploy in
   flight) the widget shows a preview board so the section never renders
   broken, clearly labelled as sample data. */
(function () {
  'use strict';

  var API_BASE = window.GCT_APP_ORIGIN || 'https://golfcreatortour.com';
  var REFRESH_MS = 5 * 60 * 1000; // matches the API's CDN cache window

  var FALLBACK = {
    season: '2026 Season',
    preview: true,
    entries: [
      { rank: 1, name: 'Sample Creator', handle: 'gctour', points: 4120, movement: 260, challenges_completed: 18 },
      { rank: 2, name: 'Season Preview', handle: 'gctour', points: 3875, movement: 145, challenges_completed: 16 },
      { rank: 3, name: 'Live Standings', handle: 'gctour', points: 3540, movement: -40, challenges_completed: 15 },
      { rank: 4, name: 'Loading Shortly', handle: 'gctour', points: 3210, movement: 90, challenges_completed: 13 },
      { rank: 5, name: 'Check The App', handle: 'gctour', points: 2980, movement: 30, challenges_completed: 12 }
    ]
  };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function initials(name) {
    return String(name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join('');
  }

  function formatPoints(points) {
    return Number(points || 0).toLocaleString('en-US');
  }

  function render(root, data) {
    root.innerHTML = '';

    var head = el('div', 'lb-head');
    var title = el('div', 'lb-title-wrap');
    title.appendChild(el('span', data.preview ? 'lb-live is-preview' : 'lb-live', data.preview ? 'PREVIEW' : 'LIVE'));
    title.appendChild(el('span', 'lb-season', data.season || 'Season Standings'));
    head.appendChild(title);

    var app = el('a', 'lb-app-link', 'Full leaderboard in the app →');
    app.href = API_BASE + '/';
    app.target = '_blank';
    app.rel = 'noopener';
    head.appendChild(app);
    root.appendChild(head);

    var list = el('ol', 'lb-rows');
    var compact = root.hasAttribute('data-compact');

    (data.entries || []).forEach(function (entry) {
      var row = el('li', 'lb-row' + (entry.rank <= 3 ? ' is-podium' : ''));

      row.appendChild(el('span', 'lb-rank', String(entry.rank)));

      var avatar = el('span', 'lb-avatar');
      if (entry.avatar_url) {
        var img = document.createElement('img');
        img.src = entry.avatar_url;
        img.alt = '';
        img.loading = 'lazy';
        avatar.appendChild(img);
      } else {
        avatar.textContent = initials(entry.name);
      }
      row.appendChild(avatar);

      var who = el('span', 'lb-who');
      who.appendChild(el('span', 'lb-name', entry.name || 'Creator'));
      if (entry.handle) who.appendChild(el('span', 'lb-handle', '@' + entry.handle));
      row.appendChild(who);

      if (!compact) {
        row.appendChild(el('span', 'lb-challenges', (entry.challenges_completed || 0) + ' challenges'));
      }

      var movement = Number(entry.movement || 0);
      row.appendChild(el(
        'span',
        'lb-move' + (movement > 0 ? ' is-up' : movement < 0 ? ' is-down' : ''),
        movement > 0 ? '▲ ' + formatPoints(movement) : movement < 0 ? '▼ ' + formatPoints(-movement) : '—'
      ));

      var points = el('span', 'lb-points', formatPoints(entry.points));
      points.appendChild(el('small', '', ' pts'));
      row.appendChild(points);

      list.appendChild(row);
    });
    root.appendChild(list);

    if (data.preview) {
      root.appendChild(el('p', 'lb-note', 'Sample standings shown — live points sync from the GCT app once connected.'));
    }
  }

  function load(root) {
    var limit = parseInt(root.dataset.limit || '10', 10);
    fetch(API_BASE + '/api/leaderboard?limit=' + limit, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.entries) || data.entries.length === 0) throw new Error('empty');
        render(root, data);
      })
      .catch(function () {
        // Keep whatever is on screen if a refresh fails; only fall back on
        // the first paint so live data never regresses to sample data.
        if (!root.querySelector('.lb-row')) render(root, FALLBACK);
      });
  }

  document.querySelectorAll('[data-leaderboard]').forEach(function (root) {
    render(root, { season: 'Loading standings…', entries: [] });
    load(root);
    setInterval(function () { load(root); }, REFRESH_MS);
  });
})();
