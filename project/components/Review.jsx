// Review detail page — long-form magazine layout with enhanced animations
const Review = ({ bookId, initialTab, setRoute, accent, density }) => {
  const BOOKS = window.BOOKS;
  const [tab, setTab] = React.useState(initialTab || 'review');
  const [saved, setSaved] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [tabKey, setTabKey] = React.useState(0);
  const pad = density === 'compact' ? 20 : 32;

  const [commRef, commVis] = useReveal();
  const [relRef, relVis] = useReveal();

  // Fetch book from API (works with MongoDB _id strings)
  const { resolved: apiBook } = useApi(
    () => ApiClient.getBook(bookId),
    null,
    [bookId]
  );

  // Use API book or fall back to static data
  const staticBook = BOOKS.find(b => b.id === bookId);
  const book = apiBook || staticBook || BOOKS[0];

  // Use book's own review if it has one, otherwise fall back to shared REVIEW_BODY
  const hasReview = book.review && book.review.headline;
  const RB = hasReview ? book.review : window.REVIEW_BODY;

  React.useEffect(()=>{
    const onScroll = () => {
      const el = document.getElementById('ri-article');
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      const p = Math.max(0, Math.min(1, (vh - top) / (h + vh - 200)));
      setProgress(p);
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return ()=>window.removeEventListener('scroll', onScroll);
  }, [bookId]);

  const handleTab = (t) => { setTab(t); setTabKey(k => k+1); };

  // Fetch related books from API (same genre)
  const { resolved: relatedData } = useApi(
    () => book.genre ? ApiClient.getBooks({ genre: book.genre, limit: 5 }) : Promise.resolve(null),
    null,
    [book.genre]
  );

  const relatedFromApi = (relatedData?.books || []).filter(b => b.id !== book.id).slice(0, 4);
  const relatedFromStatic = BOOKS.filter(b => b.id !== book.id && b.genre === book.genre).slice(0, 4);
  const related = relatedFromApi.length > 0 ? relatedFromApi : relatedFromStatic;
  if (related.length < 4) related.push(...BOOKS.filter(b => b.id !== book.id && !related.find(r => r.id === b.id)).slice(0, 4 - related.length));

  return (
    <div className="ri-page-enter" style={{ background:'#F5EFE4' }}>
      {/* Enhanced progress bar with gradient */}
      <div style={{ position:'sticky', top: 0, height: 3, zIndex: 15, background:'transparent', marginTop: -3 }}>
        <div style={{
          height:'100%',
          background: `linear-gradient(90deg, ${accent}, ${accent}cc, ${accent})`,
          width: `${progress*100}%`,
          transition:'width .15s ease-out',
          boxShadow: progress > 0.02 ? `0 0 12px ${accent}44` : 'none'
        }}/>
      </div>

      {/* HERO — poster with entrance animation */}
      <section style={{ padding:`40px ${pad}px 24px`, borderBottom:'1.5px solid #141210' }}>
        <div style={{ font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', display:'flex', gap: 10, alignItems:'center', marginBottom: 16, opacity:.75, animation:'ri-fadeIn .4s ease both' }}>
          <button onClick={()=>setRoute({name:'home'})} className="ri-link" style={{ all:'unset', cursor:'pointer', color:'#141210' }}>Home</button>
          <span>/</span>
          <button onClick={()=>setRoute({name:'browse'})} className="ri-link" style={{ all:'unset', cursor:'pointer', color:'#141210' }}>Browse</button>
          <span>/</span>
          <span>{book.genre}</span>
          <span>/</span>
          <span style={{ color: accent }}>{book.title}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap: 56, alignItems:'center' }}>
          <div style={{ position:'relative', display:'flex', justifyContent:'center', alignItems:'center', minHeight: 560, animation:'ri-scaleIn .7s .1s cubic-bezier(.2,.8,.2,1) both' }}>
            <Cover book={book} size="xl"/>
            <div style={{ position:'absolute', top: 8, right: 30 }}>
              <Seal color={accent} rotate={-8}>Rating · {book.rating.toFixed(1)} / 5</Seal>
            </div>
          </div>
          <div>
            <div style={{ animation:'ri-fadeUp .5s .15s ease both' }}>
              <Eyebrow color={accent}>{book.genre} · {book.issue || 'Issue No. 048'} · Reviewed by {book.editor || 'Mira Okafor'}</Eyebrow>
            </div>
            <h1 style={{ font:'900 88px/0.98 "DM Serif Display", Georgia, serif', margin:'10px 0 18px', letterSpacing:'-.02em', textWrap:'balance', paddingBottom: 4, animation:'ri-hero-text .8s .25s cubic-bezier(.2,.8,.2,1) both' }}>
              {book.title}
            </h1>
            <div style={{ font:'500 22px "DM Serif Display", Georgia, serif', fontStyle:'italic', opacity:.8, marginBottom: 22, animation:'ri-fadeUp .5s .35s ease both' }}>by {book.author}</div>

            <div style={{ display:'flex', alignItems:'center', gap: 28, flexWrap:'wrap', padding:'16px 0', borderTop:'1.5px solid #141210', borderBottom:'1.5px solid #141210', marginBottom: 22, animation:'ri-fadeUp .5s .4s ease both' }}>
              <Stars value={book.rating} size={16}/>
              <MetaPill label="Year" value={book.year}/>
              <MetaPill label="Pages" value={book.pages}/>
              <MetaPill label="Read" value={book.readTime}/>
              <MetaPill label="Summary" value="4 min"/>
            </div>

            {/* Enhanced tabs */}
            <div style={{ display:'flex', gap: 0, marginBottom: 22, border:'1.5px solid #141210', width:'fit-content', animation:'ri-fadeUp .5s .45s ease both' }}>
              {[
                { id:'review', label:'The Review', note:'14 min' },
                { id:'summary', label:'4-min Summary', note:'TL;DR' },
                { id:'takeaways', label:'Key Takeaways', note:'3 beats' },
                { id:'chapters', label:'Chapters', note:'guide' }
              ].map(t => (
                <button key={t.id} onClick={()=>handleTab(t.id)} style={{
                  font:'700 13px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.12em',
                  padding:'14px 18px', border:0, cursor:'pointer',
                  background: tab===t.id ? '#141210' : 'transparent',
                  color: tab===t.id ? '#F5EFE4' : '#141210',
                  borderRight: '1.5px solid #141210',
                  transition: 'all .25s ease',
                  position: 'relative'
                }}>
                  {t.label} <span style={{ opacity:.5, marginLeft: 8 }}>· {t.note}</span>
                  {tab===t.id && <div style={{ position:'absolute', bottom:-1.5, left:0, right:0, height:2, background:accent }}/>}
                </button>
              ))}
            </div>

            <div style={{ display:'flex', gap: 10, alignItems:'center', flexWrap:'wrap', animation:'ri-fadeUp .5s .5s ease both' }}>
              <button onClick={()=>setSaved(!saved)} className={saved ? 'ri-btn-primary' : 'ri-btn-ghost'} style={{
                font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
                padding:'12px 18px', border:'1.5px solid #141210', cursor:'pointer', borderRadius: 999,
                background: saved ? '#141210' : 'transparent', color: saved ? '#F5EFE4' : '#141210'
              }}>{saved ? '✓ Saved to shelf' : '+ Save to shelf'}</button>
              <button className="ri-btn-ghost" style={{
                font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
                padding:'12px 18px', border:'1.5px solid #141210', cursor:'pointer', borderRadius: 999, background:'transparent'
              }}>Listen · 12 min</button>
              <button className="ri-btn-ghost" style={{
                font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
                padding:'12px 18px', border:'1.5px solid #141210', cursor:'pointer', borderRadius: 999, background:'transparent'
              }}>Share</button>
            </div>
          </div>
        </div>
      </section>

      <div id="ri-article" key={tabKey} style={{ animation:'ri-fadeIn .4s ease both' }}>
        {tab === 'review' && <ReviewBody book={book} RB={RB} accent={accent} pad={pad}/>}
        {tab === 'summary' && <SummaryBody book={book} RB={RB} accent={accent} pad={pad}/>}
        {tab === 'takeaways' && <TakeawaysBody book={book} accent={accent} pad={pad}/>}
        {tab === 'chapters' && <ChaptersBody book={book} accent={accent} pad={pad}/>}
      </div>

      {/* COMMENTS / community */}
      <section ref={commRef} style={{ padding:`56px ${pad}px`, borderTop:'1.5px solid #141210', borderBottom:'1.5px solid #141210' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap: 48 }}>
          <div style={{
            opacity: commVis ? 1 : 0,
            transform: commVis ? 'translateX(0)' : 'translateX(-24px)',
            transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
          }}>
            <Eyebrow color={accent}>Member letters</Eyebrow>
            <h2 style={{ font:'900 54px "DM Serif Display", Georgia, serif', margin:'6px 0 12px', letterSpacing:'-.02em', lineHeight:.95 }}>The argument continues.</h2>
            <p style={{ font:'400 15px/1.55 "Space Grotesk", sans-serif', maxWidth: 320, opacity:.85 }}>
              Members can write back. We read every letter. The ten we find most interesting get published in next week's issue.
            </p>
            <textarea placeholder="Write a letter…" rows={5} style={{ display:'block', width:'100%', marginTop: 16, padding: 14, border:'1.5px solid #141210', background:'transparent', font:'400 14px/1.5 "Space Grotesk", sans-serif', color:'#141210', outline:'none', resize:'vertical', transition:'border-color .2s ease, box-shadow .2s ease', borderRadius:0 }}
              onFocus={(e)=>{ e.target.style.borderColor=accent; e.target.style.boxShadow=`0 0 0 3px ${accent}22`; }}
              onBlur={(e)=>{ e.target.style.borderColor='#141210'; e.target.style.boxShadow='none'; }}
            />
            <button className="ri-btn-primary" style={{ marginTop: 12, font:'700 12px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', padding:'12px 18px', background:'#141210', color:'#F5EFE4', border:0, borderRadius: 999, cursor:'pointer' }}>Submit letter</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 20 }}>
            {[
              { name:'Teodora V.', time:'2 days ago', text:"The eighty-page failure is the point. I kept waiting for Bellweather to cheat it and she never did. I'm going to re-read it on purpose.", color:'#1E3A8A' },
              { name:'Arun P.', time:'3 days ago', text:"I'll politely push back on the complaint about the last chapter. The forgiveness is earned by the notebook itself — Ines has been practicing mercy for 300 pages.", color: accent },
              { name:'Soraya B.', time:'5 days ago', text:"Underrated aspect: the hospital as a co-protagonist. I kept thinking of the night halls as characters with lines.", color:'#E4A72B' },
            ].map((c,i)=>(
              <div key={i} style={{
                border:'1.5px solid #141210', padding: 20,
                opacity: commVis ? 1 : 0,
                transform: commVis ? 'translateY(0)' : 'translateY(20px)',
                transition: `all .5s ${i * .1 + .15}s cubic-bezier(.2,.8,.2,1)`
              }}>
                <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, background: c.color, color:'#F5EFE4', display:'flex', alignItems:'center', justifyContent:'center', font:'700 13px "JetBrains Mono", monospace', borderRadius: 4 }}>{c.name[0]}</div>
                  <div>
                    <div style={{ font:'700 14px "DM Serif Display", Georgia, serif' }}>{c.name}</div>
                    <div style={{ font:'600 10px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', opacity:.6 }}>{c.time} · Member</div>
                  </div>
                </div>
                <p style={{ font:'400 15px/1.5 "Space Grotesk", sans-serif', margin: 0 }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RELATED with staggered reveal */}
      <section ref={relRef} style={{ padding:`56px ${pad}px`, borderBottom:'1.5px solid #141210' }}>
        <div style={{
          display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 28,
          opacity: relVis ? 1 : 0, transform: relVis ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
        }}>
          <h2 style={{ font:'900 54px "DM Serif Display", Georgia, serif', margin: 0, letterSpacing:'-.02em' }}>If you liked this.</h2>
          <Eyebrow>Four more in {book.genre}</Eyebrow>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 32 }}>
          {related.map((b, idx) => (
            <div key={b.id} onClick={()=>{ setRoute({name:'review', id: b.id}); window.scrollTo(0,0); }} style={{
              cursor:'pointer',
              opacity: relVis ? 1 : 0,
              transform: relVis ? 'translateY(0)' : 'translateY(28px)',
              transition: `all .5s ${idx * .1 + .15}s cubic-bezier(.2,.8,.2,1)`
            }} className="ri-card">
              <div style={{ display:'flex', justifyContent:'center' }}><Cover book={b} size="md"/></div>
              <Eyebrow color={accent} style={{ marginTop: 14 }}>{b.genre}</Eyebrow>
              <div style={{ font:'700 20px/1.1 "DM Serif Display", Georgia, serif', margin:'4px 0 2px' }}>{b.title}</div>
              <div style={{ font:'400 13px "Space Grotesk", sans-serif', opacity:.7, marginBottom: 6 }}>{b.author}</div>
              <Stars value={b.rating} size={12}/>
            </div>
          ))}
        </div>
      </section>

      <Footer accent={accent} pad={pad}/>
    </div>
  );
};

