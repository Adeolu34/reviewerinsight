/** Shared audio gain for Nature Live (preview, loops, RTMP, long test exports). */

function getNatureAudioGain() {
  const raw = parseFloat(process.env.NATURE_AUDIO_GAIN || '3', 10);
  if (Number.isNaN(raw)) return 3;
  return Math.min(Math.max(raw, 0.5), 8);
}

/** ffmpeg volume + soft limiter to reduce clipping after boost. */
function getNatureAudioFilter() {
  const g = getNatureAudioGain();
  return `volume=${g},alimiter=limit=0.95:level=false`;
}

function getNatureAudioBitrate() {
  return process.env.NATURE_AUDIO_BITRATE || '192k';
}

module.exports = {
  getNatureAudioGain,
  getNatureAudioFilter,
  getNatureAudioBitrate,
};
