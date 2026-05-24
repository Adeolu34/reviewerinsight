/**
 * Parse a JSON object from an LLM message (raw JSON, fenced ```json blocks,
 * extra prose, or truncated responses missing closing brackets).
 */
function jsonFromAssistantContent(raw) {
  if (raw == null || raw === '') {
    throw new Error('Empty model response');
  }
  let s = String(raw).trim();

  // Extract content from a fenced block if present anywhere in the response
  // (models sometimes add prose before the code fence)
  const fenceMatch = s.match(/```(?:json)?\s*\r?\n([\s\S]*?)(?:\r?\n```|$)/);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  } else {
    s = s.replace(/^```(?:json)?\s*\r?\n?/, '');
    s = s.replace(/\r?\n?```\s*$/, '');
    s = s.trim();
  }

  // Find the JSON object boundaries
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object in model response');
  s = s.slice(start);

  // Try clean parse first
  try { return JSON.parse(s); } catch (_) {}

  // Try up to the last closing brace (handles trailing prose)
  const end = s.lastIndexOf('}');
  if (end > 0) {
    try { return JSON.parse(s.slice(0, end + 1)); } catch (_) {}
  }

  // Last resort: patch truncated JSON by closing open strings, arrays, objects
  try { return JSON.parse(_closeTruncated(s)); } catch (_) {}

  throw new Error('Could not parse JSON from model response');
}

function _closeTruncated(s) {
  const stack = [];
  let inString = false;
  let escape   = false;

  for (const ch of s) {
    if (escape)             { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"')         { inString = !inString; continue; }
    if (inString)           continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Close dangling string
  if (inString) s += '"';
  // Close any open value with a placeholder so JSON is syntactically valid
  if (s.match(/[:,]\s*$/)) s += 'null';
  // Close open containers in reverse
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === '{' ? '}' : ']';
  }
  return s;
}

module.exports = { jsonFromAssistantContent };
