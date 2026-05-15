// AI-powered book recommendation engine with step-by-step questionnaire

// ── Constants ──

const AGE_RANGES = [{
  id: 'kid',
  label: 'Kid',
  range: '6 – 12',
  desc: 'Young readers discovering the world of books',
  num: '6'
}, {
  id: 'teen',
  label: 'Teen',
  range: '13 – 17',
  desc: 'Ready for complexity and real stakes',
  num: '13'
}, {
  id: 'young-adult',
  label: 'Young Adult',
  range: '18 – 25',
  desc: 'Big questions, big worlds, big feelings',
  num: '18'
}, {
  id: 'adult',
  label: 'Adult',
  range: '26 – 45',
  desc: 'Looking for substance and surprise',
  num: '26'
}, {
  id: 'mature',
  label: 'Mature',
  range: '46 +',
  desc: 'A lifetime of reading to draw on',
  num: '46'
}];
const MOODS_BY_AGE = {
  kid: ['adventure', 'fun', 'magical', 'heartfelt', 'mind-bending', 'heroic'],
  teen: ['adventure', 'comfort', 'challenging', 'emotional', 'inspiring', 'escapist'],
  'young-adult': ['adventure', 'comfort', 'challenging', 'emotional', 'inspiring', 'escapist'],
  adult: ['adventure', 'comfort', 'challenging', 'emotional', 'inspiring', 'escapist', 'contemplative', 'provocative'],
  mature: ['adventure', 'comfort', 'challenging', 'emotional', 'inspiring', 'contemplative', 'provocative', 'meditative']
};
const PACE_OPTIONS = [{
  id: 'quick',
  label: 'Quick Read',
  desc: 'Under 200 pages — a quiet afternoon',
  num: '<200'
}, {
  id: 'weekend',
  label: 'Weekend Read',
  desc: '200 – 400 pages — a long weekend',
  num: '~300'
}, {
  id: 'deep',
  label: 'Deep Dive',
  desc: '400+ pages — for the committed reader',
  num: '400+'
}];
const STEP_LABELS = ['Age', 'Mood', 'Genre', 'Pace', 'Details'];

// ── Sub-components ──

