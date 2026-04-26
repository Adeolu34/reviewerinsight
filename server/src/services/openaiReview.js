const { openai, model } = require('../config/openai');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

/**
 * Generate a complete book review using OpenAI.
 * @param {Object} book - Book metadata (title, author, year, pages, description, genre)
 * @param {Object} persona - Editor persona config (name, systemPrompt)
 * @returns {Object} { review, tokensUsed }
 */
async function generateReview(book, persona) {
  if (!openai) throw new Error('OpenAI client not configured. Set OPENAI_API_KEY in .env');

  const userPrompt = buildUserPrompt(book);

  const response = await withRetry(async () => {
    return await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: persona.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 1800,
    });
  }, { label: `OpenAI review: "${book.title}"`, maxAttempts: 2 });

  const content = response.choices[0].message.content;
  const tokensUsed = response.usage?.total_tokens || 0;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse OpenAI response as JSON: ${content.substring(0, 200)}`);
  }

  // Validate the response structure
  const review = validateReview(parsed, book.title);

  logger.info(`Review generated for "${book.title}" by ${persona.name} (${tokensUsed} tokens)`);

  return { review, tokensUsed };
}

function buildUserPrompt(book) {
  return `Please write a complete review for this book. Return your response as a JSON object with exactly these fields:

BOOK DETAILS:
- Title: ${book.title}
- Author: ${book.author}
- Year: ${book.year || 'Unknown'}
- Pages: ${book.pages || 'Unknown'}
- Genre: ${book.genre || 'Fiction'}
- Description: ${book.description || 'No description available.'}

REQUIRED JSON OUTPUT FORMAT:
{
  "headline": "One declarative sentence. No question marks. This is the review's thesis.",
  "stand": "One paragraph (2-3 sentences) stating your editorial position on this book.",
  "paragraphs": ["paragraph1 (80-150 words)", "paragraph2", "paragraph3", "paragraph4 (must contain your specific criticism)", "paragraph5"],
  "pullQuote": "One memorable, quotable sentence from your review.",
  "summaryBullets": ["point 1", "point 2", "point 3", "point 4", "point 5", "point 6", "point 7", "point 8"],
  "blurb": "1-2 sentences for a card/thumbnail view.",
  "takeaways": ["Theme 1 (2-4 words)", "Theme 2 (2-4 words)", "Theme 3 (2-4 words)"],
  "rating": 4.2
}

RULES:
- headline: One sentence. Declarative. No question marks.
- stand: 2-3 sentences. Your position.
- paragraphs: Exactly 5 paragraphs. Each 80-150 words. Paragraph 4 MUST contain your specific criticism or reservation.
- pullQuote: One sentence. The most quotable line from your review.
- summaryBullets: Exactly 8 points. Each 1-2 sentences. Cover plot, themes, and verdict.
- blurb: 1-2 sentences for a thumbnail card.
- takeaways: Exactly 3 thematic phrases (2-4 words each).
- rating: A number between 3.0 and 5.0, to one decimal place.

Write an honest, substantive review. Be specific. Name what works and what doesn't.`;
}

function validateReview(parsed, title) {
  const required = ['headline', 'stand', 'paragraphs', 'pullQuote', 'summaryBullets', 'blurb', 'takeaways', 'rating'];

  for (const field of required) {
    if (parsed[field] === undefined || parsed[field] === null) {
      throw new Error(`Review for "${title}" missing required field: ${field}`);
    }
  }

  if (!Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 3) {
    throw new Error(`Review for "${title}" has insufficient paragraphs (need at least 3, got ${parsed.paragraphs?.length})`);
  }

  if (!Array.isArray(parsed.summaryBullets) || parsed.summaryBullets.length < 4) {
    throw new Error(`Review for "${title}" has insufficient summary bullets (need at least 4, got ${parsed.summaryBullets?.length})`);
  }

  if (!Array.isArray(parsed.takeaways) || parsed.takeaways.length < 3) {
    throw new Error(`Review for "${title}" has insufficient takeaways (need 3, got ${parsed.takeaways?.length})`);
  }

  // Normalize rating
  let rating = parseFloat(parsed.rating);
  if (isNaN(rating)) rating = 4.0;
  rating = Math.round(Math.max(1.0, Math.min(5.0, rating)) * 10) / 10;

  return {
    headline: String(parsed.headline),
    stand: String(parsed.stand),
    paragraphs: parsed.paragraphs.map(String).slice(0, 5),
    pullQuote: String(parsed.pullQuote),
    summaryBullets: parsed.summaryBullets.map(String).slice(0, 8),
    blurb: String(parsed.blurb),
    takeaways: parsed.takeaways.map(String).slice(0, 3),
    rating,
  };
}

