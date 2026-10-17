(function () {
  'use strict';
  var header = document.querySelector('.site-header');
  function updateHeader() { header.classList.toggle('scrolled', scrollY > 20); }
  addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  var dropdowns = document.querySelectorAll('.nav-dropdown');
  function closeMenus(except) {
    dropdowns.forEach(function (item) {
      if (item === except) return;
      item.querySelector('button').setAttribute('aria-expanded', 'false');
      item.querySelector('.dropdown-panel').hidden = true;
    });
  }
  dropdowns.forEach(function (item) {
    var trigger = item.querySelector('button');
    var panel = item.querySelector('.dropdown-panel');
    var openedByHover = false;
    function open() { closeMenus(item); trigger.setAttribute('aria-expanded', 'true'); panel.hidden = false; }
    trigger.addEventListener('click', function () {
      if (openedByHover) { openedByHover = false; open(); return; }
      if (trigger.getAttribute('aria-expanded') === 'true') closeMenus(); else open();
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); open(); panel.querySelector('a').focus(); }
    });
    item.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover)').matches && panel.hidden) { openedByHover = true; open(); } });
    item.addEventListener('mouseleave', function () { if (!item.contains(document.activeElement)) closeMenus(); });
    item.addEventListener('focusout', function (event) { if (!item.contains(event.relatedTarget)) closeMenus(); });
    panel.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { closeMenus(); }); });
  });
  document.addEventListener('click', function (event) { if (!event.target.closest('.nav-dropdown')) closeMenus(); });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var active = document.querySelector('.nav-dropdown>button[aria-expanded="true"]');
    if (active) { closeMenus(); active.focus(); }
  });

  var menuButton = document.querySelector('.menu-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  function closeMobile() { mobileNav.hidden = true; menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open menu'); }
  menuButton.addEventListener('click', function () {
    var open = mobileNav.hidden;
    mobileNav.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  mobileNav.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', closeMobile); });
  document.addEventListener('click', function (event) { if (!header.contains(event.target)) closeMobile(); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !mobileNav.hidden) { closeMobile(); menuButton.focus(); } });
  matchMedia('(min-width: 1081px)').addEventListener('change', function (event) { if (event.matches) closeMobile(); });

  var dialogs = document.querySelectorAll('dialog');
  function show(dialog) { closeMenus(); closeMobile(); dialog.showModal(); document.body.classList.add('modal-open'); }
  dialogs.forEach(function (dialog) {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      var box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', function () { if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open'); });
  });
  document.querySelector('[data-open-snapshot]').addEventListener('click', function () { show(document.getElementById('snapshot-dialog')); });
  var videoDialog = document.getElementById('video-dialog');
  var player = videoDialog.querySelector('video');
  document.querySelectorAll('[data-video]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.getElementById('video-title').textContent = button.dataset.title;
      player.src = button.dataset.video;
      show(videoDialog);
      player.play().catch(function () { /* Native controls remain available. */ });
    });
  });
  videoDialog.addEventListener('close', function () { player.pause(); player.removeAttribute('src'); player.load(); });

  // Creator pages share navigation and media dialogs without the brand planner.
  if (!document.getElementById('brief-dialog')) return;

  var briefDialog = document.getElementById('brief-dialog');
  var goalSelect = document.getElementById('brief-goal');
  var briefMessage = document.getElementById('brief-message');
  var briefBrand = document.getElementById('brief-brand');
  function openBrief(message, goal) {
    if (typeof message === 'string') briefMessage.value = message;
    if (goal) goalSelect.value = goal;
    show(briefDialog);
  }
  document.querySelectorAll('[data-open-brief]').forEach(function (button) { button.addEventListener('click', function () { openBrief(); }); });
  document.querySelectorAll('[data-case]').forEach(function (button) {
    button.addEventListener('click', function () { openBrief('I’d like to discuss a campaign inspired by the ' + button.dataset.case + ' example.'); });
  });
  document.getElementById('brief-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    var subject = 'GCT campaign brief — ' + briefBrand.value.trim();
    var body = 'Brand / property: ' + briefBrand.value.trim() + '\nWebsite: ' + document.getElementById('brief-website').value.trim() + '\nGoal: ' + goalSelect.value + '\n\nCampaign idea:\n' + briefMessage.value.trim();
    location.href = 'mailto:info@golfcreatoropen.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });

  var check = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="m6 10 2.5 2.5L14 7" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var goals = {
    organic: { name: 'Organic content', placeholder: 'Show golfers how our product fits their game', list: ['Introduce the product in real golf settings', 'Give creators room for their own approach', 'Review the content you want to reuse'], scope: [['Creator fit','Golf audience'],['Deliverables','Agreed brief'],['Usage','Organic posts']], mix: ['On-course product use','First impressions','Creator challenges'] },
    ads: { name: 'Ad creative', placeholder: 'Make creator content we can use in our next ad campaign', list: ['Start with the product story and audience', 'Explore different hooks and creator styles', 'Agree ad permissions before paid use'], scope: [['Creator fit','Product relevance'],['Deliverables','Ad-ready formats'],['Usage','Agreed ad rights']], mix: ['Product demonstrations','Creator explanations','Different hooks'] },
    awareness: { name: 'Brand awareness', placeholder: 'Introduce our brand to more people who love golf', list: ['Give golfers a reason to remember the brand', 'Build a brief around a clear brand moment', 'Agree the audience and reporting scope'], scope: [['Creator fit','Relevant golfers'],['Deliverables','Launch content'],['Usage','Agreed channels']], mix: ['A new product story','On-course challenges','Creator experiences'] }
  };
  var activeGoal = 'organic';
  function tabBehavior(container, selector, callback) {
    var tabs = Array.from(container.querySelectorAll(selector));
    function select(tab, focus) {
      tabs.forEach(function (item) { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
      callback(tab);
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (event) {
        var next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { event.preventDefault(); select(tabs[next], true); }
      });
    });
  }
  tabBehavior(document.getElementById('goals'), '[data-goal]', function (tab) {
    activeGoal = tab.dataset.goal;
    var data = goals[activeGoal];
    document.getElementById('goal-panel').setAttribute('aria-labelledby', tab.id);
    document.getElementById('campaign-description').placeholder = data.placeholder;
    document.getElementById('goal-list').innerHTML = data.list.map(function (text) { return '<li>' + check + text + '</li>'; }).join('');
    document.getElementById('goal-scope').innerHTML = data.scope.map(function (pair) { return '<div><dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd></div>'; }).join('');
    document.getElementById('goal-mix').innerHTML = data.mix.map(function (text, i) { return '<div><span>' + text + '</span><i style="--mix:' + [86,63,48][i] + '%"></i></div>'; }).join('');
  });
  document.getElementById('campaign-input').addEventListener('submit', function (event) { event.preventDefault(); openBrief(document.getElementById('campaign-description').value.trim(), goals[activeGoal].name); });
  document.getElementById('final-input').addEventListener('submit', function (event) {
    event.preventDefault();
    document.getElementById('brief-website').value = document.getElementById('brand-website').value.trim();
    openBrief();
  });

  var paths = {
    creator: [['Join free','Create your profile.','Introduce yourself and the golf content you make.'],['Connect','Find your community.','Meet creators and discover the brands in the network.'],['Participate','Choose your opportunities.','Review the briefs and terms that fit your content.'],['Build on it','Keep creating. Keep connecting.','Grow relationships through the work and experiences you share.']],
    brand: [['Define','Tell us about your brand.','Start with your product, audience and campaign goals.'],['Plan','Agree the campaign scope.','Define the content, creator compensation and usage rights.'],['Create','Work with golf creators.','Give creators a clear brief and review the work.'],['Build on it','Plan the next opportunity.','Use what you learn to shape your next creator campaign.']]
  };
  var arrow = '<svg class="arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tabBehavior(document.getElementById('get-started'), '[data-path]', function (tab) {
    var key = tab.dataset.path;
    var panel = document.getElementById('journey-panel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.innerHTML = paths[key].map(function (row) { return '<article><span class="journey-dot"></span><span class="journey-tag">' + row[0] + '</span><h3>' + row[1] + '</h3><p>' + row[2] + '</p></article>'; }).join('');
    var link = document.getElementById('journey-cta');
    link.href = 'https://golfcreatortour.app/' + (key === 'brand' ? 'brands' : 'auth');
    link.innerHTML = (key === 'brand' ? 'Start a campaign ' : 'Join free as a creator ') + arrow;
  });

  var rail = document.querySelector('.experience-rail');
  var prev = document.querySelector('[data-rail-prev]');
  var next = document.querySelector('[data-rail-next]');
  function railState() { prev.disabled = rail.scrollLeft < 4; next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 5; }
  function moveRail(direction) { rail.scrollBy({ left: direction * (rail.querySelector('article').getBoundingClientRect().width + 24), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
  prev.addEventListener('click', function () { moveRail(-1); });
  next.addEventListener('click', function () { moveRail(1); });
  rail.addEventListener('scroll', railState, { passive: true });
  addEventListener('resize', railState);
  railState();
  document.querySelectorAll('.faq-item').forEach(function (item) {
    item.addEventListener('toggle', function () { if (item.open) document.querySelectorAll('.faq-item').forEach(function (other) { if (other !== item) other.open = false; }); });
  });
})();
