// Typographic book-cover tile with 3D perspective hover effects
const Cover = ({ book, size = "md", rotate = 0, float: shouldFloat = false }) => {
  const { cover, coverImageUrl, title, author } = book;
  const [imgFailed, setImgFailed] = React.useState(false);
  const useImage = coverImageUrl && !imgFailed;
  const ref = React.useRef(null);
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });

  const dims = {
    xs: { w: 80, h: 110, t: 12, s: 8 },
    sm: { w: 120, h: 170, t: 16, s: 10 },
    md: { w: 180, h: 250, t: 22, s: 11 },
    lg: { w: 260, h: 360, t: 34, s: 12 },
    xl: { w: 360, h: 500, t: 52, s: 14 }
  }[size];

  const enableTilt = size === 'lg' || size === 'xl';

  const handleMouse = React.useCallback((e) => {
    if (!enableTilt || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -8, y: x * 8 });
  }, [enableTilt]);

  const handleLeave = React.useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const titleFont = `900 ${dims.t}px "DM Serif Display", Georgia, serif`;
  const authorFont = `600 ${dims.s}px "JetBrains Mono", monospace`;

  // Motifs with subtle improvements
  const motifs = {
    bars: (
      <div style={{ position:'absolute', inset: 0, display:'flex', flexDirection:'column', justifyContent:'space-between', padding: 10, pointerEvents:'none' }}>
        {[...Array(7)].map((_,i)=>(
          <div key={i} style={{ height: 2, background: cover.fg, opacity: 0.18 }}/>
        ))}
      </div>
    ),
    grid: (
      <div style={{ position:'absolute', inset: 10, backgroundImage: `linear-gradient(${cover.fg} 1px, transparent 1px), linear-gradient(90deg, ${cover.fg} 1px, transparent 1px)`, backgroundSize: '16px 16px', opacity: 0.14, pointerEvents:'none' }}/>
    ),
    dot: (
      <div style={{ position:'absolute', inset: 10, backgroundImage: `radial-gradient(${cover.fg} 1.2px, transparent 1.6px)`, backgroundSize: '12px 12px', opacity: 0.22, pointerEvents:'none' }}/>
    ),
    rule: (
      <div style={{ position:'absolute', left: 10, right: 10, top: '50%', height: 2, background: cover.fg, opacity: 0.35, pointerEvents:'none' }}/>
    )
  };

  const floatStyle = shouldFloat ? {
    animation: `ri-float ${3 + Math.random() * 2}s ease-in-out infinite`,
    '--rot': `${rotate}deg`
  } : {};

  return (
    <div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{
        position:'relative', width: dims.w, height: dims.h, flexShrink: 0,
        perspective: enableTilt ? 800 : undefined,
        ...(shouldFloat ? { animation: `ri-float ${3 + Math.random() * 2}s ease-in-out infinite`, '--rot': `${rotate}deg` } : {})
      }}
    >
      <div style={{
        position:'relative', width:'100%', height:'100%', background: cover?.bg || '#141210', color: cover?.fg || '#F5EFE4',
        overflow:'hidden',
        transform: enableTilt
          ? `rotate(${rotate}deg) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
          : rotate ? `rotate(${rotate}deg)` : undefined,
        boxShadow: tilt.x || tilt.y
          ? `${tilt.y * -2}px ${tilt.x * 2 + 12}px 30px -10px rgba(20,18,16,0.35)`
          : '0 1px 0 rgba(20,18,16,0.35), 0 12px 30px -18px rgba(20,18,16,0.4)',
        transition: enableTilt
          ? 'transform .15s ease-out, box-shadow .15s ease-out'
          : 'transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s ease'
      }} className="ri-cover">
        {useImage ? (
          <>
            <img
              src={coverImageUrl}
              alt={`Cover of ${title}`}
              onError={() => setImgFailed(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
            />
            <div style={{
              position:'absolute', top:6, left:6,
              font: `600 ${Math.max(7, dims.s - 2)}px "JetBrains Mono", monospace`,
              textTransform:'uppercase', letterSpacing:'.08em',
              color:'#F5EFE4', background:'rgba(20,18,16,0.7)',
              padding:'3px 6px', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)'
            }}>RI</div>
          </>
        ) : (
          <>
            {motifs[cover?.motif]}
            <div style={{
              position:'absolute', top:0, left:0, right:0, height:'30%',
              background: `linear-gradient(180deg, ${cover?.fg || '#F5EFE4'}08, transparent)`,
              pointerEvents:'none'
            }}/>
            <div style={{ position:'absolute', inset: 0, padding: dims.w > 150 ? 18 : 10, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <div style={{ font: authorFont, textTransform:'uppercase', letterSpacing: '.1em', opacity: .85 }}>
                Reviewer Insight
              </div>
              <div style={{ minHeight: 0 }}>
                <div style={{ font: titleFont, lineHeight: 1.02, textWrap:'balance', overflow:'hidden', display:'-webkit-box', WebkitLineClamp: dims.h < 200 ? 3 : 4, WebkitBoxOrient:'vertical' }}>{title}</div>
                <div style={{ font: authorFont, marginTop: 10, opacity: .85, textTransform:'uppercase', letterSpacing: '.08em', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{author}</div>
              </div>
            </div>
          </>
        )}

        {/* Spine edge effect */}
        <div style={{
          position:'absolute', top:0, left:0, bottom:0, width: 3,
          background: `linear-gradient(180deg, ${(cover?.fg || '#F5EFE4')}22, ${(cover?.fg || '#F5EFE4')}11, ${(cover?.fg || '#F5EFE4')}22)`,
          pointerEvents:'none'
        }}/>
      </div>
    </div>
  );
};

window.Cover = Cover;
