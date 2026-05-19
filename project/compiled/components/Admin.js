function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// ─── Admin Dashboard for Reviewer Insight ──────────────────────
// Dark-themed control panel: overview, agents, books, editors, analytics, system

const T = {
  bg: '#0F0F0F',
  card: '#1A1A1A',
  hover: '#252525',
  border: '#333',
  text: '#E5E5E5',
  muted: '#999',
  dim: '#666',
  accent: '#6366F1',
  accentHover: '#818CF8',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  info: '#3B82F6',
  mono: '"JetBrains Mono", monospace',
  sans: '"Space Grotesk", sans-serif',
  serif: '"DM Serif Display", Georgia, serif'
};
const STATUS_COLORS = {
  running: T.info,
  completed: T.ok,
  failed: T.err,
  partial: T.warn,
  discovered: '#8B5CF6',
  metadata_complete: '#A78BFA',
  review_pending: T.warn,
  review_complete: '#34D399',
  published: T.ok
};

// ─── Utility Helpers ────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}) : '—';
const fmtTime = d => d ? new Date(d).toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}) : '—';
const fmtDur = ms => {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000),
    m = Math.floor(s / 60),
    h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};
const fmtUptime = s => {
  const d = Math.floor(s / 86400),
    h = Math.floor(s % 86400 / 3600),
    m = Math.floor(s % 3600 / 60);
  return `${d}d ${h}h ${m}m`;
};
const fmtCost = v => `$${(v || 0).toFixed(2)}`;
const fmtNum = v => (v || 0).toLocaleString();

// ─── Shared UI Components ───────────────────────────────────────
const StatusBadge = ({
  status
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    background: STATUS_COLORS[status] || T.dim,
    color: '#fff'
  }
}, status);
const Card = ({
  title,
  actions,
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: 20,
    ...style
  }
}, title && /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: `1px solid ${T.border}`
  }
}, /*#__PURE__*/React.createElement("h3", {
  style: {
    margin: 0,
    fontSize: 15,
    fontFamily: T.mono,
    fontWeight: 600,
    color: T.text,
    letterSpacing: '.02em'
  }
}, title), actions), children);
const Metric = ({
  label,
  value,
  sub,
  color,
  onClick
}) => /*#__PURE__*/React.createElement("div", {
  onClick: onClick,
  style: {
    background: T.card,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '18px 16px',
    textAlign: 'center',
    cursor: onClick ? 'pointer' : 'default',
    transition: onClick ? 'border-color .15s, box-shadow .15s' : undefined
  },
  onMouseEnter: onClick ? e => {
    e.currentTarget.style.borderColor = T.accent;
    e.currentTarget.style.boxShadow = `0 0 0 2px ${T.accent}30`;
  } : undefined,
  onMouseLeave: onClick ? e => {
    e.currentTarget.style.borderColor = T.border;
    e.currentTarget.style.boxShadow = 'none';
  } : undefined
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.1em',
    color: T.muted,
    marginBottom: 6
  }
}, label, onClick && /*#__PURE__*/React.createElement("span", {
  style: {
    marginLeft: 4,
    opacity: .5
  }
}, "\u2197")), /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 28,
    fontWeight: 800,
    fontFamily: T.serif,
    color: color || T.text,
    lineHeight: 1
  }
}, value), sub && /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontFamily: T.mono,
    color: T.dim,
    marginTop: 6
  }
}, sub));
const Btn = ({
  children,
  onClick,
  variant = 'primary',
  disabled,
  small,
  style: sx
}) => {
  const base = {
    padding: small ? '6px 12px' : '9px 16px',
    borderRadius: 6,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 11 : 12,
    fontWeight: 700,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    transition: 'all .15s',
    opacity: disabled ? .5 : 1
  };
  const variants = {
    primary: {
      background: T.accent,
      color: '#fff'
    },
    ok: {
      background: T.ok,
      color: '#fff'
    },
    danger: {
      background: T.err,
      color: '#fff'
    },
    ghost: {
      background: 'transparent',
      color: T.text,
      border: `1px solid ${T.border}`
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...sx
    }
  }, children);
};
const Select = ({
  value,
  onChange,
  children,
  style: sx
}) => /*#__PURE__*/React.createElement("select", {
  value: value,
  onChange: e => onChange(e.target.value),
  style: {
    padding: '8px 12px',
    background: T.card,
    color: T.text,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontFamily: T.mono,
    fontSize: 12,
    cursor: 'pointer',
    ...sx
  }
}, children);
const Input = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  style: sx,
  ...props
}) => /*#__PURE__*/React.createElement("input", _extends({
  type: type,
  value: value,
  onChange: e => onChange(e.target.value),
  placeholder: placeholder,
  style: {
    padding: '8px 12px',
    background: T.card,
    color: T.text,
    border: `1px solid ${T.border}`,
    borderRadius: 6,
    fontFamily: T.sans,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    ...sx
  }
}, props));
const Pagination = ({
  page,
  totalPages,
  onChange
}) => {
  if (!totalPages || totalPages <= 1) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => onChange(page - 1),
    disabled: page <= 1
  }, "Prev"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Page ", page, " of ", totalPages), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => onChange(page + 1),
    disabled: page >= totalPages
  }, "Next"));
};
const Table = ({
  columns,
  rows,
  onRowClick
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    overflow: 'hidden'
  }
}, /*#__PURE__*/React.createElement("table", {
  style: {
    width: '100%',
    borderCollapse: 'collapse'
  }
}, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
  style: {
    background: T.hover
  }
}, columns.map(c => /*#__PURE__*/React.createElement("th", {
  key: c.key,
  style: {
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 700,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: T.muted,
    width: c.width
  }
}, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
  key: row._id || row.id || i,
  onClick: () => onRowClick && onRowClick(row),
  style: {
    borderTop: `1px solid ${T.border}`,
    cursor: onRowClick ? 'pointer' : 'default',
    transition: 'background .1s'
  },
  onMouseEnter: e => e.currentTarget.style.background = T.hover,
  onMouseLeave: e => e.currentTarget.style.background = 'transparent'
}, columns.map(c => /*#__PURE__*/React.createElement("td", {
  key: c.key,
  style: {
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: c.mono ? T.mono : T.sans,
    color: T.text
  }
}, c.render ? c.render(row[c.key], row) : row[c.key])))), rows.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
  colSpan: columns.length,
  style: {
    padding: 32,
    textAlign: 'center',
    color: T.dim,
    fontFamily: T.mono,
    fontSize: 12
  }
}, "No data")))));

// ─── Modal ──────────────────────────────────────────────────────
const Modal = ({
  title,
  children,
  onClose,
  width = 640
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100
  },
  onClick: onClose
}, /*#__PURE__*/React.createElement("div", {
  style: {
    width,
    maxWidth: '92vw',
    maxHeight: '88vh',
    overflow: 'auto',
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: 28
  },
  onClick: e => e.stopPropagation()
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  }
}, /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: 0,
    fontSize: 20,
    fontFamily: T.serif,
    color: T.text
  }
}, title), /*#__PURE__*/React.createElement("button", {
  onClick: onClose,
  style: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: T.muted,
    cursor: 'pointer',
    padding: 4
  }
}, "x")), children));
const Label = ({
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    fontSize: 11,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.1em',
    color: T.muted,
    marginBottom: 6
  }
}, children);

