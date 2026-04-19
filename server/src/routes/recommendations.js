const express = require('express');
const Book = require('../models/Book');
const { openai, model } = require('../config/openai');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');
const router = express.Router();

// ── Constants ──

const VALID_AGES = ['kid', 'teen', 'young-adult', 'adult', 'mature'];
const VALID_PACES = ['quick', 'weekend', 'deep'];
const VALID_GENRES = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'];

const AGE_LABELS = {
  kid: 'Kid (6-12)',
  teen: 'Teen (13-17)',
  'young-adult': 'Young Adult (18-25)',
  adult: 'Adult (26-45)',
  mature: 'Mature (46+)',
};

const AGE_TONES = {
  kid: 'warm, enthusiastic, and encouraging. Use clear, vivid language. Avoid condescension. Think "favorite librarian who genuinely loves books."',
  teen: 'direct, honest, and slightly irreverent. Don\'t oversell. Acknowledge complexity. Think "cool older sibling who reads a lot."',
  'young-adult': 'conversational and insightful. Balance enthusiasm with substance. Think "well-read friend at a coffee shop."',
  adult: 'thoughtful, specific, and confident. Use literary references where useful. Think "trusted bookseller with strong opinions."',
  mature: 'measured, rich in context, and unhurried. Draw connections to broader reading lives. Think "magazine editor writing a personal letter."',
};

const PAGE_RANGES = {
  quick: { $lt: 250 },
  weekend: { $gte: 150, $lte: 450 },
  deep: { $gte: 300 },
};

// ── Helpers ──

function validateRequest(body) {
  const errors = [];
  if (!body.ageRange || !VALID_AGES.includes(body.ageRange)) {
    errors.push('ageRange is required and must be one of: ' + VALID_AGES.join(', '));
  }
  if (!Array.isArray(body.moods) || body.moods.length === 0) {
    errors.push('moods must be a non-empty array');
  }
  if (!Array.isArray(body.genres) || body.genres.length === 0) {
    errors.push('genres must be a non-empty array');
  }
  if (!body.paceRange || !VALID_PACES.includes(body.paceRange)) {
    errors.push('paceRange is required and must be one of: ' + VALID_PACES.join(', '));
  }
  if (body.freeText && typeof body.freeText === 'string' && body.freeText.length > 500) {
    errors.push('freeText must be 500 characters or fewer');
  }
  return errors;
}

function buildCandidateQuery(ageRange, genres, paceRange) {
  const filter = { status: 'published' };

  // Genre filter — exclude Business for kids/teens
  let effectiveGenres = [...genres];
  if (ageRange === 'kid' || ageRange === 'teen') {
    effectiveGenres = effectiveGenres.filter(g => g !== 'Business');
  }
  if (effectiveGenres.length > 0) {
    filter.genre = { $in: effectiveGenres };
  }

  // Page range by pace
  if (PAGE_RANGES[paceRange]) {
    filter.pages = PAGE_RANGES[paceRange];
  }

  // Kids: cap pages regardless of pace
  if (ageRange === 'kid') {
    filter.pages = { ...(filter.pages || {}), $lt: 350 };
  }

  return filter;
}

function buildSystemPrompt(ageRange) {
  return `You are the recommendation engine for Reviewer Insight, a literary magazine with strong editorial voice.
You are recommending books to a ${AGE_LABELS[ageRange]} reader.

Your tone should be ${AGE_TONES[ageRange]}

Rules:
- ONLY recommend books from the CANDIDATE LIST provided. Never invent books.
- Recommend between 3 and 5 books, ordered by match strength.
- Each recommendation must include a specific explanation of WHY it matches this reader.
- For kid or teen readers, note any content considerations honestly.
- Provide a "reading prescription" intro that ties all recommendations together thematically.
- If the books form a natural reading sequence, suggest one in readingOrder. Otherwise set readingOrder to null.
- Assign a confidence score (0.0 to 1.0) to each recommendation.
- Return ONLY valid JSON matching the specified format.`;
}

function buildUserPrompt(profile, candidates) {
  const paceDesc = {
    quick: 'Quick read — under 200 pages, an afternoon',
    weekend: 'Weekend read — 200-400 pages, a long weekend',
    deep: 'Deep dive — 400+ pages, for the committed reader',
  };

  const bookList = candidates.map(b =>
    `  ID: ${b._id}
  "${b.title}" by ${b.author}
  Genre: ${b.genre} | Year: ${b.year || 'N/A'} | Pages: ${b.pages || 'N/A'} | Rating: ${b.rating || 'N/A'}/5
  Blurb: ${b.blurb || 'No blurb available'}
  Themes: ${(b.takeaways || []).join(', ') || 'N/A'}`
  ).join('\n\n');

  return `READER PROFILE:
- Age group: ${AGE_LABELS[profile.ageRange]}
- Current mood(s): ${profile.moods.join(', ')}
- Genre interests: ${profile.genres.join(', ')}
- Reading capacity: ${paceDesc[profile.paceRange]}
- Additional notes: ${profile.freeText || 'None provided'}

CANDIDATE BOOKS (only recommend from this list):
${bookList}

Return a JSON object with this exact structure:
{
  "prescription": {
    "intro": "A 2-3 sentence personalized paragraph tying the recommendations together.",
    "readingOrder": "If the books form a natural sequence, describe it. Otherwise null.",
    "ageNote": "A brief note about suitability for the reader's age group."
  },
  "recommendations": [
    {
      "bookId": "the _id from the candidate list",
      "matchExplanation": "2-3 sentences explaining why this book matches the reader.",
      "ageNotes": "Brief age-appropriateness note.",
      "confidenceScore": 0.85,
      "matchTags": ["tag1", "tag2", "tag3"]
    }
  ]
}`;
}

