// Editors + Membership pages — enhanced with animations
const Editors = ({ setRoute, accent, density }) => {
  const pad = density === 'compact' ? 20 : 32;
  const [heroRef, heroVis] = useReveal({ threshold: 0.05 });

  // Fetch editors and books from API
  const { resolved: editorData } = useApi(
    () => ApiClient.getEditors(),
    { editors: window.EDITORS }
  );
  const editors = editorData.editors || window.EDITORS;

  // Fetch all published books for editor book lists
  const { resolved: allBooksData } = useApi(
    () => ApiClient.getBooks({ limit: 100 }),
    { books: window.BOOKS }
  );
  const allBooks = allBooksData.books || window.BOOKS;

  return (
    <div className="ri-page-enter" style={{ background:'#F5EFE4', padding:`48px ${pad}px 96px` }}>
      <div ref={heroRef}>
        <div style={{
          opacity: heroVis ? 1 : 0, transform: heroVis ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
        }}>
          <Eyebrow color={accent}>Masthead · Issue No. 048</Eyebrow>
        </div>
        <h1 style={{
          font:'900 120px "DM Serif Display", Georgia, serif', margin:'6px 0 36px', letterSpacing:'-.03em', lineHeight:.85,
          opacity: heroVis ? 1 : 0,
          transform: heroVis ? 'translateY(0)' : 'translateY(32px)',
          transition: 'all .8s .1s cubic-bezier(.2,.8,.2,1)'
        }}>
          Four people who read <em style={{ color: accent, fontStyle:'italic' }}>too much.</em>
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 32, borderTop:'1.5px solid #141210' }}>
        {editors.map((e, i) => {
          const books = allBooks.filter(b => b.editor === e.name).slice(0,4);
          return (
            <div key={e.name} style={{
              padding:'32px 0', borderBottom:'1.5px solid #141210', display:'grid', gridTemplateColumns:'140px 1fr', gap: 24, alignItems:'start',
              animation: `ri-fadeUp .6s ${i * .1 + .2}s cubic-bezier(.2,.8,.2,1) both`
            }}>
              <div style={{
                width: 140, height: 180, background: e.bg, color:'#F5EFE4', display:'flex', alignItems:'flex-end', justifyContent:'flex-start', padding: 14,
                position:'relative', overflow:'hidden', transition:'transform .3s ease',
                cursor:'pointer'
              }} className="ri-card">
                {/* Ambient shine */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%', background:'linear-gradient(180deg, rgba(255,255,255,0.08), transparent)', pointerEvents:'none' }}/>
                <div style={{ position:'relative' }}>
                  <div style={{ font:'900 64px "DM Serif Display", Georgia, serif', lineHeight:.85, letterSpacing:'-.03em' }}>{e.initials}</div>
                  <div style={{ font:'600 9px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', marginTop: 6, opacity:.85 }}>No. {String(i+1).padStart(2,'0')}</div>
                </div>
              </div>
              <div>
                <div style={{ font:'700 32px "DM Serif Display", Georgia, serif', letterSpacing:'-.01em' }}>{e.name}</div>
                <div style={{ font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', color: accent, margin:'4px 0 12px' }}>{e.role}{e.reviewCount ? ` · ${e.reviewCount} reviews` : ''}</div>
                <p style={{ font:'400 15px/1.55 "Space Grotesk", sans-serif', margin:'0 0 16px' }}>{e.beat}. {books.length > 0 ? `Recent bylines include ${books.map(b=>b.title).slice(0,2).join(' and ')}.` : 'Edits incoming.'}</p>
                {books.length > 0 && (
                  <div style={{ display:'flex', gap: 8 }}>
                    {books.map(b => <div key={b.id} onClick={()=>setRoute({name:'review', id: b.id})} style={{ cursor:'pointer' }} className="ri-card"><Cover book={b} size="xs"/></div>)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Footer accent={accent} pad={pad}/>
    </div>
  );
};

const Membership = ({ accent, density }) => {
  const pad = density === 'compact' ? 20 : 32;
  const [plan, setPlan] = React.useState('annual');
  const [heroRef, heroVis] = useReveal({ threshold: 0.05 });
  const { resolved: stats } = useApi(
    () => ApiClient.getStats(),
    { totalBooks: 30, totalSummaries: 30 }
  );
  const plans = {
    monthly: { price: 9, period:'month', save: null, meta:'Billed monthly' },
    annual:  { price: 84, period:'year', save:'Save $24', meta:'Billed as $84 once per year' },
    lifetime:{ price: 480, period:'once', save:'Best for heavy readers', meta:'One payment. Keep forever.' }
  };
  const active = plans[plan];

  return (
    <div className="ri-page-enter" style={{ background:'#F5EFE4', padding:`48px ${pad}px 96px` }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 56, alignItems:'start' }}>
        <div ref={heroRef}>
          <div style={{
            opacity: heroVis ? 1 : 0, transform: heroVis ? 'translateY(0)' : 'translateY(24px)',
            transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
          }}>
            <Eyebrow color={accent}>Membership · Join 24,318 readers</Eyebrow>
          </div>
          <h1 style={{
            font:'900 108px "DM Serif Display", Georgia, serif', margin:'8px 0 18px', letterSpacing:'-.03em', lineHeight:.85,
            opacity: heroVis ? 1 : 0,
            transform: heroVis ? 'translateY(0)' : 'translateY(32px)',
            transition: 'all .8s .1s cubic-bezier(.2,.8,.2,1)'
          }}>
            Nine dollars. One good habit.
          </h1>
          <p style={{
            font:'400 18px/1.55 "Space Grotesk", sans-serif', maxWidth: 520, margin:'0 0 28px',
            opacity: heroVis ? 1 : 0,
            transition: 'opacity .6s .3s ease'
          }}>
            We don't run ads. We don't sell your data. We don't write listicles. We write arguments about books, and we only stay alive because readers pay us for them.
          </p>
          <ul style={{ listStyle:'none', padding: 0, margin: '0 0 32px', display:'grid', gap: 12 }}>
            {[
              `Full access to ${stats.totalBooks.toLocaleString()} reviews + ${stats.totalSummaries.toLocaleString()} summaries`,
              "Three new long reviews every Tuesday morning",
              "Searchable archive back to Issue No. 001",
              "Audio versions of every review + summary",
              "Monthly members-only letter from the editor",
              "A paperback we chose for you, shipped twice a year"
            ].map((t, idx)=>(
              <li key={t} style={{
                display:'flex', gap: 14, alignItems:'baseline', borderBottom:'1px solid rgba(20,18,16,.2)', paddingBottom: 10, font:'400 16px "Space Grotesk", sans-serif',
                opacity: heroVis ? 1 : 0,
                transform: heroVis ? 'translateX(0)' : 'translateX(-16px)',
                transition: `all .5s ${idx * .06 + .3}s cubic-bezier(.2,.8,.2,1)`
              }}>
                <span style={{ font:'700 12px "JetBrains Mono", monospace', color: accent, flexShrink:0 }}>✓</span>{t}
              </li>
            ))}
          </ul>
        </div>

        <div style={{
          position:'sticky', top: 140, border:'1.5px solid #141210', padding: 32, background:'#F5EFE4',
          animation: 'ri-slideLeft .6s .3s cubic-bezier(.2,.8,.2,1) both',
          boxShadow: '0 16px 48px -16px rgba(20,18,16,0.12)'
        }}>
          <Eyebrow color={accent}>Pick a plan</Eyebrow>
          <div style={{ display:'grid', gap: 10, marginTop: 14 }}>
            {Object.entries(plans).map(([k,p])=>(
              <button key={k} onClick={()=>setPlan(k)} style={{
                textAlign:'left', padding: 18, border:`1.5px solid ${plan===k ? accent : '#141210'}`, cursor:'pointer',
                background: plan===k ? '#141210' : 'transparent',
                color: plan===k ? '#F5EFE4' : '#141210',
                transition: 'all .25s ease',
                borderRadius: 2,
                position: 'relative',
                overflow: 'hidden'
              }}>
                {plan===k && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:accent }}/>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap: 16 }}>
                  <div>
                    <div style={{ font:'700 14px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em' }}>{k}</div>
                    <div style={{ font:'400 12px "Space Grotesk", sans-serif', opacity:.8, marginTop: 4 }}>{p.meta}</div>
                  </div>
                  <div style={{ font:'900 40px "DM Serif Display", Georgia, serif', lineHeight:.9, transition:'transform .3s ease', transform: plan===k ? 'scale(1.05)' : 'scale(1)' }}>${p.price}</div>
                </div>
                {p.save && <div style={{ marginTop: 8, font:'600 10px "JetBrains Mono", monospace', color: accent, textTransform:'uppercase', letterSpacing:'.14em' }}>{p.save}</div>}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop:'1.5px solid #141210' }}>
            <div style={{ display:'flex', justifyContent:'space-between', font:'600 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em', marginBottom: 6 }}>
              <span>Today's total</span><span style={{ font:'900 24px "DM Serif Display", Georgia, serif' }}>${active.price}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em', opacity:.6 }}>
              <span>Then</span><span>{plan==='lifetime' ? 'Nothing. Ever.' : `$${active.price} / ${active.period}`}</span>
            </div>
            <button className="ri-btn-primary" style={{
              width:'100%', marginTop: 20, font:'700 14px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
              padding:'18px', background: accent, color:'#F5EFE4', border:0, cursor:'pointer', borderRadius: 999,
              boxShadow: `0 8px 24px -8px ${accent}44`
            }}>
              Start 14-day free trial
            </button>
            <div style={{ font:'400 11px "Space Grotesk", sans-serif', textAlign:'center', marginTop: 10, opacity:.7 }}>
              No card required for trial. Cancel any time from a single menu.
            </div>
          </div>
        </div>
      </div>

      <Footer accent={accent} pad={pad}/>
    </div>
  );
};

Object.assign(window, { Editors, Membership });
