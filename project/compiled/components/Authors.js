// Authors catalog — listing page + individual author detail page

// ─── Avatar: photo or styled initials ────────────────────────────────────────
const AuthorAvatar = ({
  name,
  photoUrl,
  size = 80,
  accent = '#E8432C'
}) => {
  const [imgError, setImgError] = React.useState(false);
  const initials = (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hash = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const bgs = ['#141210', '#1E3A8A', '#0F5132', '#7C2D12', '#4C1D95', '#92400E'];
  const bg = bgs[hash % bgs.length];
  if (photoUrl && !imgError) {
    return /*#__PURE__*/React.createElement("img", {
      src: photoUrl,
      alt: name,
      onError: () => setImgError(true),
      style: {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1.5px solid #141210',
        display: 'block',
        flexShrink: 0
      }
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: '#F5EFE4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      font: `700 ${Math.round(size * 0.34)}px/1 "DM Serif Display", Georgia, serif`,
      border: '1.5px solid #141210',
      letterSpacing: '-.02em'
    }
  }, initials);
};

// ─── Author card for grid listing ────────────────────────────────────────────
const AuthorCard = ({
  author,
  setRoute,
  accent,
  delay = 0
}) => {
  const [ref, vis] = useReveal();
  const [hov, setHov] = React.useState(false);
  const lifespan = author.birthYear ? author.deathYear ? `${author.birthYear}–${author.deathYear}` : `b. ${author.birthYear}` : null;
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    onClick: () => setRoute({
      name: 'author',
      slug: author.slug
    }),
    onMouseEnter: () => setHov(true),
    onMouseLeave: () => setHov(false),
    style: {
      cursor: 'pointer',
      padding: '24px 18px',
      border: '1.5px solid #141210',
      borderRadius: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      textAlign: 'center',
      background: hov ? '#141210' : 'transparent',
      transform: hov ? 'translateY(-5px)' : 'none',
      boxShadow: hov ? '0 16px 40px -12px rgba(20,18,16,0.28)' : 'none',
      transition: 'all .3s cubic-bezier(.2,.8,.2,1)',
      opacity: vis ? 1 : 0,
      animation: vis ? `ri-fadeUp .5s ${delay}s cubic-bezier(.2,.8,.2,1) both` : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(AuthorAvatar, {
    name: author.name,
    photoUrl: author.photoUrl,
    size: 68,
    accent: accent
  }), !author.deathYear && author.birthYear && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 13,
      height: 13,
      borderRadius: '50%',
      background: '#22c55e',
      border: '2px solid #F5EFE4'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px/1.2 "DM Serif Display", Georgia, serif',
      color: hov ? '#F5EFE4' : '#141210',
      letterSpacing: '-.01em',
      transition: 'color .3s ease'
    }
  }, author.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.11em',
      color: hov ? 'rgba(245,239,228,.55)' : 'rgba(20,18,16,.45)',
      transition: 'color .3s ease',
      lineHeight: 1.6
    }
  }, [author.nationality, lifespan].filter(Boolean).join(' · ')), author.genres?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      justifyContent: 'center'
    }
  }, author.genres.slice(0, 2).map(g => /*#__PURE__*/React.createElement("span", {
    key: g,
    style: {
      font: '600 9px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.09em',
      padding: '3px 8px',
      borderRadius: 999,
      border: `1px solid ${hov ? 'rgba(245,239,228,.25)' : 'rgba(20,18,16,.2)'}`,
      color: hov ? 'rgba(245,239,228,.65)' : 'rgba(20,18,16,.55)',
      transition: 'all .3s ease'
    }
  }, g))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      color: accent
    }
  }, author.bookCount, " ", author.bookCount === 1 ? 'review' : 'reviews'));
};

