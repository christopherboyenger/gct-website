/* The 2027 season opens on Nov 1, 2026. Eastern is still UTC-04:00 that midnight. */
(function () {
  'use strict';
  // Public browser key; the database denies anonymous access to waitlist records.
  var publicKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2dXFqcGN4bm5pa2JpZ2l4dXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDI1OTIsImV4cCI6MjA4OTgxODU5Mn0.KapJSHim09aVHucFvnsvuRVKNocvAnIeVIrqI565YfY';
  var launch = Date.parse('2026-11-01T00:00:00-04:00');
  var timer = document.querySelector('[role="timer"]');
  var interval;
  function updateCountdown() {
    var seconds = Math.max(0, Math.ceil((launch - Date.now()) / 1000));
    var values = { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24, minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
    Object.keys(values).forEach(function (key) {
      document.querySelector('[data-time="' + key + '"]').textContent = String(values[key]).padStart(2, '0');
    });
    if (seconds === 0) {
      document.getElementById('countdown-caption').textContent = 'The new season has arrived';
      timer.setAttribute('aria-label', 'The November 1, 2026 season start has arrived');
      clearInterval(interval);
    }
  }
  updateCountdown();
  if (Date.now() < launch) interval = setInterval(updateCountdown, 1000);

  var form = document.getElementById('waitlist-form');
  var button = form.querySelector('button[type="submit"]');
  var status = document.getElementById('form-status');
  var pending = false;
  function selectedAudience() { return form.querySelector('input[name="audience"]:checked').value; }
  function updateAudience() {
    var brand = selectedAudience() === 'brand';
    document.getElementById('profile-label').textContent = brand ? 'Company name or website' : 'Social handle or profile';
    document.getElementById('profile').placeholder = brand ? 'Your brand or website' : '@yourhandle';
    document.getElementById('consent-audience').textContent = brand ? 'brands' : 'creators';
    document.getElementById('submit-label').textContent = 'Join the ' + (brand ? 'brand' : 'creator') + ' waitlist';
    if (!pending) status.hidden = true;
  }
  form.querySelectorAll('input[name="audience"]').forEach(function (radio) { radio.addEventListener('change', updateAudience); });
  // Legacy links to /#brands and /#creators still select the appropriate waitlist.
  function applyAudienceLink() {
    if (location.hash === '#brands' || location.hash === '#creators') {
      var audience = location.hash === '#brands' ? 'brand' : 'creator';
      form.querySelector('input[value="' + audience + '"]').checked = true;
      updateAudience();
    }
  }
  applyAudienceLink();
  window.addEventListener('hashchange', applyAudienceLink);

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    var nameInput = document.getElementById('name');
    if (!nameInput.value.trim()) {
      nameInput.setCustomValidity('Please enter your name.');
      nameInput.reportValidity();
      nameInput.addEventListener('input', function clearNameError() { nameInput.setCustomValidity(''); nameInput.removeEventListener('input', clearNameError); });
      return;
    }
    pending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.hidden = true;
    document.getElementById('submit-label').textContent = 'Joining the waitlist…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    var audience = selectedAudience();
    try {
      var response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': publicKey, 'Authorization': 'Bearer ' + publicKey },
        body: JSON.stringify({ name: nameInput.value.trim(), email: document.getElementById('email').value.trim(), audience: audience, profile: document.getElementById('profile').value.trim(), consent: document.getElementById('consent').checked, website: document.getElementById('website').value }),
        signal: controller.signal
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.success !== true) {
        if (response.status === 429) throw new Error('Too many attempts. Please wait a little and try again.');
        if (response.status === 400) throw new Error(data.error || 'Please check your details and try again.');
        throw new Error('We couldn’t save your signup. Please try again in a moment.');
      }
      form.reset();
      form.querySelector('input[value="' + audience + '"]').checked = true;
      updateAudience();
      status.className = 'form-status';
      status.textContent = 'You’re on the ' + audience + ' waitlist. We’ll be in touch with updates about the new season.';
    } catch (error) {
      status.className = 'form-status error';
      status.textContent = error.name === 'AbortError' ? 'The connection took too long. Please try again. Your details are still here.' : (error instanceof TypeError ? 'Unable to connect. Please check your connection and try again.' : error.message);
    } finally {
      clearTimeout(timeout);
      pending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
      document.getElementById('submit-label').textContent = 'Join the ' + selectedAudience() + ' waitlist';
      status.hidden = false;
      status.focus();
    }
  });
}());