const ProgressBar = ({
  step,
  total,
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '20px 0 8px'
  }
}, Array.from({
  length: total
}, (_, i) => {
  const done = i + 1 < step;
  const active = i + 1 === step;
  return /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 1.5,
      background: done ? accent : '#14121030',
      transition: 'background .4s ease'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: done ? accent : active ? accent : 'transparent',
      border: `1.5px solid ${done || active ? accent : '#14121040'}`,
      transition: 'all .4s ease',
      animation: active ? 'ri-pulse 2s ease-in-out infinite' : 'none',
      boxShadow: active ? `0 0 12px ${accent}44` : 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 8px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: active ? 1 : 0.4,
      color: active ? accent : '#141210',
      transition: 'all .3s ease'
    }
  }, STEP_LABELS[i])));
}));
const WelcomeStep = ({
  onBegin,
  accent
}) => {
  const [ref, vis] = useReveal();
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      textAlign: 'center',
      padding: '80px 0 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "For You \u2014 Recommendation Engine")), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '900 120px "DM Serif Display", Georgia, serif',
      margin: '12px 0 24px',
      letterSpacing: '-.03em',
      lineHeight: .85,
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(32px)',
      transition: 'all .8s .1s cubic-bezier(.2,.8,.2,1)'
    }
  }, "Let us find your ", /*#__PURE__*/React.createElement("em", {
    style: {
      color: accent,
      fontStyle: 'italic'
    }
  }, "next read.")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 20px/1.55 "Space Grotesk", sans-serif',
      maxWidth: 560,
      margin: '0 auto 36px',
      color: '#141210',
      opacity: vis ? 1 : 0,
      transition: 'opacity .6s .3s ease'
    }
  }, "Answer five quick questions. We'll score the full catalog against your mood, taste, and pace \u2014 and surface books you're actually likely to read."), /*#__PURE__*/React.createElement("button", {
    onClick: onBegin,
    className: "ri-btn-primary",
    style: {
      font: '700 14px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '18px 36px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999,
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(16px)',
      transition: 'all .5s .4s cubic-bezier(.2,.8,.2,1)'
    }
  }, "Begin"));
};
const AgeStep = ({
  selected,
  onSelect,
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    maxWidth: 900,
    margin: '0 auto'
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  color: accent,
  style: {
    marginBottom: 8
  }
}, "Step 1 of 5"), /*#__PURE__*/React.createElement("h2", {
  style: {
    font: '900 72px "DM Serif Display", Georgia, serif',
    margin: '0 0 36px',
    letterSpacing: '-.02em',
    lineHeight: .9
  }
}, "Who's reading?"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16
  }
}, AGE_RANGES.map((a, i) => {
  const active = selected === a.id;
  return /*#__PURE__*/React.createElement("div", {
    key: a.id,
    onClick: () => onSelect(a.id),
    className: "ri-card",
    style: {
      padding: 20,
      border: `1.5px solid ${active ? accent : '#141210'}`,
      background: active ? '#141210' : 'transparent',
      color: active ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      transition: 'all .25s ease',
      textAlign: 'center',
      animation: `ri-fadeUp .5s ${i * 0.08}s cubic-bezier(.2,.8,.2,1) both`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 48px "DM Serif Display", Georgia, serif',
      lineHeight: .9,
      color: active ? accent : accent,
      marginBottom: 8,
      transition: 'color .25s ease'
    }
  }, a.num), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px "DM Serif Display", Georgia, serif',
      marginBottom: 4
    }
  }, a.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .7,
      marginBottom: 8
    }
  }, a.range), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 "Space Grotesk", sans-serif',
      opacity: .8
    }
  }, a.desc));
})));
const MoodStep = ({
  ageRange,
  selected,
  onToggle,
  onNext,
  accent
}) => {
  const moods = MOODS_BY_AGE[ageRange] || MOODS_BY_AGE['adult'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 8
    }
  }, "Step 2 of 5"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 72px "DM Serif Display", Georgia, serif',
      margin: '0 0 12px',
      letterSpacing: '-.02em',
      lineHeight: .9
    }
  }, "What are you in the mood for?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px "Space Grotesk", sans-serif',
      opacity: .7,
      margin: '0 0 32px'
    }
  }, "Pick up to 3."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 36
    }
  }, moods.map((m, i) => {
    const active = selected.includes(m);
    return /*#__PURE__*/React.createElement("button", {
      key: m,
      onClick: () => onToggle(m),
      className: "ri-tag",
      style: {
        font: '600 13px "JetBrains Mono", monospace',
        textTransform: 'uppercase',
        letterSpacing: '.12em',
        padding: '12px 20px',
        border: `1.5px solid ${active ? accent : '#141210'}`,
        background: active ? accent : 'transparent',
        color: active ? '#F5EFE4' : '#141210',
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        boxShadow: active ? `0 4px 16px -4px ${accent}55` : 'none',
        animation: `ri-fadeUp .4s ${i * 0.05}s cubic-bezier(.2,.8,.2,1) both`
      }
    }, m);
  })), selected.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: onNext,
    className: "ri-btn-primary",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '16px 28px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999,
      animation: 'ri-fadeUp .4s cubic-bezier(.2,.8,.2,1) both'
    }
  }, "Next \u2192"));
};
const GenreStep = ({
  selected,
  onToggle,
  onNext,
  accent
}) => {
  const genres = (window.GENRES || ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature']).filter(g => g !== 'All');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 8
    }
  }, "Step 3 of 5"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 72px "DM Serif Display", Georgia, serif',
      margin: '0 0 12px',
      letterSpacing: '-.02em',
      lineHeight: .9
    }
  }, "Which sections interest you?"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px "Space Grotesk", sans-serif',
      opacity: .7,
      margin: '0 0 32px'
    }
  }, "Select one or more genres."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 36
    }
  }, genres.map((g, i) => /*#__PURE__*/React.createElement(GenreTag, {
    key: g,
    onClick: () => onToggle(g),
    active: selected.includes(g),
    accent: accent
  }, g))), selected.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: onNext,
    className: "ri-btn-primary",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '16px 28px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999,
      animation: 'ri-fadeUp .4s cubic-bezier(.2,.8,.2,1) both'
    }
  }, "Next \u2192"));
};
const PaceStep = ({
  selected,
  onSelect,
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    maxWidth: 800,
    margin: '0 auto'
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  color: accent,
  style: {
    marginBottom: 8
  }
}, "Step 4 of 5"), /*#__PURE__*/React.createElement("h2", {
  style: {
    font: '900 72px "DM Serif Display", Georgia, serif',
    margin: '0 0 36px',
    letterSpacing: '-.02em',
    lineHeight: .9
  }
}, "How much time do you have?"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20
  }
}, PACE_OPTIONS.map((p, i) => {
  const active = selected === p.id;
  return /*#__PURE__*/React.createElement("div", {
    key: p.id,
    onClick: () => onSelect(p.id),
    className: "ri-card",
    style: {
      padding: 28,
      border: `1.5px solid ${active ? accent : '#141210'}`,
      background: active ? '#141210' : 'transparent',
      color: active ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      transition: 'all .25s ease',
      position: 'relative',
      overflow: 'hidden',
      animation: `ri-fadeUp .5s ${i * 0.1}s cubic-bezier(.2,.8,.2,1) both`
    }
  }, active && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      background: accent
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 56px "DM Serif Display", Georgia, serif',
      lineHeight: .9,
      letterSpacing: '-.02em',
      marginBottom: 12,
      transition: 'transform .3s ease',
      transform: active ? 'scale(1.05)' : 'scale(1)'
    }
  }, p.num), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 18px "DM Serif Display", Georgia, serif',
      marginBottom: 6
    }
  }, p.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px/1.4 "Space Grotesk", sans-serif',
      opacity: .75
    }
  }, p.desc));
})));
const FreeTextStep = ({
  value,
  onChange,
  onSubmit,
  onSkip,
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    maxWidth: 700,
    margin: '0 auto'
  }
}, /*#__PURE__*/React.createElement(Eyebrow, {
  color: accent,
  style: {
    marginBottom: 8
  }
}, "Step 5 of 5 \u2014 Optional"), /*#__PURE__*/React.createElement("h2", {
  style: {
    font: '900 72px "DM Serif Display", Georgia, serif',
    margin: '0 0 12px',
    letterSpacing: '-.02em',
    lineHeight: .9
  }
}, "Anything else?"), /*#__PURE__*/React.createElement("p", {
  style: {
    font: '400 16px "Space Grotesk", sans-serif',
    opacity: .7,
    margin: '0 0 28px'
  }
}, "Favorite authors, themes you love, books you've read recently \u2014 anything that helps us narrow the shelf."), /*#__PURE__*/React.createElement("textarea", {
  value: value,
  onChange: e => onChange(e.target.value),
  placeholder: "Tell us more about what you're looking for...",
  rows: 5,
  maxLength: 500,
  style: {
    display: 'block',
    width: '100%',
    padding: 16,
    border: '1.5px solid #141210',
    background: 'transparent',
    font: '400 16px/1.5 "Space Grotesk", sans-serif',
    color: '#141210',
    outline: 'none',
    resize: 'vertical',
    borderRadius: 0,
    transition: 'border-color .2s ease, box-shadow .2s ease'
  },
  onFocus: e => {
    e.target.style.borderColor = accent;
    e.target.style.boxShadow = `0 0 0 3px ${accent}22`;
  },
  onBlur: e => {
    e.target.style.borderColor = '#141210';
    e.target.style.boxShadow = 'none';
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    font: '400 11px "JetBrains Mono", monospace',
    opacity: .5,
    marginTop: 6,
    textAlign: 'right'
  }
}, value.length, "/500"), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    gap: 12,
    marginTop: 24
  }
}, /*#__PURE__*/React.createElement("button", {
  onClick: onSubmit,
  className: "ri-btn-primary",
  style: {
    font: '700 14px "JetBrains Mono", monospace',
    textTransform: 'uppercase',
    letterSpacing: '.14em',
    padding: '18px 32px',
    background: accent,
    color: '#F5EFE4',
    border: 0,
    cursor: 'pointer',
    borderRadius: 999
  }
}, "Get My Recommendations"), /*#__PURE__*/React.createElement("button", {
  onClick: onSkip,
  className: "ri-btn-ghost",
  style: {
    font: '700 13px "JetBrains Mono", monospace',
    textTransform: 'uppercase',
    letterSpacing: '.14em',
    padding: '16px 24px',
    background: 'transparent',
    color: '#141210',
    border: '1.5px solid #141210',
    cursor: 'pointer',
    borderRadius: 999
  }
}, "Skip")));
const LoadingState = ({
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    textAlign: 'center',
    padding: '80px 0'
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'inline-block',
    marginBottom: 32
  }
}, /*#__PURE__*/React.createElement(Seal, {
  color: accent,
  rotate: 0,
  size: 120
}, "Reading \xB7 Your \xB7 Shelf")), /*#__PURE__*/React.createElement("h2", {
  style: {
    font: '700 36px "DM Serif Display", Georgia, serif',
    margin: '0 0 12px'
  }
}, "Our editors are thinking..."), /*#__PURE__*/React.createElement("p", {
  style: {
    font: '400 16px "Space Grotesk", sans-serif',
    opacity: .6
  }
}, "Matching your taste against the full catalog. This takes a few seconds."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    justifyContent: 'center',
    gap: 20,
    marginTop: 40
  }
}, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
  key: i,
  style: {
    width: 120,
    height: 170,
    borderRadius: 2,
    background: `linear-gradient(90deg, #14121008, #14121018, #14121008)`,
    backgroundSize: '200% 100%',
    animation: `ri-shimmer 1.5s ${i * 0.2}s ease-in-out infinite`
  }
}))));
const RecommendationCard = ({
  rec,
  index,
  setRoute,
  accent
}) => {
  const book = {
    ...rec,
    cover: rec.cover || rec.coverDesign || {
      style: 'block',
      bg: '#141210',
      fg: '#F5EFE4',
      motif: 'bars'
    }
  };
  const confidence = Math.round((rec.confidenceScore || 0.5) * 100);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '180px 1fr',
      gap: 28,
      padding: '28px 0',
      borderBottom: '1px solid rgba(20,18,16,0.15)',
      animation: `ri-fadeUp .6s ${index * 0.12}s cubic-bezier(.2,.8,.2,1) both`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      cursor: 'pointer'
    },
    onClick: () => setRoute(riReviewRouteFromBook({
      bookId: rec.bookId,
      title: rec.title
    }))
  }, /*#__PURE__*/React.createElement(Cover, {
    book: book,
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, rec.genre, " \xB7 ", rec.pages, " pages \xB7 ", rec.readTime), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 12px "JetBrains Mono", monospace',
      color: accent,
      background: `${accent}12`,
      padding: '4px 10px',
      borderRadius: 999,
      letterSpacing: '.08em'
    }
  }, confidence, "% Match")), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: '700 28px/1.08 "DM Serif Display", Georgia, serif',
      margin: '0 0 4px',
      letterSpacing: '-.01em',
      cursor: 'pointer'
    },
    onClick: () => setRoute(riReviewRouteFromBook({
      bookId: rec.bookId,
      title: rec.title
    }))
  }, rec.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .7,
      marginBottom: 12
    }
  }, rec.author), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    value: rec.rating || 0,
    size: 13
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px/1.55 "Space Grotesk", sans-serif',
      margin: '0 0 12px',
      color: '#141210'
    }
  }, rec.matchExplanation), rec.ageNotes && /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 13px/1.4 "Space Grotesk", sans-serif',
      opacity: .65,
      margin: '0 0 12px',
      fontStyle: 'italic'
    }
  }, rec.ageNotes), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 14
    }
  }, (rec.matchTags || []).map(tag => /*#__PURE__*/React.createElement("span", {
    key: tag,
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      padding: '4px 10px',
      border: '1px solid #14121030',
      borderRadius: 999,
      color: '#141210',
      opacity: .6
    }
  }, tag))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute(riReviewRouteFromBook({
      bookId: rec.bookId,
      title: rec.title
    })),
    className: "ri-btn-ghost",
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '10px 16px',
      border: '1.5px solid #141210',
      background: 'transparent',
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Read Review \u2192")));
};
const ExternalBookCard = ({
  book,
  index,
  accent
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    padding: 20,
    border: '1.5px solid #14121020',
    borderRadius: 4,
    position: 'relative',
    animation: `ri-fadeUp .5s ${index * 0.1}s cubic-bezier(.2,.8,.2,1) both`
  },
  className: "ri-card"
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'absolute',
    top: 10,
    right: 10,
    font: '600 8px "JetBrains Mono", monospace',
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    padding: '3px 8px',
    background: '#14121010',
    borderRadius: 999,
    color: '#141210',
    opacity: .5
  }
}, "External"), book.coverImageUrl ? /*#__PURE__*/React.createElement("img", {
  src: book.coverImageUrl,
  alt: book.title,
  loading: "lazy",
  decoding: "async",
  style: {
    width: '100%',
    height: 200,
    objectFit: 'contain',
    borderRadius: 2,
    marginBottom: 14,
    background: '#14121008'
  }
}) : /*#__PURE__*/React.createElement("div", {
  style: {
    width: '100%',
    height: 200,
    background: '#141210',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    font: '700 14px/1.1 "DM Serif Display", Georgia, serif',
    color: '#F5EFE4',
    textAlign: 'center',
    padding: 16
  }
}, book.title)), book.genre && /*#__PURE__*/React.createElement(Eyebrow, {
  color: accent,
  style: {
    marginBottom: 6
  }
}, book.genre, book.year ? ` · ${book.year}` : ''), /*#__PURE__*/React.createElement("h4", {
  style: {
    font: '700 18px/1.15 "DM Serif Display", Georgia, serif',
    margin: '0 0 4px'
  }
}, book.title), /*#__PURE__*/React.createElement("div", {
  style: {
    font: '600 11px "JetBrains Mono", monospace',
    textTransform: 'uppercase',
    letterSpacing: '.12em',
    opacity: .65,
    marginBottom: 8
  }
}, book.author), book.rating && /*#__PURE__*/React.createElement("div", {
  style: {
    marginBottom: 10
  }
}, /*#__PURE__*/React.createElement(Stars, {
  value: book.rating,
  size: 11
})), book.description && /*#__PURE__*/React.createElement("p", {
  style: {
    font: '400 13px/1.45 "Space Grotesk", sans-serif',
    margin: '0 0 14px',
    opacity: .8,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  }
}, book.description), /*#__PURE__*/React.createElement("a", {
  href: amazonAffiliateUrl(book),
  target: "_blank",
  rel: "noopener noreferrer",
  style: {
    display: 'inline-block',
    font: '700 10px "JetBrains Mono", monospace',
    textTransform: 'uppercase',
    letterSpacing: '.14em',
    padding: '8px 14px',
    border: `1.5px solid ${accent}`,
    color: accent,
    borderRadius: 999,
    textDecoration: 'none',
    transition: 'all .2s ease'
  },
  className: "ri-btn-ghost"
}, "Buy on Amazon \u2192"));
const ResultsDisplay = ({
  data,
  onRestart,
  setRoute,
  accent
}) => {
  const {
    prescription,
    recommendations,
    externalPicks,
    meta
  } = data;
  const [heroRef, heroVis] = useReveal();
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    ref: heroRef,
    style: {
      background: '#141210',
      color: '#F5EFE4',
      padding: '56px 40px',
      margin: '0 -32px 40px',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '-50%',
      right: '-20%',
      width: '60%',
      height: '200%',
      background: `radial-gradient(ellipse, ${accent}12, transparent 70%)`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 800,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: heroVis ? 1 : 0,
      transform: heroVis ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "Your Reading Prescription \u2014 ", recommendations.length, " Books Selected")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '500 32px/1.25 "DM Serif Display", Georgia, serif',
      fontStyle: 'italic',
      margin: '14px 0 0',
      textWrap: 'balance',
      opacity: heroVis ? 1 : 0,
      transform: heroVis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .7s .1s cubic-bezier(.2,.8,.2,1)'
    }
  }, prescription.intro), prescription.ageNote && /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 14px "Space Grotesk", sans-serif',
      opacity: .65,
      marginTop: 16,
      opacity: heroVis ? .65 : 0,
      transition: 'opacity .6s .3s ease'
    }
  }, prescription.ageNote))), prescription.readingOrder && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800,
      margin: '0 auto 36px',
      padding: '24px 28px',
      border: `2px solid ${accent}`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -12,
      left: 24,
      background: '#F5EFE4',
      padding: '0 10px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "Suggested Reading Order")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px/1.55 "Space Grotesk", sans-serif',
      margin: '8px 0 0'
    }
  }, prescription.readingOrder)), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800,
      margin: '0 auto'
    }
  }, recommendations.map((rec, i) => /*#__PURE__*/React.createElement(RecommendationCard, {
    key: rec.bookId || i,
    rec: rec,
    index: i,
    setRoute: setRoute,
    accent: accent
  }))), externalPicks && externalPicks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 800,
      margin: '48px auto 0'
    }
  }, /*#__PURE__*/React.createElement(Rule, {
    style: {
      marginBottom: 28
    }
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 8
    }
  }, "Popular Right Now \xB7 From the wider world of books"), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: '700 36px "DM Serif Display", Georgia, serif',
      margin: '0 0 24px',
      letterSpacing: '-.01em'
    }
  }, "You might also enjoy"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 20
    }
  }, externalPicks.slice(0, 8).map((book, i) => /*#__PURE__*/React.createElement(ExternalBookCard, {
    key: `${book.title}-${i}`,
    book: book,
    index: i,
    accent: accent
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 16,
      marginTop: 48
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onRestart,
    className: "ri-btn-primary",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '16px 28px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Try Again"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'browse'
    }),
    className: "ri-btn-ghost",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '16px 28px',
      background: 'transparent',
      color: '#141210',
      border: '1.5px solid #141210',
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Browse All Books")), meta && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 24,
      font: '400 11px "JetBrains Mono", monospace',
      opacity: .35,
      textTransform: 'uppercase',
      letterSpacing: '.14em'
    }
  }, "Scored ", meta.candidateCount, " books \xB7 ", meta.algorithm || 'score-v2', meta.modelUsed && meta.modelUsed !== 'algorithmic' ? ` · ${meta.modelUsed}` : ''));
};

