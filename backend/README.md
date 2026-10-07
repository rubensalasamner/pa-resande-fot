# pa-resande-fot API (Cloudflare Workers)

Workers + D1 + R2 (+ Queues on Paid) backend for route prep, Wikipedia POIs, and Google Chirp TTS.

Current default voice: `sv-SE-Chirp3-HD-Algenib` (`TTS_VOICE` in `wrangler.jsonc`).

## Prerequisites (one-time cloud setup)

### 1. OpenRouteService (routing + geocoding)

1. Create a free account at [openrouteservice.org](https://openrouteservice.org/) / HeiGIT.
2. Create an API key (Standard free plan is enough for local testing).
3. You will put this in `.dev.vars` as `ORS_API_KEY`.

### 2. Google Cloud Text-to-Speech

1. In [Google Cloud Console](https://console.cloud.google.com/), pick or create a project (billing must be enabled for TTS usage; Chirp 3 HD has a free monthly character allotment).
2. Enable **Cloud Text-to-Speech API**  
   (`texttospeech.googleapis.com`) — not Speech-to-Text.  
   Direct link: [API library](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)
3. **IAM & Admin → Service Accounts → Create service account**  
   Example name: `pa-resande-fot-tts`.
4. Permissions step: you can leave roles empty. The console often **does not show** a “Cloud Text-to-Speech User” role; for the standard synthesize API, **API enabled + JSON key is enough**.
5. Open the service account → **Keys → Add key → Create new key → JSON** → download.
6. Put the JSON contents (one line) into `.dev.vars` as `GCP_SERVICE_ACCOUNT_JSON`.

Optional if you later get `403` and want an explicit role (Cloud Shell):

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/texttospeech.user"
```

### 3. Cloudflare (local first, deploy later)

**Local (no paid plan required):**

1. Install deps: `cd backend && npm install`
2. Copy env template and fill secrets (never commit `.dev.vars`):

```bash
cp .dev.vars.example .dev.vars
# edit .dev.vars: ORS_API_KEY + GCP_SERVICE_ACCOUNT_JSON
```

3. Apply D1 migrations locally and start:

```bash
npm run db:migrate:local
npm run dev
```

API: `http://localhost:8787` — check `GET /health` → `{"ok":true}`.

Bindings used locally via Miniflare: D1 (`DB`), R2 (`AUDIO`), Queue (`TTS_QUEUE`). Queues work under `wrangler dev` even on Free.

**Deploy to Cloudflare (when ready):**

1. `npx wrangler login`
2. Create resources (Free can create D1 + R2; Queues need Workers Paid ~$5/mo):

```bash
npx wrangler d1 create pa-resande-fot
npx wrangler r2 bucket create pa-resande-fot-audio
# Paid only:
npx wrangler queues create tts-jobs
```

3. Paste real `database_id` / bucket name into `wrangler.jsonc`.
4. Upload secrets (do not put them in git):

```bash
npx wrangler secret put ORS_API_KEY
npx wrangler secret put GCP_SERVICE_ACCOUNT_JSON
```

5. Migrate + deploy:

```bash
npx wrangler d1 migrations apply pa-resande-fot --remote
npm run deploy
```

6. Point the Expo app at the Worker URL via `EXPO_PUBLIC_API_URL` in a root `.env` (see repo `.env.example`).

## Free-tier notes (Workers)

- Prefer short routes / higher `intervalKm` (e.g. 10–15) on Workers Free (50 subrequests per invocation).
- Without Queues in production, TTS can run **inline** for up to `INLINE_TTS_MAX` POIs (default 5). Locally, the queue consumer usually handles TTS.
- Chirp characters: first ~1M Chirp 3 HD characters/month are free on Google; audio is cached in R2 by `(poi, voice, script_hash)`.

## Changing voice

Edit `TTS_VOICE` in `wrangler.jsonc` (e.g. `sv-SE-Chirp3-HD-Algenib`), restart `npm run dev`.  
To A/B male voices locally: `node scripts/sample-male-voices.mjs` → writes `voice-samples/` (gitignored).

## Useful endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/api/all-pois` | List POIs |
| GET | `/api/pois?lat=&lon=&radius=` | Nearby POIs |
| POST | `/api/prepare-route` | `{ origin, destination, intervalKm }` |
| GET | `/api/routes/:id` | Route status + `audioUrl`s |
| GET | `/audio/...` | Cached MP3 from R2 |

## Tests

```bash
npm test
```