// ─── Authors listing page ─────────────────────────────────────────────────────
const AuthorsList = ({
  setRoute,
  accent,
  density
}) => {
  const pad = density === 'compact' ? 20 : 32;
  const [letter, setLetter] = React.useState('');
  const [genre, setGenre] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [heroRef, heroVis] = useReveal({
    threshold: 0.05
  });
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const genres = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature', 'Spiritual'];
  const params = {
    limit: 30,
    sort: 'books',
    page
  };
  if (letter) params.letter = letter;
  if (genre) params.genre = genre;
  const {
    resolved: data,
    loading
  } = useApi(() => ApiClient.getAuthors(params), {
    authors: [],
    total: 0,
    pages: 1
  }, [letter, genre, page]);
  const authors = data?.authors || [];
  const totalPages = data?.pages || 1;
  const total = data?.total || 0;
  const handleLetter = v => {
    setPage(1);
    setLetter(p => p === v ? '' : v);
  };
  const handleGenre = v => {
    setPage(1);
    setGenre(p => p === v ? '' : v);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ri-page-enter",
    style: {
      background: '#F5EFE4',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("section", {
    ref: heroRef,
    style: {
      padding: `64px ${pad}px 52px`,
      borderBottom: '1.5px solid #141210',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 660
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.18em',
      color: accent,
      marginBottom: 16,
      opacity: heroVis ? 1 : 0,
      animation: heroVis ? 'ri-fadeIn .5s ease both' : 'none'
    }
  }, "Authors Catalog"), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '900 74px/0.94 "DM Serif Display", Georgia, serif',
      margin: '0 0 20px',
      letterSpacing: '-.025em',
      opacity: heroVis ? 1 : 0,
      animation: heroVis ? 'ri-hero-text .8s .1s cubic-bezier(.2,.8,.2,1) both' : 'none'
    }
  }, "The Voices", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("em", {
    style: {
      fontStyle: 'italic',
      color: accent
    }
  }, "Behind the Books")), /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 19px/1.65 "Space Grotesk", sans-serif',
      margin: 0,
      maxWidth: 520,
      opacity: .72,
      animation: heroVis ? 'ri-fadeUp .5s .3s ease both' : 'none'
    }
  }, total > 0 ? `${total.toLocaleString()} authors` : 'Thousands of authors', " \u2014 their lives, their worlds, and every book we've reviewed.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: pad,
      top: '50%',
      transform: 'translateY(-50%)',
      font: '900 300px/1 "DM Serif Display", Georgia, serif',
      color: '#141210',
      opacity: .03,
      pointerEvents: 'none',
      userSelect: 'none'
    }
  }, letter || 'A')), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: `18px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => handleLetter(''),
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '7px 12px',
      border: `1.5px solid ${!letter ? '#141210' : 'rgba(20,18,16,.25)'}`,
      background: !letter ? '#141210' : 'transparent',
      color: !letter ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      borderRadius: 999,
      transition: 'all .2s ease'
    }
  }, "All"), alphabet.map(l => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: () => handleLetter(l),
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      padding: '7px 9px',
      minWidth: 32,
      border: `1.5px solid ${letter === l ? '#141210' : 'rgba(20,18,16,.18)'}`,
      background: letter === l ? '#141210' : 'transparent',
      color: letter === l ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      borderRadius: 4,
      transition: 'all .2s ease'
    }
  }, l))), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: `14px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .45,
      marginRight: 4
    }
  }, "Genre:"), genres.map(g => /*#__PURE__*/React.createElement(GenreTag, {
    key: g,
    active: genre === g,
    accent: accent,
    onClick: () => handleGenre(g)
  }, g)), genre && /*#__PURE__*/React.createElement("button", {
    onClick: () => handleGenre(''),
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '6px 12px',
      border: '1.5px solid #141210',
      background: 'transparent',
      color: '#141210',
      cursor: 'pointer',
      borderRadius: 999
    }
  }, "Clear \xD7")), /*#__PURE__*/React.createElement("section", {
    style: {
      padding: `${pad}px`
    }
  }, loading && authors.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '80px 0',
      font: '400 16px "Space Grotesk", sans-serif',
      opacity: .45
    }
  }, "Loading authors\u2026") : authors.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '80px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 52px "DM Serif Display", serif',
      opacity: .1
    }
  }, "\u2205"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 16px "Space Grotesk", sans-serif',
      opacity: .45,
      marginTop: 12
    }
  }, "No authors found")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
      gap: 16
    }
  }, authors.map((a, i) => /*#__PURE__*/React.createElement(AuthorCard, {
    key: a._id || a.slug,
    author: a,
    setRoute: setRoute,
    accent: accent,
    delay: i % 12 * 0.04
  }))), totalPages > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 8,
      marginTop: 48,
      paddingTop: 32,
      borderTop: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.max(1, p - 1)),
    disabled: page === 1,
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '10px 18px',
      border: '1.5px solid #141210',
      background: 'transparent',
      cursor: page === 1 ? 'default' : 'pointer',
      opacity: page === 1 ? .3 : 1,
      borderRadius: 999
    }
  }, "\u2190 Prev"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      padding: '10px 16px',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .55
    }
  }, page, " / ", totalPages), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPage(p => Math.min(totalPages, p + 1)),
    disabled: page === totalPages,
    style: {
      font: '700 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '10px 18px',
      border: '1.5px solid #141210',
      background: 'transparent',
      cursor: page === totalPages ? 'default' : 'pointer',
      opacity: page === totalPages ? .3 : 1,
      borderRadius: 999
    }
  }, "Next \u2192"))));
};

