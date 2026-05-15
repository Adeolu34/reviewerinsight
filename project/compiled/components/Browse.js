// Browse page — filterable grid with staggered animations
const Browse = ({
  setRoute,
  route,
  accent,
  density
}) => {
  const BOOKS = window.BOOKS;
  const searchQuery = route?.search || '';
  const [genre, setGenre] = React.useState('All');
  const [sort, setSort] = React.useState('Newest');
  const [view, setView] = React.useState('grid');
  const [animKey, setAnimKey] = React.useState(0);
  const pad = density === 'compact' ? 20 : 32;
  const [heroRef, heroVis] = useReveal({
    threshold: 0.05
  });
  const sortMap = {
    'Newest': 'newest',
    'Highest rated': 'rating',
    'A — Z': 'alpha'
  };

  // Fetch genres from API
  const {
    resolved: genreData
  } = useApi(() => ApiClient.getGenres(), {
    genres: window.GENRES
  });

  // Fetch search results when a search query is active
  const {
    resolved: searchData,
    loading: searchLoading
  } = useApi(() => searchQuery ? ApiClient.search(searchQuery, {
    limit: 100
  }) : Promise.resolve(null), null, [searchQuery]);

  // Fetch books from API with server-side filtering/sorting (when not searching)
  const {
    resolved: booksData
  } = useApi(() => searchQuery ? Promise.resolve(null) : ApiClient.getBooks({
    ...(genre !== 'All' ? {
      genre
    } : {}),
    sort: sortMap[sort],
    limit: 100
  }), null, [genre, sort, searchQuery]);
  const genres = genreData.genres || window.GENRES;

  // Use search data when searching, otherwise normal browse data
  let list, totalBooks;
  if (searchQuery && searchData) {
    list = searchData.books;
    totalBooks = searchData.total;
  } else if (!searchQuery && booksData) {
    list = booksData.books;
    totalBooks = booksData.total;
  } else {
    list = genre === 'All' ? BOOKS : BOOKS.filter(b => b.genre === genre);
    if (sort === 'Highest rated') list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === 'Newest') list = [...list].sort((a, b) => b.year - a.year);
    if (sort === 'A — Z') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    totalBooks = BOOKS.length;
  }
  const handleGenre = g => {
    setGenre(g);
    setAnimKey(k => k + 1);
  };
  const handleSort = s => {
    setSort(s);
    setAnimKey(k => k + 1);
  };
  const clearSearch = () => setRoute({
    name: 'browse'
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "ri-page-enter",
    style: {
      background: '#F5EFE4',
      padding: `48px ${pad}px 96px`
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: heroRef,
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'end',
      gap: 24,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: heroVis ? 1 : 0,
      transform: heroVis ? 'translateY(0)' : 'translateY(32px)',
      transition: 'all .7s cubic-bezier(.2,.8,.2,1)'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent
  }, searchQuery ? 'Search results' : 'The full catalog'), /*#__PURE__*/React.createElement("h1", {
    style: {
      font: '900 96px "DM Serif Display", Georgia, serif',
      margin: '6px 0 0',
      letterSpacing: '-.025em',
      lineHeight: .9
    }
  }, searchQuery ? /*#__PURE__*/React.createElement("span", null, "Results for ", /*#__PURE__*/React.createElement("em", {
    style: {
      color: accent,
      fontStyle: 'italic'
    }
  }, "\"", searchQuery, "\"")) : /*#__PURE__*/React.createElement("span", null, "Browse every ", /*#__PURE__*/React.createElement("em", {
    style: {
      color: accent,
      fontStyle: 'italic'
    }
  }, "review."))), searchQuery && /*#__PURE__*/React.createElement("button", {
    onClick: clearSearch,
    style: {
      marginTop: 16,
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '8px 16px',
      border: '1.5px solid #141210',
      background: 'transparent',
      color: '#141210',
      cursor: 'pointer',
      borderRadius: 999,
      transition: 'all .2s ease'
    },
    className: "ri-btn-ghost"
  }, "Clear search")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: heroVis ? .75 : 0,
      textAlign: 'right',
      transition: 'opacity .6s .2s ease'
    }
  }, searchLoading ? 'Searching…' : `Showing ${list.length}${totalBooks ? ` of ${totalBooks}` : ''}`, " ", !searchQuery && '· Updated Tuesday')), !searchQuery && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1.5px solid #141210',
      borderBottom: '1.5px solid #141210',
      padding: '16px 0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 16,
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, genres.map(g => /*#__PURE__*/React.createElement(GenreTag, {
    key: g,
    onClick: () => handleGenre(g),
    active: genre === g,
    accent: accent
  }, g))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      opacity: .7
    }
  }, "Sort:"), ['Newest', 'Highest rated', 'A — Z'].map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => handleSort(s),
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '6px 10px',
      border: 0,
      background: 'transparent',
      color: '#141210',
      cursor: 'pointer',
      textDecoration: sort === s ? 'underline' : 'none',
      textUnderlineOffset: 6,
      textDecorationThickness: 2,
      textDecorationColor: accent,
      transition: 'all .2s ease',
      opacity: sort === s ? 1 : .6
    }
  }, s)), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 20,
      background: '#141210',
      opacity: .3
    }
  }), ['grid', 'list'].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setView(v),
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '6px 10px',
      border: '1.5px solid #141210',
      background: view === v ? '#141210' : 'transparent',
      color: view === v ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      transition: 'all .2s ease',
      borderRadius: 3
    }
  }, v)))), searchQuery && /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1.5px solid #141210',
      padding: '16px 0',
      marginBottom: 36,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, ['grid', 'list'].map(v => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setView(v),
    style: {
      font: '600 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.12em',
      padding: '6px 10px',
      border: '1.5px solid #141210',
      background: view === v ? '#141210' : 'transparent',
      color: view === v ? '#F5EFE4' : '#141210',
      cursor: 'pointer',
      transition: 'all .2s ease',
      borderRadius: 3
    }
  }, v))), list.length === 0 && !searchLoading && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 14px "Space Grotesk", sans-serif',
      opacity: .7
    }
  }, "No books found matching your search. Try different keywords.")), view === 'grid' ? /*#__PURE__*/React.createElement("div", {
    key: animKey,
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 32,
      rowGap: 48
    }
  }, list.map((b, idx) => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => setRoute(riReviewRouteFromBook(b)),
    style: {
      cursor: 'pointer',
      animation: `ri-fadeUp .5s ${Math.min(idx * .04, .5)}s cubic-bezier(.2,.8,.2,1) both`
    },
    className: "ri-card"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Cover, {
    book: b,
    size: "md"
  })), /*#__PURE__*/React.createElement(Eyebrow, {
    color: accent,
    style: {
      marginTop: 14
    }
  }, b.genre, " \xB7 ", b.year), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 22px/1.1 "DM Serif Display", Georgia, serif',
      margin: '4px 0 4px',
      textWrap: 'balance'
    }
  }, b.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px "Space Grotesk", sans-serif',
      opacity: .7,
      marginBottom: 8
    }
  }, b.author), /*#__PURE__*/React.createElement(Stars, {
    value: b.rating,
    size: 12
  })))) : /*#__PURE__*/React.createElement("div", {
    key: animKey
  }, list.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    onClick: () => setRoute(riReviewRouteFromBook(b)),
    style: {
      display: 'grid',
      gridTemplateColumns: '60px 100px 1fr auto auto',
      gap: 24,
      alignItems: 'center',
      padding: '20px 0',
      borderBottom: '1px solid rgba(20,18,16,0.15)',
      cursor: 'pointer',
      animation: `ri-fadeUp .4s ${Math.min(i * .03, .4)}s cubic-bezier(.2,.8,.2,1) both`
    },
    className: "ri-row"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px "JetBrains Mono", monospace',
      opacity: .5
    }
  }, "No. ", String(i + 1).padStart(3, '0')), /*#__PURE__*/React.createElement(Cover, {
    book: b,
    size: "xs"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 24px "DM Serif Display", Georgia, serif',
      letterSpacing: '-.01em'
    }
  }, b.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 13px "Space Grotesk", sans-serif',
      opacity: .7,
      marginTop: 2
    }
  }, b.author, " \xB7 ", b.genre, " \xB7 ", b.year, " \xB7 ", b.readTime)), /*#__PURE__*/React.createElement(Stars, {
    value: b.rating
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 12px "JetBrains Mono", monospace',
      textTransform: 'uppercase',
      letterSpacing: '.14em',
      color: accent
    }
  }, "Read \u2192")))), /*#__PURE__*/React.createElement(Footer, {
    accent: accent,
    pad: pad
  }));
};
window.Browse = Browse;