// ─── useAdminApi hook ───────────────────────────────────────────
function useAdminApi(fetchFn, deps = []) {
  const [state, setState] = React.useState({
    data: null,
    loading: true,
    error: null
  });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));
    fetchFn().then(data => {
      if (!cancelled) setState({
        data,
        loading: false,
        error: null
      });
    }).catch(err => {
      if (!cancelled) setState({
        data: null,
        loading: false,
        error: err
      });
    });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]);
  return {
    ...state,
    refresh: () => setTick(t => t + 1)
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Overview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const OverviewSection = ({
  navigate
}) => {
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getOverview());
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 40,
      textAlign: 'center'
    }
  }, "Loading dashboard...");
  if (!data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      padding: 40
    }
  }, "Failed to load overview");
  const {
    metrics: m,
    agentStatus: a,
    costSummary: c,
    recentErrors,
    statusBreakdown
  } = data;
  const maxStatus = Math.max(...Object.values(statusBreakdown), 1);
  const goBooks = status => navigate && navigate('books', {
    status
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Total Books",
    value: fmtNum(m.totalBooks),
    sub: `+${m.todayDiscovered} today`,
    onClick: () => goBooks('')
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Published",
    value: fmtNum(m.publishedBooks),
    color: T.ok,
    onClick: () => goBooks('published')
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Pending Review",
    value: m.pendingReviews,
    color: T.warn,
    onClick: () => goBooks('metadata_complete')
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Failed",
    value: m.failedBooks,
    color: m.failedBooks > 0 ? T.err : T.text,
    onClick: () => goBooks('failed')
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Chapter Summaries",
    value: fmtNum(m.totalChapters)
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Reviewed Today",
    value: m.todayReviewed,
    color: T.info
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Agent Status"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, a.currentlyRunning && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: `${T.info}15`,
      border: `1px solid ${T.info}40`,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.info,
      fontWeight: 700
    }
  }, "RUNNING NOW"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontFamily: T.sans,
      color: T.text,
      marginTop: 4
    }
  }, a.currentlyRunning.editor), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted,
      marginTop: 2
    }
  }, "Started ", fmtTime(a.currentlyRunning.startedAt))), a.lastRun && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Last Run"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontFamily: T.sans,
      color: T.text
    }
  }, a.lastRun.editor, " \u2014 ", a.lastRun.booksReviewed, " books ", /*#__PURE__*/React.createElement(StatusBadge, {
    status: a.lastRun.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted,
      marginTop: 2
    }
  }, fmtTime(a.lastRun.completedAt))), a.nextScheduled && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Next Scheduled"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontFamily: T.sans,
      color: T.text
    }
  }, a.nextScheduled.editor), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted,
      marginTop: 2
    }
  }, fmtTime(a.nextScheduled.scheduledFor))))), /*#__PURE__*/React.createElement(Card, {
    title: "Cost Summary"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Today"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontFamily: T.mono,
      fontWeight: 700,
      color: T.text
    }
  }, fmtCost(c.today))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "This Week"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontFamily: T.mono,
      fontWeight: 700,
      color: T.text
    }
  }, fmtCost(c.thisWeek))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "This Month"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontFamily: T.mono,
      fontWeight: 700,
      color: T.text
    }
  }, fmtCost(c.thisMonth))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: T.border
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Daily Budget"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontFamily: T.mono,
      fontWeight: 700,
      color: c.today > c.budget ? T.err : T.ok
    }
  }, fmtCost(c.budget)))))), /*#__PURE__*/React.createElement(Card, {
    title: "Book Status Breakdown"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, Object.entries(statusBreakdown).map(([status, count]) => /*#__PURE__*/React.createElement("div", {
    key: status,
    onClick: () => goBooks(status),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      borderRadius: 6,
      padding: '4px 6px',
      margin: '-4px -6px',
      transition: 'background .15s'
    },
    onMouseEnter: e => e.currentTarget.style.background = T.hover,
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 120,
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted,
      textTransform: 'capitalize'
    }
  }, status.replace(/_/g, ' ')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      background: T.hover,
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${count / maxStatus * 100}%`,
      background: STATUS_COLORS[status] || T.accent,
      borderRadius: 4,
      transition: 'width .4s ease'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50,
      fontSize: 13,
      fontFamily: T.mono,
      fontWeight: 700,
      color: T.text,
      textAlign: 'right'
    }
  }, count), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: T.mono,
      color: T.dim,
      width: 14
    }
  }, "\u2197"))))), /*#__PURE__*/React.createElement(Card, {
    title: "Recent Errors",
    actions: /*#__PURE__*/React.createElement(Btn, {
      small: true,
      variant: "ghost",
      onClick: refresh
    }, "Refresh")
  }, recentErrors.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      color: T.ok,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No recent errors") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, recentErrors.slice(0, 8).map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: 10,
      background: T.hover,
      borderRadius: 6,
      borderLeft: `3px solid ${T.err}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: T.text
    }
  }, e.bookTitle || 'Unknown'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: T.mono,
      color: T.dim
    }
  }, e.editor)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginTop: 4,
      fontFamily: T.mono,
      wordBreak: 'break-word'
    }
  }, e.error), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.dim,
      marginTop: 4,
      fontFamily: T.mono
    }
  }, fmtTime(e.timestamp)))))));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Agent Runs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const RunsSection = () => {
  const [filters, setFilters] = React.useState({
    editor: '',
    status: '',
    page: 1
  });
  const [modal, setModal] = React.useState(null); // 'trigger' or run object
  const [backfillMsg, setBackfillMsg] = React.useState('');
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getRuns(filters), [filters]);
  const triggerBackfill = async () => {
    setBackfillMsg('Starting…');
    try {
      await AdminClient.triggerBackfill();
      setBackfillMsg('Backfill started — check table for progress');
      setTimeout(() => {
        setBackfillMsg('');
        refresh();
      }, 3000);
    } catch (e) {
      setBackfillMsg(e.message === 'Backfill already running' ? 'Already running' : `Error: ${e.message}`);
      setTimeout(() => setBackfillMsg(''), 4000);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.editor,
    onChange: v => setFilters({
      ...filters,
      editor: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Editors"), /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"), /*#__PURE__*/React.createElement("option", null, "Backfill")), /*#__PURE__*/React.createElement(Select, {
    value: filters.status,
    onChange: v => setFilters({
      ...filters,
      status: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Statuses"), /*#__PURE__*/React.createElement("option", null, "running"), /*#__PURE__*/React.createElement("option", null, "completed"), /*#__PURE__*/React.createElement("option", null, "failed"), /*#__PURE__*/React.createElement("option", null, "partial")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), backfillMsg && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.mono,
      fontSize: 11,
      color: T.muted
    }
  }, backfillMsg), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: triggerBackfill
  }, "\u26A1 Run Backfill Now"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setModal('trigger')
  }, "+ Trigger Run"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: refresh
  }, "Refresh")), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 20
    }
  }, "Loading...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'editor',
      label: 'Editor',
      width: '18%'
    }, {
      key: 'startedAt',
      label: 'Started',
      render: v => fmtTime(v),
      mono: true
    }, {
      key: 'status',
      label: 'Status',
      render: v => /*#__PURE__*/React.createElement(StatusBadge, {
        status: v
      })
    }, {
      key: 'booksDiscovered',
      label: 'Found',
      mono: true
    }, {
      key: 'booksReviewed',
      label: 'Reviewed',
      mono: true
    }, {
      key: 'booksFailed',
      label: 'Failed',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          color: v > 0 ? T.err : T.dim
        }
      }, v),
      mono: true
    }, {
      key: 'estimatedCost',
      label: 'Cost',
      render: v => fmtCost(v),
      mono: true
    }, {
      key: 'durationMs',
      label: 'Duration',
      render: v => fmtDur(v),
      mono: true
    }],
    rows: data?.runs || [],
    onRowClick: run => setModal(run)
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: filters.page,
    totalPages: data?.totalPages,
    onChange: p => setFilters({
      ...filters,
      page: p
    })
  })), modal && modal !== 'trigger' && modal._id && /*#__PURE__*/React.createElement(Modal, {
    title: `Run: ${modal.editor}`,
    onClose: () => setModal(null),
    width: 720
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Discovered",
    value: modal.booksDiscovered
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Reviewed",
    value: modal.booksReviewed
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Chapters",
    value: modal.chaptersGenerated || 0
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Skipped",
    value: modal.booksSkipped
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Status"), /*#__PURE__*/React.createElement(StatusBadge, {
    status: modal.status
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Duration"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.text,
      fontFamily: T.mono,
      fontSize: 13
    }
  }, fmtDur(modal.durationMs))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Cost"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.text,
      fontFamily: T.mono,
      fontSize: 13
    }
  }, fmtCost(modal.estimatedCost), " (", fmtNum(modal.tokensUsed), " tokens)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Started"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.text,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, fmtTime(modal.startedAt))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Completed"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.text,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, fmtTime(modal.completedAt)))), modal.searchQueries?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    title: "Search Queries"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, modal.searchQueries.map((q, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '4px 10px',
      background: T.hover,
      borderRadius: 6,
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted
    }
  }, q)))), modal.errors?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    title: `Errors (${modal.errors.length})`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6,
      maxHeight: 200,
      overflowY: 'auto'
    }
  }, modal.errors.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: 8,
      background: T.hover,
      borderRadius: 6,
      borderLeft: `3px solid ${T.err}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: T.text
    }
  }, e.bookTitle), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted,
      marginTop: 2
    }
  }, e.error))))))), modal === 'trigger' && /*#__PURE__*/React.createElement(TriggerModal, {
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      refresh();
    }
  }));
};
const TriggerModal = ({
  onClose,
  onDone
}) => {
  const [editor, setEditor] = React.useState('Mira Okafor');
  const [batch, setBatch] = React.useState('8');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      await AdminClient.triggerAgent(editor, parseInt(batch));
      setMsg(`Started ${editor} (batch ${batch})`);
      setTimeout(onDone, 1200);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Trigger Agent Run",
    onClose: onClose,
    width: 420
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Editor"), /*#__PURE__*/React.createElement(Select, {
    value: editor,
    onChange: setEditor,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Batch Size"), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    value: batch,
    onChange: setBatch,
    min: "1",
    max: "20"
  })), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      borderRadius: 6,
      background: msg.startsWith('Error') ? `${T.err}20` : `${T.ok}20`,
      color: msg.startsWith('Error') ? T.err : T.ok,
      fontSize: 12,
      fontFamily: T.mono
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: go,
    disabled: busy
  }, busy ? 'Starting...' : 'Start Run'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Books
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VALID_GENRES = ['Fiction', 'Essays', 'Memoir', 'Sci-Fi', 'History', 'Business', 'Nature'];
const guessGenre = (categories = []) => {
  const cats = categories.join(' ').toLowerCase();
  if (cats.includes('science fiction') || cats.includes('sci-fi')) return 'Sci-Fi';
  if (cats.includes('fiction') || cats.includes('novel')) return 'Fiction';
  if (cats.includes('history')) return 'History';
  if (cats.includes('business') || cats.includes('economics') || cats.includes('finance')) return 'Business';
  if (cats.includes('essay')) return 'Essays';
  if (cats.includes('memoir') || cats.includes('biography') || cats.includes('autobiography')) return 'Memoir';
  if (cats.includes('nature') || cats.includes('science') || cats.includes('environment')) return 'Nature';
  return 'Fiction';
};
const SearchImportModal = ({
  onClose,
  onImported
}) => {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [searching, setSearching] = React.useState(false);
  const [searchErr, setSearchErr] = React.useState('');
  const [importing, setImporting] = React.useState({});
  const [imported, setImported] = React.useState({});
  const [genres, setGenres] = React.useState({});
  const debounceRef = React.useRef(null);
  const doSearch = async q => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setSearchErr('');
    try {
      const {
        results: r
      } = await AdminClient.searchExternal(q.trim());
      setResults(r);
      const initial = {};
      r.forEach((b, i) => {
        initial[i] = guessGenre(b.categories || []);
      });
      setGenres(initial);
    } catch (e) {
      setSearchErr(e.message);
    } finally {
      setSearching(false);
    }
  };
  const handleQueryChange = v => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 500);
  };
  const handleImport = async (book, idx) => {
    setImporting(p => ({
      ...p,
      [idx]: true
    }));
    try {
      await AdminClient.importBook({
        title: book.title,
        author: book.author,
        year: book.year,
        genre: genres[idx] || 'Fiction',
        isbn: book.isbn,
        description: book.description,
        coverUrl: book.coverUrl,
        pages: book.pages,
        sources: {
          googleBooksId: book.googleBooksId,
          openLibraryKey: book.openLibraryKey
        }
      });
      setImported(p => ({
        ...p,
        [idx]: true
      }));
      setResults(p => p.map((b, i) => i === idx ? {
        ...b,
        alreadyImported: true
      } : b));
      onImported && onImported();
    } catch (e) {
      if (e.message?.includes('already exists')) {
        setResults(p => p.map((b, i) => i === idx ? {
          ...b,
          alreadyImported: true
        } : b));
      } else {
        alert(`Import failed: ${e.message}`);
      }
    } finally {
      setImporting(p => ({
        ...p,
        [idx]: false
      }));
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Search & Import Book",
    onClose: onClose,
    width: 700
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    value: query,
    onChange: handleQueryChange,
    placeholder: "Search by title, author, or ISBN\u2026",
    autoFocus: true
  }), searching && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      fontSize: 12,
      textAlign: 'center',
      padding: 24
    }
  }, "Searching\u2026"), searchErr && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, searchErr), !searching && query.length >= 2 && results.length === 0 && !searchErr && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      fontSize: 12,
      textAlign: 'center',
      padding: 24
    }
  }, "No results found"), results.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxHeight: 500,
      overflowY: 'auto',
      paddingRight: 4
    }
  }, results.map((book, idx) => {
    const done = book.alreadyImported || imported[idx];
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      style: {
        display: 'grid',
        gridTemplateColumns: '56px 1fr auto',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        background: T.hover,
        borderRadius: 8,
        border: `1px solid ${done ? T.ok + '50' : T.border}`
      }
    }, book.coverUrl ? /*#__PURE__*/React.createElement("img", {
      src: book.coverUrl,
      alt: book.title,
      style: {
        width: 56,
        height: 76,
        objectFit: 'cover',
        borderRadius: 4
      }
    }) : /*#__PURE__*/React.createElement("div", {
      style: {
        width: 56,
        height: 76,
        background: T.border,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22
      }
    }, "\uD83D\uDCDA"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        fontFamily: T.serif,
        color: T.text,
        marginBottom: 3
      }
    }, book.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontFamily: T.mono,
        color: T.muted,
        marginBottom: 8
      }
    }, book.author, book.year ? ` · ${book.year}` : '', book.pages ? ` · ${book.pages}pp` : '', ' · ', /*#__PURE__*/React.createElement("span", {
      style: {
        color: book.source === 'google' ? T.info : T.ok
      }
    }, book.source === 'google' ? 'Google Books' : 'Open Library')), !done && /*#__PURE__*/React.createElement(Select, {
      value: genres[idx] || 'Fiction',
      onChange: v => setGenres(p => ({
        ...p,
        [idx]: v
      }))
    }, VALID_GENRES.map(g => /*#__PURE__*/React.createElement("option", {
      key: g
    }, g)))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right',
        minWidth: 80
      }
    }, done ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontFamily: T.mono,
        color: T.ok,
        fontWeight: 700
      }
    }, "\u2713 In DB") : /*#__PURE__*/React.createElement(Btn, {
      small: true,
      disabled: importing[idx],
      onClick: () => handleImport(book, idx)
    }, importing[idx] ? '…' : 'Import →')));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.dim
    }
  }, "Importing a book queues it for AI review generation \u2014 ready in under 20 minutes.")));
};
const BooksSection = ({
  params = {}
}) => {
  const [filters, setFilters] = React.useState({
    status: params.status || '',
    genre: params.genre || '',
    editor: params.editor || '',
    search: '',
    page: 1
  });
  const [modal, setModal] = React.useState(null); // { type, book }
  const [showSearchImport, setShowSearchImport] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const debounceRef = React.useRef(null);
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getAdminBooks(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))), [filters]);
  const handleSearch = v => {
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilters(f => ({
      ...f,
      search: v,
      page: 1
    })), 350);
  };
  const handleFeature = async book => {
    try {
      await AdminClient.updateBook(book._id, {
        featured: !book.featured
      });
      refresh();
    } catch (e) {
      alert(e.message);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '2 1 160px'
    }
  }, /*#__PURE__*/React.createElement(Input, {
    value: searchInput,
    onChange: handleSearch,
    placeholder: "Search books..."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 120px'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.status,
    onChange: v => setFilters({
      ...filters,
      status: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Statuses"), /*#__PURE__*/React.createElement("option", null, "discovered"), /*#__PURE__*/React.createElement("option", null, "metadata_complete"), /*#__PURE__*/React.createElement("option", null, "review_pending"), /*#__PURE__*/React.createElement("option", null, "review_complete"), /*#__PURE__*/React.createElement("option", null, "published"), /*#__PURE__*/React.createElement("option", null, "failed"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 100px'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.genre,
    onChange: v => setFilters({
      ...filters,
      genre: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Genres"), /*#__PURE__*/React.createElement("option", null, "Fiction"), /*#__PURE__*/React.createElement("option", null, "Essays"), /*#__PURE__*/React.createElement("option", null, "Memoir"), /*#__PURE__*/React.createElement("option", null, "Sci-Fi"), /*#__PURE__*/React.createElement("option", null, "History"), /*#__PURE__*/React.createElement("option", null, "Business"), /*#__PURE__*/React.createElement("option", null, "Nature"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 100px'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.editor,
    onChange: v => setFilters({
      ...filters,
      editor: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Editors"), /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"))), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setShowSearchImport(true)
  }, "+ Search & Import")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Showing ", data?.books?.length || 0, " of ", data?.total || 0, " books"), showSearchImport && /*#__PURE__*/React.createElement(SearchImportModal, {
    onClose: () => setShowSearchImport(false),
    onImported: () => {
      refresh();
    }
  }), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 20
    }
  }, "Loading...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'title',
      label: 'Title',
      width: '24%',
      render: (v, r) => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600
        }
      }, v), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: T.muted
        }
      }, r.author))
    }, {
      key: 'status',
      label: 'Status',
      render: v => /*#__PURE__*/React.createElement(StatusBadge, {
        status: v
      })
    }, {
      key: 'genre',
      label: 'Genre',
      mono: true
    }, {
      key: 'editor',
      label: 'Editor',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12
        }
      }, v)
    }, {
      key: 'rating',
      label: 'Rating',
      render: v => v ? v.toFixed(1) : '—',
      mono: true
    }, {
      key: 'featured',
      label: 'Feat.',
      render: (v, book) => /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: !!v,
        onChange: () => handleFeature(book),
        style: {
          cursor: 'pointer',
          width: 16,
          height: 16
        }
      })
    }, {
      key: 'createdAt',
      label: 'Added',
      render: v => fmtDate(v),
      mono: true
    }, {
      key: '_actions',
      label: '',
      width: '140px',
      render: (_, book) => /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          gap: 4
        }
      }, /*#__PURE__*/React.createElement(Btn, {
        small: true,
        variant: "ghost",
        onClick: e => {
          e.stopPropagation();
          setModal({
            type: 'edit',
            book
          });
        }
      }, "Edit"), book.status === 'failed' && /*#__PURE__*/React.createElement(Btn, {
        small: true,
        variant: "ok",
        onClick: e => {
          e.stopPropagation();
          setModal({
            type: 'retry',
            book
          });
        }
      }, "Retry"), /*#__PURE__*/React.createElement(Btn, {
        small: true,
        variant: "danger",
        onClick: e => {
          e.stopPropagation();
          setModal({
            type: 'delete',
            book
          });
        }
      }, "Del"))
    }],
    rows: data?.books || []
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: filters.page,
    totalPages: data?.totalPages,
    onChange: p => setFilters({
      ...filters,
      page: p
    })
  })), modal?.type === 'edit' && /*#__PURE__*/React.createElement(EditBookModal, {
    book: modal.book,
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      refresh();
    }
  }), modal?.type === 'delete' && /*#__PURE__*/React.createElement(DeleteBookModal, {
    book: modal.book,
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      refresh();
    }
  }), modal?.type === 'retry' && /*#__PURE__*/React.createElement(RetryBookModal, {
    book: modal.book,
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      refresh();
    }
  }));
};
const EditBookModal = ({
  book,
  onClose,
  onDone
}) => {
  const [status, setStatus] = React.useState(book.status);
  const [rating, setRating] = React.useState(String(book.rating || ''));
  const [editor, setEditor] = React.useState(book.editor || '');
  const [genre, setGenre] = React.useState(book.genre || '');
  const [featured, setFeatured] = React.useState(!!book.featured);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const save = async () => {
    setBusy(true);
    try {
      const updates = {
        status,
        featured,
        editor,
        genre
      };
      if (rating) updates.rating = parseFloat(rating);
      await AdminClient.updateBook(book._id, updates);
      onDone();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Edit: ${book.title}`,
    onClose: onClose,
    width: 480
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Status"), /*#__PURE__*/React.createElement(Select, {
    value: status,
    onChange: setStatus,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "discovered"), /*#__PURE__*/React.createElement("option", null, "metadata_complete"), /*#__PURE__*/React.createElement("option", null, "review_pending"), /*#__PURE__*/React.createElement("option", null, "review_complete"), /*#__PURE__*/React.createElement("option", null, "published"), /*#__PURE__*/React.createElement("option", null, "failed"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Rating"), /*#__PURE__*/React.createElement(Input, {
    type: "number",
    step: "0.1",
    min: "0",
    max: "5",
    value: rating,
    onChange: setRating,
    placeholder: "0.0 - 5.0"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Editor"), /*#__PURE__*/React.createElement(Select, {
    value: editor,
    onChange: setEditor,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Genre"), /*#__PURE__*/React.createElement(Select, {
    value: genre,
    onChange: setGenre,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Fiction"), /*#__PURE__*/React.createElement("option", null, "Essays"), /*#__PURE__*/React.createElement("option", null, "Memoir"), /*#__PURE__*/React.createElement("option", null, "Sci-Fi"), /*#__PURE__*/React.createElement("option", null, "History"), /*#__PURE__*/React.createElement("option", null, "Business"), /*#__PURE__*/React.createElement("option", null, "Nature"))), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: featured,
    onChange: e => setFeatured(e.target.checked),
    style: {
      width: 16,
      height: 16
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontFamily: T.sans,
      color: T.text
    }
  }, "Featured")), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      fontSize: 12,
      fontFamily: T.mono
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: save,
    disabled: busy
  }, busy ? 'Saving...' : 'Save'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};
