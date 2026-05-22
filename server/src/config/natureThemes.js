/** Fixed catalog of 7 nature livestream slots (max concurrent encoders). */
const NATURE_THEMES = [
  {
    id: 'rain',
    label: 'Rain',
    title: 'Rain Sounds 24/7 — Steady Rain on Leaves',
    description: 'Continuous gentle rain ambience for sleep, study, and relaxation. Live 24/7 nature sounds.',
    videoQuery: 'rain forest close up',
    audioQuery: 'rain leaves steady',
    audioPrompt: 'Seamless loopable ambient: steady gentle rain on forest leaves, natural, no music or speech, calm sleep sounds',
  },
  {
    id: 'thunder',
    label: 'Thunder',
    title: 'Thunderstorm Sounds 24/7 — Distant Thunder & Rain',
    description: 'Distant thunder and soft rain for deep focus and calm. Live 24/7 storm ambience.',
    videoQuery: 'storm clouds timelapse',
    audioQuery: 'distant thunder rain',
    audioPrompt: 'Loopable storm ambience: soft rain with distant rolling thunder, no voices, atmospheric and calm',
  },
  {
    id: 'wind',
    label: 'Wind',
    title: 'Wind Through Trees 24/7 — Forest Wind Ambience',
    description: 'Soft wind in the trees for meditation and background calm. Live 24/7.',
    videoQuery: 'tree branches wind slow motion',
    audioQuery: 'wind trees forest',
    audioPrompt: 'Loopable forest wind through trees, gentle rustling leaves, no music or speech, peaceful',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    title: 'Ocean Waves 24/7 — Gentle Beach Sounds',
    description: 'Calm ocean waves for sleep and relaxation. Live 24/7 seaside ambience.',
    videoQuery: 'ocean waves beach loop',
    audioQuery: 'ocean waves gentle',
    audioPrompt: 'Loopable gentle ocean waves on a sandy beach, soft surf, no music or voices, relaxing',
  },
  {
    id: 'birds',
    label: 'Birds',
    title: 'Forest Birds 24/7 — Dawn Chorus Ambience',
    description: 'Morning birdsong in a peaceful forest. Live 24/7 nature sounds.',
    videoQuery: 'forest morning birds',
    audioQuery: 'birds dawn forest',
    audioPrompt: 'Loopable dawn forest birdsong, soft chirping in the distance, no music or human voices, peaceful morning',
  },
  {
    id: 'breeze',
    label: 'Breeze',
    title: 'Soft Breeze 24/7 — Meadow & Leaves',
    description: 'Light breeze and rustling leaves for calm focus. Live 24/7.',
    videoQuery: 'meadow grass slow motion wind',
    audioQuery: 'breeze leaves light',
    audioPrompt: 'Loopable light breeze in a meadow, soft rustling grass and leaves, no music or speech, airy and calm',
  },
  {
    id: 'footsteps',
    label: 'Footsteps',
    title: 'Quiet Path 24/7 — Soft Footsteps Ambience',
    description: 'Distant footsteps on a peaceful path for immersive calm. Live 24/7.',
    videoQuery: 'park walkway slow motion',
    audioQuery: 'footsteps path quiet',
    audioPrompt: 'Loopable quiet footsteps on a gravel park path, distant and soft, no music or voices, peaceful walking ambience',
  },
];

const MAX_CONCURRENT_LIVE = 7;

function getTheme(themeId) {
  return NATURE_THEMES.find((t) => t.id === themeId) || null;
}

module.exports = { NATURE_THEMES, MAX_CONCURRENT_LIVE, getTheme };
