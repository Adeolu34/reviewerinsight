// Shared small bits: Star, Eyebrow, Rule, GenreTag, Seal + scroll-reveal hook
const { useEffect, useRef, useState, useCallback } = React;

// Scroll-triggered reveal hook
const useReveal = (options = {}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
    }, { threshold: options.threshold || 0.12, rootMargin: options.rootMargin || '0px 0px -40px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
};

const Stars = ({ value = 0, size = 14, color = "#141210" }) => {
  const pct = Math.max(0, Math.min(1, value/5));
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap: 2, position:'relative' }} aria-label={`${value} of 5`}>
      <span style={{ position:'relative', display:'inline-block' }}>
        <span style={{ color: color, opacity:.2, letterSpacing: 1, fontSize: size }}>★★★★★</span>
        <span style={{ position:'absolute', inset:0, width: `${pct*100}%`, overflow:'hidden', color, letterSpacing: 1, fontSize: size, whiteSpace:'nowrap', transition:'width .6s cubic-bezier(.2,.8,.2,1)' }}>★★★★★</span>
      </span>
      <span style={{ font: `600 ${Math.round(size*0.8)}px "JetBrains Mono", monospace`, color, opacity:.7, marginLeft: 4 }}>{value.toFixed(1)}</span>
    </span>
  );
};

const Eyebrow = ({ children, color = "#E8432C", style }) => (
  <div style={{
    font: '600 11px "JetBrains Mono", monospace',
    textTransform:'uppercase', letterSpacing:'.14em', color, ...style
  }}>{children}</div>
);

const Rule = ({ color = "#141210", weight = 1, style }) => (
  <div style={{ height: weight, background: color, ...style }}/>
);

const GenreTag = ({ children, onClick, active, accent = "#E8432C" }) => (
  <button onClick={onClick} className="ri-tag" style={{
    font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em',
    padding:'8px 14px', border:`1.5px solid ${active ? accent : '#141210'}`,
    background: active ? accent : 'transparent', color: active ? '#F5EFE4' : '#141210',
    cursor:'pointer', borderRadius: 999, transition:'all .25s cubic-bezier(.2,.8,.2,1)',
    boxShadow: active ? `0 4px 16px -4px ${accent}55` : 'none'
  }}>{children}</button>
);

const Seal = ({ children, color = "#E8432C", rotate = -8, size = 96 }) => (
  <div style={{
    width: size, height: size, borderRadius:'50%',
    border: `1.5px solid ${color}`, color, transform:`rotate(${rotate}deg)`,
    display:'flex', alignItems:'center', justifyContent:'center',
    font:'700 10px/1.2 "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.18em',
    textAlign:'center', padding: 8, background: 'rgba(245,239,228,0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    animation: 'ri-pulse 4s ease-in-out infinite',
    '--rot': `${rotate}deg`,
    boxShadow: `0 0 0 3px rgba(245,239,228,0.5), 0 8px 24px -8px ${color}33`
  }}>{children}</div>
);

