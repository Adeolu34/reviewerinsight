// Home page — bold magazine layout with scroll-triggered animations
const Home = ({
  setRoute,
  accent,
  density
}) => {
  const BOOKS = window.BOOKS;
  const pad = density === 'compact' ? 20 : 32;

  // API data with static fallbacks
  const {
    resolved: stats
  } = useApi(() => ApiClient.getStats(), {
    totalBooks: BOOKS.length,
    totalSummaries: BOOKS.length,
    totalIssues: 48,
    latestIssue: 'No. 048'
  });
  const {
    resolved: featuredData
  } = useApi(() => ApiClient.getFeatured(), {
    featured: BOOKS.find(b => b.id === 1),
    also: BOOKS.filter(b => b.featured && b.id !== 1).slice(0, 3)
  });
  const {
    resolved: latestData
  } = useApi(() => ApiClient.getBooks({
    limit: 12
  }), {
    books: BOOKS.slice(0, 12),
    total: BOOKS.length
  });
  const {
    resolved: trendingData
  } = useApi(() => ApiClient.getTrending(), {
    trending: []
  });
  const featured = featuredData.featured;
  const featuredSide = featuredData.also;
  const latest = latestData.books;
  const totalBooks = latestData.total || stats.totalBooks;

  // Scroll reveal refs
  const trending = trendingData.trending || [];
  const [calloutRef, calloutVis] = useReveal();
  const [featRef, featVis] = useReveal();
  const [trendRef, trendVis] = useReveal();
  const [quoteRef, quoteVis] = useReveal();
  const [catRef, catVis] = useReveal();
  const [editRef, editVis] = useReveal();
  const [ctaRef, ctaVis] = useReveal();
  const [trendingModal, setTrendingModal] = React.useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "ri-page-enter",
    style: {
      background: '#F5EFE4'
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      padding: `48px ${pad}px 36px`,
      borderBottom: '1.5px solid #141210',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      gap: 12,
      alignItems: 'baseline',
      marginBottom: 24,
      animation: 'ri-fadeIn .6s ease both'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "The Issue \xB7 No. 048"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: '#141210',
      opacity: .7
    }
  }, "\u2014\u2014  Week of April 13 \u2014 April 19, 2026  \u2014\u2014"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: '#141210',
      opacity: .7,
      textAlign: 'right'
    }
  }, stats.totalBooks.toLocaleString(), " reviews \xB7 ", stats.totalSummaries.toLocaleString(), " summaries \xB7 ", stats.totalIssues, " issues")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.15fr 1fr',
      gap: 48,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 18,
      animation: 'ri-fadeUp .5s .1s ease both'
    }
  }, "Review of the Week \xB7 ", featured.genre || 'Literary Fiction'), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '900 96px "DM Serif Display", Georgia, serif',
      lineHeight: .92,
      letterSpacing: '-.02em',
      color: '#141210',
      margin: '0 0 18px',
      textWrap: 'balance',
      animation: 'ri-hero-text .8s .2s cubic-bezier(.2,.8,.2,1) both'
    }
  }, "The novel the year ", /*#__PURE__*/React.createElement("em", {
    style: {
      color: accent,
      fontStyle: 'italic',
      position: 'relative',
      display: 'inline'
    }
  }, "didn't know"), " it was waiting for."), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 19px/1.55 "Space Grotesk", sans-serif',
      color: '#141210',
      maxWidth: 640,
      margin: '0 0 24px',
      animation: 'ri-fadeUp .6s .4s ease both'
    }
  }, featured.blurb || `${featured.author}'s ${featured.title} is a slow, exact accounting of ordinary mercy — the kind of book that rearranges the furniture in the reader's head and leaves the lamp on.`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      marginBottom: 28,
      animation: 'ri-fadeUp .6s .5s ease both'
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    value: featured.rating
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em'
    }
  }, "By ", featured.editor || 'Mira Okafor', " \xB7 ", featured.readTime || '14 min', " read \xB7 + 4 min summary")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      animation: 'ri-fadeUp .6s .6s ease both'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute(riReviewRouteFromBook(featured)),
    className: "ri-btn-primary",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '14px 22px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Read the review \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute(riReviewRouteFromBook(featured, {
      tab: 'summary'
    })),
    className: "ri-btn-ghost",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '14px 22px',
      background: 'transparent',
      color: '#141210',
      border: '1.5px solid #141210',
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Jump to 4-min summary"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 540
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 20,
      animation: 'ri-float 5s ease-in-out infinite',
      '--rot': '-5deg'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: latest[Math.min(9, latest.length - 1)] || BOOKS[9],
    size: "sm",
    rotate: -5
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      animation: 'ri-float 6s 1s ease-in-out infinite',
      '--rot': '7deg'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: latest[Math.min(2, latest.length - 1)] || BOOKS[2],
    size: "sm",
    rotate: 7
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      animation: 'ri-scaleIn .8s .3s cubic-bezier(.2,.8,.2,1) both'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: featured,
    size: "xl"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 10,
      right: 40
    }
  }, /*#__PURE__*/React.createElement(Seal, {
    color: accent,
    rotate: -10
  }, "Editor's \xB7 Pick \xB7 No. 048"))))), /*#__PURE__*/React.createElement(Marquee, {
    accent: accent,
    items: ["New this week: 7 reviews", "Now reading: Parallax City", "Summary of the day: Ledger of Small Weathers", "Members: save 2,413 hrs of reading this year", "Editor's note: 'Read small, read slow'", "Audio summaries now in 12 languages"]
  }), /*#__PURE__*/React.createElement("section", {
    ref: calloutRef,
    style: {
      padding: `56px ${pad}px`,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 40
    }
  }, [{
    num: '01',
    color: accent,
    title: 'Reviews that argue.',
    desc: `Every review states a position, earns it, and is willing to be wrong. ${stats.totalBooks.toLocaleString()} arguments, so far, on the page.`
  }, {
    num: '02',
    color: '#1E3A8A',
    title: 'Summaries you can trust.',
    desc: "Written by the same editor who wrote the review. Four minutes. The skeleton plus the why-it-matters."
  }, {
    num: '03',
    color: '#E4A72B',
    title: 'A good read, in general.',
    desc: "We read 260 books a year so you don't have to read the wrong one. Three new pieces every Tuesday."
  }].map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      opacity: calloutVis ? 1 : 0,
      transform: calloutVis ? 'translateY(0)' : 'translateY(32px)',
      transition: `all .7s ${i * .15}s cubic-bezier(.2,.8,.2,1)`,
      padding: '32px 0',
      borderTop: `3px solid ${item.color}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 100px "DM Serif Display", Georgia, serif',
      color: item.color,
      lineHeight: .8,
      letterSpacing: '-.03em',
      opacity: calloutVis ? 1 : 0,
      transform: calloutVis ? 'scale(1) translateY(0)' : 'scale(0.6) translateY(20px)',
      transition: `all .6s ${i * .15 + .1}s cubic-bezier(.2,.8,.2,1)`
    }
  }, item.num), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: '700 26px "DM Serif Display", Georgia, serif',
      margin: '14px 0 8px'
    }
  }, item.title), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 15px/1.55 "Space Grotesk", sans-serif',
      color: '#141210',
      opacity: .82,
      maxWidth: 340
    }
  }, item.desc))))), /*#__PURE__*/React.createElement("section", {
    ref: featRef,
    style: {
      padding: `56px ${pad}px`,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 28,
      opacity: featVis ? 1 : 0,
      transform: featVis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 54px "DM Serif Display", Georgia, serif',
      margin: 0,
      letterSpacing: '-.015em'
    }
  }, "Also this week."), /*#__PURE__*/React.createElement(Eyebrow, null, "Three more from our editors")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 36
    }
  }, featuredSide.map((b, i) => /*#__PURE__*/React.createElement("article", {
    key: b.id,
    onClick: () => setRoute(riReviewRouteFromBook(b)),
    style: {
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      opacity: featVis ? 1 : 0,
      transform: featVis ? 'translateY(0)' : 'translateY(40px)',
      transition: `all .7s ${i * .12 + .15}s cubic-bezier(.2,.8,.2,1)`
    },
    className: "ri-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '18px 0 24px',
      borderBottom: `1px solid #141210`,
      marginBottom: 4,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: b,
    size: "md"
  })), /*#__PURE__*/React.createElement(Eyebrow, {
    color: [accent, '#1E3A8A', '#E4A72B'][i],
    style: {
      marginTop: 18
    }
  }, b.genre, " \xB7 ", b.issue || 'No. 048'), /*#__PURE__*/React.createElement("h3", {
    style: {
      font: '700 28px/1.08 "DM Serif Display", Georgia, serif',
      margin: '10px 0 8px',
      letterSpacing: '-.01em',
      textWrap: 'balance'
    }
  }, b.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .7,
      marginBottom: 10
    }
  }, b.author), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 15px/1.5 "Space Grotesk", sans-serif',
      margin: '0 0 12px'
    }
  }, b.blurb), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    value: b.rating
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: accent,
      transition: 'transform .2s ease'
    }
  }, "Read \u2192")))))), trending.length > 0 && /*#__PURE__*/React.createElement("section", {
    ref: trendRef,
    style: {
      padding: `56px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      background: '#FDFAF5'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 28,
      opacity: trendVis ? 1 : 0,
      transform: trendVis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "Trending Now \xB7 From the wider world of books"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 54px "DM Serif Display", Georgia, serif',
      margin: '6px 0 0',
      letterSpacing: '-.015em'
    }
  }, "What the world is reading.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'recommend'
    }),
    className: "ri-btn-ghost",
    style: {
      font: '700 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '12px 18px',
      background: 'transparent',
      color: '#141210',
      border: '1.5px solid #141210',
      cursor: 'pointer',
      borderRadius: 999,
      alignSelf: 'flex-end'
    }
  }, "Get Personalized Picks \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 28,
      rowGap: 36
    }
  }, trending.slice(0, 8).map((b, idx) => /*#__PURE__*/React.createElement("div", {
    key: `${b.title}-${idx}`,
    onClick: () => setTrendingModal(b),
    style: {
      color: '#141210',
      cursor: 'pointer',
      opacity: trendVis ? 1 : 0,
      transform: trendVis ? 'translateY(0)' : 'translateY(28px)',
      transition: `all .5s ${Math.min(idx * .06, .5)}s cubic-bezier(.2,.8,.2,1)`
    },
    className: "ri-card"
  }, b.coverImageUrl ? /*#__PURE__*/React.createElement("img", {
    src: b.coverImageUrl,
    alt: b.title,
    loading: "lazy",
    decoding: "async",
    style: {
      width: '100%',
      height: 220,
      objectFit: 'contain',
      borderRadius: 2,
      background: '#14121008'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 220,
      background: '#141210',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 14px/1.15 "DM Serif Display", Georgia, serif',
      color: '#F5EFE4',
      textAlign: 'center',
      padding: 16
    }
  }, b.title)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: accent,
      marginBottom: 4
    }
  }, b.genre || 'Books', b.year ? ` · ${b.year}` : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px/1.15 "DM Serif Display", Georgia, serif',
      textWrap: 'balance'
    }
  }, b.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px "Space Grotesk", sans-serif',
      opacity: .7,
      marginTop: 2
    }
  }, b.author), b.rating && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    value: b.rating,
    size: 11
  }))))))), /*#__PURE__*/React.createElement("section", {
    ref: quoteRef,
    style: {
      background: '#141210',
      color: '#F5EFE4',
      padding: `96px ${pad}px`,
      borderBottom: '1.5px solid #141210',
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
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 48,
      alignItems: 'start',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 340px "DM Serif Display", Georgia, serif',
      color: accent,
      lineHeight: .7,
      letterSpacing: '-.04em',
      opacity: quoteVis ? 1 : 0,
      transform: quoteVis ? 'scale(1)' : 'scale(0.7)',
      transition: 'all .8s cubic-bezier(.2,.8,.2,1)',
      textShadow: `0 0 80px ${accent}33`
    }
  }, "\""), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("blockquote", {
    style: {
      font: '500 48px/1.15 "DM Serif Display", Georgia, serif',
      margin: '0 0 28px',
      textWrap: 'balance',
      letterSpacing: '-.01em',
      opacity: quoteVis ? 1 : 0,
      transform: quoteVis ? 'translateX(0)' : 'translateX(40px)',
      transition: 'all .8s .15s cubic-bezier(.2,.8,.2,1)'
    }
  }, "I've cancelled three subscriptions to make room for this one. Reviewer Insight writes about books the way old friends argue \u2014 carefully, with a lot at stake, and without ever showing off."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'center',
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: quoteVis ? .8 : 0,
      transition: 'opacity .6s .4s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: accent,
      color: '#141210',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 14px "JetBrains Mono", monospace',
      boxShadow: `0 0 20px ${accent}44`
    }
  }, "AK"), "Ava K., member since 2022 \xB7 Brooklyn, NY")))), /*#__PURE__*/React.createElement("section", {
    ref: catRef,
    style: {
      padding: `56px ${pad}px`,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 28,
      opacity: catVis ? 1 : 0,
      transform: catVis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "The full load \xB7 Every review, in order"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 72px "DM Serif Display", Georgia, serif',
      margin: '6px 0 0',
      letterSpacing: '-.02em'
    }
  }, totalBooks, " books. One shelf.")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'browse'
    }),
    className: "ri-btn-ghost",
    style: {
      font: '700 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '12px 18px',
      background: 'transparent',
      color: '#141210',
      border: '1.5px solid #141210',
      cursor: 'pointer',
      borderRadius: 999,
      alignSelf: 'flex-end'
    }
  }, "See all ", totalBooks, " \u2192")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 28,
      rowGap: 40
    }
  }, latest.map((b, idx) => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => setRoute(riReviewRouteFromBook(b)),
    style: {
      cursor: 'pointer',
      opacity: catVis ? 1 : 0,
      transform: catVis ? 'translateY(0)' : 'translateY(28px)',
      transition: `all .5s ${Math.min(idx * .06, .6)}s cubic-bezier(.2,.8,.2,1)`
    },
    className: "ri-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: b,
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: accent,
      marginBottom: 4
    }
  }, b.genre), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px/1.15 "DM Serif Display", Georgia, serif',
      textWrap: 'balance'
    }
  }, b.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px "Space Grotesk", sans-serif',
      opacity: .7,
      marginTop: 2
    }
  }, b.author), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(Stars, {
    value: b.rating,
    size: 11
  }))))))), /*#__PURE__*/React.createElement("section", {
    ref: editRef,
    style: {
      padding: `56px ${pad}px`,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: 48
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: editVis ? 1 : 0,
      transform: editVis ? 'translateX(0)' : 'translateX(-32px)',
      transition: 'all .7s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, "The Editors"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 64px "DM Serif Display", Georgia, serif',
      margin: '6px 0 16px',
      letterSpacing: '-.02em',
      lineHeight: .95
    }
  }, "Four people. ", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", {
    style: {
      color: accent
    }
  }, "One standard.")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 16px/1.55 "Space Grotesk", sans-serif',
      maxWidth: 380
    }
  }, "Every piece on Reviewer Insight is written by a named editor. No syndication, no aggregated scores, no AI pastiche. If you disagree with a review, you'll know exactly who to argue with.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 28
    }
  }, window.EDITORS.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: e.name,
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
      padding: 20,
      border: '1.5px solid #141210',
      borderRadius: 4,
      opacity: editVis ? 1 : 0,
      transform: editVis ? 'translateY(0)' : 'translateY(24px)',
      transition: `all .6s ${i * .1 + .2}s cubic-bezier(.2,.8,.2,1)`,
      cursor: 'pointer'
    },
    className: "ri-card",
    onClick: () => setRoute({
      name: 'editors'
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      background: e.bg,
      color: '#F5EFE4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: '700 20px "JetBrains Mono", monospace',
      transition: 'transform .3s ease'
    }
  }, e.initials), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 20px "DM Serif Display", Georgia, serif'
    }
  }, e.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .7,
      margin: '2px 0 8px'
    }
  }, e.role), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px/1.4 "Space Grotesk", sans-serif'
    }
  }, e.beat))))))), /*#__PURE__*/React.createElement("section", {
    ref: ctaRef,
    style: {
      padding: `72px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      background: accent,
      color: '#141210',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -100,
      right: -100,
      width: 400,
      height: 400,
      borderRadius: '50%',
      border: '1.5px solid #14121015',
      pointerEvents: 'none',
      opacity: ctaVis ? .5 : 0,
      transition: 'opacity 1s ease'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -150,
      left: -80,
      width: 500,
      height: 500,
      borderRadius: '50%',
      border: '1.5px solid #14121010',
      pointerEvents: 'none',
      opacity: ctaVis ? .4 : 0,
      transition: 'opacity 1.2s ease'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 64,
      alignItems: 'center',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: ctaVis ? 1 : 0,
      transform: ctaVis ? 'translateY(0)' : 'translateY(32px)',
      transition: 'all .7s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: "#141210"
  }, "Membership \xB7 $9/mo or $84/yr"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 96px "DM Serif Display", Georgia, serif',
      margin: '12px 0 18px',
      letterSpacing: '-.025em',
      lineHeight: .9
    }
  }, "Read the argument, ", /*#__PURE__*/React.createElement("em", {
    style: {
      fontStyle: 'italic'
    }
  }, "then the book.")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 18px/1.5 "Space Grotesk", sans-serif',
      maxWidth: 520,
      margin: '0 0 28px'
    }
  }, "Full access to every review and summary. Three new pieces every Tuesday. Searchable archive back to Issue No. 001. Cancel anytime; keep reading for the rest of the period because we're not monsters."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "ri-btn-primary",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '16px 24px',
      background: '#141210',
      color: '#F5EFE4',
      border: 0,
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Start 14-day trial"), /*#__PURE__*/React.createElement("button", {
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
  }, "Gift a year"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16
    }
  }, [{
    k: stats.totalBooks.toLocaleString(),
    v: 'Reviews on file'
  }, {
    k: stats.totalSummaries.toLocaleString(),
    v: 'Four-minute summaries'
  }, {
    k: String(stats.totalIssues),
    v: 'Back issues archived'
  }, {
    k: '∞',
    v: 'Nights of good reading'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.v,
    style: {
      padding: 24,
      border: '1.5px solid #141210',
      background: '#F5EFE4',
      opacity: ctaVis ? 1 : 0,
      transform: ctaVis ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
      transition: `all .6s ${i * .1 + .2}s cubic-bezier(.2,.8,.2,1)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 72px "DM Serif Display", Georgia, serif',
      lineHeight: .9,
      letterSpacing: '-.02em'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      marginTop: 8,
      opacity: .75
    }
  }, s.v)))))), /*#__PURE__*/React.createElement(Footer, {
    accent: accent,
    pad: pad
  })), trendingModal && /*#__PURE__*/React.createElement("div", {
    onClick: () => setTrendingModal(null),
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(20,18,16,0.72)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      animation: 'ri-fadeIn .2s ease both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: '#F5EFE4',
      maxWidth: 560,
      width: '100%',
      padding: 40,
      position: 'relative',
      animation: 'ri-fadeUp .3s cubic-bezier(.2,.8,.2,1) both',
      maxHeight: '90vh',
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTrendingModal(null),
    style: {
      position: 'absolute',
      top: 16,
      right: 16,
      background: 'transparent',
      border: 0,
      cursor: 'pointer',
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .5
    }
  }, "\u2715 Close"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 28,
      alignItems: 'start'
    }
  }, trendingModal.coverImageUrl ? /*#__PURE__*/React.createElement("img", {
    src: trendingModal.coverImageUrl,
    alt: trendingModal.title,
    loading: "lazy",
    decoding: "async",
    style: {
      width: 130,
      height: 190,
      objectFit: 'contain',
      background: '#14121008'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 130,
      height: 190,
      background: '#141210',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 13px/1.2 "DM Serif Display", Georgia, serif',
      color: '#F5EFE4',
      textAlign: 'center',
      padding: 12
    }
  }, trendingModal.title)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, trendingModal.genre || 'Books', trendingModal.year ? ` · ${trendingModal.year}` : ''), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '700 28px/1.1 "DM Serif Display", Georgia, serif',
      margin: '8px 0 4px',
      letterSpacing: '-.01em'
    }
  }, trendingModal.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .65,
      marginBottom: 12
    }
  }, trendingModal.author), trendingModal.rating && /*#__PURE__*/React.createElement(Stars, {
    value: trendingModal.rating
  }))), trendingModal.description && /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 15px/1.6 "Space Grotesk", sans-serif',
      margin: '24px 0 0',
      color: '#141210'
    }
  }, trendingModal.description), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: amazonAffiliateUrl(trendingModal),
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '14px 24px',
      background: accent,
      color: '#141210',
      borderRadius: 999,
      textDecoration: 'none',
      display: 'inline-block'
    }
  }, "Buy on Amazon \u2192"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTrendingModal(null),
    style: {
      font: '700 13px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      padding: '14px 24px',
      background: 'transparent',
      color: '#141210',
      border: '1.5px solid #141210',
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Back")))));
};
const Footer = ({
  accent,
  pad
}) => {
  const [ref, vis] = useReveal();
  return /*#__PURE__*/React.createElement("footer", {
    ref: ref,
    style: {
      background: '#141210',
      color: '#F5EFE4',
      padding: `56px ${pad}px 32px`,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
      background: `linear-gradient(0deg, ${accent}08, transparent)`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr 1fr',
      gap: 48,
      marginBottom: 48,
      position: 'relative',
      opacity: vis ? 1 : 0,
      transform: vis ? 'translateY(0)' : 'translateY(24px)',
      transition: 'all .7s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 34px "DM Serif Display", Georgia, serif',
      lineHeight: .9
    }
  }, "Reviewer ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent,
      fontStyle: 'italic'
    }
  }, "Insight")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 14px/1.5 "Space Grotesk", sans-serif',
      opacity: .7,
      marginTop: 12,
      maxWidth: 360
    }
  }, "A small magazine of long opinions about short books, and short opinions about long ones. New every Tuesday.")), [{
    h: 'Read',
    links: ['Home', 'Browse', 'Editors', 'Summaries', 'Archive']
  }, {
    h: 'Company',
    links: ['About', 'Contact', 'Careers', 'Press', 'Style guide']
  }, {
    h: 'Fine print',
    links: ['Terms', 'Privacy', 'RSS', 'Corrections', 'Letters']
  }].map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: accent,
      marginBottom: 14
    }
  }, c.h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      font: '400 14px "Space Grotesk", sans-serif',
      opacity: .85
    }
  }, c.links.map(l => /*#__PURE__*/React.createElement("span", {
    key: l,
    className: "ri-link",
    style: {
      cursor: 'pointer',
      display: 'inline-block',
      color: '#F5EFE4',
      transition: 'color .2s ease'
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(245,239,228,.15)',
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .5,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Reviewer Insight Editions Ltd."), /*#__PURE__*/React.createElement("span", null, "Issue No. 048 \xB7 Set in DM Serif Display, Space Grotesk, and JetBrains Mono.")));
};
Object.assign(window, {
  Home,
  Footer
});