// ── Client-side fallback ──

function getLocalRecommendations(profile) {
  const books = window.BOOKS || [];
  let filtered = books.filter(b => {
    if (profile.genres.length && !profile.genres.includes(b.genre)) return false;
    if (profile.paceRange === 'quick' && b.pages >= 250) return false;
    if (profile.paceRange === 'deep' && b.pages < 300) return false;
    return true;
  });
  if (filtered.length < 3) filtered = books;
  return {
    prescription: {
      intro: 'Based on your preferences, here are our top picks from the Reviewer Insight catalog.',
      readingOrder: null,
      ageNote: 'Selected based on rating and genre match.'
    },
    recommendations: filtered.sort((a, b) => b.rating - a.rating).slice(0, 4).map(b => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      genre: b.genre,
      rating: b.rating,
      pages: b.pages,
      readTime: b.readTime,
      cover: b.cover,
      coverDesign: b.cover,
      blurb: b.blurb,
      matchExplanation: `Rated ${b.rating}/5 in ${b.genre} — a strong match for your interests.`,
      ageNotes: '',
      confidenceScore: 0.7,
      matchTags: [b.genre.toLowerCase(), 'top-rated']
    })),
    meta: {
      candidateCount: books.length,
      tokensUsed: 0,
      modelUsed: 'local-fallback'
    }
  };
}

