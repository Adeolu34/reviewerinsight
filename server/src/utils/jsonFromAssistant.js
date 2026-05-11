/**
 * Parse a JSON object from an LLM message (raw JSON, or fenced ```json blocks,
 * or extra prose with a single {...} payload).
 */
function jsonFromAssistantContent(raw) {
  if (raw == null || raw === '') {
    throw new Error('Empty model response');
  }
  let s = String(raw).trim();
  const fence = /^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/m.exec(s);
  if (fence) {
    s = fence[1].trim();
  }
  try {
    return JSON.parse(s);
  } catch (_) {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object in model response');
    }
    return JSON.parse(s.slice(start, end + 1));
  }
}

module.exports = { jsonFromAssistantContent };
