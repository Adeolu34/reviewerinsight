const express = require('express');
const Book = require('../models/Book');
const { openai, model } = require('../config/openai');
const { withRetry } = require('../utils/retry');
const externalBooks = require('../services/externalBooks');
const logger = require('../utils/logger');
const router = express.Router();

// ── Constants ──

const VALID_AGES   = ['kid', 'teen', 'young-adult', 'adult', 'mature'];
const VALID_PACES  = ['quick', 'weekend', 'deep'];
const VALID_GENRES = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'];

const AGE_LABELS = {
  kid:           'Kid (6–12)',
  teen:          'Teen (13–17)',
  'young-adult': 'Young Adult (18–25)',
  adult:         'Adult (26–45)',
  mature:        'Mature (46+)',
};

// Mood → thematic keyword map — matched against book blurbs + takeaways
const MOOD_KEYWORDS = {
  adventure:      ['journey', 'survival', 'quest', 'expedition', 'exploration', 'wilderness', 'trek', 'voyage', 'daring', 'escape'],
  comfort:        ['healing', 'warmth', 'belonging', 'solace', 'gentle', 'home', 'hope', 'tender', 'kindness', 'refuge'],
  challenging:    ['difficult', 'complex', 'philosophy', 'ethics', 'moral', 'confronting', 'questioning', 'uncomfortable', 'critical'],
  emotional:      ['grief', 'love', 'loss', 'family', 'memory', 'longing', 'heartbreak', 'mourning', 'moving', 'ache'],
  inspiring:      ['resilience', 'transformation', 'triumph', 'overcoming', 'courage', 'purpose', 'breakthrough', 'hope', 'change'],
  escapist:       ['world-building', 'immersive', 'alternate', 'fantasy', 'imaginary', 'otherworldly', 'rich', 'sweeping', 'vivid'],
  contemplative:  ['reflective', 'slow', 'introspective', 'quiet', 'meditative', 'philosophical', 'inner', 'patient', 'nuanced', 'layered'],
  provocative:    ['subversive', 'controversial', 'uncomfortable', 'confronting', 'radical', 'boundary', 'taboo', 'unsettling'],
  meditative:     ['stillness', 'presence', 'spiritual', 'calm', 'mindful', 'peaceful', 'silence', 'awareness'],
  fun:            ['funny', 'humor', 'witty', 'playful', 'lighthearted', 'laugh', 'comic', 'delight', 'joy', 'whimsical'],
  magical:        ['magical', 'wonder', 'enchanting', 'fairy', 'whimsy', 'spell', 'mystical', 'dreamlike', 'fantastical'],
  heartfelt:      ['touching', 'moving', 'compassion', 'empathy', 'tender', 'sincere', 'genuine', 'emotional', 'human'],
  'mind-bending': ['twist', 'surreal', 'unexpected', 'perspective', 'reality', 'perception', 'strange', 'disorienting', 'surprising'],
  heroic:         ['hero', 'courage', 'brave', 'valor', 'noble', 'sacrifice', 'warrior', 'strength', 'champion'],
};

// Genres to exclude per age group
const AGE_GENRE_EXCLUSIONS = {
  kid:  ['Business'],
  teen: ['Business'],
};

// Hard page cap per age group (applied at DB level)
const AGE_PAGE_CAPS = {
  kid: 350,
};

// ── Validation ──

function validateRequest(body) {
  const errors = [];
  if (!body.ageRange || !VALID_AGES.includes(body.ageRange))
    errors.push('ageRange is required and must be one of: ' + VALID_AGES.join(', '));
  if (!Array.isArray(body.moods) || body.moods.length === 0)
    errors.push('moods must be a non-empty array');
  if (!Array.isArray(body.genres) || body.genres.length === 0)
    errors.push('genres must be a non-empty array');
  if (!body.paceRange || !VALID_PACES.includes(body.paceRange))
    errors.push('paceRange is required and must be one of: ' + VALID_PACES.join(', '));
  if (body.freeText && typeof body.freeText === 'string' && body.freeText.length > 500)
    errors.push('freeText must be 500 characters or fewer');
  return errors;
}

// ── Scoring Engine ──

