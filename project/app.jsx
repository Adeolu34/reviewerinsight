// URL ↔ Route helpers (React.* hooks — safe across multiple classic <script> tags)
function routeToPath(r) {
  if (!r) return '/';
  switch (r.name) {
    case 'home': return '/';
    case 'browse': return '/browse';
    case 'recommend': return '/recommend';
    case 'editors': return '/editors';
    case 'membership': return '/membership';
    case 'admin': return '/reviewadmin';
    case 'review': {
      const id = r.id || '';
      const slug = (r.slug || '').replace(/^\/+|\/+$/g, '');
      if (!id) return '/';
      return slug ? `/book/${id}/${slug}` : `/book/${id}`;
    }
    case 'authors': return '/authors';
    case 'author': return r.slug ? `/author/${r.slug}` : '/authors';
    default: return '/';
  }
}

function pathToRoute(pathname) {
  const p = pathname || '/';
  if (p === '/' || p === '') return { name: 'home' };
  if (p === '/browse') return { name: 'browse' };
  if (p === '/recommend') return { name: 'recommend' };
  if (p === '/editors') return { name: 'editors' };
  if (p === '/membership') return { name: 'membership' };
  if (p === '/reviewadmin') return { name: 'admin' };
  if (p === '/authors') return { name: 'authors' };
  const authorMatch = p.match(/^\/author\/([^/?#]+)/);
  if (authorMatch) return { name: 'author', slug: decodeURIComponent(authorMatch[1]) };
  const bookMatch = p.match(/^\/book\/([a-f0-9]{24})(?:\/([^/?#]+))?/i);
  if (bookMatch) {
    const out = { name: 'review', id: bookMatch[1] };
    if (bookMatch[2]) {
      try {
        out.slug = decodeURIComponent(bookMatch[2]);
      } catch (_) {
        out.slug = bookMatch[2];
      }
    }
    return out;
  }
  return { name: 'home' };
}

function App() {
  const [route, setRouteState] = React.useState(() => {
    try {
      return pathToRoute(window.location.pathname);
    } catch {
      return { name: 'home' };
    }
  });
  const [tweaks, setTweaks] = React.useState(window.TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = React.useState(false);

  const setRoute = React.useCallback((r) => {
    const newRoute = typeof r === 'string' ? { name: r } : r;
    const newPath = routeToPath(newRoute);
    if (window.location.pathname !== newPath) {
      window.history.pushState(newRoute, '', newPath);
    }
    setRouteState(newRoute);
  }, []);

  // Browser back/forward
  React.useEffect(() => {
    const onPopState = () => setRouteState(pathToRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // Tweaks protocol
  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const updateTweak = (key, value) => {
    const next = { ...tweaks, [key]: value };
    setTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  };

  const ctx = { accent: tweaks.accent, density: tweaks.density, setRoute, route };
  const routeKey = route.name + (route.id || '');
  if (route.name === 'admin') {
    return <window.Admin setRoute={setRoute} accent={tweaks.accent} />;
  }

  const Page = route.name === 'browse' ? window.Browse
    : route.name === 'recommend' ? window.Recommend
      : route.name === 'editors' ? window.Editors
        : route.name === 'membership' ? window.Membership
          : route.name === 'review' ? () => <window.Review bookId={route.id} initialTab={route.tab} {...ctx} />
            : (route.name === 'authors' || route.name === 'author') ? () => <window.Authors route={route} {...ctx} />
              : window.Home;

  return (
    <div data-screen-label={`Route: ${route.name}`} style={{ '--accent': tweaks.accent }}>
      <window.Header route={route} setRoute={setRoute} accent={tweaks.accent} />
      <div key={routeKey}><Page {...ctx} /></div>
      <div className={"tweaks-panel" + (tweaksOpen ? ' visible' : '')}>
        <h4>Tweaks</h4>
        <label>Accent color</label>
        <div className="swatches">
          {['#E8432C', '#1E3A8A', '#E4A72B', '#0F5132', '#141210'].map(c => (
            <div key={c} className={"sw" + (tweaks.accent === c ? ' on' : '')} style={{ background: c }} onClick={() => updateTweak('accent', c)} />
          ))}
        </div>
        <label>Density</label>
        <div className="seg">
          {['cozy', 'compact'].map(d => (
            <button key={d} className={tweaks.density === d ? 'on' : ''} onClick={() => updateTweak('density', d)}>{d}</button>
          ))}
        </div>
        <label>Jump to</label>
        <div className="seg">
          {[['home', 'Home'], ['browse', 'Browse'], ['recommend', 'For You'], ['editors', 'Editors'], ['membership', 'Member']].map(([k, lab]) => (
            <button key={k} onClick={() => setRoute({ name: k })}>{lab}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
