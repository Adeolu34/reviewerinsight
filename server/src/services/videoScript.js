const { openai, model } = require('../config/openai');
const { jsonFromAssistantContent } = require('../utils/jsonFromAssistant');
const { withRetry } = require('../utils/retry');
const { estimateDurationSeconds } = require('./elevenLabs');
const logger = require('../utils/logger');

/**
 * Generate a 5-scene video narration script from a book's review data.
 * Returns structured scenes ready for Remotion + ElevenLabs.
 *
 * Scene structure:
 *   intro    (~5s)  — title reveal, hook
 *   hook     (~15s) — why this book matters
 *   body     (~40s) — 3 key themes / takeaways
 *   verdict  (~15s) — score + one-liner verdict
 *   outro    (~5s)  — CTA
 */
async function generateVideoScript(book) {
  if (!openai) throw new Error('LLM client not configured');

  const reviewText = [
    book.review?.headline,
    book.review?.stand,
    ...(book.review?.paragraphs || []).slice(0, 2),
    book.review?.pullQuote,
    ...(book.takeaways || []).slice(0, 5),
  ].filter(Boolean).join('\n\n');

  const chapterHighlights = (book.chapterSummaries || [])
    .slice(0, 3)
    .map(c => `Chapter ${c.chapter} — ${c.title}: ${c.summary}`)
    .join('\n');

  const systemPrompt = `You are a script writer for a YouTube book summary channel.
Write punchy, engaging narration that hooks viewers and drives them to read the full book.
Style: Clear, vivid, conversational. No filler phrases. No "in this video".
Always respond with a valid JSON object.`;

  const userPrompt = `Write a narration script for a ~90-second YouTube video about this book.

BOOK: "${book.title}" by ${book.author} (${book.year || 'N/A'}) — ${book.genre}
RATING: ${book.rating || 'N/A'}/5
DESCRIPTION: ${book.description || ''}

REVIEW CONTENT:
${reviewText}

CHAPTER HIGHLIGHTS:
${chapterHighlights}

Return this exact JSON structure:
{
  "title": "short punchy video title (max 8 words)",
  "scenes": [
    {
      "id": "intro",
      "narration": "5-second opener. Drop the book title, author, one arresting statement. Max 2 sentences."
    },
    {
      "id": "hook",
      "narration": "Why does this book matter right now? What problem does it solve or truth does it reveal? 3-4 sentences, ~20 seconds."
    },
    {
      "id": "body",
      "narration": "3 key ideas from the book. Each idea is ONE punchy sentence — bold, vivid, no filler. Max 12 words per idea. Total ~25 seconds."
    },
    {
      "id": "verdict",
      "narration": "Your honest verdict in 3-4 sentences. Include the rating. ~15 seconds."
    },
    {
      "id": "outro",
      "narration": "2-sentence CTA. First sentence: ask viewers to like, comment, share and subscribe. Second sentence: send them to reviewerinsight.com for the full review."
    }
  ],
  "description": "YouTube video description (2-3 sentences + hashtags)"
}`;

  const response = await withRetry(async () => {
    return await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.75,
      max_tokens: 1600,
    });
  });

  const raw = response.choices[0]?.message?.content || '';
  const parsed = jsonFromAssistantContent(raw);

  if (!parsed?.scenes?.length) throw new Error('Invalid video script response from LLM');

  // Annotate each scene with estimated duration
  const scenes = parsed.scenes.map(scene => ({
    ...scene,
    estimatedSeconds: estimateDurationSeconds(scene.narration),
  }));

  const totalSeconds = scenes.reduce((sum, s) => sum + s.estimatedSeconds, 0);

  logger.info(`Video script generated for "${book.title}" — ${totalSeconds}s estimated, ${scenes.length} scenes`);

  return {
    title: parsed.title,
    description: parsed.description,
    scenes,
    totalSeconds,
    fullNarration: scenes.map(s => s.narration).join(' '),
  };
}

module.exports = { generateVideoScript };