/**
 * Generate chapter-by-chapter summaries for a book.
 * Separate call from the review so it can be retried independently.
 * @param {Object} book - Book metadata (title, author, year, pages, description, genre)
 * @param {Object} persona - Editor persona config (name, systemPrompt)
 * @returns {Object} { chapterSummaries, tokensUsed }
 */
async function generateChapterSummary(book, persona) {
  if (!openai) throw new Error('OpenAI client not configured. Set OPENAI_API_KEY in .env');

  const userPrompt = buildChapterPrompt(book);

  const response = await withRetry(async () => {
    return await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: persona.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1200,
    });
  }, { label: `OpenAI chapters: "${book.title}"`, maxAttempts: 2 });

  const content = response.choices[0].message.content;
  const tokensUsed = response.usage?.total_tokens || 0;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse chapter summary response as JSON: ${content.substring(0, 200)}`);
  }

  const chapterSummaries = validateChapterSummaries(parsed, book.title);

  logger.info(`Chapter summaries generated for "${book.title}" by ${persona.name} (${tokensUsed} tokens, ${chapterSummaries.length} chapters)`);

  return { chapterSummaries, tokensUsed };
}

function buildChapterPrompt(book) {
  const isFiction = ['Fiction', 'Sci-Fi'].includes(book.genre);
  const sectionWord = isFiction ? 'chapter' : 'section/part';

  return `Generate a structured ${sectionWord}-by-${sectionWord} guide for this book. Return your response as a JSON object.

BOOK DETAILS:
- Title: ${book.title}
- Author: ${book.author}
- Year: ${book.year || 'Unknown'}
- Pages: ${book.pages || 'Unknown'}
- Genre: ${book.genre || 'Fiction'}
- Description: ${book.description || 'No description available.'}

REQUIRED JSON OUTPUT FORMAT:
{
  "chapters": [
    {
      "chapter": 1,
      "title": "Chapter or section title",
      "summary": "2-3 sentence summary of this chapter/section.",
      "themes": ["theme1", "theme2"]
    }
  ]
}

RULES:
- Generate between 6 and 15 ${sectionWord} entries, depending on the book's length and structure.
- For ${isFiction ? 'fiction: use chapter numbers and titles. If you know the actual chapter titles, use them. Otherwise, create descriptive titles.' : 'non-fiction: use part/section numbers. Group by the book\'s natural structure (parts, sections, or thematic groupings).'}
- Each "summary" should be 2-3 sentences. Be specific about what happens or what is argued in that section.
- Each "themes" array should contain 1-3 short thematic tags (2-4 words each).
- "chapter" must be a sequential integer starting from 1.
- Base this on your genuine knowledge of the book. If you know the book well, reflect its actual structure. If you are working from the description, create a plausible structure that matches the description and genre conventions.
- These are AI-generated overviews, not verbatim reproductions of the text.

Be specific and substantive. Avoid generic descriptions.`;
}

function validateChapterSummaries(parsed, title) {
  if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
    throw new Error(`Chapter summaries for "${title}" missing "chapters" array`);
  }

  if (parsed.chapters.length < 3) {
    throw new Error(`Chapter summaries for "${title}" has too few entries (need at least 3, got ${parsed.chapters.length})`);
  }

  return parsed.chapters.slice(0, 15).map((ch, idx) => ({
    chapter: typeof ch.chapter === 'number' ? ch.chapter : idx + 1,
    title: String(ch.title || `Chapter ${idx + 1}`),
    summary: String(ch.summary || ''),
    themes: Array.isArray(ch.themes) ? ch.themes.map(String).slice(0, 3) : [],
  }));
}

module.exports = { generateReview, generateChapterSummary };
