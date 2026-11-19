/**
 * Safe HTML for OAuth popup callbacks.
 * - Untrusted text goes into HTML-escaped data attributes and is rendered via textContent (never innerHTML).
 * - postMessage targets the page's own origin, not '*'.
 * - No inline script: compatible with the strict site CSP.
 */
const UNSAFE_IN_SCRIPT = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/** JSON for embedding in an inline <script>: escapes < > & and line separators. */
function safeJson(value) {
  return JSON.stringify(value).replace(UNSAFE_IN_SCRIPT, (c) => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {object} o
 * @param {string} o.label       e.g. 'YouTube', 'Nature YouTube'
 * @param {boolean} o.ok
 * @param {string} o.msg         untrusted text (error message)
 * @param {string} o.successEvent  postMessage payload on success
 * @param {string} o.errorPrefix   postMessage payload prefix on failure
 */
function oauthPopupPage({ label, ok, msg, successEvent, errorPrefix }) {
  const safeMsg = String(msg == null ? '' : msg).slice(0, 200);
  const payload = ok ? successEvent : `${errorPrefix}:${safeMsg}`;
  const text = ok ? 'Connected! You can close this tab.' : `Error: ${safeMsg}`;
  const color = ok ? '#10B981' : '#EF4444';
  // All untrusted values go into HTML-escaped attributes and are read by /oauth-popup.js (no inline script).
  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"/><title>${escHtml(label)} ${ok ? 'Connected' : 'Error'}</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;background:#111;color:#eee" data-payload="${escHtml(payload)}" data-text="${escHtml(text)}">
<h2 id="m" style="color:${color}"></h2>
<script src="/oauth-popup.js"></script>
</body></html>`;
}

module.exports = { oauthPopupPage, safeJson, escHtml };
