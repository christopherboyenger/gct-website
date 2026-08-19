/* Golf Creator Tour — navbar, mobile menu, hero slider, marquees,
   scroll reveal, stat count-up. No dependencies. */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- navbar scroll state ---------- */
  var navbar = document.getElementById('navbar');
  function onScroll() {
    navbar.classList.toggle('is-scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var navToggle = document.getElementById('navToggle');
  var navMenu = document.getElementById('navMenu');

  navToggle.addEventListener('click', function () {
    var open = navMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // close the mobile menu when a link inside it is followed
  navMenu.addEventListener('click', function (e) {
    if (e.target.closest('a')) {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  /* ---------- dropdowns (click/tap + keyboard; hover is CSS) ---------- */
  var dropdownItems = Array.prototype.slice.call(document.querySelectorAll('.nav-item.has-dropdown'));

  function closeDropdowns(except) {
    dropdownItems.forEach(function (item) {
      if (item !== except) {
        item.classList.remove('is-open');
        item.querySelector('.nav-link').setAttribute('aria-expanded', 'false');
      }
    });
  }

  dropdownItems.forEach(function (item) {
    var trigger = item.querySelector('.nav-link');
    trigger.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      trigger.setAttribute('aria-expanded', String(open));
      closeDropdowns(item);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item.has-dropdown')) closeDropdowns(null);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeDropdowns(null);
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  });

  /* ---------- hero slider ---------- */
  var slider = document.getElementById('heroSlider');
  if (slider) {
    var slides = Array.prototype.slice.call(slider.querySelectorAll('.hero-slide'));
    var dotsWrap = document.getElementById('heroDots');
    var current = Math.max(0, slides.findIndex(function (s) { return s.classList.contains('is-active'); }));
    var timer = null;
    var AUTOPLAY_MS = 7000;

    var dots = slides.map(function (_, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
      dot.addEventListener('click', function () { goTo(i); restart(); });
      dotsWrap.appendChild(dot);
      return dot;
    });

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) { slide.classList.toggle('is-active', i === current); });
      dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === current); });
    }

    function restart() {
      if (prefersReducedMotion) return;
      clearInterval(timer);
      timer = setInterval(function () { goTo(current + 1); }, AUTOPLAY_MS);
    }

    slider.querySelectorAll('.slider-arrow').forEach(function (arrow) {
      arrow.addEventListener('click', function () {
        goTo(current + Number(arrow.dataset.dir));
        restart();
      });
    });

    slider.addEventListener('mouseenter', function () { clearInterval(timer); });
    slider.addEventListener('mouseleave', restart);

    goTo(current);
    restart();
  }

  /* ---------- marquees: duplicate track for a seamless loop ---------- */
  document.querySelectorAll('.marquee').forEach(function (marquee) {
    var track = marquee.querySelector('.marquee-track');
    track.innerHTML += track.innerHTML;
    track.querySelectorAll('img').forEach(function (img, i) {
      if (i >= track.children.length / 2) img.setAttribute('aria-hidden', 'true');
    });
    var speed = Number(marquee.dataset.speed) || 48;
    track.style.setProperty('--marquee-duration', speed + 's');
  });

  /* ---------- scroll reveal ---------- */
  var revealTargets = document.querySelectorAll(
    '.stat, .split-col, .tl-step, .value-card, .tile, .sol-card, ' +
    '.open-banner, .membership-copy, .membership-media, .cta-inner'
  );
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  revealTargets.forEach(function (el) { revealObserver.observe(el); });

  /* ---------- stat count-up ---------- */
  function formatStat(value, decimals) {
    var fixed = value.toFixed(decimals);
    if (decimals === 0) {
      return Number(fixed).toLocaleString('en-US');
    }
    return fixed;
  }

  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    var decimals = parseInt(el.dataset.decimals || '0', 10);
    if (isNaN(target) || prefersReducedMotion) {
      el.textContent = formatStat(target || 0, decimals) + suffix;
      return;
    }
    var DURATION = 1400;
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var progress = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatStat(target * eased, decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var statObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        countUp(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-num').forEach(function (el) { statObserver.observe(el); });

  /* ---------- footer year ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
