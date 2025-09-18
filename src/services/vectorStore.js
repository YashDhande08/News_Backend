import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { embedTexts } from './embeddings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const VECTORS_PATH = path.join(DATA_DIR, 'vectors.json');

function loadVectors() {
  if (!fs.existsSync(VECTORS_PATH)) return [];
  const raw = fs.readFileSync(VECTORS_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export async function searchSimilarChunks(query, { topK = 5 } = {}) {
  const vectors = loadVectors();
  if (vectors.length === 0) return [];
  const variants = expandQueryVariants(query);
  const embeds = await embedTexts(variants);
  // average embeddings to make the query more robust
  const dim = embeds[0].length;
  const qVec = new Array(dim).fill(0);
  for (const vec of embeds) {
    for (let i = 0; i < dim; i += 1) qVec[i] += vec[i];
  }
  for (let i = 0; i < dim; i += 1) qVec[i] /= embeds.length;
  const intent = detectIntent(query);
  const scored = vectors.map((item) => {
    const base = cosineSimilarity(qVec, item.embedding);
    const bonus = computeKeywordBoost(item, intent);
    const recency = computeRecencyBoost(item.ts);
    return { ...item, score: base + bonus + recency };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, topK);
}

function expandQueryVariants(q) {
  const lower = q.toLowerCase();
  const variants = [q];
  const add = (s) => { if (!variants.includes(s)) variants.push(s); };
  if (/(\bai\b|artificial intelligence)/.test(lower)) {
    add(`${q} artificial intelligence in India`);
    add(`${q} startups and funding`);
  }
  if (/(\bit\b|information technology|tech|technology)/.test(lower)) {
    add(`${q} information technology sector`);
    add(`${q} software services and IT stocks`);
  }
  if (/business|market|headline|news/.test(lower)) {
    add(`${q} latest headlines today`);
    add(`${q} top stories`);
  }
  if (/india|indian/.test(lower) === false) {
    add(`${q} in India`);
  }
  return variants;
}

function detectIntent(q) {
  const lower = q.toLowerCase();
  return {
    business: /(\bbusiness\b|market|markets|stocks|economy|startup|funding)/.test(lower),
    it: /(\bit\b|information technology|tech|technology|software|it services)/.test(lower),
    ai: /(\bai\b|artificial intelligence|genai|machine learning|ml)/.test(lower),
    india: /(india|indian)/.test(lower),
    locations: extractLocations(lower),
  };
}

function extractLocations(lower) {
  const candidates = ['india','pune','bengaluru','bangalore','hyderabad','mumbai','delhi','gurugram','noida','chennai','kolkata'];
  return candidates.filter((c) => lower.includes(c));
}

function computeKeywordBoost(item, intent) {
  const textAll = `${item.title || ''} ${item.text || ''}`.toLowerCase();
  let bonus = 0;
  if (intent.business && /(business|market|markets|stocks|economy|startup|funding)/.test(textAll)) bonus += 0.08;
  if (intent.it && /(it|technology|tech|software|it services)/.test(textAll)) bonus += 0.08;
  if (intent.ai && /(ai|artificial intelligence|machine learning|ml|genai)/.test(textAll)) bonus += 0.06;
  if (intent.india && /(india|indian)/.test(textAll)) bonus += 0.04;
  for (const loc of intent.locations) {
    if (textAll.includes(loc)) { bonus += 0.05; break; }
  }
  return bonus;
}

function computeRecencyBoost(ts) {
  if (!ts) return 0;
  const ageMs = Date.now() - ts;
  const oneDay = 24 * 60 * 60 * 1000;
  if (ageMs < oneDay) return 0.08;
  if (ageMs < 3 * oneDay) return 0.05;
  if (ageMs < 7 * oneDay) return 0.02;
  return 0;
}



