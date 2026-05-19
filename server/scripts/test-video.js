/**
 * Local test for the full video pipeline — does NOT call ElevenLabs by default.
 *
 * Usage (from repo root):
 *   cd server
 *   node scripts/test-video.js              # test with ElevenLabs TTS (default)
 *   node scripts/test-video.js --no-tts     # skip TTS, render silent
 *   node scripts/test-video.js <bookId>     # test a specific book with TTS
 *   node scripts/test-video.js <bookId> --no-tts
 */
require('dotenv').config();

const path = require('path');
const fs   = require('fs');
const mongoose = require('mongoose');
const config  = require('../src/config/env');
const Book    = require('../src/models/Book');
const { generateVideoScript } = require('../src/services/videoScript');

const VIDEO_OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR
  || path.join(__dirname, '..', '..', 'videos');

const args    = process.argv.slice(2);
const useTTS  = !args.includes('--no-tts');
const bookArg = args.find(a => !a.startsWith('--'));

// Tiny valid silent MP3 (44-byte MPEG frame) — used when skipping ElevenLabs
const SILENT_MP3 = Buffer.from(
  'fffb9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  'hex',
);

async function run() {
  console.log('\n[1/4] Connecting to MongoDB…');
  await mongoose.connect(config.mongoUri);
  console.log('      OK');

  // ── Pick a book ─────────────────────────────────────────────────────
  let book;
  if (bookArg) {
    book = await Book.findById(bookArg).lean();
    if (!book) { console.error(`Book not found: ${bookArg}`); process.exit(1); }
  } else {
    book = await Book.findOne({
      status: 'published',
      'review.headline': { $exists: true },
    }).sort({ rating: -1 }).lean();
    if (!book) { console.error('No published book with a review found.'); process.exit(1); }
  }
  console.log(`\n[2/4] Book: "${book.title}" by ${book.author} (${book._id})`);

  // ── Step 1: Script (LLM) ────────────────────────────────────────────
  console.log('\n[3/4] Generating video script…');
  let script;
  try {
    script = await generateVideoScript(book);
    console.log(`      OK — ${script.scenes.length} scenes, ~${script.totalSeconds}s`);
    script.scenes.forEach((s, i) =>
      console.log(`      [${s.id}] ~${s.estimatedSeconds}s: ${s.narration.slice(0, 80).trim()}…`),
    );
  } catch (err) {
    console.error('\n      FAILED at scripting:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── Step 2: Audio ────────────────────────────────────────────────────
  await fs.promises.mkdir(VIDEO_OUTPUT_DIR, { recursive: true });
  const safeTitle = book.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
  const audioPath = path.join(VIDEO_OUTPUT_DIR, `test-${safeTitle}.mp3`);
  const videoPath = path.join(VIDEO_OUTPUT_DIR, `test-${safeTitle}.mp4`);

  if (useTTS) {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenKey || elevenKey.startsWith('your-')) {
      console.error('\nELEVENLABS_API_KEY missing in .env — use --no-tts to skip voiceover');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('\n[4/4] Generating TTS audio (ElevenLabs)…');
    const { generateSpeechFile } = require('../src/services/elevenLabs');
    try {
      await generateSpeechFile(script.fullNarration, audioPath);
      const stat = await fs.promises.stat(audioPath);
      console.log(`      OK — ${(stat.size / 1024).toFixed(1)} KB`);
    } catch (err) {
      console.error('\n      FAILED at TTS:', err.message);
      await mongoose.disconnect();
      process.exit(1);
    }
  } else {
    console.log('\n[4/4] Skipping ElevenLabs (--no-tts) — video will render without voiceover');
  }

  // ── Step 3: Remotion render ──────────────────────────────────────────
  console.log('\n[5/5] Running Remotion render (may take 1-5 min)…');
  const { spawn } = require('child_process');
  const RENDER_SCRIPT = path.join(__dirname, '..', '..', 'video', 'render.js');

  if (!fs.existsSync(RENDER_SCRIPT)) {
    console.error(`\n      render.js not found at ${RENDER_SCRIPT}`);
    console.error('      Make sure you ran: cd video && npm install --legacy-peer-deps');
    await mongoose.disconnect();
    process.exit(1);
  }

  const videoDir = path.join(__dirname, '..', '..', 'video');
  if (!fs.existsSync(path.join(videoDir, 'node_modules'))) {
    console.error('\n      video/node_modules not found.');
    console.error('      Run: cd video && npm install --legacy-peer-deps');
    await mongoose.disconnect();
    process.exit(1);
  }

  const coverData = book.coverDesign || book.cover || { bg: '#141210', fg: '#F5EFE4', motif: 'bars' };
  const jobData = {
    book: { title: book.title, author: book.author, year: book.year, genre: book.genre, rating: book.rating, cover: coverData },
    scenes: script.scenes,
    audioFile: useTTS ? audioPath : null,
    outputPath: videoPath,
  };

  await new Promise((resolve, reject) => {
    const child = spawn('node', [RENDER_SCRIPT], {
      cwd: videoDir,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    child.stdin.write(JSON.stringify(jobData));
    child.stdin.end();
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`Render exited ${code}`)));
    child.on('error', reject);
  }).then(() => {
    console.log(`\n      OK → ${videoPath}`);
  }).catch(err => {
    console.error('\n      FAILED at render:', err.message);
  });

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
