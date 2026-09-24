/* Golf Creator Tour — shared marketing site behaviour */
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  // Creator UGC carousel — 8s muted loops in assets/ugc/creators/<name>.mp4 (+ .jpg poster).
  // Add a clip by dropping the files in that folder and adding its name here.
  var CREATOR_CLIPS = [
    'gct-campaigns', 'lab-putter', 'headcovers', 'cliff-hanger', 'course-vlog', 'seed-golf', 'backyard-challenge', 'creator-kit',
    'on-course', 'gift-box', 'par-3', 'putter-unboxing', 'resort-stay', 'driver', 'backyard-green'
  ];
  document.querySelectorAll('[data-ugc-carousel]').forEach(function (host) {
    var half = Math.ceil(CREATOR_CLIPS.length / 2);
    [CREATOR_CLIPS.slice(0, half), CREATOR_CLIPS.slice(half)].forEach(function (row, i) {
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