const DeleteBookModal = ({
  book,
  onClose,
  onDone
}) => {
  const [hard, setHard] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await AdminClient.deleteBook(book._id, hard);
      onDone();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: "Delete Book",
    onClose: onClose,
    width: 440
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 14,
      background: T.hover,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      fontFamily: T.serif,
      color: T.text
    }
  }, book.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.muted,
      marginTop: 4
    }
  }, "by ", book.author)), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: hard,
    onChange: e => setHard(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: T.text
    }
  }, "Permanently delete (cannot be undone)")), !hard && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Soft delete marks the book as \"failed\""), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: go,
    disabled: busy
  }, busy ? 'Deleting...' : hard ? 'Delete Forever' : 'Soft Delete'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};
const RetryBookModal = ({
  book,
  onClose,
  onDone
}) => {
  const [step, setStep] = React.useState('review');
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await AdminClient.retryBook(book._id, step);
      onDone();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Retry: ${book.title}`,
    onClose: onClose,
    width: 440
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, book.errorLog && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: `${T.err}15`,
      borderRadius: 6,
      borderLeft: `3px solid ${T.err}`
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Error"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted,
      wordBreak: 'break-word'
    }
  }, book.errorLog)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Retry from step"), /*#__PURE__*/React.createElement(Select, {
    value: step,
    onChange: setStep,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "metadata"
  }, "Metadata (re-discover)"), /*#__PURE__*/React.createElement("option", {
    value: "review"
  }, "Review (re-generate review)"), /*#__PURE__*/React.createElement("option", {
    value: "chapters"
  }, "Chapters (re-generate summaries)"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: go,
    disabled: busy
  }, busy ? 'Retrying...' : 'Retry'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Editors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EditorsSection = () => {
  const {
    data,
    loading
  } = useAdminApi(() => AdminClient.getEditorStats());
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 40,
      textAlign: 'center'
    }
  }, "Loading...");
  if (!data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      padding: 40
    }
  }, "Failed to load editor stats");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, data.editors.map(ed => /*#__PURE__*/React.createElement(Card, {
    key: ed.name,
    title: ed.name
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 10,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Runs",
    value: ed.totalRuns
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Success",
    value: `${ed.successRate}%`,
    color: ed.successRate >= 90 ? T.ok : ed.successRate >= 70 ? T.warn : T.err
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Books",
    value: ed.publishedBooks
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Avg Rating",
    value: ed.avgRating.toFixed(1),
    color: T.accent
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Total Cost",
    value: fmtCost(ed.totalCost)
  })), ed.lastRun && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      padding: '10px 0',
      borderTop: `1px solid ${T.border}`,
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Last run: ", fmtTime(ed.lastRun.startedAt)), /*#__PURE__*/React.createElement(StatusBadge, {
    status: ed.lastRun.status
  }), /*#__PURE__*/React.createElement("span", null, ed.lastRun.booksReviewed, " reviewed, ", ed.lastRun.booksDiscovered, " discovered")))));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Analytics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AnalyticsSection = () => {
  const [period, setPeriod] = React.useState('7d');
  const {
    data,
    loading
  } = useAdminApi(() => AdminClient.getAnalytics(period), [period]);
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 40,
      textAlign: 'center'
    }
  }, "Loading...");
  if (!data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      padding: 40
    }
  }, "Failed to load analytics");
  const maxDailyCost = Math.max(...(data.costs.dailyBreakdown || []).map(d => d.cost), 0.01);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, [['24h', '24 Hours'], ['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']].map(([k, label]) => /*#__PURE__*/React.createElement(Btn, {
    key: k,
    small: true,
    variant: period === k ? 'primary' : 'ghost',
    onClick: () => setPeriod(k)
  }, label))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Total Cost",
    value: fmtCost(data.costs.total)
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Runs",
    value: data.runs.total,
    sub: `${data.runs.completed} ok / ${data.runs.failed} failed`
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Books Reviewed",
    value: data.books.reviewed
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Books Failed",
    value: data.books.failed,
    color: data.books.failed > 0 ? T.err : T.text
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Cost by Editor"
  }, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'name',
      label: 'Editor'
    }, {
      key: 'runs',
      label: 'Runs',
      mono: true
    }, {
      key: 'cost',
      label: 'Cost',
      render: v => fmtCost(v),
      mono: true
    }, {
      key: 'tokens',
      label: 'Tokens',
      render: v => fmtNum(v),
      mono: true
    }, {
      key: 'avg',
      label: 'Avg/Run',
      render: (_, r) => fmtCost(r.runs > 0 ? r.cost / r.runs : 0),
      mono: true
    }],
    rows: Object.entries(data.costs.byEditor).map(([name, s]) => ({
      name,
      ...s
    }))
  })), data.costs.dailyBreakdown?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    title: "Daily Cost Trend"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6
    }
  }, data.costs.dailyBreakdown.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.date,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted
    }
  }, d.date.slice(5)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 20,
      background: T.hover,
      borderRadius: 3,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${d.cost / maxDailyCost * 100}%`,
      background: `linear-gradient(90deg, ${T.accent}, ${T.info})`,
      borderRadius: 3,
      transition: 'width .3s'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 55,
      fontSize: 11,
      fontFamily: T.mono,
      color: T.text,
      textAlign: 'right'
    }
  }, fmtCost(d.cost)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      fontSize: 10,
      fontFamily: T.mono,
      color: T.dim,
      textAlign: 'right'
    }
  }, d.runs, "r"))))), data.topErrors?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    title: "Most Common Errors"
  }, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'error',
      label: 'Error',
      width: '80%',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          wordBreak: 'break-word'
        }
      }, v)
    }, {
      key: 'count',
      label: 'Count',
      mono: true
    }],
    rows: data.topErrors
  })));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SystemSection = () => {
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getSystemInfo());
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 40,
      textAlign: 'center'
    }
  }, "Loading...");
  if (!data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      padding: 40
    }
  }, "Failed to load system info");
  const hColor = data.health === 'healthy' ? T.ok : T.err;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "System Health",
    actions: /*#__PURE__*/React.createElement(Btn, {
      small: true,
      variant: "ghost",
      onClick: refresh
    }, "Refresh")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: `${hColor}20`,
      border: `2px solid ${hColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 28
    }
  }, data.health === 'healthy' ? '✓' : '!'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontFamily: T.serif,
      fontWeight: 700,
      color: hColor
    }
  }, data.health === 'healthy' ? 'All Systems Operational' : 'Issues Detected'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted,
      marginTop: 4
    }
  }, "Uptime: ", fmtUptime(data.uptime), " | PID: ", data.process.pid)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Database"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Status"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: data.database.connected ? T.ok : T.err
    }
  }, data.database.connected ? 'Connected' : 'Disconnected')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Ping"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      fontFamily: T.mono,
      color: T.text
    }
  }, data.database.ping, "ms")))), /*#__PURE__*/React.createElement(Card, {
    title: "Memory"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "RSS"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      fontFamily: T.mono,
      color: T.text
    }
  }, data.memory.used, "MB")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Heap"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      fontFamily: T.mono,
      color: T.text
    }
  }, data.memory.heapUsed, "MB"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      height: 8,
      background: T.hover,
      borderRadius: 4,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.min(data.memory.percent, 100)}%`,
      background: data.memory.percent > 80 ? T.err : T.accent,
      borderRadius: 4
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontFamily: T.mono,
      color: T.dim,
      marginTop: 4
    }
  }, data.memory.percent, "% of ", data.memory.total, "MB total"))), /*#__PURE__*/React.createElement(Card, {
    title: "Configuration"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 0
    }
  }, [['LLM provider', data.config.llmProvider || 'openai'], ['Active LLM model', data.config.llmModel || data.config.openaiModel], ['Daily budget', fmtCost(data.config.dailyBudget)], ['LLM API key', data.config.llmApiKeyConfigured ? 'Configured' : 'Not set'], ['Google Books API', data.config.googleBooksConfigured ? 'Configured' : 'Not set'], ['Admin Key', data.config.adminKeyConfigured ? 'Configured' : 'Not set'], ['Environment', data.config.nodeEnv], ['Node.js', data.process.nodeVersion], ['Platform', data.process.platform]].map(([label, value], i) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: i < 8 ? `1px solid ${T.border}` : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontFamily: T.mono,
      fontWeight: 600,
      color: typeof value === 'string' && value.includes('Not set') ? T.warn : T.text
    }
  }, value))))), /*#__PURE__*/React.createElement(Card, {
    title: "Agent Schedule"
  }, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'editor',
      label: 'Editor'
    }, {
      key: 'cron',
      label: 'Cron',
      mono: true
    }, {
      key: 'batchSize',
      label: 'Batch',
      mono: true
    }, {
      key: 'nextRun',
      label: 'Next Run',
      render: v => fmtTime(v),
      mono: true
    }],
    rows: data.schedule
  })));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN + MAIN SHELL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AdminLogin = ({
  onAuth
}) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      await AdminClient.login(email.trim(), password);
      onAuth();
    } catch (err) {
      setError(err.message === 'AUTH_EXPIRED' ? 'Session expired, please login again' : err.message);
    } finally {
      setLoading(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 400,
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontFamily: T.serif,
      fontWeight: 900,
      color: T.text
    }
  }, "Reviewer ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.accent,
      fontStyle: 'italic'
    }
  }, "Insight")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.16em',
      color: T.muted,
      marginTop: 6
    }
  }, "Admin Dashboard")), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit
  }, /*#__PURE__*/React.createElement(Label, null, "Email"), /*#__PURE__*/React.createElement(Input, {
    type: "email",
    value: email,
    onChange: setEmail,
    autoComplete: "username",
    placeholder: "admin@example.com",
    style: {
      marginBottom: 14
    }
  }), /*#__PURE__*/React.createElement(Label, null, "Password"), /*#__PURE__*/React.createElement(Input, {
    type: "password",
    value: password,
    onChange: setPassword,
    autoComplete: "current-password",
    placeholder: "Enter your password",
    style: {
      marginBottom: 14
    }
  }), error && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      fontSize: 12,
      fontFamily: T.mono,
      marginBottom: 12,
      padding: '8px 10px',
      background: `${T.err}15`,
      borderRadius: 6
    }
  }, error), /*#__PURE__*/React.createElement(Btn, {
    onClick: submit,
    disabled: loading || !email.trim() || !password,
    style: {
      width: '100%'
    }
  }, loading ? 'Signing in...' : 'Sign In'))));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Scraper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SOURCE_COLORS = {
  npr: '#3B82F6',
  guardian: '#1E3A8A',
  bookpage: '#10B981',
  openlibrary: '#8B5CF6',
  nyt: '#DC2626',
  googlebooks: '#4285F4',
  applebooks: '#1D1D1F'
};
const SOURCE_LABELS = {
  npr: 'NPR Books',
  guardian: 'The Guardian',
  bookpage: 'BookPage',
  openlibrary: 'Open Library',
  nyt: 'NYT Bestsellers',
  googlebooks: 'Google Books',
  applebooks: 'Apple Books'
};
const SCRAPER_STATUS_COLORS = {
  scraped: '#8B5CF6',
  imported: T.ok,
  skipped: T.dim
};
const SourceBadge = ({
  source
}) => /*#__PURE__*/React.createElement("span", {
  style: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: T.mono,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    background: SOURCE_COLORS[source] || T.dim,
    color: '#fff'
  }
}, SOURCE_LABELS[source] || source);
const ScraperSection = () => {
  const [view, setView] = React.useState('books'); // 'books' | 'runs'
  const [filters, setFilters] = React.useState({
    source: '',
    status: '',
    search: '',
    page: 1
  });
  const [selected, setSelected] = React.useState(new Set());
  const [modal, setModal] = React.useState(null); // 'import-bulk' | { type: 'import', book } | 'trigger'
  const [scraping, setScraping] = React.useState(null); // source name while scraping
  const [searchInput, setSearchInput] = React.useState('');
  const debounceRef = React.useRef(null);
  const {
    data: statusData,
    refresh: refreshStatus
  } = useAdminApi(() => AdminClient.getScraperStatus());
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getScrapedBooks(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))), [filters]);
  const handleSearch = v => {
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilters(f => ({
      ...f,
      search: v,
      page: 1
    })), 350);
  };
  const handleScrape = async source => {
    setScraping(source || 'all');
    try {
      await AdminClient.triggerScraper(source);
      refresh();
      refreshStatus();
    } catch (e) {
      alert(`Scrape failed: ${e.message}`);
    } finally {
      setScraping(null);
    }
  };
  const handleSkip = async book => {
    try {
      await AdminClient.updateScrapedBook(book._id, {
        status: 'skipped'
      });
      refresh();
      refreshStatus();
    } catch (e) {
      alert(e.message);
    }
  };
  const handleDelete = async book => {
    try {
      await AdminClient.deleteScrapedBook(book._id);
      refresh();
      refreshStatus();
    } catch (e) {
      alert(e.message);
    }
  };
  const toggleSelect = id => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (!data?.books) return;
    const pending = data.books.filter(b => b.status === 'scraped');
    if (selected.size === pending.length && pending.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending.map(b => b._id)));
    }
  };
  const stats = statusData?.stats || {};
  const sourceStats = data?.sourceStats || [];
  const maxSourceTotal = Math.max(...sourceStats.map(s => s.total), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Total Scraped",
    value: fmtNum(stats.totalScraped || 0)
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Pending Import",
    value: fmtNum(stats.totalPending || 0),
    color: "#8B5CF6"
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Imported",
    value: fmtNum(stats.totalImported || 0),
    color: T.ok
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Skipped",
    value: fmtNum(stats.totalSkipped || 0),
    color: T.dim
  })), sourceStats.length > 0 && /*#__PURE__*/React.createElement(Card, {
    title: "By Source"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 10
    }
  }, sourceStats.map(s => /*#__PURE__*/React.createElement("div", {
    key: s._id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 110
    }
  }, /*#__PURE__*/React.createElement(SourceBadge, {
    source: s._id
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      background: T.hover,
      borderRadius: 4,
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${s.total / maxSourceTotal * 100}%`,
      background: SOURCE_COLORS[s._id] || T.accent,
      borderRadius: 4,
      transition: 'width .4s ease'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      fontSize: 13,
      fontFamily: T.mono,
      fontWeight: 700,
      color: T.text,
      textAlign: 'right'
    }
  }, s.total), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      fontSize: 10,
      fontFamily: T.mono,
      color: T.muted
    }
  }, s.scraped, "p / ", s.imported, "i"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => handleScrape(null),
    disabled: !!scraping
  }, scraping === 'all' ? 'Scraping...' : 'Scrape All'), Object.keys(SOURCE_COLORS).map(s => /*#__PURE__*/React.createElement(Btn, {
    key: s,
    small: true,
    variant: "ghost",
    onClick: () => handleScrape(s),
    disabled: !!scraping,
    style: {
      borderColor: SOURCE_COLORS[s],
      color: scraping === s ? '#fff' : SOURCE_COLORS[s],
      background: scraping === s ? SOURCE_COLORS[s] : 'transparent'
    }
  }, scraping === s ? '...' : SOURCE_LABELS[s])), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: view === 'books' ? 'primary' : 'ghost',
    onClick: () => setView('books')
  }, "Books"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: view === 'runs' ? 'primary' : 'ghost',
    onClick: () => setView('runs')
  }, "Run History"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => {
      refresh();
      refreshStatus();
    }
  }, "Refresh")), view === 'books' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Input, {
    value: searchInput,
    onChange: handleSearch,
    placeholder: "Search scraped books..."
  }), /*#__PURE__*/React.createElement(Select, {
    value: filters.source,
    onChange: v => setFilters({
      ...filters,
      source: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Sources"), Object.entries(SOURCE_LABELS).map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v))), /*#__PURE__*/React.createElement(Select, {
    value: filters.status,
    onChange: v => setFilters({
      ...filters,
      status: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Statuses"), /*#__PURE__*/React.createElement("option", {
    value: "scraped"
  }, "Pending"), /*#__PURE__*/React.createElement("option", {
    value: "imported"
  }, "Imported"), /*#__PURE__*/React.createElement("option", {
    value: "skipped"
  }, "Skipped"))), selected.size > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      background: `${T.accent}15`,
      border: `1px solid ${T.accent}40`,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontFamily: T.mono,
      color: T.text,
      fontWeight: 600
    }
  }, selected.size, " selected"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    onClick: () => setModal('import-bulk')
  }, "Import Selected"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => setSelected(new Set())
  }, "Clear")), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 20
    }
  }, "Loading...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, "Showing ", data?.books?.length || 0, " of ", data?.total || 0, " scraped books"), /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: T.hover
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '10px 8px',
      width: 36
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    onChange: toggleSelectAll,
    checked: data?.books?.filter(b => b.status === 'scraped').length > 0 && selected.size === data?.books?.filter(b => b.status === 'scraped').length,
    style: {
      cursor: 'pointer'
    }
  })), [['Title', '26%'], ['Source', ''], ['Status', ''], ['Rating', ''], ['Year', ''], ['Scraped', ''], ['Actions', '140px']].map(([label, w]) => /*#__PURE__*/React.createElement("th", {
    key: label,
    style: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      color: T.muted,
      width: w || undefined
    }
  }, label)))), /*#__PURE__*/React.createElement("tbody", null, (data?.books || []).map(book => /*#__PURE__*/React.createElement("tr", {
    key: book._id,
    style: {
      borderTop: `1px solid ${T.border}`,
      transition: 'background .1s'
    },
    onMouseEnter: e => e.currentTarget.style.background = T.hover,
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 8px',
      textAlign: 'center'
    }
  }, book.status === 'scraped' && /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selected.has(book._id),
    onChange: () => toggleSelect(book._id),
    style: {
      cursor: 'pointer'
    }
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: T.text
    }
  }, book.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.muted
    }
  }, book.author)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement(SourceBadge, {
    source: book.source
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      background: SCRAPER_STATUS_COLORS[book.status] || T.dim,
      color: '#fff'
    }
  }, book.status === 'scraped' ? 'pending' : book.status)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, book.sourceRating || '\u2014'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, book.year || '\u2014'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, fmtDate(book.scrapedAt)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, book.status === 'scraped' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Btn, {
    small: true,
    onClick: e => {
      e.stopPropagation();
      setModal({
        type: 'import',
        book
      });
    }
  }, "Import"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: e => {
      e.stopPropagation();
      handleSkip(book);
    }
  }, "Skip")), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "danger",
    onClick: e => {
      e.stopPropagation();
      handleDelete(book);
    }
  }, "Del"))))), (data?.books || []).length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: 8,
    style: {
      padding: 32,
      textAlign: 'center',
      color: T.dim,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No scraped books found"))))), /*#__PURE__*/React.createElement(Pagination, {
    page: filters.page,
    totalPages: data?.totalPages,
    onChange: p => setFilters({
      ...filters,
      page: p
    })
  }))) : /*#__PURE__*/React.createElement(ScraperRunsView, null), modal?.type === 'import' && /*#__PURE__*/React.createElement(ImportScrapedModal, {
    book: modal.book,
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      refresh();
      refreshStatus();
    }
  }), modal === 'import-bulk' && /*#__PURE__*/React.createElement(ImportBulkModal, {
    ids: [...selected],
    onClose: () => setModal(null),
    onDone: () => {
      setModal(null);
      setSelected(new Set());
      refresh();
      refreshStatus();
    }
  }));
};
const ImportScrapedModal = ({
  book,
  onClose,
  onDone
}) => {
  const [editor, setEditor] = React.useState('Mira Okafor');
  const [genre, setGenre] = React.useState(book.genre || 'Fiction');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const go = async () => {
    setBusy(true);
    setMsg('');
    try {
      await AdminClient.importScrapedBook(book._id, {
        editor,
        genre
      });
      onDone();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Import: ${book.title}`,
    onClose: onClose,
    width: 460
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12,
      background: T.hover,
      borderRadius: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: T.text
    }
  }, book.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: T.muted,
      marginTop: 2
    }
  }, "by ", book.author), book.sourceReviewSnippet && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: T.dim,
      marginTop: 8,
      fontStyle: 'italic',
      lineHeight: 1.5
    }
  }, "\"", book.sourceReviewSnippet.substring(0, 200), "...\"")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Assign Editor"), /*#__PURE__*/React.createElement(Select, {
    value: editor,
    onChange: setEditor,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Genre"), /*#__PURE__*/React.createElement(Select, {
    value: genre,
    onChange: setGenre,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Fiction"), /*#__PURE__*/React.createElement("option", null, "Essays"), /*#__PURE__*/React.createElement("option", null, "Memoir"), /*#__PURE__*/React.createElement("option", null, "Sci-Fi"), /*#__PURE__*/React.createElement("option", null, "History"), /*#__PURE__*/React.createElement("option", null, "Business"), /*#__PURE__*/React.createElement("option", null, "Nature"))), msg && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.err,
      fontSize: 12,
      fontFamily: T.mono
    }
  }, msg), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: go,
    disabled: busy
  }, busy ? 'Importing...' : 'Import to Pipeline'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};
