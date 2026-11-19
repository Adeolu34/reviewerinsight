// OAuth popup helper (external file so the CSP can forbid inline scripts).
(function () {
  var b = document.body;
  var payload = b.getAttribute('data-payload') || '';
  var text = b.getAttribute('data-text') || '';
  if (window.opener) {
    try { window.opener.postMessage(payload, window.location.origin); } catch (e) { /* ignore */ }
    window.close();
  } else {
    document.getElementById('m').textContent = text;
  }
})();
