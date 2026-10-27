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
          ? '<div class="b-chip word"' + attr + '><img class="b-word" src="' + b.logo + '" alt="' + (dup ? '' : esc(b.name)) + '"></div>'
          : '<div class="b-chip"' + attr + '>' + avatar(b) + '<b>' + esc(b.name) + '</b></div>';
      }).join('');
    };
    host.innerHTML = '<div class="brand-track">' + chips(false) + chips(true) + '</div>';
  });
  document.querySelectorAll('[data-case-studies]').forEach(function (host) {
    // The first stat leads as the headline result; the other two sit in the footer row.
    host.innerHTML = BRANDS.map(function (b, i) {
      return '<article class="case rv' + (i % 2 ? ' d1' : '') + '">' +
        '<div class="case-head">' + avatar(b) + '<div><span class="case-kicker">Case study · ' + esc(b.category) + '</span><span class="case-brand">' + esc(b.name) + '</span></div></div>' +
        '<div class="case-result">' + esc(b.stats[0][0]) + '<span class="case-unit">' + esc(b.stats[0][1]) + '</span></div>' +
        '<div class="case-campaign">' + esc(b.campaign) + '</div>' +
        '<p>' + esc(b.summary) + '</p>' +
        '<div class="case-stats">' + b.stats.slice(1).map(function (s) { return '<div><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></div>'; }).join('') + '</div>' +
        '</article>';
    }).join('');
  });

  // Pricing: pick a monthly creator spend and how many paid collaborations it covers to compare each
  // plan's GCT cost; the cheapest plan that allows that kind of hiring becomes the fit.
  // Each plan card carries its subscription (data-plan-base), GCT service fee rate (data-plan-rate),
  // an optional minimum fee per paid collaboration (data-plan-min) and, on a plan without campaigns,
  // its cap on new direct hires a month (data-plan-hires).
  // GCT fee per paid collaboration = max(round(creator pay × rate), minimum), worked in cents. The fee
  // is added to the brand's total, so creators receive their agreed fee.
  function money(cents) {
    var n = Math.round(cents) / 100;
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function serviceFee(payCents, rate, minCents) { return Math.max(Math.round(payCents * rate), minCents); }
  document.querySelectorAll('[data-pricing]').forEach(function (section) {
    var plans = [].slice.call(section.querySelectorAll('[data-plan-base]'));
    if (!plans.length) return;
    var spendButtons = section.querySelectorAll('[data-spend]');
    var hireButtons = section.querySelectorAll('[data-hires]');
    var num = function (el, name) { return Number(el.getAttribute(name) || 0); };
    var out = function (root, name, text) { var el = root.querySelector('[data-out="' + name + '"]'); if (el) el.textContent = text; };
    var pressed = function (buttons, name, fallback) {
      var on = [].filter.call(buttons, function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0];
      return on ? on.getAttribute(name) : fallback;
    };
    var spend = Number(pressed(spendButtons, 'data-spend', 0));
    var hires = pressed(hireButtons, 'data-hires', '1');
    var choose = function () {
      // "campaign" covers campaigns and 3+ hires; otherwise the spend is split evenly across 1 or 2 hires.
      var count = hires === 'campaign' ? 0 : Number(hires);
      var costs = plans.map(function (p) {
        var cap = num(p, 'data-plan-hires');
        var name = (p.querySelector('.plan-name') || {}).textContent;
        if (cap && !(count && count <= cap)) {
          out(p, 'fee', '—');
          out(p, 'cost', 'Not available');
          return { plan: p, name: name, cap: cap };
        }
        var n = count || 1;
        var fee = n * serviceFee(spend * 100 / n, Number(p.getAttribute('data-plan-rate')), num(p, 'data-plan-min') * 100);
        var cost = num(p, 'data-plan-base') * 100 + fee;
        out(p, 'fee', money(fee));
        out(p, 'cost', money(cost) + '/mo');
        return { plan: p, name: name, cost: cost };
      });
      var open = costs.filter(function (c) { return !c.cap; }).sort(function (a, b) { return a.cost - b.cost; });
      var closed = costs.filter(function (c) { return c.cap; });
      var fit = open[0], next = open[1];
      plans.forEach(function (p) { p.classList.toggle('fit', !!fit && p === fit.plan); });
      spendButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-spend')) === spend)); });
      hireButtons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-hires') === hires)); });
      out(section, 'spend', money(spend * 100));
      out(section, 'hires', count ? 'across ' + count + ' paid collaboration' + (count > 1 ? 's' : '') : 'through a campaign or 3+ hires');
      out(section, 'fit', fit ? fit.name : '');
      out(section, 'saving', closed.length
        ? closed.map(function (c) { return '. ' + c.name + ' can’t run campaigns or make more than ' + c.cap + ' new direct hires a month'; }).join('')
        : next && next.cost - fit.cost >= 100 ? ', ' + money(next.cost - fit.cost) + ' a month less than ' + next.name : '');
    };
    spendButtons.forEach(function (b) {
      b.addEventListener('click', function () { spend = Number(b.getAttribute('data-spend')); choose(); });
    });
    hireButtons.forEach(function (b) {
      b.addEventListener('click', function () { hires = b.getAttribute('data-hires'); choose(); });
    });
    if (spend) choose();
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

  // Tour member card: the app's metal Tour Card with the same physics (tour-card-interactive.tsx).
  // Drag or tap to spin it; momentum coasts under friction and, 3s after the last touch, it
  // eases home to the front. The shine follows the rotation angle. While it is on screen and
  // untouched it turns itself over every so often, so visitors see the engraved back.
  document.querySelectorAll('[data-tour-card]').forEach(function (card) {
    var rot = card.querySelector('.tc-rot');
    var sheens = card.querySelectorAll('.tc-sheen');
    var hint = card.parentNode.querySelector('.tc-hint');
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FRICTION = 0.95, IDLE_RETURN_MS = 3000, RETURN_EASE = 0.045; // per 60fps frame, as in the app
    var FLICK = 50;        // a tap sends the card into a free spin
    var HALF_TURN = 9;     // coasts to exactly 180° under FRICTION (9 / (1 - 0.95)): rests on the back
    var SHOWCASE_MS = 10000;
    var CARD_W = 248, SHEEN_W = 92;
    var s = { angle: 0, vel: 0, dragging: false, lastX: 0, downX: 0, downY: 0, moved: false, t0: 0, lastInteract: -1e9, turn: 0 };
    var raf = 0, last = 0, drawn = NaN, visible = false, inView = false, showAt = Infinity;

    // Position and brighten a face's reflection from its viewing angle (0 = head-on).
    var sheen = function (el, view) {
      if (Math.abs(view) >= 88) { el.style.opacity = '0'; return; }
      var t = view / 90;
      el.style.opacity = (0.12 + 0.5 * Math.sin(Math.abs(t) * Math.PI)).toFixed(3);
      // In % of the streak's own width, so the sweep holds at any card scale.
      var x = (CARD_W * (0.5 - t * 0.62) - SHEEN_W / 2) / SHEEN_W * 100;
      el.style.transform = 'translateX(' + x.toFixed(1) + '%) skewX(-12deg)';
    };
    // Turn the card over; its idle return then carries on the same way round to the front.
    var turnOver = function (dir) { s.vel = dir * HALF_TURN; s.turn = dir; };
    var frame = function (now) {
      var k = last ? Math.min((now - last) / (1000 / 60), 4) : 1; // frames elapsed at 60fps
      last = now;
      if (!s.dragging) {
        if (!still && inView && now >= showAt && s.angle === 0 && s.vel === 0) {
          turnOver(1);
          s.lastInteract = now;
          showAt = now + SHOWCASE_MS;
        }
        if (now - s.lastInteract < IDLE_RETURN_MS) {
          s.angle += s.vel * k;
          s.vel *= Math.pow(FRICTION, k);
          // End a turn-over square on the face: a fraction of a degree off-axis renders the engraving soft.
          if (s.turn && Math.abs(s.vel) < 0.01) { s.angle = Math.round(s.angle / 180) * 180; s.vel = 0; }
        } else {
          var target = (s.turn > 0 ? Math.ceil : s.turn < 0 ? Math.floor : Math.round)(s.angle / 360) * 360;
          s.angle += (target - s.angle) * (1 - Math.pow(1 - RETURN_EASE, k));
          s.vel = 0;
          if (Math.abs(target - s.angle) < 0.05) { s.angle = 0; s.turn = 0; }
        }
      }
      if (s.angle !== drawn) { // at rest there is nothing to repaint
        drawn = s.angle;
        rot.style.transform = 'rotateY(' + s.angle.toFixed(2) + 'deg)';
        var norm = ((s.angle % 360) + 360) % 360;
        sheen(sheens[0], norm > 180 ? norm - 360 : norm);
        sheen(sheens[1], norm - 180);
      }
      raf = visible ? requestAnimationFrame(frame) : 0;
    };
    var touched = function (now) {
      s.lastInteract = now;
      showAt = now + SHOWCASE_MS;
      if (hint) hint.classList.add('gone');
    };

    card.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* unsupported */ }
      s.dragging = true;
      s.lastX = s.downX = e.clientX;
      s.downY = e.clientY;
      s.moved = false;
      s.t0 = s.lastInteract = performance.now();
      s.vel = 0;
      s.turn = 0;
      card.classList.add('grabbing');
    });
    card.addEventListener('pointermove', function (e) {
      if (!s.dragging) return;
      var d = (e.clientX - s.lastX) * 0.7; // horizontal drag spins around the vertical axis
      s.lastX = e.clientX;
      s.lastInteract = performance.now();
      if (Math.abs(e.clientX - s.downX) + Math.abs(e.clientY - s.downY) > 6) s.moved = true;
      s.angle += d;
      s.vel = d; // release inherits the flick's momentum
    });
    var endDrag = function (e) {
      if (!s.dragging) return;
      s.dragging = false;
      try { card.releasePointerCapture(e.pointerId); } catch (err) { /* noop */ }
      card.classList.remove('grabbing');
      var now = performance.now();
      if (e.type === 'pointerup' && !s.moved && now - s.t0 < 350) { if (still) turnOver(1); else s.vel = FLICK; }
      if (e.type === 'pointerup' || s.moved) touched(now);
      else s.lastInteract = now;
    };
    card.addEventListener('pointerup', endDrag);
    card.addEventListener('pointercancel', endDrag);
    card.addEventListener('dragstart', function (e) { e.preventDefault(); });
    card.addEventListener('keydown', function (e) {
      if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) < 0) return;
      e.preventDefault();
      turnOver(e.key === 'ArrowLeft' ? -1 : 1);
      touched(performance.now());
    });

    var start = function () { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    if (!('IntersectionObserver' in window)) { visible = inView = true; showAt = 0; start(); return; }
    // Run the loop only while the card is on screen; show it off once it is mostly in view.
    new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      var wasInView = inView;
      visible = e.isIntersecting;
      inView = e.intersectionRatio >= 0.6;
      if (inView && !wasInView) showAt = Math.max(performance.now() + 900, s.lastInteract + SHOWCASE_MS);
      if (visible) start();
    }, { threshold: [0, 0.6] }).observe(card);
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
