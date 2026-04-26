const path = require('path');
const fs = require('fs');
const Book = require('../models/Book');

const SITE_URL = 'https://reviewerinsight.com';
const SITE_NAME = 'Reviewer Insight';
const TWITTER_HANDLE = '@ReviewerInsight';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;
const DEFAULT_DESC = 'In-depth book reviews, AI-powered summaries, chapter breakdowns, and personalized reading recommendations. Discover your next great read on Reviewer Insight.';

const EDITOR_TWITTER = {
  'Mira Okafor': '@MiraOkafor_RI',
  'Jules Park': '@JulesPark_RI',
  'Dae Han': '@DaeHan_RI',
  'Noor Saleh': '@NoorSaleh_RI',
};

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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(str, len = 160) {
  if (!str) return '';
  const clean = String(str).replace(/\s+/g, ' ').trim();
  if (clean.length <= len) return clean;
  return clean.slice(0, len - 3) + '...';
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildJsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...obj })}</script>`;
}

// ─── Page-specific meta generators ──────────────────────────────

function homeMeta() {
  const jsonLd = [
    buildJsonLd({
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
    buildJsonLd({
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
      sameAs: [`https://twitter.com/ReviewerInsight`],
    }),
  ].join('\n');

  return {
    title: 'Reviewer Insight — Reviews, Summaries, A Good Read',
    description: DEFAULT_DESC,
    canonical: SITE_URL + '/',
    ogType: 'website',
    jsonLd,
  };
}

function browseMeta(genre) {
  const genreLabel = genre ? `${genre} Books` : 'All Books';
  const title = genre
    ? `${genre} Book Reviews — Reviewer Insight`
    : 'Browse Book Reviews — Reviewer Insight';
  const description = genre
    ? `Explore in-depth ${genre} book reviews, summaries, and recommendations on Reviewer Insight.`
    : 'Explore our library of in-depth book reviews across fiction, sci-fi, history, business, memoir, and more. Filter by genre, rating, and editor.';
  const canonical = genre
    ? `${SITE_URL}/browse?genre=${encodeURIComponent(genre)}`
    : `${SITE_URL}/browse`;

  return {
    title,
    description,
    canonical,
    ogType: 'website',
    jsonLd: buildJsonLd({
      '@type': 'CollectionPage',
      name: title,
      url: canonical,
      description,
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
  const jsonLd = buildJsonLd({
    '@type': 'AboutPage',
    name: 'Our Editors — Reviewer Insight',
    url: `${SITE_URL}/editors`,
    description: 'Meet the editorial team behind Reviewer Insight.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: Object.keys(EDITOR_TWITTER).map((name, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Person', name, worksFor: { '@type': 'Organization', name: SITE_NAME } },
      })),
    },
  });

  return {
    title: 'Our Editors — Reviewer Insight',
    description: 'Meet the editorial team behind Reviewer Insight. Each editor brings deep expertise across different literary genres.',
    canonical: SITE_URL + '/editors',
    ogType: 'website',
    jsonLd,
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

    const slug = slugify(book.title);
    const canonical = `${SITE_URL}/book/${book._id}/${slug}`;
    const image = book.coverImageUrl || DEFAULT_OG_IMAGE;

    // Rich description: blurb + review headline for best snippet
    const descSource = [book.blurb, book.review?.headline, book.description]
      .find(s => s && s.length > 10);
    const description = truncate(descSource || `Read our in-depth review of ${book.title} by ${book.author}.`);

    // Title optimised for search (book + author + brand)
    const title = `${book.title} by ${book.author} — Review | Reviewer Insight`;

    const datePublished = book.sources?.reviewGeneratedAt
      ? new Date(book.sources.reviewGeneratedAt).toISOString()
      : book.createdAt ? new Date(book.createdAt).toISOString() : undefined;
    const dateModified = book.updatedAt ? new Date(book.updatedAt).toISOString() : undefined;

    const reviewParagraphs = book.review?.paragraphs || [];
    const fullReviewText = reviewParagraphs.join(' ');

    // ── JSON-LD: Review ──────────────────────────────────────────
    const reviewSchema = {
      '@type': 'Review',
      name: `Review: ${book.title}`,
      url: canonical,
      datePublished,
      dateModified,
      reviewBody: fullReviewText || description,
      author: {
        '@type': 'Person',
        name: book.editor || 'Reviewer Insight Editorial',
        worksFor: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      itemReviewed: {
        '@type': 'Book',
        name: book.title,
        author: { '@type': 'Person', name: book.author },
        ...(book.isbn ? { isbn: book.isbn } : {}),
        ...(book.pages ? { numberOfPages: book.pages } : {}),
        ...(book.genre ? { genre: book.genre } : {}),
        ...(book.year ? { datePublished: String(book.year) } : {}),
        ...(image ? {
          image: {
            '@type': 'ImageObject',
            url: image,
            ...(book.coverImageUrl ? {} : { width: 1200, height: 630 }),
          },
        } : {}),
        url: canonical,
        inLanguage: 'en',
      },
    };
    if (book.rating != null) {
      reviewSchema.reviewRating = { '@type': 'Rating', ratingValue: book.rating, bestRating: 5, worstRating: 1 };
    }

    // ── JSON-LD: BreadcrumbList ──────────────────────────────────
    const breadcrumbSchema = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Browse', item: `${SITE_URL}/browse` },
        ...(book.genre ? [{ '@type': 'ListItem', position: 3, name: book.genre, item: `${SITE_URL}/browse?genre=${encodeURIComponent(book.genre)}` }] : []),
        { '@type': 'ListItem', position: book.genre ? 4 : 3, name: book.title, item: canonical },
      ],
    };

    const jsonLd = [buildJsonLd(reviewSchema), buildJsonLd(breadcrumbSchema)].join('\n');

    // ── Visible server-rendered content (indexed by crawlers) ───
    // Injected into #root before React mounts. React replaces it on hydration.
    const seoContent = buildSeoContent(book, canonical);

    return {
      title,
      description,
      canonical,
      ogType: 'article',
      image,
      imageAlt: `Cover of ${book.title} by ${book.author}`,
      articlePublishedTime: datePublished,
      articleModifiedTime: dateModified,
      articleSection: book.genre || 'Books',
      articleAuthor: book.editor || SITE_NAME,
      jsonLd,
      seoContent,
    };
  } catch (err) {
    console.error('[SEO] bookMeta error:', err.message);
    return null;
  }
}

