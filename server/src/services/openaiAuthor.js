const { openai, model, chatJsonObjectMode } = require('../config/openai');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

async function generateAuthorBio(authorName, knownBooks = []) {
  if (!openai) throw new Error('LLM client not configured');

  const systemPrompt = chatJsonObjectMode
    ? 'You are a literary scholar who writes accurate, engaging author biographies.'
    : 'You are a literary scholar who writes accurate, engaging author biographies.\n\nRespond with a single valid JSON object only (no markdown, no commentary).';

  const booksList = knownBooks.length > 0
    ? `\nKnown works: ${knownBooks.slice(0, 5).join(', ')}`
    : '';

  const userPrompt = `Write a biography for the author: "${authorName}"${booksList}

Return a JSON object with exactly these fields:
{
  "bio": "3-4 paragraph literary biography (200-300 words). Cover their life, literary style, major works, cultural impact, and legacy.",
  "shortBio": "1-2 sentences under 30 words summarising who they are.",
  "birthYear": 1900,
  "deathYear": null,
  "nationality": "American",
  "genres": ["Fiction"]
}

RULES:
- bio: 3-4 paragraphs separated by \\n\\n. Specific, scholarly, accessible.
- shortBio: Under 30 words. The most essential fact about this author.
- birthYear / deathYear: integer year or null.
- nationality: country of origin.
- genres: 1-3 from: Fiction, Essays, Memoir, Sci-Fi, History, Business, Nature, Spiritual.
- Base everything on genuine knowledge of this real author.`;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 900,
  };
  if (chatJsonObjectMode) body.response_format = { type: 'json_object' };

  const response = await withRetry(
    () => openai.chat.completions.create(body),
    { label: `Author bio: "${authorName}"`, maxAttempts: 2 }
  );

  const content = response.choices[0].message.content;
  const tokensUsed = response.usage?.total_tokens || 0;

  let parsed;
  try {
    const clean = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Failed to parse author bio: ${content.substring(0, 200)}`);
  }

  logger.info(`Author bio generated for "${authorName}" (${tokensUsed} tokens)`);

  return {
    bio:         String(parsed.bio || ''),
    shortBio:    String(parsed.shortBio || ''),
    birthYear:   typeof parsed.birthYear === 'number' ? parsed.birthYear : null,
    deathYear:   typeof parsed.deathYear === 'number' ? parsed.deathYear : null,
    nationality: String(parsed.nationality || ''),
    genres:      Array.isArray(parsed.genres) ? parsed.genres.slice(0, 3) : [],
    tokensUsed,
  };
}

module.exports = { generateAuthorBio };
