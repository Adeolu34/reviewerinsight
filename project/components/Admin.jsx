// ─── Admin Dashboard for Reviewer Insight ──────────────────────
// Dark-themed control panel: overview, agents, books, editors, analytics, system
const { useState, useEffect, useRef, useCallback } = React;

const T = {
  bg: '#0F0F0F', card: '#1A1A1A', hover: '#252525', border: '#333',
  text: '#E5E5E5', muted: '#999', dim: '#666',
  accent: '#6366F1', accentHover: '#818CF8',
  ok: '#10B981', warn: '#F59E0B', err: '#EF4444', info: '#3B82F6',
  mono: '"JetBrains Mono", monospace', sans: '"Space Grotesk", sans-serif', serif: '"DM Serif Display", Georgia, serif',
};

const STATUS_COLORS = {
  running: T.info, completed: T.ok, failed: T.err, partial: T.warn,
  discovered: '#8B5CF6', metadata_complete: '#A78BFA', review_pending: T.warn,
  review_complete: '#34D399', published: T.ok,
};

// ─── Utility Helpers ────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDur = (ms) => {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
};
const fmtUptime = (s) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
};
const fmtCost = (v) => `$${(v || 0).toFixed(2)}`;
const fmtNum = (v) => (v || 0).toLocaleString();

// ─── Shared UI Components ───────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
    fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.06em',
    background: STATUS_COLORS[status] || T.dim, color: '#fff',
  }}>{status}</span>
);

