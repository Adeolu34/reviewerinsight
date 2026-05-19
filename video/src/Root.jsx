const { Composition } = require('remotion');
const React = require('react');
const { BookSummary } = require('./compositions/BookSummary');

// Default props used when previewing in Remotion Studio
const DEFAULT_BOOK = {
  title:  'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  year:   1925,
  genre:  'Fiction',
  rating: 4,
  cover:  { bg: '#1a1008', fg: '#F5EFE4', motif: 'bars' },
};

const DEFAULT_SCENES = [
  { id:'intro',   narration:'The Great Gatsby by F. Scott Fitzgerald. A searing portrait of the American Dream — and everything wrong with it.',       estimatedSeconds: 5  },
  { id:'hook',    narration:"Published in 1925, Fitzgerald's masterpiece captures an era of excess and illusion. Jay Gatsby throws legendary parties, yet remains a mystery. This is a novel about longing, self-invention, and the lies we tell ourselves.", estimatedSeconds: 18 },
  { id:'body',    narration:'Three ideas define this book. First: the green light across the bay — Gatsby\'s obsession with a past he can never recapture. Second: the Valley of Ashes, where those left behind by the wealthy are ground to dust. Third: Nick Carraway, the only honest man in a world of liars — and how that honesty destroys him.',                                        estimatedSeconds: 42 },
  { id:'verdict', narration:"This is a five-star novel disguised as a love story. Fitzgerald packs more truth into 180 pages than most writers manage in a lifetime. Essential reading — whether you're 18 or 80.", estimatedSeconds: 15 },
  { id:'outro',   narration:'Read the full chapter-by-chapter review at reviewerinsight.com. New books every week.',                                   estimatedSeconds: 8  },
];

const FPS = 30;
const totalFrames = DEFAULT_SCENES.reduce((sum, s) => sum + Math.round(s.estimatedSeconds * FPS), 0);

const Root = () => (
  <Composition
    id="BookSummary"
    component={BookSummary}
    durationInFrames={totalFrames}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{
      book:      DEFAULT_BOOK,
      scenes:    DEFAULT_SCENES,
      audioFile: null,
    }}
  />
);

module.exports = { Root };
