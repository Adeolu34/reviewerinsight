/** Parse an integer query value safely; falls back to `def` on NaN, clamps to [min, max]. */
function clampInt(value, def, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

module.exports = { clampInt };