// ─── Author detail page ───────────────────────────────────────────────────────
const AuthorDetail = ({
  slug,
  setRoute,
  accent,
  density
}) => {
  const pad = density === 'compact' ? 20 : 32;
  const [heroRef, heroVis] = useReveal({
    threshold: 0.05
  });
  const [booksRef, booksVis] = useReveal();
  const {
    resolved: author,
    loading: authorLoading
  } = useApi(() => ApiClient.getAuthor(slug), null, [slug]);
  const {
    resolved: booksData,
    loading: booksLoading
  } = useApi(() => ApiClient.getAuthorBooks(slug), {
    books: []
  }, [slug]);
  const books = booksData?.books || [];
  if (authorLoading) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5EFE4'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 16px "Space Grotesk", sans-serif',
        opacity: .45
      }
    }, "Loading\u2026"));
  }
  if (!author) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5EFE4',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '900 64px "DM Serif Display", serif',
        opacity: .08
      }
    }, "404"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: '400 18px "Space Grotesk", sans-serif',
        opacity: .45
      }
    }, "Author not found"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setRoute({
        name: 'authors'
      }),
      style: {
        font: '700 12px "JetBrains Mono", monospace',
        textTransform: 'uppercase',
        letterSpacing: '.14em',
        padding: '10px 20px',
        border: '1.5px solid #141210',
        background: 'transparent',
        cursor: 'pointer',
        borderRadius: 999
      }
    }, "\u2190 All Authors"));
  }
  const lifespan = author.birthYear ? author.deathYear ? `${author.birthYear}–${author.deathYear}` : `Born ${author.birthYear}` : null;
  const bioParas = (author.bio || '').split('\n\n').filter(Boolean);
  const statLine = [author.nationality, lifespan, ...(author.genres || []).slice(0, 2)].filter(Boolean).join(' · ');
  return /*#__PURE__*/React.createElement("div", {
    className: "ri-page-enter",
    style: {
      background: '#F5EFE4',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `14px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
      opacity: .7
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'home'
    }),
    className: "ri-link",
    style: {
      all: 'unset',
      cursor: 'pointer',
      color: '#141210'
    }
  }, "Home"), /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'authors'
    }),
    className: "ri-link",
    style: {
      all: 'unset',
      cursor: 'pointer',
      color: '#141210'
    }
  }, "Authors"), /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, author.name)), /*#__PURE__*/React.createElement("section", {
    ref: heroRef,
    style: {
      padding: `56px ${pad}px 48px`,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'auto 1fr',
      gap: 48,
      alignItems: 'flex-start',
      maxWidth: 1100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: heroVis ? 1 : 0,
      animation: heroVis ? 'ri-scaleIn .7s .1s cubic-bezier(.2,.8,.2,1) both' : 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(AuthorAvatar, {
    name: author.name,
    photoUrl: author.photoUrl,
    size: 160,
    accent: accent
  }), author.deathYear && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .45,
      textAlign: 'center'
    }
  }, author.birthYear, "\u2013", author.deathYear)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      animation: heroVis ? 'ri-fadeIn .4s ease both' : 'none'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, statLine)), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '900 80px/0.94 "DM Serif Display", Georgia, serif',
      margin: '12px 0 18px',
      letterSpacing: '-.025em',
      animation: heroVis ? 'ri-hero-text .8s .15s cubic-bezier(.2,.8,.2,1) both' : 'none'
    }
  }, author.name), author.shortBio && /*#__PURE__*/React.createElement("p", {
    style: {
      font: '400 20px/1.55 "Space Grotesk", sans-serif',
      fontStyle: 'italic',
      opacity: .72,
      margin: '0 0 26px',
      maxWidth: 580,
      animation: heroVis ? 'ri-fadeUp .5s .3s ease both' : 'none'
    }
  }, "\"", author.shortBio, "\""), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      border: '1.5px solid #141210',
      width: 'fit-content',
      animation: heroVis ? 'ri-fadeUp .5s .4s ease both' : 'none'
    }
  }, [{
    label: 'Reviews',
    value: author.bookCount || books.length
  }, {
    label: 'Genres',
    value: (author.genres || []).length
  }, ...(author.nationality ? [{
    label: 'Country',
    value: author.nationality
  }] : [])].map((s, i, arr) => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      padding: '14px 24px',
      borderRight: i < arr.length - 1 ? '1.5px solid #141210' : 'none',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '900 28px/1 "DM Serif Display", Georgia, serif',
      color: accent
    }
  }, s.value), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .5,
      marginTop: 4
    }
  }, s.label))))))), author.bio && /*#__PURE__*/React.createElement("section", {
    style: {
      padding: `48px ${pad}px`,
      borderBottom: '1.5px solid #141210',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 60
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 20
    }
  }, "Biography"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 17px/1.78 "Space Grotesk", sans-serif',
      color: '#141210'
    }
  }, bioParas.map((p, i) => /*#__PURE__*/React.createElement("p", {
    key: i,
    style: {
      margin: '0 0 18px'
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: 38
    }
  }, author.genres?.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .45,
      marginBottom: 10
    }
  }, "Genres"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, author.genres.map(g => /*#__PURE__*/React.createElement(GenreTag, {
    key: g,
    accent: accent,
    onClick: () => setRoute({
      name: 'browse',
      genre: g
    })
  }, g)))), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1.5px solid #141210',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px/1 "DM Serif Display", serif',
      marginBottom: 18,
      letterSpacing: '-.01em'
    }
  }, "At a Glance"), [{
    label: 'Full Name',
    value: author.name
  }, ...(author.nationality ? [{
    label: 'Nationality',
    value: author.nationality
  }] : []), ...(author.birthYear ? [{
    label: author.deathYear ? 'Lived' : 'Born',
    value: lifespan
  }] : []), {
    label: 'Reviews on Site',
    value: `${author.bookCount || books.length} books`
  }].map(row => /*#__PURE__*/React.createElement("div", {
    key: row.label,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '9px 0',
      borderBottom: '1px solid rgba(20,18,16,.08)',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      opacity: .45,
      flexShrink: 0
    }
  }, row.label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 14px "Space Grotesk", sans-serif',
      textAlign: 'right'
    }
  }, row.value)))))), /*#__PURE__*/React.createElement("section", {
    ref: booksRef,
    style: {
      padding: `${pad}px`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 28,
      paddingBottom: 20,
      borderBottom: '1.5px solid #141210'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginBottom: 8
    }
  }, "On Reviewer Insight"), /*#__PURE__*/React.createElement("h2", {
    style: {
      font: '900 42px/1 "DM Serif Display", Georgia, serif',
      margin: 0,
      letterSpacing: '-.02em'
    }
  }, "Books by ", author.name)), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      opacity: .45
    }
  }, books.length, " ", books.length === 1 ? 'title' : 'titles')), booksLoading ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 0',
      textAlign: 'center',
      opacity: .4,
      font: '400 15px "Space Grotesk", sans-serif'
    }
  }, "Loading books\u2026") : books.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '60px 0',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 16px "Space Grotesk", sans-serif',
      opacity: .45
    }
  }, "No reviewed books yet for this author.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
      gap: 20,
      opacity: booksVis ? 1 : 0,
      animation: booksVis ? 'ri-fadeUp .5s cubic-bezier(.2,.8,.2,1) both' : 'none'
    }
  }, books.map(book => /*#__PURE__*/React.createElement("div", {
    key: book._id || book.id,
    onClick: () => setRoute(riReviewRouteFromBook(book)),
    style: {
      cursor: 'pointer',
      border: '1.5px solid #141210',
      overflow: 'hidden',
      transition: 'transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(20,18,16,0.2)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 18px 0',
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: book,
    size: "sm"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 15px/1.25 "DM Serif Display", Georgia, serif',
      marginBottom: 4,
      letterSpacing: '-.01em'
    }
  }, book.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      opacity: .45
    }
  }, book.genre), book.rating && /*#__PURE__*/React.createElement(Stars, {
    value: book.rating,
    size: 11
  }))))))));
};

// ─── Route entry point ────────────────────────────────────────────────────────
const Authors = ({
  route,
  setRoute,
  accent,
  density
}) => {
  if (route.name === 'author' && route.slug) {
    return /*#__PURE__*/React.createElement(AuthorDetail, {
      slug: route.slug,
      setRoute: setRoute,
      accent: accent,
      density: density
    });
  }
  return /*#__PURE__*/React.createElement(AuthorsList, {
    setRoute: setRoute,
    accent: accent,
    density: density
  });
};
Object.assign(window, {
  Authors,
  AuthorDetail,
  AuthorsList,
  AuthorCard,
  AuthorAvatar
});