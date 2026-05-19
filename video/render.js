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

  const entryPoint = path.join(__dirname, 'src', 'index.jsx');
  console.log('Bundling Remotion composition…');

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  const totalFrames = scenes.reduce((sum, s) => sum + Math.max(fps * 3, Math.round(s.estimatedSeconds * fps)), 0);

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'BookSummary',
    inputProps: { book, scenes, audioFile },
  });

  console.log(`Rendering ${totalFrames} frames @ ${fps}fps → ${outputPath}`);

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: totalFrames,
      fps,
      width:  1920,
      height: 1080,
    },
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { book, scenes, audioFile },
    timeoutInMilliseconds: 300000,
    onProgress: ({ progress }) => {
      process.stdout.write(`\rRendering: ${Math.round(progress * 100)}%   `);
    },
  });

  console.log(`\nDone → ${outputPath}`);
  // Output path for parent process to read
  process.stdout.write(`\n__OUTPUT__:${outputPath}\n`);
}

main().catch(err => {
  console.error('render.js error:', err.message);
  process.exit(1);
});
