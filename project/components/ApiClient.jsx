// API client and data-fetching hooks for Reviewer Insight
// Falls back to static window.BOOKS data when server is unavailable.

/** Relative /api on production; localhost:3001 when the UI is on another local port (e.g. Live Server). */
function defaultApiBase() {
  if (window.API_BASE != null && window.API_BASE !== '') return window.API_BASE;
  const h = window.location.hostname;
  const isLocal = h === 'localhost' || h === '127.0.0.1';
  if (!isLocal) return '/api';
  if (window.location.port === '3001') return '/api';
  return 'http://localhost:3001/api';
}
const API_BASE = defaultApiBase();

// Normalize API book shape to match frontend expectations
function normalizeBook(b) {
  if (!b) return b;
  return {
    ...b,
    id: b._id || b.id,
    cover: b.coverDesign || b.cover || { style: 'block', bg: '#141210', fg: '#F5EFE4', motif: 'bars' },
  };
}

const ApiClient = {
  _cache: new Map(),
  _cacheTimeout: 60000, // 1 minute

  async _fetch(endpoint) {
    const cacheKey = endpoint;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheTimeout) {
      return cached.data;
    }

    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API ${res.status}: ${endpoint}`);
    const data = await res.json();

    this._cache.set(cacheKey, { data, time: Date.now() });
    return data;
  },

  async getBooks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const result = await this._fetch(`/books?${qs}`);
    return { ...result, books: (result.books || []).map(normalizeBook) };
  },

  async getBook(id) {
    return normalizeBook(await this._fetch(`/books/${id}`));
  },

  async getFeatured() {
    const result = await this._fetch('/books/featured');
    return { featured: normalizeBook(result.featured), also: (result.also || []).map(normalizeBook) };
  },

  async getGenres() {
    return this._fetch('/genres');
  },

  async getEditors() {
    return this._fetch('/editors');
  },

  async getStats() {
    return this._fetch('/stats');
  },

  async getTrending() {
    return this._fetch('/books/trending');
  },

  async search(q, params = {}) {
    const qs = new URLSearchParams({ q, ...params }).toString();
    const result = await this._fetch(`/search?${qs}`);
    return { ...result, books: (result.books || []).map(normalizeBook) };
  },

  async getRecommendations(profile) {
    const res = await fetch(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `API ${res.status}`);
    }
    const data = await res.json();
    if (data.recommendations) {
      data.recommendations = data.recommendations.map(rec => ({ ...rec, ...normalizeBook(rec) }));
    }
    return data;
  },
};

// Custom hook for API data fetching with loading/error states + static fallback
function useApi(fetchFn, fallback, deps = []) {
  const [state, setState] = React.useState({ data: null, loading: true, error: null });

  React.useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, loading: true, error: null }));

    fetchFn()
      .then(data => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch(err => { if (!cancelled) setState({ data: null, loading: false, error: err }); });

    return () => { cancelled = true; };
  }, deps);

  // Return API data if available, otherwise the fallback
  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    // Resolved data: API data or fallback
    resolved: state.data || fallback,
    isApi: !!state.data,
  };
}

// Check if the API is available (run once on load)
let _apiAvailable = null;
async function checkApiAvailable() {
  if (_apiAvailable !== null) return _apiAvailable;
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    _apiAvailable = res.ok;
  } catch {
    _apiAvailable = false;
  }
  return _apiAvailable;
}

// ─── Admin API Client ───────────────────────────────────────────
const AdminClient = {
  _token: null,

  getToken() {
    if (this._token) return this._token;
    this._token = sessionStorage.getItem('ri-admin-token');
    return this._token;
  },

  setToken(token) {
    this._token = token;
    sessionStorage.setItem('ri-admin-token', token);
  },

  clearToken() {
    this._token = null;
    sessionStorage.removeItem('ri-admin-token');
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || `API ${res.status}`);
    }
    const data = await res.json();
    this.setToken(data.token);
    return data;
  },

  async _fetch(endpoint, options = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/admin${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    if (res.status === 401) {
      this.clearToken();
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `API ${res.status}`);
    }
    return res.json();
  },

  getOverview()            { return this._fetch('/overview'); },
  getRuns(params = {})     { return this._fetch(`/runs?${new URLSearchParams(params)}`); },
  getRun(id)               { return this._fetch(`/runs/${id}`); },
  getAdminBooks(params={}) { return this._fetch(`/books?${new URLSearchParams(params)}`); },
  getAnalytics(period='7d'){ return this._fetch(`/analytics?period=${period}`); },
  getEditorStats()         { return this._fetch('/editors/stats'); },
  getSystemInfo()          { return this._fetch('/system'); },
  getCosts(since)          { return this._fetch(`/costs${since ? '?since=' + since : ''}`); },

  updateBook(id, data) {
    return this._fetch(`/books/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  deleteBook(id, hard = false) {
    return this._fetch(`/books/${id}?hard=${hard}`, { method: 'DELETE' });
  },
  triggerAgent(editor, batchSize = 10) {
    return this._fetch('/trigger-agent', { method: 'POST', body: JSON.stringify({ editor, batchSize }) });
  },
  triggerBackfill() {
    return this._fetch('/trigger-backfill', { method: 'POST' });
  },
  searchExternal(query) {
    return this._fetch('/search-external', { method: 'POST', body: JSON.stringify({ query }) });
  },
  importBook(data) {
    return this._fetch('/import-book', { method: 'POST', body: JSON.stringify(data) });
  },
  retryBook(id, step = 'review') {
    return this._fetch(`/books/${id}/retry`, { method: 'POST', body: JSON.stringify({ step }) });
  },

  // Scraper
  getScrapedBooks(params = {})    { return this._fetch(`/scraped-books?${new URLSearchParams(params)}`); },
  getScraperStatus()              { return this._fetch('/scraper/status'); },
  getScraperRuns(params = {})     { return this._fetch(`/scraper/runs?${new URLSearchParams(params)}`); },
  importScrapedBook(id, data = {}) {
    return this._fetch(`/scraped-books/${id}/import`, { method: 'POST', body: JSON.stringify(data) });
  },
  importScrapedBooksBulk(ids, data = {}) {
    return this._fetch('/scraped-books/import-bulk', { method: 'POST', body: JSON.stringify({ ids, ...data }) });
  },
  deleteScrapedBook(id) {
    return this._fetch(`/scraped-books/${id}`, { method: 'DELETE' });
  },
  updateScrapedBook(id, data) {
    return this._fetch(`/scraped-books/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },
  triggerScraper(source) {
    return this._fetch('/scraper/run', { method: 'POST', body: JSON.stringify(source ? { source } : {}) });
  },

  // Competitor insights
  getCompetitorInsights() { return this._fetch('/competitor-insights'); },

  // Duplicates
  getDuplicates()         { return this._fetch('/duplicates'); },
  mergeDuplicates(keepId, removeIds) {
    return this._fetch('/duplicates/merge', { method: 'POST', body: JSON.stringify({ keepId, removeIds }) });
  },
  dismissDuplicates(ids) {
    return this._fetch('/duplicates/dismiss', { method: 'POST', body: JSON.stringify({ ids }) });
  },
};

Object.assign(window, { ApiClient, AdminClient, useApi, checkApiAvailable, normalizeBook });
