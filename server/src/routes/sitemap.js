const express = require('express');
const Book = require('../models/Book');
const router = express.Router();

const SITE_URL = 'https://reviewerinsight.com';

const GENRES = ['Fiction', 'Non-Fiction', 'History', 'Business', 'Sci-Fi', 'Nature', 'Essays', 'Memoir', 'Biography'];

// Cache sitemap for 1 hour
let cachedSitemap = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escXml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function generateSitemap() {
  const now = new Date().toISOString();

  // Static pages
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/browse', priority: '0.9', changefreq: 'daily' },
    { loc: '/recommend', priority: '0.8', changefreq: 'weekly' },
    { loc: '/editors', priority: '0.6', changefreq: 'monthly' },
    { loc: '/membership', priority: '0.5', changefreq: 'monthly' },
  ];

  // Genre pages
  const genrePages = GENRES.map(g => ({
    loc: `/browse?genre=${encodeURIComponent(g)}`,
    priority: '0.8',
    changefreq: 'daily',
  }));

  // Published books — include cover for image sitemap
  const books = await Book.find({ status: 'published' })
    .select('_id title author updatedAt featured coverDesign')
    .lean();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  for (const page of [...staticPages, ...genrePages]) {
    xml += '  <url>\n';
    xml += `    <loc>${escXml(SITE_URL + page.loc)}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += '  </url>\n';
  }

  for (const book of books) {
    const slug = slugify(book.title);
    const lastmod = book.updatedAt ? new Date(book.updatedAt).toISOString() : now;
    const priority = book.featured ? '0.9' : '0.7';
    const bookUrl = escXml(`${SITE_URL}/book/${book._id}/${slug}`);

    xml += '  <url>\n';
    xml += `    <loc>${bookUrl}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += `    <priority>${priority}</priority>\n`;

    // Image sitemap entry if there's a cover image URL
    const coverUrl = book.coverDesign?.imageUrl;
    if (coverUrl) {
      xml += '    <image:image>\n';
      xml += `      <image:loc>${escXml(coverUrl)}</image:loc>\n`;
      xml += `      <image:title>${escXml(book.title)}</image:title>\n`;
      if (book.author) xml += `      <image:caption>${escXml(`${book.title} by ${book.author}`)}</image:caption>\n`;
      xml += '    </image:image>\n';
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    if (cachedSitemap && Date.now() - cacheTime < CACHE_TTL) {
      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(cachedSitemap);
    }

    const xml = await generateSitemap();
    cachedSitemap = xml;
    cacheTime = Date.now();

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('[Sitemap] Error:', err.message);
    res.status(500).set('Content-Type', 'text/plain').send('Sitemap generation failed');
  }
});

module.exports = router;