// ── Main Component ──

const Recommend = ({
  setRoute,
  accent,
  density
}) => {
  const pad = density === 'compact' ? 20 : 32;
  const [step, setStep] = React.useState(0);
  const [stepKey, setStepKey] = React.useState(0);
  const [profile, setProfile] = React.useState({
    ageRange: null,
    moods: [],
    genres: [],
    paceRange: null,
    freeText: ''
  });
  const [results, setResults] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const advance = React.useCallback(() => {
    setStepKey(k => k + 1);
    setStep(s => s + 1);
  }, []);
  const updateProfile = React.useCallback((key, value) => {
    setProfile(p => ({
      ...p,
      [key]: value
    }));
  }, []);
  const toggleArray = React.useCallback((key, value, max) => {
    setProfile(p => {
      const arr = p[key];
      if (arr.includes(value)) return {
        ...p,
        [key]: arr.filter(v => v !== value)
      };
      if (max && arr.length >= max) return p;
      return {
        ...p,
        [key]: [...arr, value]
      };
    });
  }, []);
  const handleSubmit = React.useCallback(async () => {
    setLoading(true);
    advance();
    try {
      const data = await ApiClient.getRecommendations(profile);
      setResults(data);
    } catch (err) {
      setResults(getLocalRecommendations(profile));
    } finally {
      setLoading(false);
    }
  }, [profile, advance]);
  const restart = React.useCallback(() => {
    setStep(0);
    setStepKey(k => k + 1);
    setProfile({
      ageRange: null,
      moods: [],
      genres: [],
      paceRange: null,
      freeText: ''
    });
    setResults(null);
    window.scrollTo(0, 0);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "ri-page-enter",
    style: {
      background: '#F5EFE4',
      minHeight: '100vh'
    }
  }, step > 0 && step < 6 && /*#__PURE__*/React.createElement(ProgressBar, {
    step: step,
    total: 5,
    accent: accent
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `48px ${pad}px 96px`
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: stepKey,
    style: {
      animation: 'ri-fadeUp .5s cubic-bezier(.2,.8,.2,1) both'
    }
  }, step === 0 && /*#__PURE__*/React.createElement(WelcomeStep, {
    onBegin: advance,
    accent: accent
  }), step === 1 && /*#__PURE__*/React.createElement(AgeStep, {
    selected: profile.ageRange,
    onSelect: v => {
      updateProfile('ageRange', v);
      setTimeout(advance, 400);
    },
    accent: accent
  }), step === 2 && /*#__PURE__*/React.createElement(MoodStep, {
    ageRange: profile.ageRange,
    selected: profile.moods,
    onToggle: v => toggleArray('moods', v, 3),
    onNext: advance,
    accent: accent
  }), step === 3 && /*#__PURE__*/React.createElement(GenreStep, {
    selected: profile.genres,
    onToggle: v => toggleArray('genres', v),
    onNext: advance,
    accent: accent
  }), step === 4 && /*#__PURE__*/React.createElement(PaceStep, {
    selected: profile.paceRange,
    onSelect: v => {
      updateProfile('paceRange', v);
      setTimeout(advance, 400);
    },
    accent: accent
  }), step === 5 && /*#__PURE__*/React.createElement(FreeTextStep, {
    value: profile.freeText,
    onChange: v => updateProfile('freeText', v),
    onSubmit: handleSubmit,
    onSkip: handleSubmit,
    accent: accent
  }), step === 6 && (loading ? /*#__PURE__*/React.createElement(LoadingState, {
    accent: accent
  }) : results ? /*#__PURE__*/React.createElement(ResultsDisplay, {
    data: results,
    onRestart: restart,
    setRoute: setRoute,
    accent: accent
  }) : null))), /*#__PURE__*/React.createElement(Footer, {
    accent: accent,
    pad: pad
  }));
};
window.Recommend = Recommend;