// Continuous pace fitness — returns 0.0–1.0 (no hard cutoffs)
function paceFitness(pages, paceRange) {
  if (!pages) return 0.5;
  if (paceRange === 'quick') {
    if (pages <= 180) return 1.0;
    if (pages <= 250) return 0.75;
    if (pages <= 350) return 0.4;
    return Math.max(0, 1 - (pages - 200) / 400);
  }
  if (paceRange === 'weekend') {
    if (pages >= 200 && pages <= 350) return 1.0;
    if (pages >= 150 && pages <= 450) return 0.75;
    if (pages >= 100 && pages <= 550) return 0.4;
    return 0.15;
  }
  if (paceRange === 'deep') {
    if (pages >= 400) return 1.0;
    if (pages >= 300) return 0.8;
    if (pages >= 250) return 0.5;
    return Math.max(0, pages / 500);
  }
  return 0.5;
}

// Score a book against a reader profile — returns 0–100
function scoreBook(book, profile) {
  const text = [
    ...(book.takeaways || []),
    book.blurb || '',
    book.review?.headline || '',
  ].join(' ').toLowerCase();

  // Genre match (0–25)
  const genreScore = profile.genres.includes(book.genre) ? 25 : 0;

  // Mood–theme alignment (0–25)
  // Each mood contributes proportionally; cap per mood avoids single-mood domination
  let moodHits = 0;
  for (const mood of profile.moods) {
    const keywords = MOOD_KEYWORDS[mood] || [];
    const hits = keywords.filter(kw => text.includes(kw)).length;
    moodHits += Math.min(hits, 3);
  }
  const moodScore = Math.min((moodHits / Math.max(profile.moods.length * 2, 1)) * 25, 25);

  // Pace fitness (0–20)
  const paceScore = paceFitness(book.pages, profile.paceRange) * 20;

  // Editorial rating quality (0–15)
  const ratingScore = ((book.rating || 0) / 5) * 15;

  // Editors pick / featured signal (0–10)
  const editorialScore = book.featured ? 10 : 0;

  // Recency (0–5) — newer books get a slight boost
  const year = book.year || 1990;
  const recencyScore = Math.min(Math.max((year - 1980) / 8, 0), 1) * 5;

  return genreScore + moodScore + paceScore + ratingScore + editorialScore + recencyScore;
}

// ── Jitter + Diversity Sampling ──
// Injects controlled randomness so repeated identical queries return varied results.
// Jitter range: ±18 pts (on 100pt scale) — large enough to rotate top results,
// small enough that a genuinely weak book can't beat a strong one.
const JITTER_RANGE = 18;

function sampleRecommendations(candidates, profile, n = 4) {
  const scored = candidates.map(book => ({
    book,
    rawScore: scoreBook(book, profile),
  }));

  // Apply per-request jitter
  const jittered = scored.map(item => ({
    ...item,
    jitteredScore: item.rawScore + (Math.random() - 0.5) * 2 * JITTER_RANGE,
  }));

  jittered.sort((a, b) => b.jitteredScore - a.jitteredScore);

  // Diversity pass 1: max 2 per genre, 1 per author
  const selected = [];
  const genreCounts = {};
  const authorsSeen = new Set();

  for (const item of jittered) {
    if (selected.length >= n) break;
    const { genre, author } = item.book;
    if ((genreCounts[genre] || 0) >= 2) continue;
    if (authorsSeen.has(author)) continue;
    genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    authorsSeen.add(author);
    selected.push(item);
  }

  // Diversity pass 2: relax author constraint if still short
  if (selected.length < Math.min(n, jittered.length)) {
    for (const item of jittered) {
      if (selected.length >= n) break;
      if (selected.includes(item)) continue;
      const { genre } = item.book;
      if ((genreCounts[genre] || 0) >= 2) continue;
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      selected.push(item);
    }
  }

  // Last resort: fill without any constraints
  if (selected.length < Math.min(n, jittered.length)) {
    for (const item of jittered) {
      if (selected.length >= n) break;
      if (!selected.includes(item)) selected.push(item);
    }
  }

  return selected;
}

// ── Match Tags & Explanations (algorithmic) ──

