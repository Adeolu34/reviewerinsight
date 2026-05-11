function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState,
  useEffect,
  useCallback
} = React;

// URL ↔ Route helpers
function routeToPath(r) {
  if (!r) return '/';
  switch (r.name) {
    case 'home':
      return '/';
    case 'browse':
      return '/browse';
    case 'recommend':
      return '/recommend';
    case 'editors':
      return '/editors';
    case 'membership':
      return '/membership';
    case 'admin':
      return '/reviewadmin';
    case 'review':
      {
        const id = r.id || '';
        return `/book/${id}`;
      }
    default:
      return '/';
  }
}
function pathToRoute(pathname) {
  const p = pathname || '/';
  if (p === '/' || p === '') return {
    name: 'home'
  };
  if (p === '/browse') return {
    name: 'browse'
  };
  if (p === '/recommend') return {
    name: 'recommend'
  };
  if (p === '/editors') return {
    name: 'editors'
  };
  if (p === '/membership') return {
    name: 'membership'
  };
  if (p === '/reviewadmin') return {
    name: 'admin'
  };
  const bookMatch = p.match(/^\/book\/([a-f0-9]+)/i);
  if (bookMatch) return {
    name: 'review',
    id: bookMatch[1]
  };
  return {
    name: 'home'
  };
}
function App() {
  const [route, setRouteState] = useState(() => {
    try {
      return pathToRoute(window.location.pathname);
    } catch {
      return {
        name: 'home'
      };
    }
  });
  const [tweaks, setTweaks] = useState(window.TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const setRoute = useCallback(r => {
    const newRoute = typeof r === 'string' ? {
      name: r
    } : r;
    const newPath = routeToPath(newRoute);
    if (window.location.pathname !== newPath) {
      window.history.pushState(newRoute, '', newPath);
    }
    setRouteState(newRoute);
  }, []);

  // Browser back/forward
  useEffect(() => {
    const onPopState = () => setRouteState(pathToRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // Tweaks protocol
  useEffect(() => {
    const onMsg = e => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode') setTweaksOpen(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const updateTweak = (key, value) => {
    const next = {
      ...tweaks,
      [key]: value
    };
    setTweaks(next);
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits: {
        [key]: value
      }
    }, '*');
  };
  const ctx = {
    accent: tweaks.accent,
    density: tweaks.density,
    setRoute,
    route
  };
  const routeKey = route.name + (route.id || '');
  if (route.name === 'admin') {
    return /*#__PURE__*/React.createElement(window.Admin, {
      setRoute: setRoute,
      accent: tweaks.accent
    });
  }
  const Page = route.name === 'browse' ? window.Browse : route.name === 'recommend' ? window.Recommend : route.name === 'editors' ? window.Editors : route.name === 'membership' ? window.Membership : route.name === 'review' ? () => /*#__PURE__*/React.createElement(window.Review, _extends({
    bookId: route.id,
    initialTab: route.tab
  }, ctx)) : window.Home;
  return /*#__PURE__*/React.createElement("div", {
    "data-screen-label": `Route: ${route.name}`,
    style: {
      '--accent': tweaks.accent
    }
  }, /*#__PURE__*/React.createElement(window.Header, {
    route: route,
    setRoute: setRoute,
    accent: tweaks.accent
  }), /*#__PURE__*/React.createElement("div", {
    key: routeKey
  }, /*#__PURE__*/React.createElement(Page, ctx)), /*#__PURE__*/React.createElement("div", {
    className: "tweaks-panel" + (tweaksOpen ? ' visible' : '')
  }, /*#__PURE__*/React.createElement("h4", null, "Tweaks"), /*#__PURE__*/React.createElement("label", null, "Accent color"), /*#__PURE__*/React.createElement("div", {
    className: "swatches"
  }, ['#E8432C', '#1E3A8A', '#E4A72B', '#0F5132', '#141210'].map(c => /*#__PURE__*/React.createElement("div", {
    key: c,
    className: "sw" + (tweaks.accent === c ? ' on' : ''),
    style: {
      background: c
    },
    onClick: () => updateTweak('accent', c)
  }))), /*#__PURE__*/React.createElement("label", null, "Density"), /*#__PURE__*/React.createElement("div", {
    className: "seg"
  }, ['cozy', 'compact'].map(d => /*#__PURE__*/React.createElement("button", {
    key: d,
    className: tweaks.density === d ? 'on' : '',
    onClick: () => updateTweak('density', d)
  }, d))), /*#__PURE__*/React.createElement("label", null, "Jump to"), /*#__PURE__*/React.createElement("div", {
    className: "seg"
  }, [['home', 'Home'], ['browse', 'Browse'], ['recommend', 'For You'], ['review', 'Review'], ['membership', 'Member']].map(([k, lab]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setRoute(k === 'review' ? {
      name: 'review',
      id: 1
    } : {
      name: k
    })
  }, lab)))));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
