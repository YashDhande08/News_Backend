import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { fileURLToPath } from 'url';
import { embedTexts } from '../src/services/embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const VECTORS_PATH = path.join(DATA_DIR, 'vectors.json');

// Helper to build Google News RSS for a query (IN locale)
function gn(query) {
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

// Indian states and union territories
const INDIAN_REGIONS = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
];

// Capital city per Indian state/UT (to ensure a top city feed per region)
const IN_STATE_CAPITALS = {
  'Andhra Pradesh': 'Amaravati',
  'Arunachal Pradesh': 'Itanagar',
  'Assam': 'Dispur',
  'Bihar': 'Patna',
  'Chhattisgarh': 'Raipur',
  'Goa': 'Panaji',
  'Gujarat': 'Gandhinagar',
  'Haryana': 'Chandigarh',
  'Himachal Pradesh': 'Shimla',
  'Jharkhand': 'Ranchi',
  'Karnataka': 'Bengaluru',
  'Kerala': 'Thiruvananthapuram',
  'Madhya Pradesh': 'Bhopal',
  'Maharashtra': 'Mumbai',
  'Manipur': 'Imphal',
  'Meghalaya': 'Shillong',
  'Mizoram': 'Aizawl',
  'Nagaland': 'Kohima',
  'Odisha': 'Bhubaneswar',
  'Punjab': 'Chandigarh',
  'Rajasthan': 'Jaipur',
  'Sikkim': 'Gangtok',
  'Tamil Nadu': 'Chennai',
  'Telangana': 'Hyderabad',
  'Tripura': 'Agartala',
  'Uttar Pradesh': 'Lucknow',
  'Uttarakhand': 'Dehradun',
  'West Bengal': 'Kolkata',
  'Andaman and Nicobar Islands': 'Port Blair',
  'Chandigarh': 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu': 'Daman',
  'Delhi': 'New Delhi',
  'Jammu and Kashmir': 'Srinagar',
  'Ladakh': 'Leh',
  'Lakshadweep': 'Kavaratti',
  'Puducherry': 'Puducherry'
};

// Broader coverage: global + Pakistan + India (national + all states/UT via Google News RSS)
const DEFAULT_FEEDS = [
  // Global
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://www.theguardian.com/world/rss',
  'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  'https://www.aljazeera.com/xml/rss/all.xml',

  // Pakistan
  'https://www.dawn.com/feed',
  'https://www.geo.tv/rss/1/1',
  'https://tribune.com.pk/feed/rss',
  'https://www.thenews.com.pk/rss/1/1',

  // India - National
  'https://www.thehindu.com/news/national/feeder/default.rss',
  'https://indianexpress.com/section/india/feed/',
  'https://feeds.hindustantimes.com/HT-Home-Page-TopStories',
  'https://feeds.feedburner.com/ndtvnews-india-news',
  'https://timesofindia.indiatimes.com/rssfeeds/-2128936835.cms',
  // India - all states & UTs via Google News
  ...INDIAN_REGIONS.map((name) => gn(`${name} news`)),
  // India - top city per state/UT (capitals)
  ...Object.entries(IN_STATE_CAPITALS).map(([state, capital]) => gn(`${capital} ${state} news`)),
  // Business - global and regional via Google News
  gn('global business news'),
  gn('international markets news'),
  gn('Pakistan business news'),
  gn('India business news'),
  // India - business for top financial cities
  gn('Mumbai business news'),
  gn('Delhi business news'),
  gn('Bengaluru business news'),
  gn('Chennai business news'),
  gn('Hyderabad business news'),
  gn('Kolkata business news'),
  gn('Pune business news'),
  gn('Ahmedabad business news'),
  gn('Gurugram business news'),
  gn('Noida business news'),
  // IT/Tech business in India and major hubs
  gn('India IT business news'),
  gn('India technology business news'),
  gn('Bengaluru IT business news'),
  gn('Hyderabad IT business news'),
  gn('Pune IT business news'),
  gn('Chennai IT business news'),
  gn('Gurugram IT business news'),
  gn('Noida IT business news'),
  gn('Mumbai IT business news'),
  gn('Delhi IT business news'),
  // AI business in India and major hubs
  gn('India AI business news'),
  gn('India artificial intelligence business news'),
  gn('Bengaluru AI business news'),
  gn('Hyderabad AI business news'),
  gn('Pune AI business news'),
  gn('Chennai AI business news'),
  gn('Gurugram AI business news'),
  gn('Noida AI business news'),
  gn('Mumbai AI business news'),
  gn('Delhi AI business news'),
];

function chunkText(text, maxLen = 800) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxLen) {
      if (current.trim().length > 0) chunks.push(current.trim());
      current = s;
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

async function fetchArticles(feeds = DEFAULT_FEEDS, targetCount = 50) {
  const parser = new Parser();
  const articles = [];
  const perFeedMax = parseInt(process.env.PER_FEED_MAX || '12', 10);
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      let addedFromThisFeed = 0;
      for (const item of feed.items) {
        if (articles.length >= targetCount) break;
        if (addedFromThisFeed >= perFeedMax) break;
        const text = [item.title, item.contentSnippet || item.content || ''].filter(Boolean).join('. ');
        const ts = item.isoDate ? Date.parse(item.isoDate) : (item.pubDate ? Date.parse(item.pubDate) : Date.now());
        if (!text || text.length < 100) continue;
        articles.push({
          id: item.guid || item.link || item.title,
          title: item.title,
          link: item.link,
          text,
          ts,
          source: feed.title || url
        });
        addedFromThisFeed += 1;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Feed failed', url, e.message);
    }
    if (articles.length >= targetCount) break;
  }
  // Prefer recent items first, then trim to targetCount
  articles.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return articles.slice(0, targetCount);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  // Allow overrides via env
  const envFeeds = process.env.FEED_URLS
    ? process.env.FEED_URLS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FEEDS;
  const targetCount = parseInt(process.env.INGEST_TARGET_COUNT || '120', 10);
  const articles = await fetchArticles(envFeeds, targetCount);
  // Build chunks
  const chunkRecords = [];
  for (const art of articles) {
    const chunks = chunkText(art.text, 700);
    for (const c of chunks) {
      chunkRecords.push({ title: art.title, source: art.link || art.source, text: c, ts: art.ts });
    }
  }
  // Embed in batches to respect limits
  const embeddings = [];
  const batchSize = 32;
  for (let i = 0; i < chunkRecords.length; i += batchSize) {
    const batch = chunkRecords.slice(i, i + batchSize);
    const vecs = await embedTexts(batch.map((b) => b.text));
    for (let j = 0; j < vecs.length; j += 1) {
      embeddings.push({ ...batch[j], embedding: vecs[j] });
    }
    // eslint-disable-next-line no-console
    console.log(`Embedded ${Math.min(i + batchSize, chunkRecords.length)} / ${chunkRecords.length}`);
  }
  fs.writeFileSync(VECTORS_PATH, JSON.stringify(embeddings, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Saved ${embeddings.length} chunks to ${VECTORS_PATH}`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});



