const {
  AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, staticFile, Easing,
} = require('remotion');
const React = require('react');

// ─── Design tokens (matches site theme) ──────────────────────────
const ACCENT = '#E8432C';
const SERIF  = '"DM Serif Display", Georgia, serif';
const MONO   = '"JetBrains Mono", monospace';
const SANS   = '"Space Grotesk", sans-serif';

// ─── Utility: fade in/out a value ────────────────────────────────
function fadeIn(frame, start, duration, easing = Easing.ease) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing,
  });
}
function fadeOut(frame, end, duration) {
  return interpolate(frame, [end - duration, end], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
}

// ─── Cover tile (matches site's generated covers) ────────────────
const CoverTile = ({ cover, title, author, size = 260 }) => {
  const bg     = cover?.bg    || '#141210';
  const fg     = cover?.fg    || '#F5EFE4';
  const motif  = cover?.motif || 'bars';
  const h      = Math.round(size * 1.4);

  const motifs = {
    bars: (
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:12 }}>
        {[...Array(7)].map((_,i) => <div key={i} style={{ height:2, background:fg, opacity:0.18 }} />)}
      </div>
    ),
    grid: <div style={{ position:'absolute', inset:10, backgroundImage:`linear-gradient(${fg} 1px,transparent 1px),linear-gradient(90deg,${fg} 1px,transparent 1px)`, backgroundSize:'16px 16px', opacity:0.14 }} />,
    dot:  <div style={{ position:'absolute', inset:10, backgroundImage:`radial-gradient(${fg} 1.2px,transparent 1.6px)`, backgroundSize:'12px 12px', opacity:0.22 }} />,
    rule: <div style={{ position:'absolute', left:10, right:10, top:'50%', height:2, background:fg, opacity:0.35 }} />,
  };

  return (
    <div style={{ position:'relative', width:size, height:h, background:bg, color:fg, overflow:'hidden', borderRadius:4, boxShadow:'0 24px 60px -16px rgba(0,0,0,0.6)' }}>
      {motifs[motif]}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'30%', background:`linear-gradient(180deg,${fg}08,transparent)` }} />
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:20 }}>
        <div style={{ fontSize: Math.round(size * 0.075), fontFamily:SERIF, fontWeight:900, lineHeight:1.1, marginBottom:10, wordBreak:'break-word' }}>{title}</div>
        <div style={{ fontSize: Math.round(size * 0.042), fontFamily:MONO, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', opacity:0.7 }}>{author}</div>
      </div>
      <div style={{ position:'absolute', top:14, left:14, fontSize: Math.round(size * 0.04), fontFamily:MONO, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', background:'rgba(232,67,44,0.9)', color:'#fff', padding:'4px 8px' }}>RI</div>
    </div>
  );
};

// ─── Scene: Intro ────────────────────────────────────────────────
const IntroScene = ({ book, durationInFrames }) => {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg     = book.cover?.bg || '#141210';
  const fg     = book.cover?.fg || '#F5EFE4';

  const coverScale = spring({ frame, fps, config: { damping: 18, stiffness: 80 } });
  const titleOp    = fadeIn(frame, fps * 1.5, fps * 0.8);
  const barWidth   = interpolate(frame, [fps * 2, fps * 2.8], [0, 100], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });

  return (
    <AbsoluteFill style={{ background: bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:40 }}>
      <div style={{ transform:`scale(${coverScale})`, transformOrigin:'center' }}>
        <CoverTile cover={book.cover} title={book.title} author={book.author} size={280} />
      </div>
      <div style={{ opacity: titleOp, textAlign:'center', color: fg, maxWidth: 700 }}>
        <div style={{ height: 3, background: ACCENT, width:`${barWidth}%`, margin:'0 auto 20px', transition:'width .1s' }} />
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight:600, letterSpacing:'.15em', textTransform:'uppercase', opacity:.6, marginBottom: 8 }}>
          {book.genre} · {book.year || ''}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 42, fontWeight: 900, lineHeight: 1.1 }}>{book.title}</div>
        <div style={{ fontFamily: MONO, fontSize: 16, marginTop: 12, opacity:.65, letterSpacing:'.06em' }}>by {book.author}</div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Content (hook / body / verdict) ──────────────────────