function findMoodMatches(book, profile) {
  const text = [
    ...(book.takeaways || []),
    book.blurb || '',
  ].join(' ').toLowerCase();

  return profile.moods.filter(mood => {
    const keywords = MOOD_KEYWORDS[mood] || [];
    return keywords.some(kw => text.includes(kw));
  });
}

function generateMatchTags(book, profile, moodMatches) {
  const tags = new Set();
  if (profile.genres.includes(book.genre)) tags.add(book.genre.toLowerCase());
  for (const mood of moodMatches) tags.add(mood);
  if (book.featured) tags.add('editors pick');
  if ((book.rating || 0) >= 4.5) tags.add('top rated');
  const pages = book.pages || 200;
  if (profile.paceRange === 'quick' && pages < 200) tags.add('quick read');
  if (profile.paceRange === 'deep' && pages >= 400) tags.add('deep dive');
  return [...tags].slice(0, 4);
}

function generateExplanation(book, profile, moodMatches) {
  const parts = [];
  const themes = (book.takeaways || []).slice(0, 2);
  const genreMatch = profile.genres.includes(book.genre);

  if (genreMatch) {
    parts.push(`A strong ${book.genre} pick aligned with your stated interest.`);
  }

  if (moodMatches.length > 0 && themes.length > 0) {
    const moodStr = moodMatches.length === 1
      ? moodMatches[0]
      : moodMatches.slice(0, 2).join(' and ');
    parts.push(`Its themes — ${themes.join(', ')} — match a ${moodStr} reading mood.`);
  } else if (themes.length > 0) {
    parts.push(`Anchored by themes of ${themes.join(' and ')}.`);
  }

  const pages = book.pages;
  if ((book.rating || 0) >= 4 && pages) {
    if (profile.paceRange === 'quick' && pages < 200) {
      parts.push(`At ${pages} pages and rated ${book.rating}/5, it fits into a single sitting.`);
    } else if (profile.paceRange === 'deep' && pages >= 400) {
      parts.push(`At ${pages} pages and rated ${book.rating}/5, it rewards sustained attention.`);
    } else {
      parts.push(`Rated ${book.rating}/5 — one of the stronger entries in the catalog.`);
    }
  } else if ((book.rating || 0) >= 4) {
    parts.push(`Rated ${book.rating}/5 in our editorial assessment.`);
  }

  // Blurb fallback if explanation is too thin
  if (parts.length < 2 && book.blurb) {
    const snippet = book.blurb.slice(0, 140);
    parts.push(snippet + (book.blurb.length > 140 ? '…' : ''));
  }

  return parts.slice(0, 3).join(' ') || `A well-matched ${book.genre || 'title'} for your reading profile.`;
}

// ── Prescription ──

function algorithmicPrescription(picks, profile) {
  const genreSet = [...new Set(picks.map(p => p.book.genre))];
  const moodStr = profile.moods.slice(0, 2).join(' and ');
  const genreStr = genreSet.length > 1
    ? genreSet.slice(0, -1).join(', ') + ' and ' + genreSet[genreSet.length - 1]
    : (genreSet[0] || 'selected');

  const ageNote = profile.ageRange === 'kid' || profile.ageRange === 'teen'
    ? 'All picks reviewed for age-appropriate content.'
    : null;

  return {
    intro: `We found ${picks.length} ${genreStr} ${picks.length === 1 ? 'title' : 'titles'} that fit your ${moodStr} mood and ${AGE_LABELS[profile.ageRange]} reading profile — chosen for thematic alignment, editorial quality, and pace fit.`,
    readingOrder: null,
    ageNote,
  };
}

async function aiPrescription(picks, profile) {
  const bookList = picks.map((p, i) =>
    `${i + 1}. "${p.book.title}" by ${p.book.author} (${p.book.genre}, ${p.book.pages || '?'} pages, rated ${p.book.rating || '?'}/5)`
  ).join('\n');

  const prompt = `Write a 2–3 sentence reading prescription for a ${AGE_LABELS[profile.ageRange]} reader whose mood is ${profile.moods.join(', ')}, looking for ${profile.paceRange} reads in ${profile.genres.join(', ')}. Tie the selections below together thematically without naming individual titles:

${bookList}

Return only JSON: { "intro": "...", "readingOrder": "..." or null, "ageNote": "..." or null }`;

  const response = await withRetry(async () => {
    return await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You write concise, editorial prose for a literary magazine. No clichés. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 280,
    });
  }, { label: 'Prescription', maxAttempts: 2 });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    intro: parsed.intro || '',
    readingOrder: parsed.readingOrder || null,
    ageNote: parsed.ageNote || null,
    tokensUsed: response.usage?.total_tokens || 0,
  };
}

