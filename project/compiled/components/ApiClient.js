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
    cover: b.coverDesign || b.cover || {
      style: 'block',
      bg: '#141210',
      fg: '#F5EFE4',
      motif: 'bars'
    }
  };
}
const ApiClient = {
  _cache: new Map(),
  _cacheTimeout: 60000,
  // 1 minute

  async _fetch(endpoint) {
    const cacheKey = endpoint;
    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < this._cacheTimeout) {
      return cached.data;
    }
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API ${res.status}: ${endpoint}`);
    const data = await res.json();
    this._cache.set(cacheKey, {
      data,
      time: Date.now()
    });
    return data;
  },
  async getBooks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const result = await this._fetch(`/books?${qs}`);
    return {
      ...result,
      books: (result.books || []).map(normalizeBook)
    };
  },
  async getBook(id) {
    return normalizeBook(await this._fetch(`/books/${id}`));
  },
  async getFeatured() {
    const result = await this._fetch('/books/featured');
    return {
      featured: normalizeBook(result.featured),
      also: (result.also || []).map(normalizeBook)
    };
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
  async getAuthors(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this._fetch(`/authors?${qs}`);
  },
  async getAuthor(slug) {
    return this._fetch(`/authors/${slug}`);
  },
  async getAuthorBooks(slug) {
    return this._fetch(`/authors/${slug}/books`);
  },
  async search(q, params = {}) {
    const qs = new URLSearchParams({
      q,
      ...params
    }).toString();
    const result = await this._fetch(`/search?${qs}`);
    return {
      ...result,
      books: (result.books || []).map(normalizeBook)
    };
  },
  async getRecommendations(profile) {
    const res = await fetch(`${API_BASE}/recommendations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(profile)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'Request failed'
      }));
      throw new Error(err.error || `API ${res.status}`);
    }
    const data = await res.json();
    if (data.recommendations) {
      data.recommendations = data.recommendations.map(rec => ({
        ...rec,
        ...normalizeBook(rec)
      }));
    }
    return data;
  }
};

// Custom hook for API data fetching with loading/error states + static fallback
function useApi(fetchFn, fallback, deps = []) {
  const [state, setState] = React.useState({
    data: null,
    loading: true,
    error: null
  });
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
  }, deps);

  // Return API data if available, otherwise the fallback
  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    // Resolved data: API data or fallback
    resolved: state.data || fallback,
    isApi: !!state.data
  };
}

