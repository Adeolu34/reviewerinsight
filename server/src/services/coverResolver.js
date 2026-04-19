/**
 * Cover resolution and fallback generation.
 */

const PALETTES = [
  { bg: '#E8432C', fg: '#F5EFE4' },
  { bg: '#1E3A8A', fg: '#F5EFE4' },
  { bg: '#141210', fg: '#E4A72B' },
  { bg: '#E4A72B', fg: '#141210' },
  { bg: '#F5EFE4', fg: '#141210' },
  { bg: '#141210', fg: '#F5EFE4' },
  { bg: '#F5EFE4', fg: '#E8432C' },
  { bg: '#E8432C', fg: '#141210' },
  { bg: '#1E3A8A', fg: '#E4A72B' },
  { bg: '#E4A72B', fg: '#E8432C' },
];

const MOTIFS = ['bars', 'grid', 'dot', 'rule'];
const STYLES = ['block', 'type'];

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic typographic cover design from title + author.
 */
function generateCoverDesign(title, author) {
  const hash = simpleHash(`${title}${author}`);
  const palette = PALETTES[hash % PALETTES.length];
  return {
    style: STYLES[hash % STYLES.length],
    bg: palette.bg,
    fg: palette.fg,
    motif: MOTIFS[hash % MOTIFS.length],
  };
}

/**
 * Validate that a cover image URL is actually loadable.
 * Returns the URL if valid, null if broken.
 */
async function validateCoverUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) return url;
    return null;
  } catch {
    return null;
  }
}

module.exports = { generateCoverDesign, validateCoverUrl, simpleHash };