const Card = ({ title, actions, children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, ...style }}>
    {title && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.border}` }}>
        <h3 style={{ margin: 0, fontSize: 15, fontFamily: T.mono, fontWeight: 600, color: T.text, letterSpacing: '.02em' }}>{title}</h3>
        {actions}
      </div>
    )}
    {children}
  </div>
);

const Metric = ({ label, value, sub, color }) => (
  <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '18px 16px', textAlign: 'center' }}>
    <div style={{ fontSize: 11, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: T.serif, color: color || T.text, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, fontFamily: T.mono, color: T.dim, marginTop: 6 }}>{sub}</div>}
  </div>
);

const Btn = ({ children, onClick, variant = 'primary', disabled, small, style: sx }) => {
  const base = { padding: small ? '6px 12px' : '9px 16px', borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: small ? 11 : 12, fontWeight: 700, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.05em', transition: 'all .15s', opacity: disabled ? .5 : 1 };
  const variants = {
    primary: { background: T.accent, color: '#fff' },
    ok: { background: T.ok, color: '#fff' },
    danger: { background: T.err, color: '#fff' },
    ghost: { background: 'transparent', color: T.text, border: `1px solid ${T.border}` },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...sx }}>{children}</button>;
};

const Select = ({ value, onChange, children, style: sx }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '8px 12px', background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.mono, fontSize: 12, cursor: 'pointer', ...sx }}>{children}</select>
);

const Input = ({ value, onChange, placeholder, type = 'text', style: sx, ...props }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ padding: '8px 12px', background: T.card, color: T.text, border: `1px solid ${T.border}`, borderRadius: 6, fontFamily: T.sans, fontSize: 13, outline: 'none', width: '100%', ...sx }} {...props} />
);

const Pagination = ({ page, totalPages, onChange }) => {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
      <Btn small variant="ghost" onClick={() => onChange(page - 1)} disabled={page <= 1}>Prev</Btn>
      <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>Page {page} of {totalPages}</span>
      <Btn small variant="ghost" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Next</Btn>
    </div>
  );
};

const Table = ({ columns, rows, onRowClick }) => (
  <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: T.hover }}>
          {columns.map(c => (
            <th key={c.key} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted, width: c.width }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row._id || row.id || i} onClick={() => onRowClick && onRowClick(row)}
            style={{ borderTop: `1px solid ${T.border}`, cursor: onRowClick ? 'pointer' : 'default', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = T.hover}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {columns.map(c => (
              <td key={c.key} style={{ padding: '10px 12px', fontSize: 13, fontFamily: c.mono ? T.mono : T.sans, color: T.text }}>
                {c.render ? c.render(row[c.key], row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: T.dim, fontFamily: T.mono, fontSize: 12 }}>No data</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

// ─── Modal ──────────────────────────────────────────────────────
const Modal = ({ title, children, onClose, width = 640 }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
    onClick={onClose}>
    <div style={{ width, maxWidth: '92vw', maxHeight: '88vh', overflow: 'auto', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, padding: 28 }}
      onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: T.serif, color: T.text }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: T.muted, cursor: 'pointer', padding: 4 }}>x</button>
      </div>
      {children}
    </div>
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, marginBottom: 6 }}>{children}</div>
);

// ─── useAdminApi hook ───────────────────────────────────────────
function useAdminApi(fetchFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));
    fetchFn()
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err }); });
    return () => { cancelled = true; };
  }, [...deps, tick]);

  return { ...state, refresh: () => setTick(t => t + 1) };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Overview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const OverviewSection = () => {
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getOverview());

  if (loading) return <div style={{ color: T.muted, fontFamily: T.mono, padding: 40, textAlign: 'center' }}>Loading dashboard...</div>;
  if (!data) return <div style={{ color: T.err, padding: 40 }}>Failed to load overview</div>;

  const { metrics: m, agentStatus: a, costSummary: c, recentErrors, statusBreakdown } = data;
  const maxStatus = Math.max(...Object.values(statusBreakdown), 1);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Metric label="Total Books" value={fmtNum(m.totalBooks)} sub={`+${m.todayDiscovered} today`} />
        <Metric label="Published" value={fmtNum(m.publishedBooks)} color={T.ok} />
        <Metric label="Pending Review" value={m.pendingReviews} color={T.warn} />
        <Metric label="Failed" value={m.failedBooks} color={m.failedBooks > 0 ? T.err : T.text} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Metric label="Chapter Summaries" value={fmtNum(m.totalChapters)} />
        <Metric label="Reviewed Today" value={m.todayReviewed} color={T.info} />
      </div>

      {/* Agent Status + Cost */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <Card title="Agent Status">
          <div style={{ display: 'grid', gap: 14 }}>
            {a.currentlyRunning && (
              <div style={{ padding: 12, background: `${T.info}15`, border: `1px solid ${T.info}40`, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontFamily: T.mono, color: T.info, fontWeight: 700 }}>RUNNING NOW</div>
                <div style={{ fontSize: 15, fontFamily: T.sans, color: T.text, marginTop: 4 }}>{a.currentlyRunning.editor}</div>
                <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, marginTop: 2 }}>Started {fmtTime(a.currentlyRunning.startedAt)}</div>
              </div>
            )}
            {a.lastRun && (
              <div>
                <Label>Last Run</Label>
                <div style={{ fontSize: 14, fontFamily: T.sans, color: T.text }}>{a.lastRun.editor} — {a.lastRun.booksReviewed} books <StatusBadge status={a.lastRun.status} /></div>
                <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, marginTop: 2 }}>{fmtTime(a.lastRun.completedAt)}</div>
              </div>
            )}
            {a.nextScheduled && (
              <div>
                <Label>Next Scheduled</Label>
                <div style={{ fontSize: 14, fontFamily: T.sans, color: T.text }}>{a.nextScheduled.editor}</div>
                <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, marginTop: 2 }}>{fmtTime(a.nextScheduled.scheduledFor)}</div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Cost Summary">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>Today</span>
              <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>{fmtCost(c.today)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>This Week</span>
              <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>{fmtCost(c.thisWeek)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>This Month</span>
              <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.text }}>{fmtCost(c.thisMonth)}</span>
            </div>
            <div style={{ height: 1, background: T.border }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>Daily Budget</span>
              <span style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: c.today > c.budget ? T.err : T.ok }}>{fmtCost(c.budget)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card title="Book Status Breakdown">
        <div style={{ display: 'grid', gap: 10 }}>
          {Object.entries(statusBreakdown).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120, fontSize: 12, fontFamily: T.mono, color: T.muted, textTransform: 'capitalize' }}>{status.replace('_', ' ')}</div>
              <div style={{ flex: 1, height: 22, background: T.hover, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${(count / maxStatus) * 100}%`, background: STATUS_COLORS[status] || T.accent, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
              <div style={{ width: 50, fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.text, textAlign: 'right' }}>{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Errors */}
      <Card title="Recent Errors" actions={<Btn small variant="ghost" onClick={refresh}>Refresh</Btn>}>
        {recentErrors.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: T.ok, fontFamily: T.mono, fontSize: 12 }}>No recent errors</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {recentErrors.slice(0, 8).map((e, i) => (
              <div key={i} style={{ padding: 10, background: T.hover, borderRadius: 6, borderLeft: `3px solid ${T.err}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{e.bookTitle || 'Unknown'}</span>
                  <span style={{ fontSize: 10, fontFamily: T.mono, color: T.dim }}>{e.editor}</span>
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4, fontFamily: T.mono, wordBreak: 'break-word' }}>{e.error}</div>
                <div style={{ fontSize: 10, color: T.dim, marginTop: 4, fontFamily: T.mono }}>{fmtTime(e.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Agent Runs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const RunsSection = () => {
  const [filters, setFilters] = useState({ editor: '', status: '', page: 1 });
  const [modal, setModal] = useState(null); // 'trigger' or run object
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getRuns(filters), [filters]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={filters.editor} onChange={v => setFilters({ ...filters, editor: v, page: 1 })}>
          <option value="">All Editors</option>
          <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
        </Select>
        <Select value={filters.status} onChange={v => setFilters({ ...filters, status: v, page: 1 })}>
          <option value="">All Statuses</option>
          <option>running</option><option>completed</option><option>failed</option><option>partial</option>
        </Select>
        <div style={{ flex: 1 }} />
        <Btn onClick={() => setModal('trigger')}>+ Trigger Run</Btn>
        <Btn variant="ghost" onClick={refresh}>Refresh</Btn>
      </div>

      {/* Table */}
      {loading ? <div style={{ color: T.muted, fontFamily: T.mono, padding: 20 }}>Loading...</div> : (
        <>
          <Table
            columns={[
              { key: 'editor', label: 'Editor', width: '18%' },
              { key: 'startedAt', label: 'Started', render: v => fmtTime(v), mono: true },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
              { key: 'booksDiscovered', label: 'Found', mono: true },
              { key: 'booksReviewed', label: 'Reviewed', mono: true },
              { key: 'booksFailed', label: 'Failed', render: v => <span style={{ color: v > 0 ? T.err : T.dim }}>{v}</span>, mono: true },
              { key: 'estimatedCost', label: 'Cost', render: v => fmtCost(v), mono: true },
              { key: 'durationMs', label: 'Duration', render: v => fmtDur(v), mono: true },
            ]}
            rows={data?.runs || []}
            onRowClick={run => setModal(run)}
          />
          <Pagination page={filters.page} totalPages={data?.totalPages} onChange={p => setFilters({ ...filters, page: p })} />
        </>
      )}

      {/* Run Detail Modal */}
      {modal && modal !== 'trigger' && modal._id && (
        <Modal title={`Run: ${modal.editor}`} onClose={() => setModal(null)} width={720}>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <Metric label="Discovered" value={modal.booksDiscovered} />
              <Metric label="Reviewed" value={modal.booksReviewed} />
              <Metric label="Chapters" value={modal.chaptersGenerated || 0} />
              <Metric label="Skipped" value={modal.booksSkipped} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><Label>Status</Label><StatusBadge status={modal.status} /></div>
              <div><Label>Duration</Label><span style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{fmtDur(modal.durationMs)}</span></div>
              <div><Label>Cost</Label><span style={{ color: T.text, fontFamily: T.mono, fontSize: 13 }}>{fmtCost(modal.estimatedCost)} ({fmtNum(modal.tokensUsed)} tokens)</span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><Label>Started</Label><span style={{ color: T.text, fontFamily: T.mono, fontSize: 12 }}>{fmtTime(modal.startedAt)}</span></div>
              <div><Label>Completed</Label><span style={{ color: T.text, fontFamily: T.mono, fontSize: 12 }}>{fmtTime(modal.completedAt)}</span></div>
            </div>
            {modal.searchQueries?.length > 0 && (
              <Card title="Search Queries">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {modal.searchQueries.map((q, i) => (
                    <span key={i} style={{ padding: '4px 10px', background: T.hover, borderRadius: 6, fontSize: 11, fontFamily: T.mono, color: T.muted }}>{q}</span>
                  ))}
                </div>
              </Card>
            )}
            {modal.errors?.length > 0 && (
              <Card title={`Errors (${modal.errors.length})`}>
                <div style={{ display: 'grid', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {modal.errors.map((e, i) => (
                    <div key={i} style={{ padding: 8, background: T.hover, borderRadius: 6, borderLeft: `3px solid ${T.err}` }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{e.bookTitle}</span>
                      <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted, marginTop: 2 }}>{e.error}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </Modal>
      )}

      {/* Trigger Modal */}
      {modal === 'trigger' && <TriggerModal onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
    </div>
  );
};

const TriggerModal = ({ onClose, onDone }) => {
  const [editor, setEditor] = useState('Mira Okafor');
  const [batch, setBatch] = useState('8');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const go = async () => {
    setBusy(true); setMsg('');
    try {
      await AdminClient.triggerAgent(editor, parseInt(batch));
      setMsg(`Started ${editor} (batch ${batch})`);
      setTimeout(onDone, 1200);
    } catch (e) { setMsg(`Error: ${e.message}`); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Trigger Agent Run" onClose={onClose} width={420}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div><Label>Editor</Label><Select value={editor} onChange={setEditor} style={{ width: '100%' }}>
          <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
        </Select></div>
        <div><Label>Batch Size</Label><Input type="number" value={batch} onChange={setBatch} min="1" max="20" /></div>
        {msg && <div style={{ padding: 10, borderRadius: 6, background: msg.startsWith('Error') ? `${T.err}20` : `${T.ok}20`, color: msg.startsWith('Error') ? T.err : T.ok, fontSize: 12, fontFamily: T.mono }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={go} disabled={busy}>{busy ? 'Starting...' : 'Start Run'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Books
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BooksSection = () => {
  const [filters, setFilters] = useState({ status: '', genre: '', editor: '', search: '', page: 1 });
  const [modal, setModal] = useState(null); // { type, book }
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);

  const { data, loading, refresh } = useAdminApi(() => AdminClient.getAdminBooks(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  ), [filters]);

  const handleSearch = (v) => {
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilters(f => ({ ...f, search: v, page: 1 })), 350);
  };

  const handleFeature = async (book) => {
    try {
      await AdminClient.updateBook(book._id, { featured: !book.featured });
      refresh();
    } catch (e) { alert(e.message); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
        <Input value={searchInput} onChange={handleSearch} placeholder="Search books..." />
        <Select value={filters.status} onChange={v => setFilters({ ...filters, status: v, page: 1 })}>
          <option value="">All Statuses</option>
          <option>discovered</option><option>metadata_complete</option><option>review_pending</option>
          <option>review_complete</option><option>published</option><option>failed</option>
        </Select>
        <Select value={filters.genre} onChange={v => setFilters({ ...filters, genre: v, page: 1 })}>
          <option value="">All Genres</option>
          <option>Fiction</option><option>Essays</option><option>Memoir</option><option>Sci-Fi</option>
          <option>History</option><option>Business</option><option>Nature</option>
        </Select>
        <Select value={filters.editor} onChange={v => setFilters({ ...filters, editor: v, page: 1 })}>
          <option value="">All Editors</option>
          <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
        </Select>
      </div>

      <div style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>
        Showing {data?.books?.length || 0} of {data?.total || 0} books
      </div>

      {loading ? <div style={{ color: T.muted, fontFamily: T.mono, padding: 20 }}>Loading...</div> : (
        <>
          <Table
            columns={[
              { key: 'title', label: 'Title', width: '24%', render: (v, r) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{v}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{r.author}</div>
                </div>
              )},
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
              { key: 'genre', label: 'Genre', mono: true },
              { key: 'editor', label: 'Editor', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
              { key: 'rating', label: 'Rating', render: v => v ? v.toFixed(1) : '—', mono: true },
              { key: 'featured', label: 'Feat.', render: (v, book) => (
                <input type="checkbox" checked={!!v} onChange={() => handleFeature(book)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
              )},
              { key: 'createdAt', label: 'Added', render: v => fmtDate(v), mono: true },
              { key: '_actions', label: '', width: '140px', render: (_, book) => (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Btn small variant="ghost" onClick={e => { e.stopPropagation(); setModal({ type: 'edit', book }); }}>Edit</Btn>
                  {book.status === 'failed' && <Btn small variant="ok" onClick={e => { e.stopPropagation(); setModal({ type: 'retry', book }); }}>Retry</Btn>}
                  <Btn small variant="danger" onClick={e => { e.stopPropagation(); setModal({ type: 'delete', book }); }}>Del</Btn>
                </div>
              )},
            ]}
            rows={data?.books || []}
          />
          <Pagination page={filters.page} totalPages={data?.totalPages} onChange={p => setFilters({ ...filters, page: p })} />
        </>
      )}

      {/* Modals */}
      {modal?.type === 'edit' && <EditBookModal book={modal.book} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'delete' && <DeleteBookModal book={modal.book} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal?.type === 'retry' && <RetryBookModal book={modal.book} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
    </div>
  );
};

const EditBookModal = ({ book, onClose, onDone }) => {
  const [status, setStatus] = useState(book.status);
  const [rating, setRating] = useState(String(book.rating || ''));
  const [editor, setEditor] = useState(book.editor || '');
  const [genre, setGenre] = useState(book.genre || '');
  const [featured, setFeatured] = useState(!!book.featured);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    setBusy(true);
    try {
      const updates = { status, featured, editor, genre };
      if (rating) updates.rating = parseFloat(rating);
      await AdminClient.updateBook(book._id, updates);
      onDone();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Edit: ${book.title}`} onClose={onClose} width={480}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div><Label>Status</Label><Select value={status} onChange={setStatus} style={{ width: '100%' }}>
          <option>discovered</option><option>metadata_complete</option><option>review_pending</option>
          <option>review_complete</option><option>published</option><option>failed</option>
        </Select></div>
        <div><Label>Rating</Label><Input type="number" step="0.1" min="0" max="5" value={rating} onChange={setRating} placeholder="0.0 - 5.0" /></div>
        <div><Label>Editor</Label><Select value={editor} onChange={setEditor} style={{ width: '100%' }}>
          <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
        </Select></div>
        <div><Label>Genre</Label><Select value={genre} onChange={setGenre} style={{ width: '100%' }}>
          <option>Fiction</option><option>Essays</option><option>Memoir</option><option>Sci-Fi</option>
          <option>History</option><option>Business</option><option>Nature</option>
        </Select></div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 13, fontFamily: T.sans, color: T.text }}>Featured</span>
        </label>
        {msg && <div style={{ color: T.err, fontSize: 12, fontFamily: T.mono }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Btn onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

const DeleteBookModal = ({ book, onClose, onDone }) => {
  const [hard, setHard] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      await AdminClient.deleteBook(book._id, hard);
      onDone();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Delete Book" onClose={onClose} width={440}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: 14, background: T.hover, borderRadius: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.serif, color: T.text }}>{book.title}</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>by {book.author}</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={hard} onChange={e => setHard(e.target.checked)} />
          <span style={{ fontSize: 13, color: T.text }}>Permanently delete (cannot be undone)</span>
        </label>
        {!hard && <div style={{ fontSize: 11, fontFamily: T.mono, color: T.muted }}>Soft delete marks the book as "failed"</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="danger" onClick={go} disabled={busy}>{busy ? 'Deleting...' : hard ? 'Delete Forever' : 'Soft Delete'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

const RetryBookModal = ({ book, onClose, onDone }) => {
  const [step, setStep] = useState('review');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      await AdminClient.retryBook(book._id, step);
      onDone();
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Retry: ${book.title}`} onClose={onClose} width={440}>
      <div style={{ display: 'grid', gap: 14 }}>
        {book.errorLog && (
          <div style={{ padding: 10, background: `${T.err}15`, borderRadius: 6, borderLeft: `3px solid ${T.err}` }}>
            <Label>Error</Label>
            <div style={{ fontSize: 12, fontFamily: T.mono, color: T.muted, wordBreak: 'break-word' }}>{book.errorLog}</div>
          </div>
        )}
        <div><Label>Retry from step</Label><Select value={step} onChange={setStep} style={{ width: '100%' }}>
          <option value="metadata">Metadata (re-discover)</option>
          <option value="review">Review (re-generate review)</option>
          <option value="chapters">Chapters (re-generate summaries)</option>
        </Select></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={go} disabled={busy}>{busy ? 'Retrying...' : 'Retry'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Editors
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EditorsSection = () => {
  const { data, loading } = useAdminApi(() => AdminClient.getEditorStats());

  if (loading) return <div style={{ color: T.muted, fontFamily: T.mono, padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!data) return <div style={{ color: T.err, padding: 40 }}>Failed to load editor stats</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {data.editors.map(ed => (
        <Card key={ed.name} title={ed.name}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            <Metric label="Runs" value={ed.totalRuns} />
            <Metric label="Success" value={`${ed.successRate}%`} color={ed.successRate >= 90 ? T.ok : ed.successRate >= 70 ? T.warn : T.err} />
            <Metric label="Books" value={ed.publishedBooks} />
            <Metric label="Avg Rating" value={ed.avgRating.toFixed(1)} color={T.accent} />
            <Metric label="Total Cost" value={fmtCost(ed.totalCost)} />
          </div>
          {ed.lastRun && (
            <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderTop: `1px solid ${T.border}`, fontSize: 12, fontFamily: T.mono, color: T.muted }}>
              <span>Last run: {fmtTime(ed.lastRun.startedAt)}</span>
              <StatusBadge status={ed.lastRun.status} />
              <span>{ed.lastRun.booksReviewed} reviewed, {ed.lastRun.booksDiscovered} discovered</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Analytics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AnalyticsSection = () => {
  const [period, setPeriod] = useState('7d');
  const { data, loading } = useAdminApi(() => AdminClient.getAnalytics(period), [period]);

  if (loading) return <div style={{ color: T.muted, fontFamily: T.mono, padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!data) return <div style={{ color: T.err, padding: 40 }}>Failed to load analytics</div>;

  const maxDailyCost = Math.max(...(data.costs.dailyBreakdown || []).map(d => d.cost), 0.01);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Period Selector */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['24h', '24 Hours'], ['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']].map(([k, label]) => (
          <Btn key={k} small variant={period === k ? 'primary' : 'ghost'} onClick={() => setPeriod(k)}>{label}</Btn>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Metric label="Total Cost" value={fmtCost(data.costs.total)} />
        <Metric label="Runs" value={data.runs.total} sub={`${data.runs.completed} ok / ${data.runs.failed} failed`} />
        <Metric label="Books Reviewed" value={data.books.reviewed} />
        <Metric label="Books Failed" value={data.books.failed} color={data.books.failed > 0 ? T.err : T.text} />
      </div>

      {/* Cost by Editor */}
      <Card title="Cost by Editor">
        <Table
          columns={[
            { key: 'name', label: 'Editor' },
            { key: 'runs', label: 'Runs', mono: true },
            { key: 'cost', label: 'Cost', render: v => fmtCost(v), mono: true },
            { key: 'tokens', label: 'Tokens', render: v => fmtNum(v), mono: true },
            { key: 'avg', label: 'Avg/Run', render: (_, r) => fmtCost(r.runs > 0 ? r.cost / r.runs : 0), mono: true },
          ]}
          rows={Object.entries(data.costs.byEditor).map(([name, s]) => ({ name, ...s }))}
        />
      </Card>

      {/* Daily Chart */}
      {data.costs.dailyBreakdown?.length > 0 && (
        <Card title="Daily Cost Trend">
          <div style={{ display: 'grid', gap: 6 }}>
            {data.costs.dailyBreakdown.map(d => (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 80, fontSize: 11, fontFamily: T.mono, color: T.muted }}>{d.date.slice(5)}</div>
                <div style={{ flex: 1, height: 20, background: T.hover, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(d.cost / maxDailyCost) * 100}%`, background: `linear-gradient(90deg, ${T.accent}, ${T.info})`, borderRadius: 3, transition: 'width .3s' }} />
                </div>
                <div style={{ width: 55, fontSize: 11, fontFamily: T.mono, color: T.text, textAlign: 'right' }}>{fmtCost(d.cost)}</div>
                <div style={{ width: 40, fontSize: 10, fontFamily: T.mono, color: T.dim, textAlign: 'right' }}>{d.runs}r</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top Errors */}
      {data.topErrors?.length > 0 && (
        <Card title="Most Common Errors">
          <Table
            columns={[
              { key: 'error', label: 'Error', width: '80%', render: v => <span style={{ fontSize: 12, wordBreak: 'break-word' }}>{v}</span> },
              { key: 'count', label: 'Count', mono: true },
            ]}
            rows={data.topErrors}
          />
        </Card>
      )}
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SystemSection = () => {
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getSystemInfo());

  if (loading) return <div style={{ color: T.muted, fontFamily: T.mono, padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (!data) return <div style={{ color: T.err, padding: 40 }}>Failed to load system info</div>;

  const hColor = data.health === 'healthy' ? T.ok : T.err;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Health */}
      <Card title="System Health" actions={<Btn small variant="ghost" onClick={refresh}>Refresh</Btn>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${hColor}20`, border: `2px solid ${hColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
            {data.health === 'healthy' ? '✓' : '!'}
          </div>
          <div>
            <div style={{ fontSize: 20, fontFamily: T.serif, fontWeight: 700, color: hColor }}>
              {data.health === 'healthy' ? 'All Systems Operational' : 'Issues Detected'}
            </div>
            <div style={{ fontSize: 12, fontFamily: T.mono, color: T.muted, marginTop: 4 }}>
              Uptime: {fmtUptime(data.uptime)} | PID: {data.process.pid}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Database */}
        <Card title="Database">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Label>Status</Label>
              <div style={{ fontSize: 16, fontWeight: 700, color: data.database.connected ? T.ok : T.err }}>
                {data.database.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
            <div>
              <Label>Ping</Label>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, color: T.text }}>{data.database.ping}ms</div>
            </div>
          </div>
        </Card>

        {/* Memory */}
        <Card title="Memory">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <Label>RSS</Label>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, color: T.text }}>{data.memory.used}MB</div>
            </div>
            <div>
              <Label>Heap</Label>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: T.mono, color: T.text }}>{data.memory.heapUsed}MB</div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 8, background: T.hover, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(data.memory.percent, 100)}%`, background: data.memory.percent > 80 ? T.err : T.accent, borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 10, fontFamily: T.mono, color: T.dim, marginTop: 4 }}>{data.memory.percent}% of {data.memory.total}MB total</div>
        </Card>
      </div>

      {/* Config */}
      <Card title="Configuration">
        <div style={{ display: 'grid', gap: 0 }}>
          {[
            ['OpenAI Model', data.config.openaiModel],
            ['Daily Budget', fmtCost(data.config.dailyBudget)],
            ['OpenAI API Key', data.config.openaiConfigured ? 'Configured' : 'Not set'],
            ['Google Books API', data.config.googleBooksConfigured ? 'Configured' : 'Not set'],
            ['Admin Key', data.config.adminKeyConfigured ? 'Configured' : 'Not set'],
            ['Environment', data.config.nodeEnv],
            ['Node.js', data.process.nodeVersion],
            ['Platform', data.process.platform],
          ].map(([label, value], i) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 7 ? `1px solid ${T.border}` : 'none' }}>
              <span style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>{label}</span>
              <span style={{ fontSize: 13, fontFamily: T.mono, fontWeight: 600, color: typeof value === 'string' && value.includes('Not set') ? T.warn : T.text }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Schedule */}
      <Card title="Agent Schedule">
        <Table
          columns={[
            { key: 'editor', label: 'Editor' },
            { key: 'cron', label: 'Cron', mono: true },
            { key: 'batchSize', label: 'Batch', mono: true },
            { key: 'nextRun', label: 'Next Run', render: v => fmtTime(v), mono: true },
          ]}
          rows={data.schedule}
        />
      </Card>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGIN + MAIN SHELL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const AdminLogin = ({ onAuth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true); setError('');
    try {
      await AdminClient.login(email.trim(), password);
      onAuth();
    } catch (err) {
      setError(err.message === 'AUTH_EXPIRED' ? 'Session expired, please login again' : err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: 400, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 36 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontFamily: T.serif, fontWeight: 900, color: T.text }}>
            Reviewer <span style={{ color: T.accent, fontStyle: 'italic' }}>Insight</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.16em', color: T.muted, marginTop: 6 }}>Admin Dashboard</div>
        </div>
        <form onSubmit={submit}>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={setEmail} placeholder="admin@example.com" style={{ marginBottom: 14 }} />
          <Label>Password</Label>
          <Input type="password" value={password} onChange={setPassword} placeholder="Enter your password" style={{ marginBottom: 14 }} />
          {error && <div style={{ color: T.err, fontSize: 12, fontFamily: T.mono, marginBottom: 12, padding: '8px 10px', background: `${T.err}15`, borderRadius: 6 }}>{error}</div>}
          <Btn onClick={submit} disabled={loading || !email.trim() || !password} style={{ width: '100%' }}>{loading ? 'Signing in...' : 'Sign In'}</Btn>
        </form>
      </div>
    </div>
  );
};

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '◐' },
  { id: 'runs', label: 'Agent Runs', icon: '▶' },
  { id: 'books', label: 'Books', icon: '▤' },
  { id: 'editors', label: 'Editors', icon: '✎' },
  { id: 'analytics', label: 'Analytics', icon: '◔' },
  { id: 'system', label: 'System', icon: '⚙' },
];

const Admin = ({ setRoute }) => {
  const [authed, setAuthed] = useState(!!AdminClient.getToken());
  const [section, setSection] = useState('overview');

  // If auth expired mid-session
  useEffect(() => {
    const orig = window.fetch;
    // No need to intercept — AdminClient handles 401 → AUTH_EXPIRED
  }, []);

  if (!authed) return <AdminLogin onAuth={() => setAuthed(true)} />;

  const SectionComponent = {
    overview: OverviewSection,
    runs: RunsSection,
    books: BooksSection,
    editors: EditorsSection,
    analytics: AnalyticsSection,
    system: SystemSection,
  }[section];

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text, display: 'flex' }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: `1px solid ${T.border}`, padding: '20px 0', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <button onClick={() => setRoute({ name: 'home' })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 20px', textAlign: 'left' }}>
          <div style={{ fontSize: 18, fontFamily: T.serif, fontWeight: 900, color: T.text }}>
            Reviewer <span style={{ color: T.accent, fontStyle: 'italic' }}>Insight</span>
          </div>
          <div style={{ fontSize: 9, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.16em', color: T.dim, marginTop: 2 }}>Admin Panel</div>
        </button>

        <div style={{ height: 1, background: T.border, margin: '12px 0' }} />

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: T.sans, fontWeight: 500,
              background: section === s.id ? `${T.accent}20` : 'transparent',
              color: section === s.id ? T.accentHover : T.muted,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.border}` }}>
          <Btn small variant="ghost" onClick={() => { AdminClient.clearToken(); setAuthed(false); }} style={{ width: '100%' }}>Sign Out</Btn>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: 28, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1100 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontFamily: T.serif, fontWeight: 900 }}>
              {SECTIONS.find(s => s.id === section)?.label}
            </h1>
          </div>
          <SectionComponent />
        </div>
      </div>
    </div>
  );
};

window.Admin = Admin;
