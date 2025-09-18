import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import Redis from 'ioredis';
import { MemoryStore, RedisStore } from './src/services/sessionStore.js';

import { createRagRouter } from './src/routes/rag.js';
import { runIngest } from './src/services/refresher.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

async function start() {
  // Session store (Redis if available, else in-memory)
  let store;
  try {
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.ping();
    store = new RedisStore(redis);
    // eslint-disable-next-line no-console
    console.log('Using Redis session store');
  } catch (e) {
    store = new MemoryStore();
    // eslint-disable-next-line no-console
    console.log('Using in-memory session store (Redis not available)');
  }

  // Health
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // RAG routes
  app.use('/api', createRagRouter({ store }));

  // Manual refresh endpoint
  app.post('/api/refresh', async (_req, res) => {
    try {
      await runIngest();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });


  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });

  // Kick off refresh on startup and hourly
  try {
    await runIngest();
    // eslint-disable-next-line no-console
    console.log('Initial ingest complete');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Initial ingest failed:', e.message);
  }
  setInterval(async () => {
    try {
      await runIngest();
      // eslint-disable-next-line no-console
      console.log('Periodic ingest complete');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Periodic ingest failed:', e.message);
    }
  }, 60 * 60 * 1000);

  // Ingestion is run manually via: npm run ingest
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', err);
  process.exit(1);
});