const MetaPill = ({ label, value }) => (
  <div>
    <div style={{ font:'600 10px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em', opacity:.6 }}>{label}</div>
    <div style={{ font:'700 20px "DM Serif Display", Georgia, serif' }}>{value}</div>
  </div>
);

const ReviewBody = ({ book, RB, accent, pad }) => {
  const [ref, vis] = useReveal({ threshold: 0.05 });
  return (
    <article ref={ref} style={{ padding:`72px ${pad}px`, display:'grid', gridTemplateColumns:'200px 1fr 260px', gap: 48 }}>
      <aside style={{
        position:'sticky', top: 120, alignSelf:'start', font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.14em',
        opacity: vis ? 1 : 0, transform: vis ? 'translateX(0)' : 'translateX(-20px)',
        transition: 'all .6s cubic-bezier(.2,.8,.2,1)'
      }}>
        <div style={{ opacity:.6, marginBottom: 10 }}>In this review</div>
        <div style={{ display:'flex', flexDirection:'column', gap: 8, borderLeft:`2px solid ${accent}`, paddingLeft: 12 }}>
          <span style={{ cursor:'pointer', transition:'color .2s ease' }}>The setup</span>
          <span style={{ cursor:'pointer', transition:'color .2s ease' }}>The notebook</span>
          <span style={{ cursor:'pointer', transition:'color .2s ease' }}>The middle section</span>
          <span style={{ cursor:'pointer', transition:'color .2s ease' }}>A small complaint</span>
          <span style={{ cursor:'pointer', transition:'color .2s ease' }}>The verdict</span>
        </div>
      </aside>

      <div style={{ maxWidth: 680, margin:'0 auto' }}>
        <h2 style={{ font:'900 56px/1 "DM Serif Display", Georgia, serif', margin:'0 0 20px', letterSpacing:'-.02em', textWrap:'balance' }}>
          {RB.headline}
        </h2>
        <p style={{ font:'500 22px/1.45 "DM Serif Display", Georgia, serif', fontStyle:'italic', color:'#141210', opacity:.85, margin:'0 0 32px', textWrap:'balance' }}>
          {RB.stand}
        </p>
        <div style={{ font:'400 18px/1.7 "Space Grotesk", sans-serif', color:'#141210' }}>
          <p style={{ marginTop: 0 }}>
            <span style={{ float:'left', font:'900 120px "DM Serif Display", Georgia, serif', lineHeight:.85, margin:'6px 14px -6px 0', color: accent, textShadow: `2px 2px 0px ${accent}22` }}>T</span>
            {RB.paragraphs[0].slice(1)}
          </p>
          <p>{RB.paragraphs[1]}</p>
          <figure style={{ margin:'40px -40px', padding:'32px 40px', borderTop:`2px solid ${accent}`, borderBottom:'1.5px solid #141210', background:'#141210', color:'#F5EFE4', position:'relative', overflow:'hidden' }}>
            {/* Ambient glow in pull quote */}
            <div style={{ position:'absolute', top:'-50%', right:'-20%', width:'50%', height:'200%', background:`radial-gradient(ellipse, ${accent}15, transparent 70%)`, pointerEvents:'none' }}/>
            <blockquote style={{ font:'500 40px/1.15 "DM Serif Display", Georgia, serif', margin: 0, textWrap:'balance', letterSpacing:'-.01em', position:'relative' }}>
              <span style={{ color: accent, font:'900 60px "DM Serif Display", Georgia, serif', textShadow: `0 0 40px ${accent}33` }}>"</span>
              {RB.pullQuote}
            </blockquote>
            <figcaption style={{ font:'600 11px "JetBrains Mono", monospace', textTransform:'uppercase', letterSpacing:'.16em', opacity:.7, marginTop: 18, position:'relative' }}>
              — {book.editor || 'Mira Okafor'}, Editor
            </figcaption>
          </figure>
          <p>{RB.paragraphs[2]}</p>
          <p>{RB.paragraphs[3]}</p>
          <p>{RB.paragraphs[4]}</p>

          <div style={{ marginTop: 48, padding: 28, border:`2px solid ${accent}`, background:'#F5EFE4', position:'relative' }}>
            <div style={{ position:'absolute', top:-12, left:28, background:'#F5EFE4', padding:'0 12px' }}>
              <Eyebrow color={accent}>Reviewer Insight's verdict</Eyebrow>
            </div>
            <div style={{ display:'flex', gap: 24, alignItems:'center', marginTop: 14, flexWrap:'wrap' }}>
              <div style={{ font:'900 84px "DM Serif Display", Georgia, serif', lineHeight:.9, letterSpacing:'-.02em', color: accent }}>{book.rating.toFixed(1)}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Stars value={book.rating} size={18}/>
                <div style={{ font:'400 15px/1.45 "Space Grotesk", sans-serif', marginTop: 10 }}>
                  Major, quiet, willing to be slow. The right book for a reader tired of books that shout. One of the three best novels of 2025.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside style={{
        position:'sticky', top: 120, alignSelf:'start',
        opacity: vis ? 1 : 0, transform: vis ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all .6s .2s cubic-bezier(.2,.8,.2,1)'
      }}>
        <Eyebrow color={accent}>Also from this editor</Eyebrow>
        <div style={{ marginTop: 12, display:'flex', flexDirection:'column', gap: 14 }}>
          {window.BOOKS.filter(b => b.editor === (book.editor || 'Mira Okafor') && b.id !== book.id).slice(0,3).map(b=>(
            <div key={b.id} onClick={()=>{ setRoute({name:'review', id: b.id}); window.scrollTo(0,0); }} style={{ display:'flex', gap: 10, cursor:'pointer', transition:'transform .2s ease' }} className="ri-card">
              <Cover book={b} size="xs"/>
              <div>
                <div style={{ font:'700 14px/1.15 "DM Serif Display", Georgia, serif' }}>{b.title}</div>
                <div style={{ font:'400 11px "Space Grotesk", sans-serif', opacity:.7 }}>{b.author}</div>
                <div style={{ marginTop: 4 }}><Stars value={b.rating} size={10}/></div>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </article>
  );
};

const SummaryBody = ({ book, RB, accent, pad }) => {
  const [ref, vis] = useReveal({ threshold: 0.05 });
  return (
    <article ref={ref} style={{ padding:`72px ${pad}px`, maxWidth: 920, margin:'0 auto' }}>
      <Eyebrow color={accent}>4-minute summary · by {book.editor || 'Mira Okafor'}</Eyebrow>
      <h2 style={{ font:'900 56px "DM Serif Display", Georgia, serif', margin:'10px 0 20px', letterSpacing:'-.02em', lineHeight:.95, textWrap:'balance' }}>
        If you only have four minutes.
      </h2>
      <p style={{ font:'500 22px/1.5 "DM Serif Display", Georgia, serif', fontStyle:'italic', opacity:.85, margin:'0 0 36px', textWrap:'balance' }}>
        {RB.stand}
      </p>

      <ol style={{ listStyle:'none', padding: 0, margin: 0, counterReset:'ri' }}>
        {RB.summaryBullets.map((t, i)=>(
          <li key={i} style={{
            display:'grid', gridTemplateColumns:'80px 1fr', gap: 20, padding:'22px 0',
            borderTop: i===0 ? '1.5px solid #141210' : '1px solid rgba(20,18,16,.18)',
            borderBottom: i===RB.summaryBullets.length-1 ? '1.5px solid #141210' : 'none',
            opacity: vis ? 1 : 0,
            transform: vis ? 'translateY(0)' : 'translateY(16px)',
            transition: `all .5s ${i * .06 + .1}s cubic-bezier(.2,.8,.2,1)`
          }}>
            <div style={{ font:'900 44px "DM Serif Display", Georgia, serif', color: accent, lineHeight:.9, letterSpacing:'-.02em' }}>
              {String(i+1).padStart(2,'0')}
            </div>
            <div style={{ font:'400 18px/1.55 "Space Grotesk", sans-serif' }}>{t}</div>
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 40, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 20 }}>
        <div style={{ padding: 24, background:'#141210', color:'#F5EFE4', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:'-50%', right:'-30%', width:'60%', height:'200%', background:`radial-gradient(ellipse, ${accent}10, transparent 70%)`, pointerEvents:'none' }}/>
          <Eyebrow color={accent}>Should you read the whole book?</Eyebrow>
          <div style={{ font:'700 32px/1.1 "DM Serif Display", Georgia, serif', margin:'8px 0 6px', position:'relative' }}>Yes — with no hurry.</div>
          <div style={{ font:'400 14px/1.5 "Space Grotesk", sans-serif', opacity:.85, position:'relative' }}>Bellweather's rhythm is the experience. The summary tells you what happens; the book tells you how it feels when it does.</div>
        </div>
        <div style={{ padding: 24, border:'1.5px solid #141210' }}>
          <Eyebrow color={accent}>Pair with</Eyebrow>
          <div style={{ font:'700 18px "DM Serif Display", Georgia, serif', margin:'8px 0 4px' }}>Slow Weather — Ingrid Voss</div>
          <div style={{ font:'400 13px "Space Grotesk", sans-serif', opacity:.7 }}>For another patient writer who refuses to rush the reader.</div>
        </div>
      </div>
    </article>
  );
};

const TakeawaysBody = ({ book, accent, pad }) => {
  const [ref, vis] = useReveal({ threshold: 0.05 });
  return (
    <article ref={ref} style={{ padding:`72px ${pad}px`, maxWidth: 920, margin:'0 auto' }}>
      <Eyebrow color={accent}>Three beats · Key takeaways</Eyebrow>
      <h2 style={{ font:'900 64px "DM Serif Display", Georgia, serif', margin:'10px 0 28px', letterSpacing:'-.02em', lineHeight:.95 }}>What the book is arguing.</h2>
      <div style={{ display:'grid', gap: 28 }}>
        {(book.takeaways || []).map((t, i)=>(
          <div key={i} style={{
            display:'grid', gridTemplateColumns:'160px 1fr', alignItems:'start', gap: 28, borderTop:`2px solid ${[accent,'#1E3A8A','#E4A72B'][i%3]}`, paddingTop: 28,
            opacity: vis ? 1 : 0,
            transform: vis ? 'translateY(0)' : 'translateY(24px)',
            transition: `all .6s ${i * .15 + .1}s cubic-bezier(.2,.8,.2,1)`
          }}>
            <div style={{
              font:'900 110px "DM Serif Display", Georgia, serif', color: [accent,'#1E3A8A','#E4A72B'][i%3], lineHeight:.8, letterSpacing:'-.03em',
              textShadow: `3px 3px 0px ${[accent,'#1E3A8A','#E4A72B'][i%3]}15`
            }}>{i+1}</div>
            <div>
              <div style={{ font:'700 32px "DM Serif Display", Georgia, serif', letterSpacing:'-.01em', marginBottom: 10 }}>{t}</div>
              <div style={{ font:'400 16px/1.55 "Space Grotesk", sans-serif', maxWidth: 620, opacity:.85 }}>
                One of the book's organizing concerns. Our editor returns to this idea in the full review; it is the reason the novel rewards a second reading.
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
};

const ChaptersBody = ({ book, accent, pad }) => {
  const [ref, vis] = useReveal({ threshold: 0.05 });
  const chapters = book.chapterSummaries || [];
  const [expanded, setExpanded] = React.useState(null);

  if (chapters.length === 0) {
    return (
      <article style={{ padding:`72px ${pad}px`, maxWidth: 920, margin:'0 auto', textAlign:'center' }}>
        <Eyebrow color={accent}>Chapter guide</Eyebrow>
        <h2 style={{ font:'900 48px "DM Serif Display", Georgia, serif', margin:'10px 0 16px', letterSpacing:'-.02em', lineHeight:.95 }}>
          Coming soon.
        </h2>
        <p style={{ font:'400 16px/1.55 "Space Grotesk", sans-serif', opacity:.7, maxWidth: 480, margin:'0 auto' }}>
          Chapter-by-chapter summaries for this book are being generated. Check back shortly.
        </p>
      </article>
    );
  }

  return (
    <article ref={ref} style={{ padding:`72px ${pad}px`, maxWidth: 920, margin:'0 auto' }}>
      <Eyebrow color={accent}>Chapter-by-chapter guide · {chapters.length} sections</Eyebrow>
      <h2 style={{ font:'900 56px "DM Serif Display", Georgia, serif', margin:'10px 0 12px', letterSpacing:'-.02em', lineHeight:.95, textWrap:'balance' }}>
        The architecture of the book.
      </h2>
      <p style={{ font:'400 14px/1.5 "Space Grotesk", sans-serif', opacity:.5, margin:'0 0 32px', maxWidth: 600 }}>
        AI-generated overview based on available book information. Not a verbatim reproduction of the text.
      </p>

      <div style={{ display:'flex', flexDirection:'column', gap: 0 }}>
        {chapters.map((ch, i) => {
          const isOpen = expanded === i;
          return (
            <div key={i}
              onClick={() => setExpanded(isOpen ? null : i)}
              style={{
                padding: '20px 0',
                borderTop: i === 0 ? '1.5px solid #141210' : '1px solid rgba(20,18,16,.18)',
                borderBottom: i === chapters.length - 1 ? '1.5px solid #141210' : 'none',
                cursor: 'pointer',
                opacity: vis ? 1 : 0,
                transform: vis ? 'translateY(0)' : 'translateY(16px)',
                transition: `all .5s ${i * .04 + .1}s cubic-bezier(.2,.8,.2,1)`
              }}
            >
              <div style={{ display:'grid', gridTemplateColumns:'60px 1fr auto', gap: 16, alignItems:'center' }}>
                <div style={{
                  font:'900 36px "DM Serif Display", Georgia, serif',
                  color: accent, lineHeight:.9, letterSpacing:'-.02em'
                }}>
                  {String(ch.chapter).padStart(2, '0')}
                </div>
                <div>
                  <div style={{ font:'700 20px/1.15 "DM Serif Display", Georgia, serif' }}>
                    {ch.title}
                  </div>
                  {ch.themes && ch.themes.length > 0 && (
                    <div style={{ display:'flex', gap: 8, marginTop: 6, flexWrap:'wrap' }}>
                      {ch.themes.map((theme, ti) => (
                        <span key={ti} style={{
                          font:'600 10px "JetBrains Mono", monospace',
                          textTransform:'uppercase', letterSpacing:'.1em',
                          padding:'3px 8px', border:'1px solid rgba(20,18,16,.25)',
                          borderRadius: 999, opacity:.7
                        }}>{theme}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{
                  font:'600 18px "JetBrains Mono", monospace',
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'transform .25s ease',
                  opacity: .5
                }}>+</div>
              </div>

              {isOpen && (
                <div style={{
                  marginTop: 14, marginLeft: 76,
                  font:'400 16px/1.6 "Space Grotesk", sans-serif',
                  maxWidth: 640, opacity:.85,
                  animation: 'ri-fadeIn .3s ease both'
                }}>
                  {ch.summary}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
};

Object.assign(window, { Review });