const ImportBulkModal = ({
  ids,
  onClose,
  onDone
}) => {
  const [editor, setEditor] = React.useState('Mira Okafor');
  const [genre, setGenre] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const go = async () => {
    setBusy(true);
    try {
      const data = {
        editor
      };
      if (genre) data.genre = genre;
      const res = await AdminClient.importScrapedBooksBulk(ids, data);
      setResult(res);
      setTimeout(onDone, 2000);
    } catch (e) {
      setResult({
        error: e.message
      });
    } finally {
      setBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    title: `Bulk Import (${ids.length} books)`,
    onClose: onClose,
    width: 460
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: T.muted
    }
  }, "Import ", ids.length, " scraped books into the review pipeline."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Assign Editor"), /*#__PURE__*/React.createElement(Select, {
    value: editor,
    onChange: setEditor,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", null, "Mira Okafor"), /*#__PURE__*/React.createElement("option", null, "Jules Park"), /*#__PURE__*/React.createElement("option", null, "Dae Han"), /*#__PURE__*/React.createElement("option", null, "Noor Saleh"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Genre Override (optional)"), /*#__PURE__*/React.createElement(Select, {
    value: genre,
    onChange: setGenre,
    style: {
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Use scraped genre"), /*#__PURE__*/React.createElement("option", null, "Fiction"), /*#__PURE__*/React.createElement("option", null, "Essays"), /*#__PURE__*/React.createElement("option", null, "Memoir"), /*#__PURE__*/React.createElement("option", null, "Sci-Fi"), /*#__PURE__*/React.createElement("option", null, "History"), /*#__PURE__*/React.createElement("option", null, "Business"), /*#__PURE__*/React.createElement("option", null, "Nature"))), result && !result.error && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: `${T.ok}20`,
      borderRadius: 6,
      fontSize: 12,
      fontFamily: T.mono,
      color: T.ok
    }
  }, "Imported: ", result.imported, " | Skipped: ", result.skipped, " | Failed: ", result.failed), result?.error && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      background: `${T.err}20`,
      borderRadius: 6,
      fontSize: 12,
      fontFamily: T.mono,
      color: T.err
    }
  }, result.error), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: go,
    disabled: busy || !!result
  }, busy ? 'Importing...' : 'Import All'), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onClose
  }, "Cancel"))));
};
const ScraperRunsView = () => {
  const [filters, setFilters] = React.useState({
    source: '',
    page: 1
  });
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getScraperRuns(filters), [filters]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    value: filters.source,
    onChange: v => setFilters({
      ...filters,
      source: v,
      page: 1
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "All Sources"), Object.entries(SOURCE_LABELS).map(([k, v]) => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, v))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: refresh
  }, "Refresh")), loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      padding: 20
    }
  }, "Loading...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: 'source',
      label: 'Source',
      render: v => /*#__PURE__*/React.createElement(SourceBadge, {
        source: v
      })
    }, {
      key: 'trigger',
      label: 'Trigger',
      mono: true
    }, {
      key: 'status',
      label: 'Status',
      render: v => /*#__PURE__*/React.createElement(StatusBadge, {
        status: v
      })
    }, {
      key: 'booksFound',
      label: 'Found',
      mono: true
    }, {
      key: 'booksNew',
      label: 'New',
      mono: true
    }, {
      key: 'booksDuplicate',
      label: 'Dup',
      mono: true
    }, {
      key: 'booksFailed',
      label: 'Failed',
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          color: v > 0 ? T.err : T.dim
        }
      }, v),
      mono: true
    }, {
      key: 'durationMs',
      label: 'Duration',
      render: v => fmtDur(v),
      mono: true
    }, {
      key: 'startedAt',
      label: 'Started',
      render: v => fmtTime(v),
      mono: true
    }],
    rows: data?.runs || []
  }), /*#__PURE__*/React.createElement(Pagination, {
    page: filters.page,
    totalPages: data?.totalPages,
    onChange: p => setFilters({
      ...filters,
      page: p
    })
  })));
};

