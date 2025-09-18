import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = process.env.GOOGLE_EMBEDDING_MODEL || 'text-embedding-004';

export async function embedTexts(texts) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  if (texts.length === 1) {
    const res = await model.embedContent({
      content: { parts: [{ text: texts[0] }] },
    });
    return [res.embedding.values];
  }

  const res = await model.batchEmbedContents({
    requests: texts.map((t) => ({ content: { parts: [{ text: t }] } })),
  });
  return res.embeddings.map((e) => e.values);
}


