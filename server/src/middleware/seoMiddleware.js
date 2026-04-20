const path = require('path');
const fs = require('fs');
const Book = require('../models/Book');

const SITE_URL = 'https://reviewerinsight.com';
const SITE_NAME = 'Reviewer Insight';
const DEFAULT_DESC = 'In-depth book reviews, AI-powered summaries, chapter breakdowns, and personalized reading recommendations. Discover your next great read on Reviewer Insight.';

// Read the HTML template once at startup
const templatePath = path.join(__dirname, '../../../project/Reviewer Insight.html');
let htmlTemplate = '';
try {
  htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
} catch (err) {
  console.error('[SEO] Failed to read HTML template:', err.message);
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(str, len = 160) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  if (clean.length <= len) return clean;
  return clean.slice(0, len - 3) + '...';
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildJsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...obj })}</script>`;
}

// ─── Page-specific meta generators ──────────────────

function homeMeta() {
  return {
    title: 'Reviewer Insight — Reviews, Summaries, A Good Read',
    description: DEFAULT_DESC,
    canonical: SITE_URL + '/',
    ogType: 'website',
    jsonLd: buildJsonLd({
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESC,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/browse?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    }),
  };
}

function browseMeta() {
  return {
    title: 'Browse Book Reviews — Reviewer Insight',
    description: 'Explore our library of in-depth book reviews across fiction, sci-fi, history, business, memoir, and more. Filter by genre, rating, and editor.',
    canonical: SITE_URL + '/browse',
    ogType: 'website',
    jsonLd: buildJsonLd({
      '@type': 'CollectionPage',
      name: 'Browse Book Reviews',
      url: `${SITE_URL}/browse`,
      description: 'Explore in-depth book reviews across all genres.',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    }),
  };
}

function recommendMeta() {
  return {
    title: 'Personalized Book Recommendations — Reviewer Insight',
    description: 'Tell us your reading preferences and get AI-powered personalized book recommendations with reviews and summaries.',
    canonical: SITE_URL + '/recommend',
    ogType: 'website',
    jsonLd: null,
  };
}

function editorsMeta() {
  return {
    title: 'Our Editors — Reviewer Insight',
    description: 'Meet the editorial team behind Reviewer Insight. Each editor brings expertise across different literary genres.',
    canonical: SITE_URL + '/editors',
    ogType: 'website',
    jsonLd: null,
  };
}

function membershipMeta() {
  return {
    title: 'Membership — Reviewer Insight',
    description: 'Join Reviewer Insight for exclusive reviews, early access to new content, and personalized reading lists.',
    canonical: SITE_URL + '/membership',
    ogType: 'website',
    jsonLd: null,
  };
}

function adminMeta() {
  return {
    title: 'Admin — Reviewer Insight',
    description: '',
    canonical: null,
    ogType: null,
    noindex: true,
    jsonLd: null,
  };
}

async function bookMeta(bookId) {
  try {
    const book = await Book.findById(bookId).lean();
    if (!book || book.status !== 'published') return null;

    const title = `${book.title} by ${book.author} — Review | Reviewer Insight`;
    const description = truncate(book.blurb || book.review?.headline || book.description || `Read our in-depth review of ${book.title} by ${book.author}.`);
    const slug = slugify(book.title);
    const canonical = `${SITE_URL}/book/${book._id}/${slug}`;
    const image = book.coverImageUrl || null;

    const reviewBody = (book.review?.paragraphs || []).join(' ');
    const jsonLdObj = {
      '@type': 'Review',
      name: `Review: ${book.title}`,
      url: canonical,
      datePublished: book.createdAt ? new Date(book.createdAt).toISOString() : undefined,
      dateModified: book.updatedAt ? new Date(book.updatedAt).toISOString() : undefined,
      reviewBody: truncate(reviewBody, 500),
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      itemReviewed: {
        '@type': 'Book',
        name: book.title,
        author: { '@type': 'Person', name: book.author },
        ...(book.isbn ? { isbn: book.isbn } : {}),
        ...(book.pages ? { numberOfPages: book.pages } : {}),
        ...(book.genre ? { genre: book.genre } : {}),
        ...(book.year ? { datePublished: String(book.year) } : {}),
        ...(image ? { image } : {}),
      },
    };
    if (book.rating != null) {
      jsonLdObj.reviewRating = { '@type': 'Rating', ratingValue: book.rating, bestRating: 5, worstRating: 0 };
    }

    return {
      title,
      description,
      canonical,
      ogType: 'article',
      image,
      jsonLd: buildJsonLd(jsonLdObj),
    };
  } catch {
    return null;
  }
}

// ─── Inject tags into HTML ──────────────────

function injectMeta(html, meta) {
  if (!meta) return html;

  const tags = [];

  // Title override
  if (meta.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(meta.title)}</title>`);
  }

  // Noindex for admin
  if (meta.noindex) {
    tags.push('<meta name="robots" content="noindex, nofollow"/>');
  }

  // Meta description
  if (meta.description) {
    // Replace existing default meta description
    html = html.replace(
      /<meta name="description" content="[^"]*"\/>/,
      `<meta name="description" content="${escHtml(meta.description)}"/>`
    );
  }

  // Canonical
  if (meta.canonical) {
    html = html.replace(
      /<link rel="canonical" href="[^"]*"\/>/,
      `<link rel="canonical" href="${escHtml(meta.canonical)}"/>`
    );
  }

  // OG tags
  if (meta.title) {
    html = html.replace(
      /<meta property="og:title" content="[^"]*"\/>/,
      `<meta property="og:title" content="${escHtml(meta.title)}"/>`
    );
  }
  if (meta.description) {
    html = html.replace(
      /<meta property="og:description" content="[^"]*"\/>/,
      `<meta property="og:description" content="${escHtml(meta.description)}"/>`
    );
  }
  if (meta.canonical) {
    html = html.replace(
      /<meta property="og:url" content="[^"]*"\/>/,
      `<meta property="og:url" content="${escHtml(meta.canonical)}"/>`
    );
  }
  if (meta.ogType) {
    html = html.replace(
      /<meta property="og:type" content="[^"]*"\/>/,
      `<meta property="og:type" content="${escHtml(meta.ogType)}"/>`
    );
  }

  // Twitter tags
  if (meta.title) {
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"\/>/,
      `<meta name="twitter:title" content="${escHtml(meta.title)}"/>`
    );
  }
  if (meta.description) {
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*"\/>/,
      `<meta name="twitter:description" content="${escHtml(truncate(meta.description, 200))}"/>`
    );
  }

  // OG image + Twitter image
  if (meta.image) {
    tags.push(`<meta property="og:image" content="${escHtml(meta.image)}"/>`);
    tags.push(`<meta name="twitter:image" content="${escHtml(meta.image)}"/>`);
    html = html.replace(
      /<meta name="twitter:card" content="[^"]*"\/>/,
      '<meta name="twitter:card" content="summary_large_image"/>'
    );
  }

  // JSON-LD
  if (meta.jsonLd) {
    tags.push(meta.jsonLd);
  }

  // Inject tags at the <!--SEO_INJECT--> placeholder
  if (tags.length > 0) {
    html = html.replace('<!--SEO_INJECT-->', tags.join('\n'));
  }

  return html;
}

// ─── Route → meta resolver ──────────────────

async function resolveMeta(pathname) {
  if (pathname === '/' || pathname === '') return homeMeta();
  if (pathname === '/browse') return browseMeta();
  if (pathname === '/recommend') return recommendMeta();
  if (pathname === '/editors') return editorsMeta();
  if (pathname === '/membership') return membershipMeta();
  if (pathname === '/reviewadmin') return adminMeta();

  const bookMatch = pathname.match(/^\/book\/([a-f0-9]{24})/i);
  if (bookMatch) {
    const meta = await bookMeta(bookMatch[1]);
    return meta || homeMeta();
  }

  return homeMeta();
}

// ─── Express middleware ──────────────────

function seoMiddleware(req, res, next) {
  // Only handle GET requests for HTML pages
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();

  // Let static files pass through (they're handled by express.static before this)
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();

  if (!htmlTemplate) {
    return res.status(500).send('Template not loaded');
  }

  resolveMeta(req.path)
    .then(meta => {
      const html = injectMeta(htmlTemplate, meta);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    })
    .catch(err => {
      console.error('[SEO] Meta resolution error:', err.message);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlTemplate);
    });
}

module.exports = seoMiddleware;