// ━━━ DUPLICATES SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STATUS_PRIORITY = ['published', 'review_complete', 'review_pending', 'metadata_complete', 'discovered', 'failed'];
const DuplicatesSection = () => {
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getDuplicates());
  const [merging, setMerging] = React.useState(null);
  const [message, setMessage] = React.useState(null);
  const handleMerge = async group => {
    // Auto-pick best book: highest status priority, then highest rating, then newest
    const sorted = [...group.books].sort((a, b) => {
      const sa = STATUS_PRIORITY.indexOf(a.status);
      const sb = STATUS_PRIORITY.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const keeper = sorted[0];
    const removeIds = sorted.slice(1).map(b => b._id);
    if (!confirm(`Keep "${keeper.title}" (${keeper.status}, rating: ${keeper.rating || 'N/A'}) and remove ${removeIds.length} duplicate(s)?`)) return;
    setMerging(group.key);
    try {
      const result = await AdminClient.mergeDuplicates(keeper._id, removeIds);
      setMessage({
        type: 'ok',
        text: result.message
      });
      refresh();
    } catch (err) {
      setMessage({
        type: 'err',
        text: err.message
      });
    }
    setMerging(null);
  };
  const handleDismissScraped = async dup => {
    // Keep one, dismiss the rest
    const removeIds = dup.ids.slice(1);
    setMerging(dup._id?.title);
    try {
      const result = await AdminClient.dismissDuplicates(removeIds);
      setMessage({
        type: 'ok',
        text: result.message
      });
      refresh();
    } catch (err) {
      setMessage({
        type: 'err',
        text: err.message
      });
    }
    setMerging(null);
  };
  if (loading) return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 32,
      opacity: .5
    }
  }, "Loading duplicates...");
  const bookDups = data?.bookDuplicates || [];
  const scrapedDups = data?.scrapedDuplicates || [];
  return /*#__PURE__*/React.createElement("div", null, message && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 16px',
      marginBottom: 16,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: T.mono,
      background: message.type === 'ok' ? '#dcfce7' : '#fef2f2',
      color: message.type === 'ok' ? '#166534' : '#991b1b'
    }
  }, message.text, /*#__PURE__*/React.createElement("span", {
    onClick: () => setMessage(null),
    style: {
      cursor: 'pointer',
      marginLeft: 12,
      opacity: .5
    }
  }, "x")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 16,
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Book Duplicate Groups",
    value: bookDups.length
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Extra Book Copies",
    value: data?.totalBookDups || 0
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Scraped Dup Groups",
    value: scrapedDups.length
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Extra Scraped Copies",
    value: data?.totalScrapedDups || 0
  })), /*#__PURE__*/React.createElement(Card, {
    title: `Book Collection Duplicates (${bookDups.length} groups)`,
    style: {
      marginBottom: 24
    }
  }, bookDups.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      opacity: .5,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No duplicates found \u2014 collection is clean") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, bookDups.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.key,
    style: {
      padding: 16,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      background: T.hover
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 14,
      fontFamily: T.serif
    }
  }, group.books[0]?.title), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 12,
      fontFamily: T.mono,
      opacity: .6
    }
  }, group.count, " copies")), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    onClick: () => handleMerge(group),
    disabled: merging === group.key
  }, merging === group.key ? 'Merging...' : 'Auto-Merge')), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      fontSize: 12,
      fontFamily: T.mono,
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: `1px solid ${T.border}`,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Title"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Author"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Status"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Rating"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Genre"), /*#__PURE__*/React.createElement("th", {
    style: {
      padding: '4px 8px'
    }
  }, "Created"))), /*#__PURE__*/React.createElement("tbody", null, group.books.map((b, i) => /*#__PURE__*/React.createElement("tr", {
    key: b._id,
    style: {
      borderBottom: `1px solid ${T.border}22`,
      background: i === 0 ? `${T.accent}08` : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px',
      fontWeight: i === 0 ? 700 : 400
    }
  }, b.title), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, b.author), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: b.status
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, b.rating || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, b.genre), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '6px 8px'
    }
  }, new Date(b.createdAt).toLocaleDateString()))))))))), /*#__PURE__*/React.createElement(Card, {
    title: `Scraped Book Duplicates (${scrapedDups.length} groups)`
  }, scrapedDups.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 20,
      textAlign: 'center',
      opacity: .5,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No scraped duplicates found") : /*#__PURE__*/React.createElement(Table, {
    columns: [{
      key: '_id',
      label: 'Title / Author',
      render: v => /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, v.title), " \u2014 ", v.author)
    }, {
      key: 'count',
      label: 'Copies',
      mono: true
    }, {
      key: 'sources',
      label: 'Sources',
      render: v => v.join(', ')
    }],
    rows: scrapedDups,
    actions: row => /*#__PURE__*/React.createElement(Btn, {
      small: true,
      variant: "ghost",
      onClick: () => handleDismissScraped(row),
      disabled: !!merging
    }, "Dismiss Extras")
  })));
};

