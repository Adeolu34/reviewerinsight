/**
 * Programmatic Remotion renderer.
 * Called by VideoAgent with job data passed via stdin (JSON).
 *
 * Usage (internal — called by VideoAgent.js):
 *   node render.js < job.json
 *
 * Or directly for testing:
 *   echo '{"book":{...},"scenes":[...],"audioFile":"narration.mp3","outputPath":"/tmp/out.mp4"}' | node render.js
 */
const { bundle }      = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs   = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function getAudioDurationSecs(filePath) {
  const ffprobe = path.join(__dirname, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');
  if (!fs.existsSync(ffprobe)) return null;
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
  const { book, scenes, audioFile, outputPath, fps = 30 } = job;

  if (!book || !scenes || !outputPath) {
    console.error('render.js: missing required fields (book, scenes, outputPath)');
    process.exit(1);
  }

  // Copy audio into video/public/ so Remotion's staticFile() can serve it
  const publicDir = path.join(__dirname, 'public');
  await fs.promises.mkdir(publicDir, { recursive: true });
  let publicAudioName = null;
  if (audioFile && fs.existsSync(audioFile)) {
    publicAudioName = `audio-${Date.now()}${path.extname(audioFile)}`;
    await fs.promises.copyFile(audioFile, path.join(publicDir, publicAudioName));
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

  const audioRef = publicAudioName || null;

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BookSummary',
    inputProps: { book, scenes, audioFile: audioRef },
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
    inputProps: { book, scenes, audioFile: audioRef },
    timeoutInMilliseconds: 300000,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering: ${Math.round(progress * 100)}%   `);
    },
  });

  // Clean up temp audio from public dir
  if (publicAudioName) {
    await fs.promises.unlink(path.join(publicDir, publicAudioName)).catch(() => {});
  }

  console.log(`\nDone → ${outputPath}`);
  // Output path for parent process to read
  process.stdout.write(`\n__OUTPUT__:${outputPath}\n`);
}

main().catch(err => {
  console.error('render.js error:', err.message);
  process.exit(1);
});
