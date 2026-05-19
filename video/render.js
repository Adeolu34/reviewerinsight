/**
 * Programmatic Remotion renderer.
 * Called by VideoAgent with job data passed via stdin (JSON).
 *
 * Usage (internal — called by VideoAgent.js):
 *   node render.js < job.json
 *
 * Or directly for testing:
 *   echo '{"book":{...},"scenes":[...],"audioFile":"narration.mp3","outputPath":"/tmp/out.mp4"}' | node render.js
 *
 * Background music: place a royalty-free MP3 at video/assets/background.mp3
 * (or set BACKGROUND_MUSIC_FILE env var to an absolute path).
 */
const { bundle }      = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs   = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// Locate Remotion's bundled ffprobe — handles Windows and Linux
function findFfprobe() {
  const candidates = [
    path.join(__dirname, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe'),
    path.join(__dirname, 'node_modules', '@remotion', 'compositor-linux-x64-gnu',  'ffprobe'),
    path.join(__dirname, 'node_modules', '@remotion', 'compositor-linux-x64-musl', 'ffprobe'),
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

async function getAudioDurationSecs(filePath) {
  const ffprobe = findFfprobe();
  if (!ffprobe) return null;
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
    ]);
    const secs = parseFloat(stdout.trim());
    return isNaN(secs) ? null : secs;
  } catch {
    return null;
  }
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  const job = JSON.parse(input);
  const { book, scenes, audioFile, outputPath, fps = 30, captions } = job;

  if (!book || !scenes || !outputPath) {
    console.error('render.js: missing required fields (book, scenes, outputPath)');
    process.exit(1);
  }

  const publicDir = path.join(__dirname, 'public');
  await fs.promises.mkdir(publicDir, { recursive: true });

  // Copy narration audio into public/ so staticFile() can serve it
  let publicAudioName = null;
  if (audioFile && fs.existsSync(audioFile)) {
    publicAudioName = `audio-${Date.now()}${path.extname(audioFile)}`;
    await fs.promises.copyFile(audioFile, path.join(publicDir, publicAudioName));
  }

  // Copy background music into public/ if available
  const bgMusicSrc = process.env.BACKGROUND_MUSIC_FILE
    || path.join(__dirname, 'assets', 'background.mp3');
  let publicBgName = null;
  if (fs.existsSync(bgMusicSrc)) {
    publicBgName = `bg-${Date.now()}${path.extname(bgMusicSrc)}`;
    await fs.promises.copyFile(bgMusicSrc, path.join(publicDir, publicBgName));
    console.log('Background music loaded:', path.basename(bgMusicSrc));
  }

  const entryPoint = path.join(__dirname, 'src', 'index.jsx');
  console.log('Bundling Remotion composition…');

  const bundleLocation = await bundle({
    entryPoint,
    publicDir,
    webpackOverride: (config) => config,
  });

  const estimatedFrames = scenes.reduce((sum, s) => sum + Math.max(fps * 3, Math.round(s.estimatedSeconds * fps)), 0);

  // Use actual audio duration so the video never cuts off mid-narration
  let audioDurationSecs = null;
  if (publicAudioName) {
    audioDurationSecs = await getAudioDurationSecs(path.join(publicDir, publicAudioName));
    if (audioDurationSecs) {
      console.log(`Audio duration: ${audioDurationSecs.toFixed(1)}s`);
    } else {
      console.warn('Could not detect audio duration, using estimate');
    }
  }
  const audioFrames = audioDurationSecs ? Math.ceil(audioDurationSecs * fps) + fps * 2 : 0;
  const totalFrames = Math.max(estimatedFrames, audioFrames);

  const inputProps = {
    book,
    scenes,
    audioFile:             publicAudioName || null,
    backgroundMusicFile:   publicBgName    || null,
    totalDurationInFrames: totalFrames,
    captions:              captions || null,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BookSummary',
    inputProps,
  });

  console.log(`Rendering ${totalFrames} frames @ ${fps}fps → ${outputPath}`);

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      fps,
      width:  1080,
      height: 1920,
    },
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 300000,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering: ${Math.round(progress * 100)}%   `);
    },
  });

  // Clean up temp files from public dir
  if (publicAudioName) {
    await fs.promises.unlink(path.join(publicDir, publicAudioName)).catch(() => {});
  }
  if (publicBgName) {
    await fs.promises.unlink(path.join(publicDir, publicBgName)).catch(() => {});
  }

  console.log(`\nDone → ${outputPath}`);
  process.stdout.write(`\n__OUTPUT__:${outputPath}\n`);
}

main().catch(err => {
  console.error('render.js error:', err.message);
  process.exit(1);
});
