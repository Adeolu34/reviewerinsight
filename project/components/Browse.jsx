// Browse page — filterable grid with staggered animations
const Browse = ({ setRoute, accent, density }) => {
  const BOOKS = window.BOOKS;
  const [genre, setGenre] = React.useState('All');
  const [sort, setSort] = React.useState('Newest');
  const [view, setView] = React.useState('grid');
  const [animKey, setAnimKey] = React.useState(0);
  const pad = density === 'compact' ? 20 : 32;

  const [heroRef, heroVis] = useReveal({ threshold: 0.05 });

  const sortMap = { 'Newest': 'newest', 'Highest rated': 'rating', 'A — Z': 'alpha' };

  // Fetch genres from API
  const { resolved: genreData } = useApi(
    () => ApiClient.getGenres(),
    { genres: window.GENRES }
  );

  // Fetch books from API with server-side filtering/sorting
  const { resolved: booksData } = useApi(
    () => ApiClient.getBooks({
      ...(genre !== 'All' ? { genre } : {}),
      sort: sortMap[sort],
      limit: 100,
    }),
    null,
    [genre, sort]
  );

  const genres = genreData.genres || window.GENRES;

  // Use API data or fall back to static with client-side filtering
  let list, totalBooks;
  if (booksData) {
    list = booksData.books;
    totalBooks = booksData.total;
  } else {
    list = genre === 'All' ? BOOKS : BOOKS.filter(b => b.genre === genre);
    if (sort === 'Highest rated') list = [...list].sort((a,b)=>b.rating-a.rating);
    if (sort === 'Newest') list = [...list].sort((a,b)=>b.year-a.year);
    if (sort === 'A — Z') list = [...list].sort((a,b)=>a.title.localeCompare(b.title));
    totalBooks = BOOKS.length;
  }

  const handleGenre = (g) => { setGenre(g); setAnimKey(k => k+1); };
  const handleSort = (s) => { setSort(s); setAnimKey(k => k+1); };

  return (
    <div className="ri-page-enter" style={{ background:'#F5EFE4', padding:`48px ${pad}px 96px` }}>
      <div ref={heroRef} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'end', gap: 24, marginBottom: 24 }}>
        <div style={{
          opacity: heroVis ? 1 : 0, transform: heroVis ? 'translateY(0)' : 'translateY(32px)',
          transition: 'all .7s cubic-bezier(.2,.8,.2,1)'
        }}>
          <Eyebrow color={accent}>The full catalog</Eyebrow>
          <h1 style={{ font:'900 96px "DM Serif Display", Georgia, serif', margin:'6px 0 0', letterSpacing:'-.025em', lineHeight:.9 }}>
            Browse every <em style={{ color: accent, fontStyle:'italic' }}>review.</em>
          </h1>
        </div>
        <div style={{
          font:'600 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', opacity: heroVis ? .75 : 0, textAlign:'right',
          transition: 'opacity .6s .2s ease'
        }}>
          Showing {list.length} of {totalBooks} · Updated Tuesday
        </div>
      </div>

      <div style={{ borderTop:'1.5px solid #141210', borderBottom:'1.5px solid #141210', padding:'16px 0', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap: 16, marginBottom: 36 }}>
        <div style={{ display:'flex', gap: 8, flexWrap:'wrap' }}>
          {genres.map(g => <GenreTag key={g} onClick={()=>handleGenre(g)} active={genre===g} accent={accent}>{g}</GenreTag>)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 16 }}>
          <span style={{ font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', opacity:.7 }}>Sort:</span>
          {['Newest','Highest rated','A — Z'].map(s=>(
            <button key={s} onClick={()=>handleSort(s)} style={{
              font:'600 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em',
              padding:'6px 10px', border:0, background:'transparent', color:'#141210', cursor:'pointer',
              textDecoration: sort===s ? 'underline' : 'none', textUnderlineOffset: 6, textDecorationThickness: 2,
              textDecorationColor: accent, transition:'all .2s ease',
              opacity: sort===s ? 1 : .6
            }}>{s}</button>
          ))}
          <span style={{ width: 1, height: 20, background:'#141210', opacity:.3 }}/>
          {['grid','list'].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{
              font:'600 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em',
              padding:'6px 10px', border:'1.5px solid #141210', background: view===v ? '#141210' : 'transparent', color: view===v ? '#F5EFE4' : '#141210', cursor:'pointer',
              transition:'all .2s ease', borderRadius: 3
            }}>{v}</button>
          ))}
        </div>
      </div>

      {view==='grid' ? (
        <div key={animKey} style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap: 32, rowGap: 48 }}>
          {list.map((b, idx) => (
            <div key={b.id} onClick={()=>setRoute({name:'review', id: b.id})} style={{
              cursor:'pointer',
              animation: `ri-fadeUp .5s ${Math.min(idx * .04, .5)}s cubic-bezier(.2,.8,.2,1) both`
            }} className="ri-card">
              <div style={{ display:'flex', justifyContent:'center' }}><Cover book={b} size="md"/></div>
              <Eyebrow color={accent} style={{ marginTop: 14 }}>{b.genre} · {b.year}</Eyebrow>
              <div style={{ font:'700 22px/1.1 "DM Serif Display", Georgia, serif', margin:'4px 0 4px', textWrap:'balance' }}>{b.title}</div>
              <div style={{ font:'400 13px "Space Grotesk", sans-serif', opacity:.7, marginBottom: 8 }}>{b.author}</div>
              <Stars value={b.rating} size={12}/>
            </div>
          ))}
        </div>
      ) : (
        <div key={animKey}>
          {list.map((b, i) => (
            <div key={b.id} onClick={()=>setRoute({name:'review', id: b.id})} style={{
              display:'grid', gridTemplateColumns:'60px 100px 1fr auto auto', gap: 24, alignItems:'center', padding:'20px 0', borderBottom:'1px solid rgba(20,18,16,0.15)', cursor:'pointer',
              animation: `ri-fadeUp .4s ${Math.min(i * .03, .4)}s cubic-bezier(.2,.8,.2,1) both`
            }} className="ri-row">
              <div style={{ font:'600 11px "JetBrains Mono", monospace', opacity:.5 }}>No. {String(i+1).padStart(3,'0')}</div>
              <Cover book={b} size="xs"/>
              <div>
                <div style={{ font:'700 24px "DM Serif Display", Georgia, serif', letterSpacing:'-.01em' }}>{b.title}</div>
                <div style={{ font:'400 13px "Space Grotesk", sans-serif', opacity:.7, marginTop: 2 }}>{b.author} · {b.genre} · {b.year} · {b.readTime}</div>
              </div>
              <Stars value={b.rating}/>
              <div style={{ font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', color: accent }}>Read →</div>
            </div>
          ))}
        </div>
      )}

      <Footer accent={accent} pad={pad}/>
    </div>
  );
};

window.Browse = Browse;