// Enhanced Header with glassmorphism
const Header = ({ route, setRoute, accent, dark }) => {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Sync search input with route (clear when navigating away from search)
  useEffect(() => {
    if (route.name !== 'browse' || !route.search) {
      setSearchQuery('');
    }
  }, [route.name]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q.length >= 2) {
      setRoute({ name: 'browse', search: q });
    }
  };

  const ink = dark ? '#F5EFE4' : '#141210';
  const paper = dark ? '#141210' : '#F5EFE4';
  const nav = [
    { id: 'home', label: 'Home' },
    { id: 'browse', label: 'Browse' },
    { id: 'recommend', label: 'For You' },
    { id: 'editors', label: 'Editors' },
    { id: 'membership', label: 'Membership' },
  ];
  return (
    <header style={{
      borderBottom:`1.5px solid ${ink}`,
      background: scrolled ? `${paper}ee` : paper,
      backdropFilter: scrolled ? 'blur(16px) saturate(1.2)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(1.2)' : 'none',
      position:'sticky', top:0, zIndex: 20,
      transition: 'background .35s ease, box-shadow .35s ease',
      boxShadow: scrolled ? '0 4px 32px -8px rgba(20,18,16,0.12)' : 'none'
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: scrolled ? '6px 28px' : '10px 28px', font: scrolled ? '600 10px "JetBrains Mono", monospace' : '600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', color: ink, borderBottom:`1px solid ${ink}`, opacity:.9, transition: 'padding .3s ease, font-size .3s ease' }}>
        <span>Issue No. 048 · April 18, 2026</span>
        <span style={{ display:'flex', gap: 18 }}>
          <span>Est. 2019</span>
          <span>New York · Lagos · Lisbon</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius:'50%', background:'#22c55e', animation: 'ri-pulse 2s ease infinite', boxShadow: '0 0 8px #22c55e55' }}/>
            Members online: 2,431
          </span>
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding: scrolled ? '12px 28px' : '18px 28px', gap: 32, transition:'padding .3s ease' }}>
        <button onClick={()=>setRoute({name:'home'})} style={{ background:'none', border:0, padding:0, cursor:'pointer', textAlign:'left' }}>
          <div style={{ font: scrolled ? '900 26px/.9 "DM Serif Display", Georgia, serif' : '900 34px/.9 "DM Serif Display", Georgia, serif', color: ink, letterSpacing:'-.01em', transition: 'font-size .3s ease' }}>
            Reviewer <span style={{ color: accent, fontStyle:'italic', transition: 'color .3s ease' }}>Insight</span>
          </div>
          {!scrolled && (
            <div style={{ font:'600 10px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.22em', color: ink, opacity:.65, marginTop: 4 }}>
              Reviews · Summaries · A Good Read
            </div>
          )}
        </button>
        <nav style={{ display:'flex', gap: 4 }}>
          {nav.map(n => {
            const isActive = route.name === n.id;
            return (
              <button key={n.id} onClick={()=>setRoute({name:n.id})} className="ri-link" style={{
                font:'600 13px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em',
                padding:'10px 14px', border:0, cursor:'pointer', position:'relative',
                background: isActive ? ink : 'transparent',
                color: isActive ? paper : ink,
                transition: 'all .25s ease',
                borderRadius: isActive ? 4 : 0
              }}>{n.label}</button>
            );
          })}
        </nav>
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <form onSubmit={handleSearch} style={{ display:'flex', alignItems:'center', gap: 8, border:`1.5px solid ${ink}`, padding:'8px 12px', borderRadius: 999, minWidth: 220, transition:'box-shadow .3s ease' }}>
            <span style={{ font:'600 12px "JetBrains Mono", monospace', color: ink, opacity:.6, cursor:'pointer' }} onClick={handleSearch}>⌕</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reviews…"
              style={{ border:0, background:'transparent', outline:'none', font:'400 13px "Space Grotesk", sans-serif', color: ink, width:'100%' }}
            />
            {searchQuery && (
              <span onClick={() => { setSearchQuery(''); searchRef.current?.focus(); }} style={{ cursor:'pointer', font:'600 14px "JetBrains Mono", monospace', color: ink, opacity:.5, lineHeight:1 }}>×</span>
            )}
          </form>
          <button className="ri-btn-primary" style={{
            font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
            padding:'10px 16px', background: accent, color:'#F5EFE4', border:0, cursor:'pointer', borderRadius: 999,
            boxShadow: `0 4px 16px -4px ${accent}55`
          }}>Subscribe</button>
        </div>
      </div>
    </header>
  );
};

// Enhanced Marquee with gradient fade edges and glow dots
const Marquee = ({ items, accent }) => (
  <div style={{ background:'#141210', color:'#F5EFE4', overflow:'hidden', borderBottom:`1.5px solid #141210`, borderTop:`1.5px solid #141210`, position:'relative' }}>
    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:80, background:'linear-gradient(90deg, #141210, transparent)', zIndex:2 }}/>
    <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:'linear-gradient(270deg, #141210, transparent)', zIndex:2 }}/>
    <div className="ri-marquee" style={{ display:'flex', gap: 48, whiteSpace:'nowrap', padding:'12px 0', font:'600 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.16em' }}>
      {[...items, ...items, ...items].map((t,i)=>(
        <span key={i} style={{ display:'inline-flex', alignItems:'center', gap: 14 }}>
          <span style={{ width: 7, height: 7, background: accent, borderRadius:'50%', boxShadow: `0 0 10px ${accent}66, 0 0 4px ${accent}33`, flexShrink: 0 }}/>
          {t}
        </span>
      ))}
    </div>
  </div>
);

const amazonAffiliateUrl = (book) => {
  const tag = 'reviewerin0d8-20';
  // Strip everything except digits and X (handles dashes, spaces, mixed formats)
  const isbn = book.isbn ? book.isbn.replace(/[^0-9Xx]/g, '') : null;

  if (isbn && isbn.length >= 10) {
    // Search by ISBN — precise, handles both ISBN-10 and ISBN-13, avoids dead dp/ links
    return `https://www.amazon.com/s?k=${encodeURIComponent(isbn)}&i=stripbooks&tag=${tag}`;
  }

  // Quote the title so Amazon doesn't match unrelated books with similar words
  const title = (book.title || '').trim();
  const author = (book.author || '').trim();
  const query = author ? `"${title}" ${author}` : `"${title}"`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=stripbooks&tag=${tag}`;
};

Object.assign(window, { Stars, Eyebrow, Rule, GenreTag, Seal, Header, Marquee, useReveal, amazonAffiliateUrl });