// ── Route ──

router.post('/', async (req, res, next) => {
  try {
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation error', details: errors });
    }

    const { ageRange, moods, genres, paceRange, freeText } = req.body;
    const profile = { ageRange, moods, genres, paceRange, freeText };

    const excludedGenres = AGE_GENRE_EXCLUSIONS[ageRange] || [];
    const effectiveGenres = genres.filter(g => !excludedGenres.includes(g));

    const selectFields = 'title author year genre pages readTime rating blurb takeaways featured coverDesign coverImageUrl review.headline';

    // Fetch candidates — page fit is a score dimension, not a hard DB filter
    let candidates = await Book.find({
      status: 'published',
      ...(effectiveGenres.length > 0 ? { genre: { $in: effectiveGenres } } : {}),
      ...(AGE_PAGE_CAPS[ageRange] ? { pages: { $lt: AGE_PAGE_CAPS[ageRange] } } : {}),
    }).select(selectFields).lean();

    // Broaden to all genres if too few candidates
    if (candidates.length < 5) {
      candidates = await Book.find({
        status: 'published',
        ...(AGE_PAGE_CAPS[ageRange] ? { pages: { $lt: AGE_PAGE_CAPS[ageRange] } } : {}),
      }).select(selectFields).lean();
    }

    if (candidates.length === 0) {
      return res.json({
        prescription: { intro: 'The catalog is still growing — check back soon!', readingOrder: null, ageNote: null },
        recommendations: [],
        meta: { candidateCount: 0, algorithm: 'score-v2', tokensUsed: 0, modelUsed: 'algorithmic' },
      });
    }

    logger.info(`Scoring ${candidates.length} candidates: age=${ageRange} moods=[${moods}] genres=[${genres}] pace=${paceRange}`);

    // Score + jitter + diversity sample
    const picks = sampleRecommendations(candidates, profile, 4);

    // Build recommendations algorithmically
    const recommendations = picks.map(({ book, rawScore }) => {
      const moodMatches = findMoodMatches(book, profile);
      return {
        bookId:           String(book._id),
        title:            book.title,
        author:           book.author,
        genre:            book.genre,
        rating:           book.rating,
        pages:            book.pages,
        readTime:         book.readTime,
        coverDesign:      book.coverDesign,
        coverImageUrl:    book.coverImageUrl,
        blurb:            book.blurb,
        matchExplanation: generateExplanation(book, profile, moodMatches),
        ageNotes:         null,
        confidenceScore:  Math.min(rawScore / 100, 1),
        matchTags:        generateMatchTags(book, profile, moodMatches),
      };
    });

    // Prescription + external picks in parallel
    let tokensUsed = 0;
    let prescription;

    const [prescriptionResult, externalPicks] = await Promise.all([
      openai
        ? aiPrescription(picks, profile).catch(err => {
            logger.warn(`AI prescription failed, using algorithmic: ${err.message}`);
            return null;
          })
        : Promise.resolve(null),
      externalBooks.searchBooks({ genres: effectiveGenres, moods, freeText }).catch(err => {
        logger.warn(`External book search failed: ${err.message}`);
        return [];
      }),
    ]);

    if (prescriptionResult) {
      prescription = { intro: prescriptionResult.intro, readingOrder: prescriptionResult.readingOrder, ageNote: prescriptionResult.ageNote };
      tokensUsed = prescriptionResult.tokensUsed;
    } else {
      prescription = algorithmicPrescription(picks, profile);
    }

    logger.info(`Recommendations ready: ${recommendations.length} picks + ${externalPicks.length} external, ${tokensUsed} tokens`);

    res.json({
      prescription,
      recommendations,
      externalPicks,
      meta: {
        candidateCount: candidates.length,
        algorithm:      'score-v2',
        tokensUsed,
        modelUsed:      tokensUsed > 0 ? model : 'algorithmic',
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
