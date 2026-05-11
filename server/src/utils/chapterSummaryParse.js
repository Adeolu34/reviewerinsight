const { jsonFromAssistantContent } = require('./jsonFromAssistant');

/**
 * Normalize alternate LLM shapes to { chapters: [...] }.
 */
function normalizeChaptersShape(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj.chapters)) return { chapters: obj.chapters };
  if (Array.isArray(obj.Chapters)) return { chapters: obj.Chapters };
  if (Array.isArray(obj.sections)) return { chapters: obj.sections };
  if (Array.isArray(obj)) return { chapters: obj };
  return null;
}

/**
 * Walk the raw text after "chapters":[ and pull each complete `{ ... }` object
 * (handles responses cut off mid-array by the model's max_tokens).
 */
function extractChapterObjectsFromTruncatedArray(text) {
  const m = text.match(/"chapters"\s*:\s*\[/i);
  if (!m) return [];

  let i = m.index + m[0].length;
  const rest = text;
  const chapters = [];

  while (i < rest.length) {
    while (i < rest.length && /[\s,\r\n]/.test(rest[i])) i++;
    if (i >= rest.length || rest[i] !== '{') break;

    let depth = 0;
    let inStr = false;
    let esc = false;
    const start = i;
    let j = i;
    for (; j < rest.length; j++) {
      const c = rest[j];
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\' && inStr) {
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = !inStr;
        continue;
      }
      if (!inStr) {
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            const slice = rest.slice(start, j + 1);
            try {
              chapters.push(JSON.parse(slice));
            } catch (_) {
              /* skip malformed fragment */
            }
            i = j + 1;
            break;
          }
        }
      }
    }
    if (j >= rest.length && depth !== 0) break;
  }

  return chapters;
}

/**
 * Parse LLM chapter-summary JSON; tolerate truncation and alternate keys.
 */
function parseChapterSummariesResponse(raw) {
  const str = String(raw || '');
  let parsed = null;
  try {
    parsed = jsonFromAssistantContent(str);
  } catch (_) {
    /* fall through to bracket extraction */
  }

  const shaped = parsed ? normalizeChaptersShape(parsed) : null;
  if (shaped?.chapters?.length >= 3) {
    return shaped;
  }

  const extracted = extractChapterObjectsFromTruncatedArray(str);
  if (extracted.length >= 3) {
    return { chapters: extracted };
  }

  if (shaped?.chapters?.length) {
    throw new Error(`Parsed ${shaped.chapters.length} chapters (need 3+); extracted ${extracted.length} complete objects`);
  }
  throw new Error(`Could not parse chapters (extracted ${extracted.length} complete objects, need 3+)`);
}

module.exports = { parseChapterSummariesResponse, normalizeChaptersShape };
