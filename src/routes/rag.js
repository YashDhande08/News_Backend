import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { searchSimilarChunks } from '../services/vectorStore.js';
import { generateAnswer } from '../services/gemini.js';

const CHAT_TTL_SECONDS = parseInt(process.env.CHAT_TTL_SECONDS || '86400', 10);
const HISTORY_KEY = (sessionId) => `chat:${sessionId}:history`;

export function createRagRouter({ store }) {
  const router = express.Router();

  // Create new session
  router.post('/session', async (_req, res) => {
    const sessionId = uuidv4();
    await store.del(HISTORY_KEY(sessionId));
    await store.expire(HISTORY_KEY(sessionId), CHAT_TTL_SECONDS);
    res.json({ sessionId });
  });

  // Get history
  router.get('/session/:sessionId/history', async (req, res) => {
    const { sessionId } = req.params;
    const list = await store.lrange(HISTORY_KEY(sessionId), 0, -1);
    const history = list.map((item) => JSON.parse(item));
    res.json({ history });
  });

  // Clear session
  router.delete('/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    await store.del(HISTORY_KEY(sessionId));
    res.json({ ok: true });
  });

  // Chat endpoint
  router.post('/chat', async (req, res) => {
    const { sessionId, message, topK = 8 } = req.body || {};
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    // Save user message
    await store.rpush(HISTORY_KEY(sessionId), JSON.stringify({ role: 'user', content: message, ts: Date.now() }));
    await store.expire(HISTORY_KEY(sessionId), CHAT_TTL_SECONDS);

    try {
      const contextChunks = await searchSimilarChunks(message, { topK });
      const answer = await generateAnswer(message, contextChunks);

      // Save assistant message
      await store.rpush(HISTORY_KEY(sessionId), JSON.stringify({ role: 'assistant', content: answer, ts: Date.now() }));
      await store.expire(HISTORY_KEY(sessionId), CHAT_TTL_SECONDS);

      return res.json({ answer, context: contextChunks });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('POST /api/chat failed:', err);
      return res.status(500).json({ error: err?.message || 'Generation failed' });
    }
  });

  return router;
}