// ━━━ COMPETITOR INSIGHTS SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TYPE_COLOR = {
  editorial: '#8B5CF6',
  professional: '#3B82F6',
  bestseller: '#F59E0B',
  catalog: '#10B981',
  other: '#6B7280'
};
const CompetitorSection = () => {
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getCompetitorInsights());
  const [scraping, setScraping] = React.useState(null);
  const handleScrape = async source => {
    setScraping(source);
    try {
      await AdminClient.triggerScraper(source);
      setTimeout(refresh, 1500);
    } catch (e) {
      alert(`Scrape failed: ${e.message}`);
    } finally {
      setScraping(null);
    }
  };
  if (loading || !data) return /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "Loading competitor data\u2026");
  const {
    insights = [],
    totals = {}
  } = data;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Sources Active",
    value: totals.sources || 0
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Total Scraped",
    value: fmtNum(totals.totalScraped),
    color: T.info
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Imported to Catalog",
    value: fmtNum(totals.totalImported),
    color: T.ok,
    sub: totals.totalPending ? `${fmtNum(totals.totalPending)} pending` : null
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Source Coverage"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 12,
      fontFamily: T.mono
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      borderBottom: `1px solid ${T.border}`
    }
  }, ['Source', 'Type', 'Scraped', 'Imported', 'Pending', 'Last Run', 'Status', ''].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '6px 10px',
      textAlign: 'left',
      color: T.muted,
      fontWeight: 600,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      whiteSpace: 'nowrap'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, insights.map(row => /*#__PURE__*/React.createElement("tr", {
    key: row.source,
    style: {
      borderBottom: `1px solid ${T.border}22`
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px',
      color: T.text,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("div", null, row.label), row.url && /*#__PURE__*/React.createElement("a", {
    href: row.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: T.dim,
      fontSize: 10,
      textDecoration: 'none'
    }
  }, row.url.replace(/^https?:\/\//, ''))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 700,
      background: `${TYPE_COLOR[row.type] || T.dim}22`,
      color: TYPE_COLOR[row.type] || T.dim
    }
  }, row.type)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px',
      color: T.text
    }
  }, fmtNum(row.totalScraped)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px',
      color: T.ok
    }
  }, fmtNum(row.imported)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px',
      color: row.pending > 0 ? T.warn : T.dim
    }
  }, fmtNum(row.pending)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px',
      color: T.muted,
      whiteSpace: 'nowrap'
    }
  }, row.lastRun ? fmtDate(row.lastRun) : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 700,
      background: row.lastStatus === 'completed' ? `${T.ok}22` : row.lastStatus === 'failed' ? `${T.err}22` : row.lastStatus === 'never' ? `${T.dim}22` : `${T.info}22`,
      color: row.lastStatus === 'completed' ? T.ok : row.lastStatus === 'failed' ? T.err : row.lastStatus === 'never' ? T.dim : T.info
    }
  }, row.lastStatus)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '8px 10px'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    disabled: scraping === row.source,
    onClick: () => handleScrape(row.source)
  }, scraping === row.source ? '…' : 'Scrape'))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "primary",
    disabled: !!scraping,
    onClick: () => handleScrape(null)
  }, scraping ? `Scraping ${scraping}…` : 'Run All Sources')));
};

