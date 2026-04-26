const express = require('express');
const Book = require('../models/Book');
const router = express.Router();

const SITE_URL = 'https://reviewerinsight.com';
const SITE_NAME = 'Reviewer Insight';
const FEED_DESC = 'In-depth book reviews, AI-powered summaries, and chapter breakdowns for serious readers.';
const FEED_URL = `${SITE_URL}/feed.xml`;

// Cache for 30 minutes
let cachedFeed = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

function escXml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Wrap HTML content safely in CDATA for <content:encoded>
function cdata(str) {
  return `<![CDATA[${(str || '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

function buildItemContent(book, bookUrl) {
  const paragraphs = (book.review?.paragraphs || [])
    .map(p => `<p>${p}</p>`).join('\n');
  const bullets = (book.review?.summaryBullets || [])
    .map(b => `<li>${b}</li>`).join('\n');
  const takeaways = (book.takeaways || [])
    .map(t => `<li>${t}</li>`).join('\n');
  const headline = book.review?.headline || '';
  const stand = book.review?.stand || '';
  const blurb = book.blurb || book.description || '';
  const rating = book.rating != null ? `<p><strong>Rating: ${book.rating}/5</strong></p>` : '';
  const chapterCount = book.chapterSummaries?.length
    ? `<p><em>${book.chapterSummaries.length}-chapter breakdown available on site.</em></p>` : '';

  return `
    ${rating}
    ${blurb ? `<p>${blurb}</p>` : ''}
    ${headline ? `<h2>${headline}</h2>` : ''}
    ${stand ? `<p><em>${stand}</em></p>` : ''}
    ${paragraphs}
    ${bullets ? `<h3>Key Points</h3><ul>\n${bullets}\n</ul>` : ''}
    ${takeaways ? `<h3>Themes</h3><ul>\n${takeaways}\n</ul>` : ''}
    ${chapterCount}
    <p><a href="${bookUrl}">Read the full review on Reviewer Insight →</a></p>
  `.trim();
}

async function generateFeed() {
  const books = await Book.find({ status: 'published' })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();

  const buildDate = new Date().toUTCString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0"\n`;
  xml += `  xmlns:content="http://purl.org/rss/1.0/modules/content/"\n`;
  xml += `  xmlns:atom="http://www.w3.org/2005/Atom"\n`;
  xml += `  xmlns:dc="http://purl.org/dc/elements/1.1/">\n`;
  xml += `<channel>\n`;
  xml += `  <title>${escXml(SITE_NAME)}</title>\n`;
  xml += `  <link>${escXml(SITE_URL)}</link>\n`;
  xml += `  <description>${escXml(FEED_DESC)}</description>\n`;
  xml += `  <language>en-us</language>\n`;
  xml += `  <lastBuildDate>${buildDate}</lastBuildDate>\n`;
  xml += `  <ttl>30</ttl>\n`;
  xml += `  <atom:link href="${escXml(FEED_URL)}" rel="self" type="application/rss+xml"/>\n`;
  xml += `  <image>\n`;
  xml += `    <url>${escXml(SITE_URL)}/logo.png</url>\n`;
  xml += `    <title>${escXml(SITE_NAME)}</title>\n`;
  xml += `    <link>${escXml(SITE_URL)}</link>\n`;
  xml += `  </image>\n`;

  for (const book of books) {
    const slug = slugify(book.title);
    const bookUrl = `${SITE_URL}/book/${book._id}/${slug}`;
    const pubDate = book.updatedAt
      ? new Date(book.updatedAt).toUTCString()
      : buildDate;
    const description = book.blurb || book.review?.headline || `Review of ${book.title} by ${book.author}.`;
    const content = buildItemContent(book, bookUrl);

    xml += `  <item>\n`;
    xml += `    <title>${escXml(`${book.title} by ${book.author}`)}</title>\n`;
    xml += `    <link>${escXml(bookUrl)}</link>\n`;
    xml += `    <guid isPermaLink="true">${escXml(bookUrl)}</guid>\n`;
    xml += `    <pubDate>${pubDate}</pubDate>\n`;
    xml += `    <description>${escXml(description)}</description>\n`;
    xml += `    <content:encoded>${cdata(content)}</content:encoded>\n`;
    if (book.editor) xml += `    <dc:creator>${escXml(book.editor)}</dc:creator>\n`;
    if (book.genre) xml += `    <category>${escXml(book.genre)}</category>\n`;
    if (book.coverImageUrl) xml += `    <enclosure url="${escXml(book.coverImageUrl)}" type="image/jpeg" length="0"/>\n`;
    xml += `  </item>\n`;
  }

  xml += `</channel>\n`;
  xml += `</rss>`;
  return xml;
}

router.get('/feed.xml', async (req, res) => {
  try {
    if (cachedFeed && Date.now() - cacheTime < CACHE_TTL) {
      res.set('Content-Type', 'application/rss+xml; charset=utf-8');
      return res.send(cachedFeed);
    }

    const xml = await generateFeed();
    cachedFeed = xml;
    cacheTime = Date.now();

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(xml);
  } catch (err) {
    console.error('[Feed] Error:', err.message);
    res.status(500).set('Content-Type', 'text/plain').send('Feed generation failed');
  }
});

module.exports = router;
