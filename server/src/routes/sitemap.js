const express = require('express');
const Book = require('../models/Book');
const config = require('../config/env');

const router = express.Router();

const SITE_URL = config.siteUrl;

/** Remove characters illegal in XML 1.0 text nodes (breaks Google’s parser if present in titles/URLs). */
function stripIllegalXmlChars(str) {
  if (str == null) return '';
  return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, '');
}

function escXml(str) {
  return stripIllegalXmlChars(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Google requires fully qualified http(s) URLs in image sitemap entries. */
function toAbsoluteImageUrl(url) {
  const u = stripIllegalXmlChars((url || '').trim());
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  if (u.startsWith('/')) return `${SITE_URL}${encodeURI(u)}`;
  return '';
}

function locXml(pathOrUrl) {
  const raw = pathOrUrl.startsWith('http') ? pathOrUrl : `${SITE_URL}${pathOrUrl}`;
  let normalized = stripIllegalXmlChars(raw);
  try {
    normalized = encodeURI(decodeURI(normalized));
  } catch {
    try {
      normalized = encodeURI(normalized);
    } catch (_) {
      // keep stripped string
    }
  }
  return escXml(normalized);
}

// Cache sitemap for 1 hour
let cachedSitemap = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function generateSitemap() {
  const now = new Date().toISOString();

  // Canonical static routes only (no /browse?genre=… — those are client state and duplicate /browse for crawlers).
  const staticPages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/browse', priority: '0.9', changefreq: 'daily' },
    { path: '/recommend', priority: '0.8', changefreq: 'weekly' },
    { path: '/editors', priority: '0.6', changefreq: 'monthly' },
    { path: '/membership', priority: '0.5', changefreq: 'monthly' },
  ];

  const books = await Book.find({ status: 'published' })
    .select('_id title author updatedAt featured coverImageUrl')
    .lean();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  for (const page of staticPages) {
    xml += '  <url>\n';
    xml += `    <loc>${locXml(page.path)}</loc>\n`;
    xml += `    <lastmod>${escXml(now)}</lastmod>\n`;
    xml += `    <changefreq>${escXml(page.changefreq)}</changefreq>\n`;
    xml += `    <priority>${escXml(page.priority)}</priority>\n`;
    xml += '  </url>\n';
  }

  for (const book of books) {
    const slug = slugify(book.title);
    const lastmod = book.updatedAt ? new Date(book.updatedAt).toISOString() : now;
    const priority = book.featured ? '0.9' : '0.7';
    const bookPath = `/book/${book._id}/${slug}`;
    const bookUrl = locXml(bookPath);

    xml += '  <url>\n';
    xml += `    <loc>${bookUrl}</loc>\n`;
    xml += `    <lastmod>${escXml(lastmod)}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += `    <priority>${escXml(priority)}</priority>\n`;

    const coverAbs = toAbsoluteImageUrl(book.coverImageUrl);
    if (coverAbs) {
      xml += '    <image:image>\n';
      xml += `      <image:loc>${escXml(coverAbs)}</image:loc>\n`;
      xml += `      <image:title>${escXml(book.title)}</image:title>\n`;
      if (book.author) xml += `      <image:caption>${escXml(`${book.title} by ${book.author}`)}</image:caption>\n`;
      xml += '    </image:image>\n';
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

function sendSitemap(res, body) {
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.send(body);
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (cachedSitemap && Date.now() - cacheTime < CACHE_TTL) {
      return sendSitemap(res, cachedSitemap);
    }

    const xml = await generateSitemap();
    cachedSitemap = xml;
    cacheTime = Date.now();

    sendSitemap(res, xml);
  } catch (err) {
    console.error('[Sitemap] Error:', err.message);
    res.status(500).set('Content-Type', 'text/plain; charset=utf-8').send('Sitemap generation failed');
  }
});

module.exports = router;