// ─── SECTION: Authors ────────────────────────────────────────────
const AuthorsSection = () => {
  const [bioFilter, setBioFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [running, setRunning] = React.useState(false);
  const [runMsg, setRunMsg] = React.useState('');
  const [batchSize, setBatchSize] = React.useState(50);
  const [regenerating, setRegenerating] = React.useState(null);
  const [seeding, setSeeding] = React.useState(false);
  const [seedMsg, setSeedMsg] = React.useState('');
  const {
    data: stats,
    refresh: refreshStats
  } = useAdminApi(() => AdminClient.getAuthorStats());
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getAdminAuthors({
    page,
    limit: 30,
    ...(bioFilter ? {
      bioStatus: bioFilter
    } : {})
  }), [page, bioFilter]);
  const refreshAll = () => {
    refreshStats();
    refresh();
  };
  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      const r = await AdminClient.seedAuthors();
      setSeedMsg(`✓ Seeded — ${r.created.toLocaleString()} new, ${r.updated.toLocaleString()} updated (${r.total.toLocaleString()} total). Now run Sofia Kwon to generate bios.`);
      setTimeout(refreshAll, 500);
    } catch (e) {
      setSeedMsg(`✗ ${e.message}`);
    } finally {
      setSeeding(false);
    }
  };
  const handleRun = async () => {
    setRunning(true);
    setRunMsg('');
    try {
      const r = await AdminClient.triggerAuthorBios(batchSize);
      setRunMsg(`✓ Run started — ID: ${r.runId}`);
      setTimeout(refreshAll, 3000);
    } catch (e) {
      setRunMsg(`✗ ${e.message}`);
    } finally {
      setRunning(false);
    }
  };
  const handleRegenerate = async (id, name) => {
    setRegenerating(id);
    try {
      await AdminClient.regenerateAuthorBio(id);
      refreshAll();
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setRegenerating(null);
    }
  };
  const BIO_STATUS_COLORS = {
    generated: T.ok,
    pending: T.warn,
    failed: T.err
  };
  const authors = data?.authors || [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Total Authors",
    value: fmtNum(stats?.total || 0)
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Bios Generated",
    value: fmtNum(stats?.generated || 0),
    color: T.ok
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Pending",
    value: fmtNum(stats?.pending || 0),
    color: T.warn,
    onClick: () => {
      setBioFilter('pending');
      setPage(1);
    }
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Failed",
    value: fmtNum(stats?.failed || 0),
    color: stats?.failed > 0 ? T.err : T.text,
    onClick: () => {
      setBioFilter('failed');
      setPage(1);
    }
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Seed Author List",
    actions: /*#__PURE__*/React.createElement(Btn, {
      variant: "ok",
      disabled: seeding,
      onClick: handleSeed
    }, seeding ? 'Seeding…' : '⊕ Seed from Books')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontFamily: T.sans,
      color: T.muted,
      lineHeight: 1.6
    }
  }, "Scans all published books and creates an Author entry for every unique author name.", /*#__PURE__*/React.createElement("br", null), "Run this once to populate the list, then let Sofia Kwon generate the bios."), seedMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      fontFamily: T.mono,
      color: seedMsg.startsWith('✓') ? T.ok : T.err
    }
  }, seedMsg)), /*#__PURE__*/React.createElement(Card, {
    title: "Sofia Kwon \u2014 Profiles Editor",
    actions: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Select, {
      value: batchSize,
      onChange: v => setBatchSize(Number(v)),
      style: {
        width: 120
      }
    }, [20, 50, 100, 200, 500].map(n => /*#__PURE__*/React.createElement("option", {
      key: n,
      value: n
    }, n, " authors"))), /*#__PURE__*/React.createElement(Btn, {
      variant: "ok",
      disabled: running,
      onClick: handleRun
    }, running ? 'Running…' : '▶ Run Now'))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontFamily: T.sans,
      color: T.muted,
      lineHeight: 1.6
    }
  }, "Generates AI biographies for pending authors, fetches photos from Open Library.", /*#__PURE__*/React.createElement("br", null), "Auto-runs every 4 hours. Use ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: T.text
    }
  }, "Run Now"), " to blast through the backlog immediately."), runMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontSize: 12,
      fontFamily: T.mono,
      color: runMsg.startsWith('✓') ? T.ok : T.err
    }
  }, runMsg)), /*#__PURE__*/React.createElement(Card, {
    title: "Author Catalog",
    actions: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Select, {
      value: bioFilter,
      onChange: v => {
        setBioFilter(v);
        setPage(1);
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "All statuses"), /*#__PURE__*/React.createElement("option", {
      value: "generated"
    }, "Generated"), /*#__PURE__*/React.createElement("option", {
      value: "pending"
    }, "Pending"), /*#__PURE__*/React.createElement("option", {
      value: "failed"
    }, "Failed")), /*#__PURE__*/React.createElement(Btn, {
      small: true,
      variant: "ghost",
      onClick: refreshAll
    }, "\u21BB Refresh"))
  }, loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 30,
      color: T.muted,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "Loading\u2026") : authors.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 30,
      color: T.dim,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No authors found.", !stats?.total ? ' Run the populate script first.' : '') : /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: T.hover
    }
  }, ['Author', 'Nationality', 'Books', 'Genres', 'Status', 'Photo', ''].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      color: T.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, authors.map(a => /*#__PURE__*/React.createElement("tr", {
    key: a._id,
    style: {
      borderTop: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontFamily: T.serif,
      fontWeight: 700,
      color: T.text
    }
  }, a.name), a.shortBio && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.sans,
      color: T.dim,
      marginTop: 2,
      maxWidth: 240,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, a.shortBio)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 12,
      fontFamily: T.mono,
      color: T.muted
    }
  }, a.nationality || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 13,
      fontFamily: T.mono,
      color: T.text,
      textAlign: 'center'
    }
  }, a.bookCount), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontSize: 11,
      fontFamily: T.mono,
      color: T.muted
    }
  }, (a.genres || []).slice(0, 2).join(', ') || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      background: BIO_STATUS_COLORS[a.bioStatus] || T.dim,
      color: '#fff'
    }
  }, a.bioStatus)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      textAlign: 'center'
    }
  }, a.photoUrl ? /*#__PURE__*/React.createElement("img", {
    src: a.photoUrl,
    alt: "",
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      objectFit: 'cover',
      border: `1px solid ${T.border}`
    },
    onError: e => {
      e.target.style.display = 'none';
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: T.dim,
      fontFamily: T.mono
    }
  }, "\u2014")), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    disabled: regenerating === a._id,
    onClick: () => handleRegenerate(a._id, a.name)
  }, regenerating === a._id ? '…' : '↺ Regen'))))))), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    totalPages: data?.pages,
    onChange: setPage
  })));
};

