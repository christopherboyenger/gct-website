(function () {
  'use strict';
  var dialog = document.getElementById('preview-dialog');
  var opener = document.getElementById('open-preview');
  var form = document.getElementById('preview-form');
  var password = document.getElementById('preview-password');
  var status = document.getElementById('preview-status');
  var button = form.querySelector('button[type="submit"]');
  var requestedPage = new URLSearchParams(location.search).get('preview');
  function open() { if (!dialog.open) dialog.showModal(); }
  opener.addEventListener('click', open);
  document.getElementById('close-preview').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { password.value = ''; status.hidden = true; });
  if (['network', 'brands', 'courses', 'v2', 'creators'].includes(requestedPage)) open();
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled || !form.reportValidity()) return;
    button.disabled = true;
    button.textContent = 'Opening preview…';
    status.hidden = true;
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch(form.action, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.value, page: requestedPage || 'network' }), signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Preview access is unavailable. Please try again.');
      password.value = '';
      location.assign(result.next);
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'The request timed out. Please try again.' : (error.message || 'Could not connect. Please try again.');
      status.hidden = false;
      password.focus();
      password.select();
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
      button.textContent = 'Open website';
    }
  });
})();
