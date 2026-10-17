(function () {
  'use strict';
  var stories = [
    ['on-course', 'On-course content', 'A round worth sharing.', 'Golf gives you the setting. Your perspective makes it yours.'],
    ['headcovers', 'Product stories', 'Show a product in your own style.', 'From first impressions to on-course use, see how a product becomes part of the story.'],
    ['resort-stay', 'Creator experiences', 'Bring the audience along.', 'A course, a destination and a creator’s point of view.']
  ];
  var tabs = Array.from(document.querySelectorAll('[data-story]'));
  function select(tab, focus) {
    var story = stories[Number(tab.dataset.story)];
    tabs.forEach(function (item) { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
    document.getElementById('story-panel').setAttribute('aria-labelledby', tab.id);
    document.getElementById('story-heading').textContent = story[2];
    document.getElementById('story-copy').textContent = story[3];
    var picture = document.getElementById('story-image');
    picture.src = 'assets/ugc/creators/' + story[0] + '.jpg'; picture.alt = story[1];
    var play = document.getElementById('story-play');
    play.dataset.video = 'assets/ugc/creators/' + story[0] + '.mp4'; play.dataset.title = story[1];
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { select(tab, false); });
    tab.addEventListener('keydown', function (event) {
      var next;
      if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); select(tabs[next], true); }
    });
  });
  document.querySelectorAll('.faq-item').forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (item.open) document.querySelectorAll('.faq-item').forEach(function (other) { if (other !== item) other.open = false; });
    });
  });
})();
