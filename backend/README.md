# pa-resande-fot API (Cloudflare Workers)

Workers + D1 + R2 + Queues backend for route prep, Wikipedia POIs, and Google Chirp TTS.

Current default voice: `sv-SE-Chirp3-HD-Algenib` (`TTS_VOICE` in `wrangler.jsonc`).

## Architecture

Route preparation is split so every Worker invocation stays inside the Free plan limits (50 external subrequests, 50 D1 queries, 10 ms CPU):

1. `POST /api/prepare-route` geocodes + routes (3 external calls), decimates the polyline, enqueues collect jobs on `route-jobs`, returns immediately.
2. Each `collect` job searches Wikipedia for a few corridor samples, filters POIs by distance to the road, and writes with `db.batch` + `json_each`.
3. When all collect jobs finish, a `finalize` job picks one POI per `intervalKm` window (closest to the road), creates pending narrations, and enqueues `tts-jobs`.
4. Each TTS job synthesizes one Chirp MP3 into R2. Failures retry with exponential backoff; the last attempt marks the narration `failed`.

Queue consumers share one `dispatchBatch` helper (`JobHandler` + `RetryPolicy`). Adding a new job kind is a new handler entry, not a new `if` in `index.ts`.

## Prerequisites (one-time cloud setup)

### 1. OpenRouteService (routing + geocoding)

1. Create a free account at [openrouteservice.org](https://openrouteservice.org/) / HeiGIT.
2. Create an API key (Standard free plan is enough for local testing).
3. Put it in `.dev.vars` as `ORS_API_KEY`.

### 2. Google Cloud Text-to-Speech

1. In [Google Cloud Console](https://console.cloud.google.com/), pick or create a project (billing must be enabled for TTS; Chirp 3 HD has a free monthly character allotment).
2. Enable **Cloud Text-to-Speech API** (`texttospeech.googleapis.com`) — not Speech-to-Text.
3. **IAM & Admin → Service Accounts → Create service account** (e.g. `pa-resande-fot-tts`).
4. Permissions: leave roles empty. API enabled + JSON key is enough.
5. **Keys → Add key → Create new key → JSON** → download.
6. Put the JSON contents (one line) into `.dev.vars` as `GCP_SERVICE_ACCOUNT_JSON`.

### 3. Local development

```bash
cd backend
npm install
cp .dev.vars.example .dev.vars
# edit .dev.vars: ORS_API_KEY + GCP_SERVICE_ACCOUNT_JSON

npm run db:migrate:local
npm run dev
```

API: `http://localhost:8787` — `GET /health` → `{"ok":true}`.

Queues work under `wrangler dev` on Free. Both `route-jobs` and `tts-jobs` are simulated locally.

### 4. Deploy to Cloudflare

Queues are available on Workers Free (10k operations/day since 2026-02).

```bash
npx wrangler login
npx wrangler d1 create pa-resande-fot
npx wrangler r2 bucket create pa-resande-fot-audio
npx wrangler queues create route-jobs
npx wrangler queues create tts-jobs
```

Paste the real `database_id` into `wrangler.jsonc`, then:

```bash
npx wrangler secret put ORS_API_KEY
npx wrangler secret put GCP_SERVICE_ACCOUNT_JSON
npx wrangler d1 migrations apply pa-resande-fot --remote
npm run deploy
```

Point the Expo app at the Worker URL via `EXPO_PUBLIC_API_URL` (see repo `.env.example`).

## Free-tier knobs (`wrangler.jsonc` vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `MAX_POI_DISTANCE_FROM_ROUTE_M` | `1500` | Corridor half-width; POIs farther away are dropped |
| `TRIGGER_MARGIN_M` | `300` | Extra meters added to distance-to-route for the trigger radius |
| `SAMPLES_PER_COLLECT_JOB` | `5` | Wikipedia calls per collect job (must stay ≤ Free external-subrequest budget) |
| `DEFAULT_POI_RADIUS_M` | `500` | Floor for per-POI trigger radius |
| `TTS_VOICE` | Algenib | Chirp 3 HD voice id |

`intervalKm` in the prepare request controls how densely narrated POIs are selected along the route (one closest-to-road POI per window), not the Wikipedia search density.

## Useful endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/api/all-pois` | List POIs |
| GET | `/api/pois?lat=&lon=&radius=` | Nearby POIs |
| POST | `/api/prepare-route` | `{ origin, destination, intervalKm }` → `{ routeId, distanceM, collectJobs }` |
| GET | `/api/routes/:id` | Status: `collecting` → `generating` → `ready` / `failed` |
| GET | `/audio/...` | Cached MP3 from R2 |

## Tests

```bash
npm test
```

Pipeline tests use `getPlatformProxy` against a real local D1.