// Check if the API is available (run once on load)
let _apiAvailable = null;
async function checkApiAvailable() {
  if (_apiAvailable !== null) return _apiAvailable;
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000)
    });
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'Login failed'
      }));
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
        ...(options.headers || {})
      }
    });
    if (res.status === 401) {
      this.clearToken();
      throw new Error('AUTH_EXPIRED');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({
        error: 'Request failed'
      }));
      throw new Error(err.error || `API ${res.status}`);
    }
    return res.json();
  },
  getOverview() {
    return this._fetch('/overview');
  },
  getRuns(params = {}) {
    return this._fetch(`/runs?${new URLSearchParams(params)}`);
  },
  getRun(id) {
    return this._fetch(`/runs/${id}`);
  },
  getAdminBooks(params = {}) {
    return this._fetch(`/books?${new URLSearchParams(params)}`);
  },
  getAnalytics(period = '7d') {
    return this._fetch(`/analytics?period=${period}`);
  },
  getEditorStats() {
    return this._fetch('/editors/stats');
  },
  getSystemInfo() {
    return this._fetch('/system');
  },
  getCosts(since) {
    return this._fetch(`/costs${since ? '?since=' + since : ''}`);
  },
  updateBook(id, data) {
    return this._fetch(`/books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  deleteBook(id, hard = false) {
    return this._fetch(`/books/${id}?hard=${hard}`, {
      method: 'DELETE'
    });
  },
  triggerAgent(editor, batchSize = 10) {
    return this._fetch('/trigger-agent', {
      method: 'POST',
      body: JSON.stringify({
        editor,
        batchSize
      })
    });
  },
  triggerBackfill() {
    return this._fetch('/trigger-backfill', {
      method: 'POST'
    });
  },
  searchExternal(query) {
    return this._fetch('/search-external', {
      method: 'POST',
      body: JSON.stringify({
        query
      })
    });
  },
  importBook(data) {
    return this._fetch('/import-book', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  retryBook(id, step = 'review') {
    return this._fetch(`/books/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify({
        step
      })
    });
  },
  // Scraper
  getScrapedBooks(params = {}) {
    return this._fetch(`/scraped-books?${new URLSearchParams(params)}`);
  },
  getScraperStatus() {
    return this._fetch('/scraper/status');
  },
  getScraperRuns(params = {}) {
    return this._fetch(`/scraper/runs?${new URLSearchParams(params)}`);
  },
  importScrapedBook(id, data = {}) {
    return this._fetch(`/scraped-books/${id}/import`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  importScrapedBooksBulk(ids, data = {}) {
    return this._fetch('/scraped-books/import-bulk', {
      method: 'POST',
      body: JSON.stringify({
        ids,
        ...data
      })
    });
  },
  deleteScrapedBook(id) {
    return this._fetch(`/scraped-books/${id}`, {
      method: 'DELETE'
    });
  },
  updateScrapedBook(id, data) {
    return this._fetch(`/scraped-books/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  triggerScraper(source) {
    return this._fetch('/scraper/run', {
      method: 'POST',
      body: JSON.stringify(source ? {
        source
      } : {})
    });
  },
  // Competitor insights
  getCompetitorInsights() {
    return this._fetch('/competitor-insights');
  },
  // Authors (admin)
  getAuthorStats() {
    return this._fetch('/author-stats');
  },
  getAdminAuthors(params = {}) {
    return this._fetch(`/authors?${new URLSearchParams(params)}`);
  },
  regenerateAuthorBio(id) {
    return this._fetch(`/authors/${id}/regenerate-bio`, {
      method: 'POST'
    });
  },
  triggerAuthorBios(batchSize = 50) {
    return this._fetch('/trigger-agent', {
      method: 'POST',
      body: JSON.stringify({
        editor: 'Sofia Kwon',
        batchSize
      })
    });
  },
  seedAuthors() {
    return this._fetch('/seed-authors', {
      method: 'POST'
    });
  },
  // YouTube OAuth
  getYoutubeStatus() {
    return this._fetch('/youtube/status');
  },
  getYoutubeAuthUrl() {
    return this._fetch('/youtube/auth-url');
  },
  disconnectYoutube() {
    return this._fetch('/youtube/disconnect', {
      method: 'DELETE'
    });
  },
  // Nature Live (separate YouTube channel)
  getNatureLiveStatus() {
    return this._fetch('/nature-live/status');
  },
  getNatureYoutubeAuthUrl() {
    return this._fetch('/nature-live/youtube/auth-url');
  },
  disconnectNatureYoutube() {
    return this._fetch('/nature-live/youtube/disconnect', {
      method: 'DELETE'
    });
  },
  generateNatureAssets(themeId) {
    return this._fetch(`/nature-live/${themeId}/generate-assets`, {
      method: 'POST'
    });
  },
  prepareNatureStream(themeId) {
    return this._fetch(`/nature-live/${themeId}/prepare`, {
      method: 'POST'
    });
  },
  goLiveNatureStream(themeId) {
    return this._fetch(`/nature-live/${themeId}/go-live`, {
      method: 'POST'
    });
  },
  getNatureBroadcastStatus(themeId) {
    return this._fetch(`/nature-live/${themeId}/broadcast-status`);
  },
  exportNatureTest(themeId, minutes = 15) {
    return this._fetch(`/nature-live/${themeId}/export-test`, {
      method: 'POST',
      body: JSON.stringify({
        minutes
      })
    });
  },
  natureExportTestDownloadUrl(themeId) {
    const token = this.getToken();
    const base = `${API_BASE}/admin/nature-live/${themeId}/export-test/download`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
  natureExportTestStreamUrl(themeId) {
    const token = this.getToken();
    const base = `${API_BASE}/admin/nature-live/${themeId}/export-test/stream`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  },
  cancelNatureExport(themeId) {
    return this._fetch(`/nature-live/${themeId}/export-test/cancel`, {
      method: 'POST'
    });
  },
  resetNatureExport(themeId) {
    return this._fetch(`/nature-live/${themeId}/export-test/reset`, {
      method: 'POST'
    });
  },
  naturePreviewUrl(themeId) {
    return `${API_BASE}/admin/nature-live/${themeId}/preview`;
  },
  naturePreviewVideoUrl(themeId) {
    return `${API_BASE}/admin/nature-live/${themeId}/preview/video`;
  },
  naturePreviewAudioUrl(themeId) {
    return `${API_BASE}/admin/nature-live/${themeId}/preview/audio`;
  },
  startNatureStream(themeId) {
    return this._fetch(`/nature-live/${themeId}/start`, {
      method: 'POST'
    });
  },
  stopNatureStream(themeId) {
    return this._fetch(`/nature-live/${themeId}/stop`, {
      method: 'POST'
    });
  },
  stopAllNatureStreams() {
    return this._fetch('/nature-live/stop-all', {
      method: 'POST'
    });
  },
  // Football Live (separate YouTube channel)
  getFootballLiveStatus() {
    return this._fetch('/football-live/status');
  },
  getFootballYoutubeAuthUrl() {
    return this._fetch('/football-live/youtube/auth-url');
  },
  disconnectFootballYoutube() {
    return this._fetch('/football-live/youtube/disconnect', {
      method: 'DELETE'
    });
  },
  updateFootballStream(data) {
    return this._fetch('/football-live/stream', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },
  prepareFootballStream() {
    return this._fetch('/football-live/prepare', {
      method: 'POST'
    });
  },
  goLiveFootballStream() {
    return this._fetch('/football-live/go-live', {
      method: 'POST'
    });
  },
  startFootballStream() {
    return this._fetch('/football-live/start', {
      method: 'POST'
    });
  },
  stopFootballStream() {
    return this._fetch('/football-live/stop', {
      method: 'POST'
    });
  },
  getFootballBroadcastStatus() {
    return this._fetch('/football-live/broadcast-status');
  },
  uploadFootballVideo(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/admin/football-live/upload-video`);
      xhr.setRequestHeader('Authorization', `Bearer ${this.getToken()}`);
      xhr.setRequestHeader('Content-Type', 'video/mp4');
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({});
          }
        } else {
          try {
            reject(new Error(JSON.parse(xhr.responseText).error || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(file);
    });
  },
  // Videos
  getVideoStats() {
    return this._fetch('/video-stats');
  },
  getVideos(params = {}) {
    return this._fetch(`/videos?${new URLSearchParams(params)}`);
  },
  generateVideo(bookId) {
    return this._fetch('/videos/generate', {
      method: 'POST',
      body: JSON.stringify({
        bookId
      })
    });
  },
  generateVideoBatch(batchSize = 3) {
    return this._fetch('/videos/batch', {
      method: 'POST',
      body: JSON.stringify({
        batchSize
      })
    });
  },
  uploadVideoToYoutube(id) {
    return this._fetch(`/videos/${id}/upload-youtube`, {
      method: 'POST'
    });
  },
  deleteVideo(id) {
    return this._fetch(`/videos/${id}`, {
      method: 'DELETE'
    });
  },
  // Duplicates
  getDuplicates() {
    return this._fetch('/duplicates');
  },
  mergeDuplicates(keepId, removeIds) {
    return this._fetch('/duplicates/merge', {
      method: 'POST',
      body: JSON.stringify({
        keepId,
        removeIds
      })
    });
  },
  dismissDuplicates(ids) {
    return this._fetch('/duplicates/dismiss', {
      method: 'POST',
      body: JSON.stringify({
        ids
      })
    });
  }
};

/** URL slug + review route (must match server `utils/slugify` and sitemap /book/:id/:slug). */
function riSlugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function riReviewRouteFromBook(book, extra = {}) {
  if (!book) return {
    name: 'home'
  };
  const id = book.id != null ? String(book.id) : book._id != null ? String(book._id) : book.bookId != null ? String(book.bookId) : '';
  if (!id) return {
    name: 'home'
  };
  const title = book.title != null ? String(book.title) : '';
  const slug = title ? riSlugify(title) : '';
  return {
    name: 'review',
    id,
    ...(slug ? {
      slug
    } : {}),
    ...extra
  };
}
Object.assign(window, {
  ApiClient,
  AdminClient,
  useApi,
  checkApiAvailable,
  normalizeBook,
  riSlugify,
  riReviewRouteFromBook
});