# Jeopardy

A multiplayer Jeopardy-style game you can host locally or deploy to Vercel. Create a room, share a 6-character code (or link), and play with friends in real time.

## Quick start (local)

```bash
npm install
npm run dev
```

Open http://localhost:3000/

- **Create game (host)** — you get a room code and land on the host control panel
- **Join** — enter a code on the home page, or open `http://localhost:3000/ABC123` directly

## How it works

| Role | What they see |
|------|----------------|
| **Host** | `/host` (scores, answers) and `/settings` (categories & clues). Not listed as a player. |
| **Players** | `/play` — the board and live scores. They pick a name when joining. |

Room codes are **6 characters** (capital letters and numbers, e.g. `K7NP2X`).

Share the join link from the host page: `https://yoursite.vercel.app/ABC123`

## Deploy to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add **Upstash Redis** from the Vercel Marketplace (free tier works). It auto-sets:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Deploy.

Redis is required in production so room state persists across serverless function invocations. Local `npm run dev` uses in-memory storage automatically when Redis env vars are not set.

```bash
npx vercel          # preview deploy
npx vercel --prod   # production
```

## Pages

- `/` — lobby (create or join)
- `/:code` — join a room via URL (e.g. `/K7NP2X`)
- `/play` — game board (players + host preview)
- `/host` — host control panel
- `/settings` — edit categories, questions, answers (host only)
