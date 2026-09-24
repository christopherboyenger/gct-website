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
      stats: [['106', 'creators joined'], ['72', 'posts created'], ['30.6K', 'verified views']] },
    { name: 'BLURRD', logo: LOGO + 'be559f17-71c9-4b1d-8958-a9ae8234a432-1787199611185.PNG', category: 'Golf gloves',
      campaign: 'One Club Challenge · product seeding',
      summary: 'A play-a-hole-with-one-club brief with an organic glove moment. Creator demand more than doubled the available spots.',
      stats: [['48', 'creator applications'], ['20', 'spots available'], ['18', 'creators approved']] },
    { name: 'Bad Cards', logo: LOGO + '70d84494-65b4-41bc-9d46-3b92834413ec-1787069380816.png', category: 'On-course card game',
      campaign: 'On-Course Challenge · product seeding',
      summary: 'Creators filmed themselves drawing a card and playing the hole. One brief put the game in the hands of creators nationwide.',
      stats: [['27', 'creator applications'], ['21', 'creators approved'], ['30', 'creator spots']] },
    { name: 'Malcontents', logo: 'assets/brands/malcontents.jpg', category: 'Golf apparel',
      campaign: 'Fit Check challenge',
      summary: 'An apparel fit-check challenge that turned creators into on-course models for the brand.',
      stats: [['10', 'creators joined'], ['6', 'fit-check posts'], ['60%', 'of creators posted']] }
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
    host.innerHTML = '<div class="marquee-track">' + STRIP.map(function (b) {
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