const ContentScene = ({ scene, book, index }) => {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg     = book.cover?.bg || '#141210';
  const fg     = book.cover?.fg || '#F5EFE4';

  const SCENE_LABELS = { hook:'Why This Book', body:'Key Ideas', verdict:'The Verdict' };
  const label = SCENE_LABELS[scene.id] || scene.id;

  const op    = fadeIn(frame, 0, fps * 0.5);
  const slideY = interpolate(frame, [0, fps * 0.5], [30, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic) });

  // Split body text into visual paragraphs (split on ". " for rhythm)
  const paragraphs = scene.narration
    .split(/(?<=\.) (?=[A-Z])/)
    .reduce((acc, sentence, i) => {
      const bucket = Math.floor(i / 2);
      if (!acc[bucket]) acc[bucket] = '';
      acc[bucket] += (acc[bucket] ? ' ' : '') + sentence;
      return acc;
    }, []);

  const activePara = Math.min(
    Math.floor(interpolate(frame, [fps * 0.5, fps * (scene.estimatedSeconds - 1)], [0, paragraphs.length], { extrapolateLeft:'clamp', extrapolateRight:'clamp' })),
    paragraphs.length - 1
  );

  return (
    <AbsoluteFill style={{ background: bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 120px' }}>
      {/* Left accent stripe */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:6, background: ACCENT, opacity:.9 }} />

      {/* Small cover in corner */}
      <div style={{ position:'absolute', bottom: 48, right: 60, opacity:.35 }}>
        <CoverTile cover={book.cover} title={book.title} author={book.author} size={90} />
      </div>

      <div style={{ opacity:op, transform:`translateY(${slideY}px)`, width:'100%', maxWidth:900 }}>
        <div style={{ fontFamily:MONO, fontSize:13, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:ACCENT, marginBottom:24 }}>
          {label}
        </div>

        {paragraphs.map((para, i) => (
          <div key={i} style={{
            fontFamily: SERIF, fontSize: 36, lineHeight:1.45, color: fg,
            marginBottom: 24,
            opacity: i === activePara ? 1 : (i < activePara ? 0.3 : 0.15),
            transition: 'opacity .3s',
          }}>
            {para}
          </div>
        ))}
      </div>

      {/* Progress dots */}
      <div style={{ position:'absolute', bottom:36, left:'50%', transform:'translateX(-50%)', display:'flex', gap:8 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:8, height:8, borderRadius:'50%', background: i === index ? ACCENT : fg, opacity: i === index ? 1 : 0.2 }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Verdict ───────────────────────────────────────────────
const VerdictScene = ({ scene, book }) => {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg     = book.cover?.bg || '#141210';
  const fg     = book.cover?.fg || '#F5EFE4';

  const stars  = Math.round(book.rating || 4);
  const op     = fadeIn(frame, 0, fps * 0.5);
  const scaleV = spring({ frame: Math.max(0, frame - fps * 0.3), fps, config: { damping: 14, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ background: bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'80px 120px' }}>
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:6, background: ACCENT }} />

      <div style={{ opacity:op, textAlign:'center', maxWidth:800 }}>
        <div style={{ fontFamily:MONO, fontSize:13, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:ACCENT, marginBottom:28 }}>
          The Verdict
        </div>

        {/* Stars */}
        <div style={{ transform:`scale(${scaleV})`, transformOrigin:'center', marginBottom:32 }}>
          <div style={{ display:'flex', justifyContent:'center', gap:12 }}>
            {[...Array(5)].map((_,i) => (
              <div key={i} style={{ fontSize:42, color: i < stars ? ACCENT : fg, opacity: i < stars ? 1 : 0.2 }}>★</div>
            ))}
          </div>
          <div style={{ fontFamily:MONO, fontSize:16, color:fg, opacity:.5, marginTop:8 }}>{book.rating || 4}/5</div>
        </div>

        <div style={{ fontFamily:SERIF, fontSize:30, lineHeight:1.5, color:fg }}>
          {scene.narration}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene: Outro ────────────────────────────────────────────────
const OutroScene = ({ scene, book }) => {
  const frame  = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg     = book.cover?.bg || '#141210';
  const fg     = book.cover?.fg || '#F5EFE4';

  const op      = fadeIn(frame, 0, fps * 0.6);
  const urlSlide = interpolate(frame, [fps * 0.8, fps * 1.4], [20, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });

  return (
    <AbsoluteFill style={{ background: bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:32 }}>
      <div style={{ opacity:op, textAlign:'center' }}>
        <div style={{ fontFamily:SERIF, fontSize:38, color:fg, marginBottom:16 }}>Read the Full Review</div>
        <div style={{ transform:`translateY(${urlSlide}px)`, fontFamily:MONO, fontSize:20, fontWeight:700, color:ACCENT, letterSpacing:'.06em' }}>
          reviewerinsight.com
        </div>
        <div style={{ marginTop:24, fontFamily:SANS, fontSize:16, color:fg, opacity:.55 }}>
          {scene.narration.replace('reviewerinsight.com', '').trim()}
        </div>
      </div>

      <div style={{ opacity: op * 0.4 }}>
        <CoverTile cover={book.cover} title={book.title} author={book.author} size={140} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Main composition ────────────────────────────────────────────
const BookSummary = ({ book, scenes, audioFile }) => {
  const { fps } = useVideoConfig();

  // Build scene timeline: each scene starts where the previous one ended
  let cursor = 0;
  const timeline = scenes.map(scene => {
    const startFrame = cursor;
    const durationInFrames = Math.max(fps * 3, Math.round(scene.estimatedSeconds * fps));
    cursor += durationInFrames;
    return { ...scene, startFrame, durationInFrames };
  });

  const contentScenes = timeline.filter(s => ['hook','body'].includes(s.id));

  return (
    <AbsoluteFill>
      {audioFile && <Audio src={staticFile(audioFile)} />}

      {timeline.map(scene => {
        const idx = contentScenes.findIndex(s => s.id === scene.id);

        return (
          <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
            {scene.id === 'intro'   && <IntroScene   book={book} durationInFrames={scene.durationInFrames} />}
            {scene.id === 'hook'    && <ContentScene scene={scene} book={book} index={1} />}
            {scene.id === 'body'    && <ContentScene scene={scene} book={book} index={2} />}
            {scene.id === 'verdict' && <VerdictScene scene={scene} book={book} />}
            {scene.id === 'outro'   && <OutroScene   scene={scene} book={book} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

module.exports = { BookSummary };