// ─── SECTION: Videos ─────────────────────────────────────────────
const VIDEO_STATUS_COLORS = {
  done: T.ok,
  failed: T.err,
  rendering: '#7C6FCF',
  tts: T.warn,
  scripting: T.warn,
  queued: T.dim
};
const VideosSection = () => {
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [batchSize, setBatchSize] = React.useState(3);
  const [running, setRunning] = React.useState(false);
  const [runMsg, setRunMsg] = React.useState('');
  const [genBookId, setGenBookId] = React.useState('');
  const {
    data: stats,
    refresh: refreshStats
  } = useAdminApi(() => AdminClient.getVideoStats());
  const {
    data,
    loading,
    refresh
  } = useAdminApi(() => AdminClient.getVideos({
    page,
    limit: 20,
    ...(statusFilter ? {
      status: statusFilter
    } : {})
  }), [page, statusFilter]);
  const refreshAll = () => {
    refreshStats();
    refresh();
  };
  const handleBatch = async () => {
    setRunning(true);
    setRunMsg('');
    try {
      const r = await AdminClient.generateVideoBatch(batchSize);
      setRunMsg(`✓ ${r.message}`);
      setTimeout(refreshAll, 5000);
    } catch (e) {
      setRunMsg(`✗ ${e.message}`);
    } finally {
      setRunning(false);
    }
  };
  const handleSingle = async () => {
    if (!genBookId.trim()) return;
    setRunning(true);
    setRunMsg('');
    try {
      const r = await AdminClient.generateVideo(genBookId.trim());
      setRunMsg(`✓ ${r.message}`);
      setGenBookId('');
      setTimeout(refreshAll, 5000);
    } catch (e) {
      setRunMsg(`✗ ${e.message}`);
    } finally {
      setRunning(false);
    }
  };
  const handleDelete = async id => {
    if (!confirm('Delete this video job and its files?')) return;
    try {
      await AdminClient.deleteVideo(id);
      refreshAll();
    } catch (e) {
      alert(e.message);
    }
  };
  const jobs = data?.jobs || [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Metric, {
    label: "Total Jobs",
    value: fmtNum(stats?.total || 0)
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Done",
    value: fmtNum(stats?.done || 0),
    color: T.ok
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Rendering",
    value: fmtNum(stats?.rendering || 0),
    color: "#7C6FCF"
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Queued",
    value: fmtNum(stats?.queued || 0),
    color: T.warn
  }), /*#__PURE__*/React.createElement(Metric, {
    label: "Failed",
    value: fmtNum(stats?.failed || 0),
    color: stats?.failed > 0 ? T.err : T.text
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Generate Videos"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.sans,
      fontSize: 13,
      color: T.muted
    }
  }, "Batch next"), /*#__PURE__*/React.createElement(Select, {
    value: batchSize,
    onChange: v => setBatchSize(Number(v)),
    style: {
      width: 110
    }
  }, [1, 2, 3, 5, 10].map(n => /*#__PURE__*/React.createElement("option", {
    key: n,
    value: n
  }, n, " video", n > 1 ? 's' : ''))), /*#__PURE__*/React.createElement(Btn, {
    variant: "ok",
    disabled: running,
    onClick: handleBatch
  }, running ? 'Starting…' : '▶ Run Batch')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: T.sans,
      fontSize: 13,
      color: T.muted
    }
  }, "Single book ID"), /*#__PURE__*/React.createElement("input", {
    value: genBookId,
    onChange: e => setGenBookId(e.target.value),
    placeholder: "MongoDB _id",
    style: {
      background: T.inputBg,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      padding: '8px 12px',
      fontFamily: T.mono,
      fontSize: 12,
      color: T.text,
      width: 260
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    disabled: running || !genBookId.trim(),
    onClick: handleSingle
  }, "Generate")), runMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.mono,
      color: runMsg.startsWith('✓') ? T.ok : T.err
    }
  }, runMsg), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontFamily: T.sans,
      color: T.dim,
      lineHeight: 1.6
    }
  }, "Each video: AI script \u2192 ElevenLabs TTS \u2192 Remotion render \u2192 MP4.", /*#__PURE__*/React.createElement("br", null), "Rendering takes 2\u20135 minutes per video. Status updates every 5 seconds."))), /*#__PURE__*/React.createElement(Card, {
    title: "Video Jobs",
    actions: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Select, {
      value: statusFilter,
      onChange: v => {
        setStatusFilter(v);
        setPage(1);
      }
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "All statuses"), ['queued', 'scripting', 'tts', 'rendering', 'done', 'failed'].map(s => /*#__PURE__*/React.createElement("option", {
      key: s,
      value: s
    }, s))), /*#__PURE__*/React.createElement(Btn, {
      small: true,
      variant: "ghost",
      onClick: refreshAll
    }, "\u21BB Refresh"))
  }, loading ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 30,
      color: T.muted,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "Loading\u2026") : jobs.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 30,
      color: T.dim,
      fontFamily: T.mono,
      fontSize: 12
    }
  }, "No video jobs yet.") : /*#__PURE__*/React.createElement("div", {
    style: {
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: T.hover
    }
  }, ['Book', 'Status', 'Duration', 'Video Title', 'Created', ''].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.08em',
      color: T.muted
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, jobs.map(j => /*#__PURE__*/React.createElement("tr", {
    key: j._id,
    style: {
      borderTop: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontFamily: T.serif,
      fontWeight: 700,
      color: T.text
    }
  }, j.bookId?.title || '—'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontFamily: T.mono,
      color: T.dim
    }
  }, j.bookId?.author)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 10,
      fontWeight: 700,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.06em',
      background: VIDEO_STATUS_COLORS[j.status] || T.dim,
      color: '#fff'
    }
  }, j.status), j.error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.err,
      fontFamily: T.mono,
      marginTop: 4,
      maxWidth: 200
    }
  }, j.error.slice(0, 60))), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontFamily: T.mono,
      fontSize: 12,
      color: T.muted
    }
  }, j.durationMs ? `${Math.round(j.durationMs / 1000)}s` : j.script?.totalSeconds ? `~${j.script.totalSeconds}s` : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontFamily: T.sans,
      fontSize: 12,
      color: T.text,
      maxWidth: 220
    }
  }, j.script?.title || '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px',
      fontFamily: T.mono,
      fontSize: 11,
      color: T.dim
    }
  }, j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '—'), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, j.videoPath && /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ok",
    onClick: () => window.open(`/videos/${j._id}/download`, '_blank')
  }, "\u2B07 MP4"), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => handleDelete(j._id)
  }, "\u2715")))))))), /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    totalPages: data?.pages,
    onChange: setPage
  })));
};
const SECTIONS = [{
  id: 'overview',
  label: 'Overview',
  icon: '◐'
}, {
  id: 'runs',
  label: 'Agent Runs',
  icon: '▶'
}, {
  id: 'books',
  label: 'Books',
  icon: '▤'
}, {
  id: 'authors',
  label: 'Authors',
  icon: '✍'
}, {
  id: 'videos',
  label: 'Videos',
  icon: '▷'
}, {
  id: 'scraper',
  label: 'Scraper',
  icon: '⇣'
}, {
  id: 'duplicates',
  label: 'Duplicates',
  icon: '⊘'
}, {
  id: 'competitors',
  label: 'Competitors',
  icon: '◈'
}, {
  id: 'editors',
  label: 'Editors',
  icon: '✎'
}, {
  id: 'analytics',
  label: 'Analytics',
  icon: '◔'
}, {
  id: 'system',
  label: 'System',
  icon: '⚙'
}];
const Admin = ({
  setRoute
}) => {
  const [authed, setAuthed] = React.useState(!!AdminClient.getToken());
  const [section, setSection] = React.useState('overview');
  const [sectionParams, setSectionParams] = React.useState({});
  const navigate = (sec, params = {}) => {
    setSectionParams(params);
    setSection(sec);
  };
  if (!authed) return /*#__PURE__*/React.createElement(AdminLogin, {
    onAuth: () => setAuthed(true)
  });
  const SectionComponent = {
    overview: OverviewSection,
    runs: RunsSection,
    books: BooksSection,
    authors: AuthorsSection,
    videos: VideosSection,
    scraper: ScraperSection,
    duplicates: DuplicatesSection,
    competitors: CompetitorSection,
    editors: EditorsSection,
    analytics: AnalyticsSection,
    system: SystemSection
  }[section];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: T.bg,
      color: T.text,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      borderRight: `1px solid ${T.border}`,
      padding: '20px 0',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setRoute({
      name: 'home'
    }),
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '12px 20px',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontFamily: T.serif,
      fontWeight: 900,
      color: T.text
    }
  }, "Reviewer ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.accent,
      fontStyle: 'italic'
    }
  }, "Insight")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontFamily: T.mono,
      textTransform: 'uppercase',
      letterSpacing: '.16em',
      color: T.dim,
      marginTop: 2
    }
  }, "Admin Panel")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: T.border,
      margin: '12px 0'
    }
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      padding: '0 8px'
    }
  }, SECTIONS.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    onClick: () => navigate(s.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: T.sans,
      fontWeight: 500,
      background: section === s.id ? `${T.accent}20` : 'transparent',
      color: section === s.id ? T.accentHover : T.muted,
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      width: 20,
      textAlign: 'center'
    }
  }, s.icon), s.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 20px',
      borderTop: `1px solid ${T.border}`
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    small: true,
    variant: "ghost",
    onClick: () => {
      AdminClient.clearToken();
      setAuthed(false);
    },
    style: {
      width: '100%'
    }
  }, "Sign Out"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 28,
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontSize: 28,
      fontFamily: T.serif,
      fontWeight: 900
    }
  }, SECTIONS.find(s => s.id === section)?.label)), /*#__PURE__*/React.createElement(SectionComponent, {
    navigate: navigate,
    params: sectionParams
  }))));
};
window.Admin = Admin;