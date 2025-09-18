NEWS CHATbot – Server

Overview

- Node.js (Express) API for the news RAG chatbot
- Ingests RSS → chunks → embeds (Gemini text-embedding-004) → stores vectors (JSON)
- Retrieves top‑K and generates answers via Gemini
- Sessions in Redis (preferred) with in‑memory fallback

Run locally (Windows/PowerShell)

```
cd server
notepad .env  # add keys below
npm install
npm run ingest
npm run dev
```

.env

```
GEMINI_API_KEY=YOUR_GEMINI_KEY
PORT=4000
CHAT_TTL_SECONDS=86400
# Optional Redis (fallback to in‑memory store if absent)
# REDIS_URL=redis://localhost:6379
# Ingestion tuning (optional)
# INGEST_TARGET_COUNT=300
# PER_FEED_MAX=20
# FEED_URLS=https://example.com/rss,https://another.com/rss
```

Key endpoints

- GET `/health` – health check
- POST `/api/session` – create session `{ sessionId }`
- GET `/api/session/:sessionId/history` – get history
- DELETE `/api/session/:sessionId` – clear session
- POST `/api/chat` – ask `{ sessionId, message, topK? }`
- POST `/api/refresh` – re‑ingest (manual cache warming)

TTL configuration (sessions)

- Set `CHAT_TTL_SECONDS` in `.env` (default 86400)
- Applied on each `rpush` to refresh expiry
- Implementations in `src/services/sessionStore.js`

Cache warming / freshness

- Startup: runs ingest once
- Hourly: runs ingest on an interval
- Manual: call `POST /api/refresh`
- Tuning: `INGEST_TARGET_COUNT`, `PER_FEED_MAX`, `FEED_URLS`

Deploy (Render)

- Root Directory: `server`
- Build Command: `npm install`
- Start Command: `node index.js`
- Health Check Path: `/health`
- Env: `GEMINI_API_KEY` (+ optional vars above). Render sets `PORT`.

Notes

- Vectors saved to `server/data/vectors.json`
- If you prefer external scheduling, disable the interval and call `/api/refresh` via Render Cron
