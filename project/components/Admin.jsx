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

const Metric = ({ label, value, sub, color, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '18px 16px', textAlign: 'center',
      cursor: onClick ? 'pointer' : 'default',
      transition: onClick ? 'border-color .15s, box-shadow .15s' : undefined,
    }}
    onMouseEnter={onClick ? e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.boxShadow = `0 0 0 2px ${T.accent}30`; } : undefined}
    onMouseLeave={onClick ? e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; } : undefined}
  >
    <div style={{ fontSize: 11, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.1em', color: T.muted, marginBottom: 6 }}>
      {label}{onClick && <span style={{ marginLeft: 4, opacity: .5 }}>↗</span>}
    </div>
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
const OverviewSection = ({ navigate }) => {
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getOverview());

  if (loading) return <div style={{ color: T.muted, fontFamily: T.mono, padding: 40, textAlign: 'center' }}>Loading dashboard...</div>;
  if (!data) return <div style={{ color: T.err, padding: 40 }}>Failed to load overview</div>;

  const { metrics: m, agentStatus: a, costSummary: c, recentErrors, statusBreakdown } = data;
  const maxStatus = Math.max(...Object.values(statusBreakdown), 1);
  const goBooks = (status) => navigate && navigate('books', { status });

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Metric label="Total Books" value={fmtNum(m.totalBooks)} sub={`+${m.todayDiscovered} today`} onClick={() => goBooks('')} />
        <Metric label="Published" value={fmtNum(m.publishedBooks)} color={T.ok} onClick={() => goBooks('published')} />
        <Metric label="Pending Review" value={m.pendingReviews} color={T.warn} onClick={() => goBooks('metadata_complete')} />
        <Metric label="Failed" value={m.failedBooks} color={m.failedBooks > 0 ? T.err : T.text} onClick={() => goBooks('failed')} />
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
            <div
              key={status}
              onClick={() => goBooks(status)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderRadius: 6, padding: '4px 6px', margin: '-4px -6px', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = T.hover}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 120, fontSize: 12, fontFamily: T.mono, color: T.muted, textTransform: 'capitalize' }}>{status.replace(/_/g, ' ')}</div>
              <div style={{ flex: 1, height: 22, background: T.hover, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${(count / maxStatus) * 100}%`, background: STATUS_COLORS[status] || T.accent, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
              <div style={{ width: 50, fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.text, textAlign: 'right' }}>{count}</div>
              <div style={{ fontSize: 10, fontFamily: T.mono, color: T.dim, width: 14 }}>↗</div>
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
  const [backfillMsg, setBackfillMsg] = useState('');
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getRuns(filters), [filters]);

  const triggerBackfill = async () => {
    setBackfillMsg('Starting…');
    try {
      await AdminClient.triggerBackfill();
      setBackfillMsg('Backfill started — check table for progress');
      setTimeout(() => { setBackfillMsg(''); refresh(); }, 3000);
    } catch (e) {
      setBackfillMsg(e.message === 'Backfill already running' ? 'Already running' : `Error: ${e.message}`);
      setTimeout(() => setBackfillMsg(''), 4000);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={filters.editor} onChange={v => setFilters({ ...filters, editor: v, page: 1 })}>
          <option value="">All Editors</option>
          <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
          <option>Backfill</option>
        </Select>
        <Select value={filters.status} onChange={v => setFilters({ ...filters, status: v, page: 1 })}>
          <option value="">All Statuses</option>
          <option>running</option><option>completed</option><option>failed</option><option>partial</option>
        </Select>
        <div style={{ flex: 1 }} />
        {backfillMsg && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{backfillMsg}</span>}
        <Btn variant="ghost" onClick={triggerBackfill}>⚡ Run Backfill Now</Btn>
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
const BooksSection = ({ params = {} }) => {
  const [filters, setFilters] = useState({ status: params.status || '', genre: params.genre || '', editor: params.editor || '', search: '', page: 1 });
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
          <Input type="email" value={email} onChange={setEmail} autoComplete="username" placeholder="admin@example.com" style={{ marginBottom: 14 }} />
          <Label>Password</Label>
          <Input type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" style={{ marginBottom: 14 }} />
          {error && <div style={{ color: T.err, fontSize: 12, fontFamily: T.mono, marginBottom: 12, padding: '8px 10px', background: `${T.err}15`, borderRadius: 6 }}>{error}</div>}
          <Btn onClick={submit} disabled={loading || !email.trim() || !password} style={{ width: '100%' }}>{loading ? 'Signing in...' : 'Sign In'}</Btn>
        </form>
      </div>
    </div>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION: Scraper
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SOURCE_COLORS = { npr: '#3B82F6', guardian: '#1E3A8A', bookpage: '#10B981', openlibrary: '#8B5CF6', nyt: '#DC2626', googlebooks: '#4285F4', applebooks: '#1D1D1F' };
const SOURCE_LABELS = { npr: 'NPR Books', guardian: 'The Guardian', bookpage: 'BookPage', openlibrary: 'Open Library', nyt: 'NYT Bestsellers', googlebooks: 'Google Books', applebooks: 'Apple Books' };
const SCRAPER_STATUS_COLORS = { scraped: '#8B5CF6', imported: T.ok, skipped: T.dim };

const SourceBadge = ({ source }) => (
  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.04em', background: SOURCE_COLORS[source] || T.dim, color: '#fff' }}>
    {SOURCE_LABELS[source] || source}
  </span>
);

const ScraperSection = () => {
  const [view, setView] = useState('books'); // 'books' | 'runs'
  const [filters, setFilters] = useState({ source: '', status: '', search: '', page: 1 });
  const [selected, setSelected] = useState(new Set());
  const [modal, setModal] = useState(null); // 'import-bulk' | { type: 'import', book } | 'trigger'
  const [scraping, setScraping] = useState(null); // source name while scraping
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);

  const { data: statusData, refresh: refreshStatus } = useAdminApi(() => AdminClient.getScraperStatus());
  const { data, loading, refresh } = useAdminApi(
    () => AdminClient.getScrapedBooks(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))),
    [filters]
  );

  const handleSearch = (v) => {
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFilters(f => ({ ...f, search: v, page: 1 })), 350);
  };

  const handleScrape = async (source) => {
    setScraping(source || 'all');
    try {
      await AdminClient.triggerScraper(source);
      refresh();
      refreshStatus();
    } catch (e) { alert(`Scrape failed: ${e.message}`); }
    finally { setScraping(null); }
  };

  const handleSkip = async (book) => {
    try {
      await AdminClient.updateScrapedBook(book._id, { status: 'skipped' });
      refresh(); refreshStatus();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (book) => {
    try {
      await AdminClient.deleteScrapedBook(book._id);
      refresh(); refreshStatus();
    } catch (e) { alert(e.message); }
  };

  const toggleSelect = (id) => {
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

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Overview metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <Metric label="Total Scraped" value={fmtNum(stats.totalScraped || 0)} />
        <Metric label="Pending Import" value={fmtNum(stats.totalPending || 0)} color="#8B5CF6" />
        <Metric label="Imported" value={fmtNum(stats.totalImported || 0)} color={T.ok} />
        <Metric label="Skipped" value={fmtNum(stats.totalSkipped || 0)} color={T.dim} />
      </div>

      {/* Source breakdown */}
      {sourceStats.length > 0 && (
        <Card title="By Source">
          <div style={{ display: 'grid', gap: 10 }}>
            {sourceStats.map(s => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 110 }}><SourceBadge source={s._id} /></div>
                <div style={{ flex: 1, height: 22, background: T.hover, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: `${(s.total / maxSourceTotal) * 100}%`, background: SOURCE_COLORS[s._id] || T.accent, borderRadius: 4, transition: 'width .4s ease' }} />
                </div>
                <div style={{ width: 40, fontSize: 13, fontFamily: T.mono, fontWeight: 700, color: T.text, textAlign: 'right' }}>{s.total}</div>
                <div style={{ width: 80, fontSize: 10, fontFamily: T.mono, color: T.muted }}>{s.scraped}p / {s.imported}i</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trigger bar + view toggle */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn onClick={() => handleScrape(null)} disabled={!!scraping}>
          {scraping === 'all' ? 'Scraping...' : 'Scrape All'}
        </Btn>
        {Object.keys(SOURCE_COLORS).map(s => (
          <Btn key={s} small variant="ghost" onClick={() => handleScrape(s)} disabled={!!scraping}
            style={{ borderColor: SOURCE_COLORS[s], color: scraping === s ? '#fff' : SOURCE_COLORS[s], background: scraping === s ? SOURCE_COLORS[s] : 'transparent' }}>
            {scraping === s ? '...' : SOURCE_LABELS[s]}
          </Btn>
        ))}
        <div style={{ flex: 1 }} />
        <Btn small variant={view === 'books' ? 'primary' : 'ghost'} onClick={() => setView('books')}>Books</Btn>
        <Btn small variant={view === 'runs' ? 'primary' : 'ghost'} onClick={() => setView('runs')}>Run History</Btn>
        <Btn small variant="ghost" onClick={() => { refresh(); refreshStatus(); }}>Refresh</Btn>
      </div>

      {view === 'books' ? (
        <>
          {/* Filters */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <Input value={searchInput} onChange={handleSearch} placeholder="Search scraped books..." />
            <Select value={filters.source} onChange={v => setFilters({ ...filters, source: v, page: 1 })}>
              <option value="">All Sources</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Select value={filters.status} onChange={v => setFilters({ ...filters, status: v, page: 1 })}>
              <option value="">All Statuses</option>
              <option value="scraped">Pending</option>
              <option value="imported">Imported</option>
              <option value="skipped">Skipped</option>
            </Select>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `${T.accent}15`, border: `1px solid ${T.accent}40`, borderRadius: 8 }}>
              <span style={{ fontSize: 13, fontFamily: T.mono, color: T.text, fontWeight: 600 }}>{selected.size} selected</span>
              <Btn small onClick={() => setModal('import-bulk')}>Import Selected</Btn>
              <Btn small variant="ghost" onClick={() => setSelected(new Set())}>Clear</Btn>
            </div>
          )}

          {/* Table */}
          {loading ? <div style={{ color: T.muted, fontFamily: T.mono, padding: 20 }}>Loading...</div> : (
            <>
              <div style={{ fontSize: 12, fontFamily: T.mono, color: T.muted }}>
                Showing {data?.books?.length || 0} of {data?.total || 0} scraped books
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: T.hover }}>
                      <th style={{ padding: '10px 8px', width: 36 }}>
                        <input type="checkbox" onChange={toggleSelectAll}
                          checked={data?.books?.filter(b => b.status === 'scraped').length > 0 && selected.size === data?.books?.filter(b => b.status === 'scraped').length}
                          style={{ cursor: 'pointer' }} />
                      </th>
                      {[['Title', '26%'], ['Source', ''], ['Status', ''], ['Rating', ''], ['Year', ''], ['Scraped', ''], ['Actions', '140px']].map(([label, w]) => (
                        <th key={label} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '.08em', color: T.muted, width: w || undefined }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.books || []).map(book => (
                      <tr key={book._id} style={{ borderTop: `1px solid ${T.border}`, transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.hover}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          {book.status === 'scraped' && (
                            <input type="checkbox" checked={selected.has(book._id)} onChange={() => toggleSelect(book._id)} style={{ cursor: 'pointer' }} />
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{book.title}</div>
                          <div style={{ fontSize: 11, color: T.muted }}>{book.author}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}><SourceBadge source={book.source} /></td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, fontFamily: T.mono, textTransform: 'uppercase', background: SCRAPER_STATUS_COLORS[book.status] || T.dim, color: '#fff' }}>
                            {book.status === 'scraped' ? 'pending' : book.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: T.mono, color: T.muted }}>{book.sourceRating || '\u2014'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: T.mono, color: T.muted }}>{book.year || '\u2014'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: T.mono, color: T.muted }}>{fmtDate(book.scrapedAt)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {book.status === 'scraped' && (
                              <>
                                <Btn small onClick={(e) => { e.stopPropagation(); setModal({ type: 'import', book }); }}>Import</Btn>
                                <Btn small variant="ghost" onClick={(e) => { e.stopPropagation(); handleSkip(book); }}>Skip</Btn>
                              </>
                            )}
                            <Btn small variant="danger" onClick={(e) => { e.stopPropagation(); handleDelete(book); }}>Del</Btn>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(data?.books || []).length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: T.dim, fontFamily: T.mono, fontSize: 12 }}>No scraped books found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={filters.page} totalPages={data?.totalPages} onChange={p => setFilters({ ...filters, page: p })} />
            </>
          )}
        </>
      ) : (
        <ScraperRunsView />
      )}

      {/* Import Modal (single) */}
      {modal?.type === 'import' && (
        <ImportScrapedModal book={modal.book} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); refreshStatus(); }} />
      )}

      {/* Import Modal (bulk) */}
      {modal === 'import-bulk' && (
        <ImportBulkModal ids={[...selected]} onClose={() => setModal(null)} onDone={() => { setModal(null); setSelected(new Set()); refresh(); refreshStatus(); }} />
      )}
    </div>
  );
};

const ImportScrapedModal = ({ book, onClose, onDone }) => {
  const [editor, setEditor] = useState('Mira Okafor');
  const [genre, setGenre] = useState(book.genre || 'Fiction');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const go = async () => {
    setBusy(true); setMsg('');
    try {
      await AdminClient.importScrapedBook(book._id, { editor, genre });
      onDone();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Import: ${book.title}`} onClose={onClose} width={460}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: 12, background: T.hover, borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{book.title}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>by {book.author}</div>
          {book.sourceReviewSnippet && (
            <div style={{ fontSize: 11, color: T.dim, marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
              "{book.sourceReviewSnippet.substring(0, 200)}..."
            </div>
          )}
        </div>
        <div>
          <Label>Assign Editor</Label>
          <Select value={editor} onChange={setEditor} style={{ width: '100%' }}>
            <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
          </Select>
        </div>
        <div>
          <Label>Genre</Label>
          <Select value={genre} onChange={setGenre} style={{ width: '100%' }}>
            <option>Fiction</option><option>Essays</option><option>Memoir</option><option>Sci-Fi</option>
            <option>History</option><option>Business</option><option>Nature</option>
          </Select>
        </div>
        {msg && <div style={{ color: T.err, fontSize: 12, fontFamily: T.mono }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={go} disabled={busy}>{busy ? 'Importing...' : 'Import to Pipeline'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

const ImportBulkModal = ({ ids, onClose, onDone }) => {
  const [editor, setEditor] = useState('Mira Okafor');
  const [genre, setGenre] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const go = async () => {
    setBusy(true);
    try {
      const data = { editor };
      if (genre) data.genre = genre;
      const res = await AdminClient.importScrapedBooksBulk(ids, data);
      setResult(res);
      setTimeout(onDone, 2000);
    } catch (e) { setResult({ error: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Bulk Import (${ids.length} books)`} onClose={onClose} width={460}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13, color: T.muted }}>
          Import {ids.length} scraped books into the review pipeline.
        </div>
        <div>
          <Label>Assign Editor</Label>
          <Select value={editor} onChange={setEditor} style={{ width: '100%' }}>
            <option>Mira Okafor</option><option>Jules Park</option><option>Dae Han</option><option>Noor Saleh</option>
          </Select>
        </div>
        <div>
          <Label>Genre Override (optional)</Label>
          <Select value={genre} onChange={setGenre} style={{ width: '100%' }}>
            <option value="">Use scraped genre</option>
            <option>Fiction</option><option>Essays</option><option>Memoir</option><option>Sci-Fi</option>
            <option>History</option><option>Business</option><option>Nature</option>
          </Select>
        </div>
        {result && !result.error && (
          <div style={{ padding: 10, background: `${T.ok}20`, borderRadius: 6, fontSize: 12, fontFamily: T.mono, color: T.ok }}>
            Imported: {result.imported} | Skipped: {result.skipped} | Failed: {result.failed}
          </div>
        )}
        {result?.error && (
          <div style={{ padding: 10, background: `${T.err}20`, borderRadius: 6, fontSize: 12, fontFamily: T.mono, color: T.err }}>{result.error}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={go} disabled={busy || !!result}>{busy ? 'Importing...' : 'Import All'}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
};

const ScraperRunsView = () => {
  const [filters, setFilters] = useState({ source: '', page: 1 });
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getScraperRuns(filters), [filters]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Select value={filters.source} onChange={v => setFilters({ ...filters, source: v, page: 1 })}>
          <option value="">All Sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <div style={{ flex: 1 }} />
        <Btn small variant="ghost" onClick={refresh}>Refresh</Btn>
      </div>

      {loading ? <div style={{ color: T.muted, fontFamily: T.mono, padding: 20 }}>Loading...</div> : (
        <>
          <Table
            columns={[
              { key: 'source', label: 'Source', render: v => <SourceBadge source={v} /> },
              { key: 'trigger', label: 'Trigger', mono: true },
              { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
              { key: 'booksFound', label: 'Found', mono: true },
              { key: 'booksNew', label: 'New', mono: true },
              { key: 'booksDuplicate', label: 'Dup', mono: true },
              { key: 'booksFailed', label: 'Failed', render: v => <span style={{ color: v > 0 ? T.err : T.dim }}>{v}</span>, mono: true },
              { key: 'durationMs', label: 'Duration', render: v => fmtDur(v), mono: true },
              { key: 'startedAt', label: 'Started', render: v => fmtTime(v), mono: true },
            ]}
            rows={data?.runs || []}
          />
          <Pagination page={filters.page} totalPages={data?.totalPages} onChange={p => setFilters({ ...filters, page: p })} />
        </>
      )}
    </div>
  );
};

// ━━━ DUPLICATES SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const STATUS_PRIORITY = ['published', 'review_complete', 'review_pending', 'metadata_complete', 'discovered', 'failed'];

const DuplicatesSection = () => {
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getDuplicates());
  const [merging, setMerging] = useState(null);
  const [message, setMessage] = useState(null);

  const handleMerge = async (group) => {
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
      setMessage({ type: 'ok', text: result.message });
      refresh();
    } catch (err) {
      setMessage({ type: 'err', text: err.message });
    }
    setMerging(null);
  };

  const handleDismissScraped = async (dup) => {
    // Keep one, dismiss the rest
    const removeIds = dup.ids.slice(1);
    setMerging(dup._id?.title);
    try {
      const result = await AdminClient.dismissDuplicates(removeIds);
      setMessage({ type: 'ok', text: result.message });
      refresh();
    } catch (err) {
      setMessage({ type: 'err', text: err.message });
    }
    setMerging(null);
  };

  if (loading) return <div style={{ padding: 32, opacity: .5 }}>Loading duplicates...</div>;

  const bookDups = data?.bookDuplicates || [];
  const scrapedDups = data?.scrapedDuplicates || [];

  return (
    <div>
      {message && (
        <div style={{ padding: '10px 16px', marginBottom: 16, borderRadius: 8, fontSize: 13, fontFamily: T.mono, background: message.type === 'ok' ? '#dcfce7' : '#fef2f2', color: message.type === 'ok' ? '#166534' : '#991b1b' }}>
          {message.text}
          <span onClick={() => setMessage(null)} style={{ cursor: 'pointer', marginLeft: 12, opacity: .5 }}>x</span>
        </div>
      )}

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <Metric label="Book Duplicate Groups" value={bookDups.length} />
        <Metric label="Extra Book Copies" value={data?.totalBookDups || 0} />
        <Metric label="Scraped Dup Groups" value={scrapedDups.length} />
        <Metric label="Extra Scraped Copies" value={data?.totalScrapedDups || 0} />
      </div>

      {/* Book duplicates */}
      <Card title={`Book Collection Duplicates (${bookDups.length} groups)`} style={{ marginBottom: 24 }}>
        {bookDups.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: .5, fontFamily: T.mono, fontSize: 12 }}>No duplicates found — collection is clean</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {bookDups.map(group => (
              <div key={group.key} style={{ padding: 16, border: `1px solid ${T.border}`, borderRadius: 8, background: T.hover }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, fontFamily: T.serif }}>{group.books[0]?.title}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, fontFamily: T.mono, opacity: .6 }}>{group.count} copies</span>
                  </div>
                  <Btn small onClick={() => handleMerge(group)} disabled={merging === group.key}>
                    {merging === group.key ? 'Merging...' : 'Auto-Merge'}
                  </Btn>
                </div>
                <table style={{ width: '100%', fontSize: 12, fontFamily: T.mono, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}`, textAlign: 'left' }}>
                      <th style={{ padding: '4px 8px' }}>Title</th>
                      <th style={{ padding: '4px 8px' }}>Author</th>
                      <th style={{ padding: '4px 8px' }}>Status</th>
                      <th style={{ padding: '4px 8px' }}>Rating</th>
                      <th style={{ padding: '4px 8px' }}>Genre</th>
                      <th style={{ padding: '4px 8px' }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.books.map((b, i) => (
                      <tr key={b._id} style={{ borderBottom: `1px solid ${T.border}22`, background: i === 0 ? `${T.accent}08` : 'transparent' }}>
                        <td style={{ padding: '6px 8px', fontWeight: i === 0 ? 700 : 400 }}>{b.title}</td>
                        <td style={{ padding: '6px 8px' }}>{b.author}</td>
                        <td style={{ padding: '6px 8px' }}><StatusBadge status={b.status} /></td>
                        <td style={{ padding: '6px 8px' }}>{b.rating || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>{b.genre}</td>
                        <td style={{ padding: '6px 8px' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Scraped duplicates */}
      <Card title={`Scraped Book Duplicates (${scrapedDups.length} groups)`}>
        {scrapedDups.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: .5, fontFamily: T.mono, fontSize: 12 }}>No scraped duplicates found</div>
        ) : (
          <Table
            columns={[
              { key: '_id', label: 'Title / Author', render: v => <span><strong>{v.title}</strong> — {v.author}</span> },
              { key: 'count', label: 'Copies', mono: true },
              { key: 'sources', label: 'Sources', render: v => v.join(', ') },
            ]}
            rows={scrapedDups}
            actions={row => (
              <Btn small variant="ghost" onClick={() => handleDismissScraped(row)} disabled={!!merging}>
                Dismiss Extras
              </Btn>
            )}
          />
        )}
      </Card>
    </div>
  );
};

// ━━━ COMPETITOR INSIGHTS SECTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TYPE_COLOR = { editorial: '#8B5CF6', professional: '#3B82F6', bestseller: '#F59E0B', catalog: '#10B981', other: '#6B7280' };

const CompetitorSection = () => {
  const { data, loading, refresh } = useAdminApi(() => AdminClient.getCompetitorInsights());
  const [scraping, setScraping] = useState(null);

  const handleScrape = async (source) => {
    setScraping(source);
    try {
      await AdminClient.triggerScraper(source);
      setTimeout(refresh, 1500);
    } catch (e) { alert(`Scrape failed: ${e.message}`); }
    finally { setScraping(null); }
  };

  if (loading || !data) return <div style={{ color: T.muted, fontFamily: T.mono, fontSize: 12 }}>Loading competitor data…</div>;

  const { insights = [], totals = {} } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Metric label="Sources Active" value={totals.sources || 0} />
        <Metric label="Total Scraped" value={fmtNum(totals.totalScraped)} color={T.info} />
        <Metric label="Imported to Catalog" value={fmtNum(totals.totalImported)} color={T.ok}
          sub={totals.totalPending ? `${fmtNum(totals.totalPending)} pending` : null} />
      </div>

      {/* Source breakdown */}
      <Card title="Source Coverage">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: T.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['Source', 'Type', 'Scraped', 'Imported', 'Pending', 'Last Run', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: T.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {insights.map(row => (
              <tr key={row.source} style={{ borderBottom: `1px solid ${T.border}22` }}>
                <td style={{ padding: '8px 10px', color: T.text, fontWeight: 600 }}>
                  <div>{row.label}</div>
                  {row.url && <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: T.dim, fontSize: 10, textDecoration: 'none' }}>{row.url.replace(/^https?:\/\//, '')}</a>}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: `${TYPE_COLOR[row.type] || T.dim}22`, color: TYPE_COLOR[row.type] || T.dim }}>
                    {row.type}
                  </span>
                </td>
                <td style={{ padding: '8px 10px', color: T.text }}>{fmtNum(row.totalScraped)}</td>
                <td style={{ padding: '8px 10px', color: T.ok }}>{fmtNum(row.imported)}</td>
                <td style={{ padding: '8px 10px', color: row.pending > 0 ? T.warn : T.dim }}>{fmtNum(row.pending)}</td>
                <td style={{ padding: '8px 10px', color: T.muted, whiteSpace: 'nowrap' }}>{row.lastRun ? fmtDate(row.lastRun) : '—'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: row.lastStatus === 'completed' ? `${T.ok}22` : row.lastStatus === 'failed' ? `${T.err}22` : row.lastStatus === 'never' ? `${T.dim}22` : `${T.info}22`,
                    color: row.lastStatus === 'completed' ? T.ok : row.lastStatus === 'failed' ? T.err : row.lastStatus === 'never' ? T.dim : T.info }}>
                    {row.lastStatus}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <Btn small variant="ghost" disabled={scraping === row.source} onClick={() => handleScrape(row.source)}>
                    {scraping === row.source ? '…' : 'Scrape'}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Run all button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="primary" disabled={!!scraping} onClick={() => handleScrape(null)}>
          {scraping ? `Scraping ${scraping}…` : 'Run All Sources'}
        </Btn>
      </div>
    </div>
  );
};

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: '◐' },
  { id: 'runs', label: 'Agent Runs', icon: '▶' },
  { id: 'books', label: 'Books', icon: '▤' },
  { id: 'scraper', label: 'Scraper', icon: '⇣' },
  { id: 'duplicates', label: 'Duplicates', icon: '⊘' },
  { id: 'competitors', label: 'Competitors', icon: '◈' },
  { id: 'editors', label: 'Editors', icon: '✎' },
  { id: 'analytics', label: 'Analytics', icon: '◔' },
  { id: 'system', label: 'System', icon: '⚙' },
];

const Admin = ({ setRoute }) => {
  const [authed, setAuthed] = useState(!!AdminClient.getToken());
  const [section, setSection] = useState('overview');
  const [sectionParams, setSectionParams] = useState({});

  const navigate = (sec, params = {}) => {
    setSectionParams(params);
    setSection(sec);
  };

  if (!authed) return <AdminLogin onAuth={() => setAuthed(true)} />;

  const SectionComponent = {
    overview: OverviewSection,
    runs: RunsSection,
    books: BooksSection,
    scraper: ScraperSection,
    duplicates: DuplicatesSection,
    competitors: CompetitorSection,
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
            <button key={s.id} onClick={() => navigate(s.id)} style={{
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
          <SectionComponent navigate={navigate} params={sectionParams} />
        </div>
      </div>
    </div>
  );
};

window.Admin = Admin;
