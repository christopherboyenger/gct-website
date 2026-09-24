/* Golf Creator Tour — shared marketing site behaviour */
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  // Brands that have run campaigns/challenges on GCT (logo strip + simplified case studies).
  var LOGO = 'https://qvuqjpcxnnikbigixupb.supabase.co/storage/v1/object/public/challenge-logos/sponsors/';
  var BRANDS = [
    { name: 'PUR3 Golf', logo: LOGO + '760726bf-1908-42dd-994c-c930cb791c05-1787108059061.jpg', category: 'Golf gloves',
      campaign: '3 always-on glove challenges',
      summary: 'Seeded the Tour with gloves and built a library of on-course glove content from creators competing for points.',
      stats: [['2.2M', 'combined creator reach'], ['69', 'creators activated'], ['72', 'posts created']] },
    { name: 'BLURRD', logo: LOGO + 'be559f17-71c9-4b1d-8958-a9ae8234a432-1787199611185.PNG', category: 'Golf gloves',
      campaign: 'One Club Challenge · product seeding',
      summary: 'A play-a-hole-with-one-club brief with an organic glove moment. All 20 spots were claimed in under 10 hours, and applications kept coming.',
      stats: [['9 hrs', 'to fill every spot'], ['2.4×', 'oversubscribed'], ['736K', 'combined creator reach']] },
    { name: 'Bad Cards', logo: LOGO + '70d84494-65b4-41bc-9d46-3b92834413ec-1787069380816.png', category: 'On-course card game',
      campaign: 'On-Course Challenge · product seeding',
      summary: 'Creators filmed themselves drawing a card and playing the hole. One brief put the game in front of 1.8 million followers.',
      stats: [['1.8M', 'combined creator reach'], ['19', 'applications in 24 hrs'], ['22', 'creators seeded']] },
    { name: 'Malcontents', logo: 'assets/brands/malcontents.jpg', category: 'Golf apparel',
      campaign: 'Fit Check challenge',
      summary: 'An apparel fit-check challenge that turned creators into on-course models for the brand, fully booked in less than a day.',
      stats: [['18 hrs', 'to fill every spot'], ['216K', 'combined creator reach'], ['100%', 'of spots claimed']] }
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function avatar(b) {
    return '<span class="b-av"><img src="' + b.logo + '" alt="" loading="lazy" onerror="this.remove()"><span>' + esc(b.name.charAt(0)) + '</span></span>';
  }
  // Logo strip: case-study brands plus other brands GCT has worked with.
  // wide: true = the logo already contains the brand name (shown on its own).
  var STRIP = BRANDS.concat([
    { name: 'Dryvebox', logo: 'assets/brands/dryvebox.jpg', wide: true },
    { name: 'PopStroke', logo: 'assets/brands/popstroke.jpg', wide: true },
    { name: 'Performance Golf', logo: 'assets/brands/performance-golf.jpg' },
    { name: 'ShipSticks', logo: 'assets/brands/shipsticks.jpg' }
  ]);
  document.querySelectorAll('[data-brand-strip]').forEach(function (host) {
    host.innerHTML = '<div class="brand-track">' + STRIP.map(function (b) {
      return b.wide
        ? '<div class="b-chip"><img class="b-word" src="' + b.logo + '" alt="' + esc(b.name) + '" loading="lazy"></div>'
        : '<div class="b-chip">' + avatar(b) + '<b>' + esc(b.name) + '</b></div>';
    }).join('') + '</div>';
  });
  document.querySelectorAll('[data-case-studies]').forEach(function (host) {
    host.innerHTML = BRANDS.map(function (b, i) {
      return '<article class="card cs rv' + (i % 2 ? ' d1' : '') + '">' +
        '<div class="cs-head">' + avatar(b) + '<div><b>' + esc(b.name) + '</b><small>' + esc(b.category) + '</small></div></div>' +
        '<div class="cs-tag">' + esc(b.campaign) + '</div>' +
        '<p>' + esc(b.summary) + '</p>' +
        '<div class="cs-stats">' + b.stats.map(function (s) { return '<div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>' +
        '</article>';
    }).join('');
  });

  // Brand strip: manual scroll carousel (arrows + drag on desktop, swipe on touch).
  document.querySelectorAll('.brand-scroller').forEach(function (sc) {
    var row = sc.querySelector('.brand-row');
    var step = function () { return Math.max(240, row.clientWidth * 0.7); };
    sc.querySelector('.prev').addEventListener('click', function () { row.scrollBy({ left: -step(), behavior: 'smooth' }); });
    sc.querySelector('.next').addEventListener('click', function () { row.scrollBy({ left: step(), behavior: 'smooth' }); });
    var sync = function () {
      sc.classList.toggle('at-start', row.scrollLeft < 4);
      sc.classList.toggle('at-end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
    };
    row.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    var down = false, startX = 0, startLeft = 0, moved = false;
    row.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startLeft = row.scrollLeft; row.classList.add('dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX; if (Math.abs(dx) > 3) moved = true;
      row.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () { down = false; row.classList.remove('dragging'); });
    row.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  // Creator UGC carousel — 8s muted loops in assets/ugc/creators/<name>.mp4 (+ .jpg poster).
  // Add a clip by dropping the files in that folder and adding its name here.
  var CREATOR_CLIPS = [
    'gct-campaigns', 'lab-putter', 'headcovers', 'cliff-hanger', 'course-vlog', 'seed-golf', 'backyard-challenge', 'creator-kit',
    'on-course', 'gift-box', 'par-3', 'putter-unboxing', 'resort-stay', 'driver', 'backyard-green'
  ];
  document.querySelectorAll('[data-ugc-carousel]').forEach(function (host) {
    [CREATOR_CLIPS].forEach(function (row, i) {
      var m = document.createElement('div');
      m.className = 'marquee ugc-row' + (i ? ' reverse' : '');
      var track = document.createElement('div');
      track.className = 'marquee-track';
      row.forEach(function (name) {
        var src = 'assets/ugc/creators/' + name;
        track.insertAdjacentHTML('beforeend',
          '<div class="tile"><video data-autoplay muted playsinline loop preload="none" poster="' + src + '.jpg">' +
          '<source src="' + src + '.mp4" type="video/mp4"></video></div>');
      });
      m.appendChild(track);
      host.appendChild(m);
    });
  });

  // Nav shadow once the page scrolls
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile menu
  window.toggleMenu = function (force) {
    var open = typeof force === 'boolean' ? force : !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    var btn = document.querySelector('.menu-btn');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  document.querySelectorAll('.mobile-menu a').forEach(function (a) {
    a.addEventListener('click', function () { window.toggleMenu(false); });
  });

  // Duplicate marquee tracks so the loop is seamless
  document.querySelectorAll('.marquee').forEach(function (m) {
    var track = m.querySelector('.marquee-track');
    if (!track || m.querySelectorAll('.marquee-track').length > 1) return;
    var clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    m.appendChild(clone);
  });

  // Content walls scroll at one constant speed (px/s) whatever their length,
  // so the creator carousel and the Golf Creator Open strip move at the same pace.
  var WALL_SPEED = 100;
  function paceWalls() {
    document.querySelectorAll('.wall .marquee').forEach(function (m) {
      var w = m.querySelector('.marquee-track').scrollWidth;
      if (!w) return;
      m.querySelectorAll('.marquee-track').forEach(function (t) { t.style.animationDuration = (w / WALL_SPEED) + 's'; });
    });
  }
  paceWalls();
  window.addEventListener('load', paceWalls);
  window.addEventListener('resize', paceWalls);
  document.querySelectorAll('.wall img').forEach(function (img) { img.addEventListener('load', paceWalls); });

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.rv').forEach(function (el) { el.classList.add('in'); });
    return;
  }

  // Reveal on scroll
  var rvObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); rvObs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { rvObs.observe(el); });

  // Only play UGC videos while they are on screen
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var vidObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting && !reduce) {
        if (v.preload === 'none') v.preload = 'auto';
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('video[data-autoplay]').forEach(function (v) {
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.loop = true;
    vidObs.observe(v);
  });
})();