function buildSeoContent(book, canonical) {
  const paragraphs = (book.review?.paragraphs || []).map(p => `<p>${escHtml(p)}</p>`).join('');
  const takeaways = (book.takeaways || []).map(t => `<li>${escHtml(t)}</li>`).join('');
  const summaryBullets = (book.review?.summaryBullets || []).map(b => `<li>${escHtml(b)}</li>`).join('');
  const chapters = (book.chapterSummaries || []).slice(0, 5)
    .map(ch => `<dt>Chapter ${ch.chapter}: ${escHtml(ch.title)}</dt><dd>${escHtml(ch.summary)}</dd>`).join('');

  return `<article itemscope itemtype="https://schema.org/Review" style="display:none" aria-hidden="true">
  <h1 itemprop="name">${escHtml(book.title)}</h1>
  <p>by <span itemprop="author">${escHtml(book.author)}</span>${book.year ? ` · ${book.year}` : ''}${book.pages ? ` · ${book.pages} pages` : ''}</p>
  ${book.genre ? `<p>Genre: ${escHtml(book.genre)}</p>` : ''}
  ${book.rating != null ? `<p itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">Rating: <span itemprop="ratingValue">${book.rating}</span>/5</p>` : ''}
  ${book.blurb ? `<p itemprop="description">${escHtml(book.blurb)}</p>` : ''}
  ${book.review?.headline ? `<h2>${escHtml(book.review.headline)}</h2>` : ''}
  ${book.review?.stand ? `<p><em>${escHtml(book.review.stand)}</em></p>` : ''}
  <div itemprop="reviewBody">${paragraphs}</div>
  ${takeaways ? `<h3>Key Takeaways</h3><ul>${takeaways}</ul>` : ''}
  ${summaryBullets ? `<h3>Summary</h3><ul>${summaryBullets}</ul>` : ''}
  ${chapters ? `<h3>Chapter Guide</h3><dl>${chapters}</dl>` : ''}
  <p>Read the full review at <a href="${escHtml(canonical)}">${escHtml(canonical)}</a></p>
</article>`;
}

// ─── Inject tags into HTML ───────────────────────────────────────

function injectMeta(html, meta) {
  if (!meta) return html;

  const tags = [];

  // Title
  if (meta.title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(meta.title)}</title>`);
  }

  // Noindex
  if (meta.noindex) {
    tags.push('<meta name="robots" content="noindex, nofollow"/>');
  }

  // Meta description
  if (meta.description) {
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

  // OG: title, description, url, type
  if (meta.title) html = html.replace(/<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${escHtml(meta.title)}"/>`);
  if (meta.description) html = html.replace(/<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${escHtml(meta.description)}"/>`);
  if (meta.canonical) html = html.replace(/<meta property="og:url" content="[^"]*"\/>/, `<meta property="og:url" content="${escHtml(meta.canonical)}"/>`);
  if (meta.ogType) html = html.replace(/<meta property="og:type" content="[^"]*"\/>/, `<meta property="og:type" content="${escHtml(meta.ogType)}"/>`);

  // OG: image
  const imageUrl = meta.image || DEFAULT_OG_IMAGE;
  tags.push(`<meta property="og:image" content="${escHtml(imageUrl)}"/>`);
  tags.push(`<meta property="og:image:alt" content="${escHtml(meta.imageAlt || SITE_NAME)}"/>`);
  tags.push(`<meta property="og:image:width" content="1200"/>`);
  tags.push(`<meta property="og:image:height" content="630"/>`);
  tags.push(`<meta property="og:locale" content="en_US"/>`);

  // Article-specific OG tags
  if (meta.ogType === 'article') {
    if (meta.articlePublishedTime) tags.push(`<meta property="article:published_time" content="${escHtml(meta.articlePublishedTime)}"/>`);
    if (meta.articleModifiedTime) tags.push(`<meta property="article:modified_time" content="${escHtml(meta.articleModifiedTime)}"/>`);
    if (meta.articleSection) tags.push(`<meta property="article:section" content="${escHtml(meta.articleSection)}"/>`);
    if (meta.articleAuthor) tags.push(`<meta property="article:author" content="${escHtml(meta.articleAuthor)}"/>`);
  }

  // Twitter
  if (meta.title) html = html.replace(/<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${escHtml(meta.title)}"/>`);
  if (meta.description) html = html.replace(/<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${escHtml(truncate(meta.description, 200))}"/>`);

  const twitterCard = meta.image ? 'summary_large_image' : 'summary';
  html = html.replace(/<meta name="twitter:card" content="[^"]*"\/>/, `<meta name="twitter:card" content="${twitterCard}"/>`);

  tags.push(`<meta name="twitter:image" content="${escHtml(imageUrl)}"/>`);
  tags.push(`<meta name="twitter:image:alt" content="${escHtml(meta.imageAlt || SITE_NAME)}"/>`);
  tags.push(`<meta name="twitter:site" content="${TWITTER_HANDLE}"/>`);
  if (meta.articleAuthor && EDITOR_TWITTER[meta.articleAuthor]) {
    tags.push(`<meta name="twitter:creator" content="${EDITOR_TWITTER[meta.articleAuthor]}"/>`);
  }

  // JSON-LD
  if (meta.jsonLd) tags.push(meta.jsonLd);

  // Inject into <!--SEO_INJECT-->
  if (tags.length > 0) {
    html = html.replace('<!--SEO_INJECT-->', tags.join('\n'));
  }

  // Inject crawlable content into <!--SEO_CONTENT-->
  if (meta.seoContent) {
    html = html.replace('<!--SEO_CONTENT-->', meta.seoContent);
  } else {
    html = html.replace('<!--SEO_CONTENT-->', '');
  }

  return html;
}

// ─── Route → meta resolver ──────────────────────────────────────

async function resolveMeta(pathname, query) {
  if (pathname === '/' || pathname === '') return homeMeta();
  if (pathname === '/browse') return browseMeta(query?.genre || null);
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

// ─── Express middleware ──────────────────────────────────────────

function seoMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();

  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();

  if (!htmlTemplate) {
    return res.status(500).send('Template not loaded');
  }

  resolveMeta(req.path, req.query)
    .then(meta => {
      const html = injectMeta(htmlTemplate, meta);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      res.send(html);
    })
    .catch(err => {
      console.error('[SEO] Meta resolution error:', err.message);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlTemplate);
    });
}

module.exports = seoMiddleware;
