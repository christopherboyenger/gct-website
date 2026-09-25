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
  // Order = display order: the strongest-recognition brands lead.
  var byName = function (n) { return BRANDS.filter(function (b) { return b.name === n; })[0]; };
  var STRIP = [
    byName('Malcontents'),
    { name: 'Dryvebox', logo: 'assets/brands/dryvebox.jpg', wide: true },
    { name: 'PopStroke', logo: 'assets/brands/popstroke.jpg', wide: true },
    { name: 'Performance Golf', logo: 'assets/brands/performance-golf.jpg' },
    { name: 'ShipSticks', logo: 'assets/brands/shipsticks.jpg' },
    byName('PUR3 Golf'),
    byName('BLURRD'),
    byName('Bad Cards'),
    { name: 'RIVO', logo: 'assets/brands/rivo.jpg', wide: true },
    { name: 'Course Record', logo: 'assets/brands/course-record.jpg', wide: true },
    { name: 'Legato', logo: 'assets/brands/legato.jpg', wide: true },
    { name: 'Caddy Splash', logo: 'assets/brands/caddy-splash.jpg', wide: true },
    { name: 'Greg Norman', logo: 'assets/brands/greg-norman.jpg', wide: true },
    { name: 'Dunning', logo: 'assets/brands/dunning.jpg', wide: true },
    { name: 'Smartpin', logo: 'assets/brands/smartpin.jpg', wide: true },
    { name: 'Kismet', logo: 'assets/brands/kismet.jpg', wide: true }
  ];
  // The strip is rendered twice so the auto-scroll can loop seamlessly; the copy is hidden from screen readers.
  document.querySelectorAll('[data-brand-strip]').forEach(function (host) {
    var chips = function (dup) {
      var attr = dup ? ' aria-hidden="true"' : '';
      return STRIP.map(function (b) {
        return b.wide
          ? '<div class="b-chip"' + attr + '><img class="b-word" src="' + b.logo + '" alt="' + (dup ? '' : esc(b.name)) + '"></div>'
          : '<div class="b-chip"' + attr + '>' + avatar(b) + '<b>' + esc(b.name) + '</b></div>';
      }).join('');
    };
    host.innerHTML = '<div class="brand-track">' + chips(false) + chips(true) + '</div>';
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

  // Brand strip: auto-rotating loop that still takes arrows, drag on desktop and swipe on touch.
  // Auto-scroll pauses on hover/touch and for a moment after any manual interaction.
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.brand-scroller').forEach(function (sc) {
    var row = sc.querySelector('.brand-row');
    var chips = row.querySelectorAll('.b-chip');
    var half = chips.length / 2;
    // Width of one full set of logos: the distance from the first logo to its duplicate.
    var loop = function () { return chips[half].offsetLeft - chips[0].offsetLeft; };
    var wrap = function () {
      var l = loop();
      if (l <= 0) return;
      if (row.scrollLeft >= l) row.scrollLeft -= l;
      else if (row.scrollLeft <= 0) row.scrollLeft += l;
    };
    var hover = false, down = false, resumeAt = 0;
    var hold = function (ms) { resumeAt = Date.now() + (ms || 3000); };
    var step = function () { return Math.max(240, row.clientWidth * 0.7); };
    sc.querySelector('.prev').addEventListener('click', function () { hold(); wrap(); row.scrollBy({ left: -step(), behavior: 'smooth' }); });
    sc.querySelector('.next').addEventListener('click', function () { hold(); wrap(); row.scrollBy({ left: step(), behavior: 'smooth' }); });
    row.addEventListener('mouseenter', function () { hover = true; });
    row.addEventListener('mouseleave', function () { hover = false; });
    row.addEventListener('touchstart', function () { hold(4000); }, { passive: true });
    row.addEventListener('touchmove', function () { hold(4000); }, { passive: true });
    row.addEventListener('wheel', function () { hold(); }, { passive: true });

    var startX = 0, startLeft = 0;
    row.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; startX = e.clientX; startLeft = row.scrollLeft; row.classList.add('dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      row.scrollLeft = startLeft - (e.clientX - startX);
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false; row.classList.remove('dragging'); hold(); wrap();
    });
    row.addEventListener('dragstart', function (e) { e.preventDefault(); });

    if (reduceMotion) return;
    var SPEED = 40; // px per second
    var pos = row.scrollLeft, set = pos, last = 0;
    var tick = function (t) {
      var dt = last ? Math.min(t - last, 100) : 0;
      last = t;
      // Pick up wherever the user (or keyboard/scrollbar) left it.
      if (Math.abs(row.scrollLeft - set) > 2) pos = row.scrollLeft;
      if (hover || down || Date.now() < resumeAt) {
        pos = row.scrollLeft;
      } else {
        var l = loop();
        pos += SPEED * dt / 1000;
        if (l > 0 && pos >= l) pos -= l;
        row.scrollLeft = pos;
      }
      set = row.scrollLeft;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
  // Phones get a slower speed: the same px/s crosses a narrow screen much faster.
  function wallSpeed() { return window.innerWidth < 640 ? 30 : 50; }
  function paceWalls() {
    var WALL_SPEED = wallSpeed();
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