function validateAIResponse(parsed, candidateIds) {
  if (!parsed.prescription || !parsed.prescription.intro) {
    throw new Error('Missing prescription.intro');
  }
  if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
    throw new Error('No recommendations returned');
  }

  // Filter to only valid book IDs
  parsed.recommendations = parsed.recommendations.filter(rec => {
    const id = String(rec.bookId);
    return candidateIds.has(id);
  });

  // Normalize confidence scores
  parsed.recommendations.forEach(rec => {
    rec.confidenceScore = Math.max(0, Math.min(1, Number(rec.confidenceScore) || 0.5));
    rec.matchTags = Array.isArray(rec.matchTags) ? rec.matchTags : [];
  });

  return parsed;
}

function enrichRecommendations(aiRecs, candidates) {
  const candidateMap = new Map(candidates.map(c => [String(c._id), c]));

  return aiRecs.map(rec => {
    const book = candidateMap.get(String(rec.bookId));
    if (!book) return null;
    return {
      bookId: String(book._id),
      title: book.title,
      author: book.author,
      genre: book.genre,
      rating: book.rating,
      pages: book.pages,
      readTime: book.readTime,
      coverDesign: book.coverDesign,
      coverImageUrl: book.coverImageUrl,
      blurb: book.blurb,
      matchExplanation: rec.matchExplanation,
      ageNotes: rec.ageNotes,
      confidenceScore: rec.confidenceScore,
      matchTags: rec.matchTags,
    };
  }).filter(Boolean);
}

// ── Route ──

router.post('/', async (req, res, next) => {
  try {
    // Validate
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation error', details: errors });
    }

    if (!openai) {
      return res.status(503).json({ error: 'AI recommendations unavailable — OpenAI not configured' });
    }

    const { ageRange, moods, genres, paceRange, freeText } = req.body;
    const profile = { ageRange, moods, genres, paceRange, freeText };

    // Query candidates with progressive relaxation
    const selectFields = 'title author year genre pages readTime rating blurb takeaways coverDesign coverImageUrl';
    let candidates;

    // Attempt 1: full filter
    const fullFilter = buildCandidateQuery(ageRange, genres, paceRange);
    candidates = await Book.find(fullFilter).select(selectFields).sort({ rating: -1 }).limit(20).lean();

    // Attempt 2: drop page filter
    if (candidates.length < 8) {
      const relaxed = { ...fullFilter };
      delete relaxed.pages;
      candidates = await Book.find(relaxed).select(selectFields).sort({ rating: -1 }).limit(20).lean();
    }

    // Attempt 3: drop genre filter too
    if (candidates.length < 5) {
      candidates = await Book.find({ status: 'published' }).select(selectFields).sort({ rating: -1 }).limit(20).lean();
    }

    if (candidates.length === 0) {
      return res.json({
        prescription: { intro: 'We don\'t have enough books matching your criteria yet. Check back soon!', readingOrder: null, ageNote: '' },
        recommendations: [],
        meta: { candidateCount: 0, tokensUsed: 0, modelUsed: 'none' },
      });
    }

    // Build prompts and call OpenAI
    const systemPrompt = buildSystemPrompt(ageRange);
    const userPrompt = buildUserPrompt(profile, candidates);
    const candidateIds = new Set(candidates.map(c => String(c._id)));

    logger.info(`Generating recommendations: age=${ageRange}, moods=[${moods}], genres=[${genres}], pace=${paceRange}, candidates=${candidates.length}`);

    const response = await withRetry(async () => {
      return await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });
    }, { label: 'AI Recommendations', maxAttempts: 2 });

    const content = response.choices[0].message.content;
    const tokensUsed = response.usage?.total_tokens || 0;
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error('Failed to parse AI recommendation response');
      return res.status(500).json({ error: 'AI returned invalid response' });
    }

    // Validate and enrich
    const validated = validateAIResponse(parsed, candidateIds);
    const recommendations = enrichRecommendations(validated.recommendations, candidates);

    logger.info(`Recommendations generated: ${recommendations.length} books, ${tokensUsed} tokens`);

    res.json({
      prescription: validated.prescription,
      recommendations,
      meta: {
        candidateCount: candidates.length,
        tokensUsed,
        modelUsed: model,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
