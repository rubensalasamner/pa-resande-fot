# pa-resande-fot API (Cloudflare Workers)

Workers + D1 + R2 (+ Queues on Paid) backend for route prep, Wikipedia POIs, and Google Chirp TTS.

## Setup

1. Copy `.dev.vars.example` → `.dev.vars` and fill `ORS_API_KEY` + `GCP_SERVICE_ACCOUNT_JSON`.
2. Apply migrations locally:

```bash
npm run db:migrate:local
```

3. Start:

```bash
npm run dev
```

API listens on `http://localhost:8787`.

## Free tier notes

- Prefer short routes / higher `intervalKm` (e.g. 10) while on Workers Free (50 subrequests/request).
- Without Queues (Paid), TTS runs **inline** for up to `INLINE_TTS_MAX` POIs (default 5).
- Queues work under `wrangler dev` locally.

## Deploy

Create real D1 + R2 (and Queue on Paid), replace IDs in `wrangler.jsonc`, then:

```bash
npx wrangler secret put ORS_API_KEY
npx wrangler secret put GCP_SERVICE_ACCOUNT_JSON
npx wrangler d1 migrations apply pa-resande-fot
npm run deploy
```
