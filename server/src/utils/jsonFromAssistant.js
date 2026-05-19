/**
 * Parse a JSON object from an LLM message (raw JSON, or fenced ```json blocks,
 * or extra prose with a single {...} payload).
 */
function jsonFromAssistantContent(raw) {
  if (raw == null || raw === '') {
    throw new Error('Empty model response');
  }
  let s = String(raw).trim();

  // Strip opening fence (```json or ```) — handles both complete and truncated fences
  s = s.replace(/^```(?:json)?\s*\r?\n?/, '');
  // Strip closing fence if present
  s = s.replace(/\r?\n?```\s*$/, '');
  s = s.trim();

  try {
    return JSON.parse(s);
  } catch (_) {
    // Extract the {...} payload; handles trailing prose or truncated JSON
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object in model response');
    }
    return JSON.parse(s.slice(start, end + 1));
  }
}

module.exports = { jsonFromAssistantContent };
