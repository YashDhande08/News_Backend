import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function generateAnswer(userQuery, contextChunks = []) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  const model = genAI.getGenerativeModel({ model: MODEL });
  const contextText = contextChunks
    .map((c, i) => `[[Chunk ${i + 1} | score=${c.score.toFixed(3)}]]\nTitle: ${c.title}\nSource: ${c.source}\nText: ${c.text}`)
    .join('\n\n');

  const prompt = `You are a helpful news assistant. Use only the provided context to answer. If the context does not contain relevant information, say so briefly.\n\nTask: Return the latest on-topic headlines directly answering the user's question. Prefer items that are recent and match sector/location keywords.\n\nFormat:\n- A short intro line (one sentence)\n- 3-6 bullet headlines with 1-line summaries\n- End with "Sources:" listing the titles you used\n\nContext:\n${contextText || 'No context available.'}\n\nUser question: ${userQuery}`;

  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const text = result.response.text();
  return text;
}



