const {
  AbsoluteFill, Audio, Sequence, useCurrentFrame, useVideoConfig,
  interpolate, spring, staticFile, Easing, random, interpolateColors,
} = require('remotion');
const React = require('react');

const ACCENT = '#E8432C';
const SERIF  = '"DM Serif Display", Georgia, serif';
const MONO   = '"JetBrains Mono", monospace';
const TRANSITION_FRAMES = 12; // cross-fade overlap between scenes

function fadeIn(frame, start, dur, easing = Easing.ease) {
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing,
  });
}

// ─── Word-by-word text reveal ─────────────────────────────────
const WordReveal = ({ text, startFrame, wps = 3, fontSize, color, center = false }) => {
  const frame      = useCurrentFrame();
  const { fps }    = useVideoConfig();
  const words      = text.split(' ');
  const spf        = fps / wps;
  const fadeDur    = fps * 0.2;

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '0 0',
      justifyContent: center ? 'center' : 'flex-start',
    }}>
      {words.map((word, i) => {
        const ws = startFrame + i * spf;
        const op = interpolate(frame, [ws, ws + fadeDur], [0, 1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
        const y  = interpolate(frame, [ws, ws + fadeDur], [18, 0], {
          extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic),
        });
        return (
          <span key={i} style={{
            display: 'inline-block',
            opacity: op,
            transform: `translateY(${y}px)`,
            fontFamily: SERIF,
            fontSize,
            fontWeight: 700,
            color,
            lineHeight: 1.45,
            marginRight: i < words.length - 1 ? '0.26em' : 0,
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ─── Floating micro-particles ─────────────────────────────────
const Particles = ({ count = 24, fg }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
      {[...Array(count)].map((_, i) => {
        const x   = random('x' + i) * 100;
        const y   = random('y' + i) * 100;
        const sz  = random('s' + i) * 2.5 + 0.5;
        const spd = random('v' + i) * 0.4 + 0.1;
        const ph  = random('f' + i) * Math.PI * 2;
        const dy  = Math.sin(frame * spd * 0.035 + ph) * 14;
        const dx  = Math.cos(frame * spd * 0.025 + ph) * 7;
        const op  = random('o' + i) * 0.18 + 0.03;
        return (
          <div key={i} style={{
            position:'absolute', left:`${x}%`, top:`${y}%`,
            transform:`translate(${dx}px,${dy}px)`,
            width:sz, height:sz, borderRadius:'50%',
            background:fg, opacity:op,
          }} />
        );
      })}
    </div>
  );
};

// ─── Scan-line sweep (intro) ──────────────────────────────────
const ScanLine = ({ totalFrames }) => {
  const frame = useCurrentFrame();
  const pos = interpolate(frame, [0, totalFrames * 0.55], [-2, 102], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.inOut(Easing.cubic),
  });
  const op = interpolate(
    frame, [0, 6, totalFrames * 0.45, totalFrames * 0.55], [0, 0.7, 0.7, 0],
    { extrapolateLeft:'clamp', extrapolateRight:'clamp' }
  );
  return (
    <div style={{
      position:'absolute', top:`${pos}%`, left:0, right:0, height:2,
      background:'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)',
      opacity:op, pointerEvents:'none',
    }} />
  );
};

// ─── Scene wrapper — handles cross-fade in/out for every scene ─
const SceneWrapper = ({ durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeInOp  = interpolate(frame, [0, fps * 0.25], [0, 1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  const fadeOutOp = interpolate(frame, [durationInFrames - TRANSITION_FRAMES, durationInFrames], [1, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  return (
    <div style={{ position:'absolute', inset:0, opacity: Math.min(fadeInOp, fadeOutOp) }}>
      {children}
    </div>
  );
};

// ─── Word-level captions overlay ──────────────────────────────
const WORDS_PER_CAPTION = 4;

const CaptionsOverlay = ({ captions }) => {
  const frame    = useCurrentFrame();
  const { fps }  = useVideoConfig();
  if (!captions?.length) return null;

  const currentMs = (frame / fps) * 1000;

  // Group words into segments
  const segments = [];
  for (let i = 0; i < captions.length; i += WORDS_PER_CAPTION) {
    segments.push(captions.slice(i, i + WORDS_PER_CAPTION));
  }

  const activeIdx = segments.findIndex(seg =>
    currentMs >= seg[0].startMs - 50 && currentMs <= seg[seg.length - 1].endMs + 500
  );
  if (activeIdx === -1) return null;

  const seg = segments[activeIdx];
  const segStart = seg[0].startMs;
  const fadeOp = interpolate(currentMs, [segStart - 50, segStart + 60], [0, 1], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });

  return (
    <div style={{
      position:'absolute', bottom:110, left:0, right:0,
      display:'flex', justifyContent:'center',
      padding:'0 48px',
      opacity: fadeOp,
      pointerEvents:'none',
    }}>
      <div style={{
        display:'inline-flex', flexWrap:'wrap', gap:'0 0.28em',
        justifyContent:'center',
        background:'rgba(0,0,0,0.78)',
        backdropFilter:'blur(8px)',
        padding:'12px 26px', borderRadius:12,
        maxWidth:'88%',
      }}>
        {seg.map((w, i) => {
          const active = currentMs >= w.startMs && currentMs <= w.endMs + 180;
          return (
            <span key={i} style={{
              fontFamily: MONO,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: '.03em',
              textTransform: 'uppercase',
              color: active ? ACCENT : '#ffffff',
              textShadow: active ? `0 0 18px ${ACCENT}99` : 'none',
            }}>
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── Cover tile ───────────────────────────────────────────────
const CoverTile = ({ cover, title, author, size = 260 }) => {
  const bg    = cover?.bg    || '#141210';
  const fg    = cover?.fg    || '#F5EFE4';
  const motif = cover?.motif || 'bars';
  const h     = Math.round(size * 1.4);

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
    <div style={{ position:'relative', width:size, height:h, background:bg, color:fg, overflow:'hidden', borderRadius:6, boxShadow:'0 40px 100px -20px rgba(0,0,0,0.9)' }}>
      {motifs[motif]}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:'30%', background:`linear-gradient(180deg,${fg}08,transparent)` }} />
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:20 }}>
        <div style={{ fontSize:Math.round(size * 0.075), fontFamily:SERIF, fontWeight:900, lineHeight:1.1, marginBottom:10, wordBreak:'break-word' }}>{title}</div>
        <div style={{ fontSize:Math.round(size * 0.042), fontFamily:MONO, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', opacity:0.7 }}>{author}</div>
      </div>
      <div style={{ position:'absolute', top:14, left:14, fontSize:Math.round(size * 0.04), fontFamily:MONO, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', background:'rgba(232,67,44,0.9)', color:'#fff', padding:'4px 8px' }}>RI</div>
    </div>
  );
};

// ─── Intro scene ──────────────────────────────────────────────
const IntroScene = ({ book, durationInFrames }) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg      = book.cover?.bg || '#141210';
  const fg      = book.cover?.fg || '#F5EFE4';

  // Ken Burns — slow zoom + drift
  const kbScale = interpolate(frame, [0, durationInFrames], [1.0, 1.12], { extrapolateLeft:'clamp', extrapolateRight:'clamp' });
  const kbX     = interpolate(frame, [0, durationInFrames], [0, -10],    { extrapolateLeft:'clamp', extrapolateRight:'clamp' });

  // Cover spring entry
  const coverSpr = spring({ frame, fps, config: { damping: 16, stiffness: 70 } });

  // Animated radial glow pulse
  const glowOp = interpolate(Math.sin(frame * 0.025), [-1, 1], [0.04, 0.11]);

  const titleOp = fadeIn(frame, fps * 1.3, fps * 0.7);
  const barPct  = interpolate(frame, [fps * 1.8, fps * 2.8], [0, 100], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:48, padding:'80px 60px', overflow:'hidden' }}>
      {/* Radial accent glow */}
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 70% 55% at 50% 25%, rgba(232,67,44,${glowOp.toFixed(3)}), transparent)` }} />
      <Particles count={22} fg={fg} />

      {/* Ken Burns cover inside spring envelope */}
      <div style={{ transform:`scale(${coverSpr})`, transformOrigin:'center bottom' }}>
        <div style={{ transform:`scale(${kbScale}) translateX(${kbX}px)`, transformOrigin:'center', overflow:'hidden', borderRadius:8 }}>
          <CoverTile cover={book.cover} title={book.title} author={book.author} size={300} />
        </div>
      </div>

      {/* Title block */}
      <div style={{ opacity:titleOp, textAlign:'center', color:fg, width:'100%' }}>
        <div style={{ height:3, background:ACCENT, width:`${barPct}%`, margin:'0 auto 20px', boxShadow:`0 0 14px ${ACCENT}` }} />
        <div style={{ fontFamily:MONO, fontSize:20, fontWeight:600, letterSpacing:'.16em', textTransform:'uppercase', opacity:.55, marginBottom:14 }}>
          {book.genre} · {book.year || ''}
        </div>
        <div style={{ fontFamily:SERIF, fontSize:72, fontWeight:900, lineHeight:1.08, textShadow:'0 2px 24px rgba(0,0,0,0.5)' }}>
          {book.title}
        </div>
        <div style={{ fontFamily:MONO, fontSize:24, marginTop:16, opacity:.6, letterSpacing:'.06em' }}>
          by {book.author}
        </div>
      </div>

      {/* Scan-line sweep */}
      <ScanLine totalFrames={durationInFrames} />
    </AbsoluteFill>
  );
};

// ─── Content scene (hook / body) ──────────────────────────────
const ContentScene = ({ scene, book, index }) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg      = book.cover?.bg || '#141210';
  const fg      = book.cover?.fg || '#F5EFE4';

  const LABELS = { hook:'Why This Book', body:'Key Ideas' };
  const label  = LABELS[scene.id] || scene.id;

  const sceneOp   = fadeIn(frame, 0, fps * 0.4);
  const labelX    = interpolate(frame, [0, fps * 0.5], [-30, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic) });
  const barHeight = interpolate(frame, [fps * 0.2, fps * 0.9], [0, 100], { extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ background:bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'100px 68px 100px 80px', overflow:'hidden' }}>
      {/* Top accent bar */}
      <div style={{ position:'absolute', left:0, top:0, right:0, height:5, background:ACCENT, boxShadow:`0 0 16px ${ACCENT}80` }} />

      {/* Left growing accent line */}
      <div style={{
        position:'absolute', left:38, top:`${(100 - barHeight) / 2}%`, width:3,
        height:`${barHeight}%`,
        background:`linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`,
        opacity:sceneOp,
      }} />

      {/* Bottom warm glow */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'40%', background:`linear-gradient(to top, rgba(232,67,44,0.06), transparent)` }} />

      <Particles count={18} fg={fg} />

      <div style={{ opacity:sceneOp, width:'100%' }}>
        {/* Scene label */}
        <div style={{
          fontFamily:MONO, fontSize:17, fontWeight:700, letterSpacing:'.2em',
          textTransform:'uppercase', color:ACCENT, marginBottom:34,
          transform:`translateX(${labelX}px)`,
          display:'flex', alignItems:'center', gap:12,
        }}>
          <div style={{ width:22, height:2, background:ACCENT }} />
          {label}
        </div>

        {/* Word-by-word narration */}
        <WordReveal
          text={scene.narration}
          startFrame={fps * 0.3}
          wps={2.5}
          fontSize={62}
          color={fg}
        />
      </div>

      {/* Progress dots — pill for active */}
      <div style={{ position:'absolute', bottom:50, left:'50%', transform:'translateX(-50%)', display:'flex', gap:10, alignItems:'center' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: i === index ? 30 : 10,
            height: 10, borderRadius: 5,
            background: i === index ? ACCENT : fg,
            opacity: i === index ? 1 : 0.2,
          }} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ─── Verdict scene ────────────────────────────────────────────
const VerdictScene = ({ scene, book }) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg      = book.cover?.bg || '#141210';
  const fg      = book.cover?.fg || '#F5EFE4';
  const stars   = Math.round(book.rating || 4);

  const sceneOp = fadeIn(frame, 0, fps * 0.4);

  // Stars spring in one by one
  const starScales = [...Array(5)].map((_, i) =>
    spring({ frame: Math.max(0, frame - fps * (0.2 + i * 0.15)), fps, config: { damping: 10, stiffness: 120 } })
  );

  // Score count-up
  const scoreDisplay = interpolate(frame, [fps * 0.3, fps * 1.4], [0, book.rating || 4], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic),
  });

  // Score bar fill
  const scoreFill = interpolate(frame, [fps * 0.4, fps * 1.5], [0, (book.rating || 4) / 5 * 100], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic),
  });

  // Pulsing glow on active stars
  const starGlow = interpolate(Math.sin(frame * 0.08), [-1, 1], [8, 20]);

  return (
    <AbsoluteFill style={{ background:bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'100px 60px', overflow:'hidden' }}>
      <div style={{ position:'absolute', left:0, top:0, right:0, height:5, background:ACCENT, boxShadow:`0 0 16px ${ACCENT}80` }} />
      {/* Glow behind the stars */}
      <div style={{ position:'absolute', top:'12%', left:0, right:0, height:'40%', background:`radial-gradient(ellipse 70% 100% at 50% 50%, rgba(232,67,44,0.10), transparent)` }} />
      <Particles count={16} fg={fg} />

      <div style={{ opacity:sceneOp, textAlign:'center', width:'100%' }}>
        <div style={{ fontFamily:MONO, fontSize:17, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:ACCENT, marginBottom:40, display:'flex', justifyContent:'center', alignItems:'center', gap:14 }}>
          <div style={{ width:22, height:2, background:ACCENT }} />
          The Verdict
          <div style={{ width:22, height:2, background:ACCENT }} />
        </div>

        {/* Stars popping in */}
        <div style={{ display:'flex', justifyContent:'center', gap:16, marginBottom:20 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              fontSize:66, lineHeight:1,
              transform:`scale(${starScales[i]})`,
              transformOrigin:'center',
              color: i < stars ? ACCENT : fg,
              opacity: i < stars ? 1 : 0.18,
              filter: i < stars ? `drop-shadow(0 0 ${starGlow}px ${ACCENT}99)` : 'none',
            }}>★</div>
          ))}
        </div>

        {/* Score count-up */}
        <div style={{ fontFamily:MONO, fontSize:22, color:fg, opacity:.5, marginBottom:12 }}>
          {scoreDisplay.toFixed(1)}/5
        </div>

        {/* Score fill bar */}
        <div style={{ width:140, height:4, background:`${fg}1a`, margin:'0 auto 44px', borderRadius:2 }}>
          <div style={{ height:'100%', width:`${scoreFill}%`, background:ACCENT, borderRadius:2, boxShadow:`0 0 10px ${ACCENT}` }} />
        </div>

        {/* Verdict word reveal */}
        <WordReveal
          text={scene.narration}
          startFrame={fps * 1.0}
          wps={2.5}
          fontSize={46}
          color={fg}
          center
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Outro scene ──────────────────────────────────────────────
const OutroScene = ({ scene, book }) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bg      = book.cover?.bg || '#141210';
  const fg      = book.cover?.fg || '#F5EFE4';

  const sceneOp   = fadeIn(frame, 0, fps * 0.5);
  const coverSpr  = spring({ frame: Math.max(0, frame - fps * 0.15), fps, config: { damping: 18, stiffness: 70 } });
  const urlSlideY = interpolate(frame, [fps * 0.9, fps * 1.7], [30, 0], { extrapolateLeft:'clamp', extrapolateRight:'clamp', easing: Easing.out(Easing.cubic) });
  const urlOp     = fadeIn(frame, fps * 0.9, fps * 0.6);

  // URL glow pulses
  const urlGlow = interpolate(Math.sin(frame * 0.1), [-1, 1], [8, 22]);

  const ctaText = scene.narration
    .replace(/reviewerinsight\.com/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return (
    <AbsoluteFill style={{ background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:40, padding:'80px 60px', overflow:'hidden' }}>
      <div style={{ position:'absolute', left:0, top:0, right:0, height:5, background:ACCENT, boxShadow:`0 0 16px ${ACCENT}80` }} />
      <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 80% 60% at 50% 50%, rgba(232,67,44,0.07), transparent)` }} />
      <Particles count={22} fg={fg} />

      {/* Faded cover with glow */}
      <div style={{ opacity:sceneOp * 0.55, transform:`scale(${coverSpr})`, filter:`drop-shadow(0 20px 40px rgba(232,67,44,0.35))` }}>
        <CoverTile cover={book.cover} title={book.title} author={book.author} size={160} />
      </div>

      {/* CTA word reveal */}
      <div style={{ opacity:sceneOp, textAlign:'center', width:'100%' }}>
        <WordReveal
          text={ctaText}
          startFrame={fps * 0.4}
          wps={2.2}
          fontSize={48}
          color={fg}
          center
        />
      </div>

      {/* URL slide up + pulse glow */}
      <div style={{ opacity:urlOp, transform:`translateY(${urlSlideY}px)`, textAlign:'center' }}>
        <div style={{ fontFamily:MONO, fontSize:16, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:fg, opacity:.45, marginBottom:12 }}>
          Full review at
        </div>
        <div style={{ fontFamily:MONO, fontSize:38, fontWeight:700, color:ACCENT, letterSpacing:'.04em', textShadow:`0 0 ${urlGlow}px ${ACCENT}` }}>
          reviewerinsight.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Root composition ─────────────────────────────────────────
const BookSummary = ({ book, scenes, audioFile, backgroundMusicFile, totalDurationInFrames, captions }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame       = useCurrentFrame();
  const totalFrames = totalDurationInFrames || durationInFrames;

  // Each scene's startFrame is based on estimated durations (no overlap offset),
  // but durationInFrames extends by TRANSITION_FRAMES so consecutive scenes overlap
  // — this creates cross-fade transitions between scenes.
  let cursor = 0;
  const timeline = scenes.map((scene, i) => {
    const isLast      = i === scenes.length - 1;
    const startFrame  = cursor;
    const estimated   = Math.max(fps * 3, Math.round(scene.estimatedSeconds * fps));
    const sceneFrames = isLast
      ? Math.max(estimated + TRANSITION_FRAMES, totalFrames - cursor + TRANSITION_FRAMES)
      : estimated + TRANSITION_FRAMES;
    cursor += estimated; // advance by estimated, NOT sceneFrames, so next scene overlaps
    return { ...scene, startFrame, durationInFrames: sceneFrames };
  });

  // Global progress bar color interpolates across the video
  const progress     = Math.min(frame / Math.max(totalFrames - 1, 1), 1);
  const progressColor = interpolateColors(progress, [0, 0.5, 1], ['#E8432C', '#FF6B50', '#E8432C']);

  return (
    <AbsoluteFill>
      {audioFile && <Audio src={staticFile(audioFile)} />}
      {backgroundMusicFile && (
        <Audio src={staticFile(backgroundMusicFile)} volume={0.05} loop />
      )}

      {timeline.map(scene => (
        <Sequence key={scene.id} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
          <SceneWrapper durationInFrames={scene.durationInFrames}>
            {scene.id === 'intro'   && <IntroScene   book={book} durationInFrames={scene.durationInFrames} />}
            {scene.id === 'hook'    && <ContentScene scene={scene} book={book} index={1} />}
            {scene.id === 'body'    && <ContentScene scene={scene} book={book} index={2} />}
            {scene.id === 'verdict' && <VerdictScene scene={scene} book={book} />}
            {scene.id === 'outro'   && <OutroScene   scene={scene} book={book} />}
          </SceneWrapper>
        </Sequence>
      ))}

      {/* Word-level captions — rendered above everything */}
      <CaptionsOverlay captions={captions} />

      {/* Global progress bar at bottom */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:4, background:'rgba(255,255,255,0.06)', pointerEvents:'none' }}>
        <div style={{ height:'100%', width:`${progress * 100}%`, background:progressColor, boxShadow:`0 0 8px ${progressColor}` }} />
      </div>
    </AbsoluteFill>
  );
};

module.exports = { BookSummary };
