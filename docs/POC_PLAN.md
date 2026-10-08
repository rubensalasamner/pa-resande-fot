# POC plan: drivable build

Goal: plan a route on the phone, drive it with the phone on mobile data and no computer, and hear every POI near the road exactly once, with Chirp audio and device-speech fallback.

Status legend: `[ ]` todo, `[x]` done.

## Platform constraints (verified 2026-10)

Workers Free, per invocation:

- 10 ms CPU. Waiting on fetch, D1 or R2 does not count.
- 50 external subrequests.
- 1000 subrequests to Cloudflare services.

Workers Free, per day or month:

- 100k requests per day.
- Queues: available on Free since 2026-02. 10k operations per day; a delivered message costs about 3 (write, read, delete). Retention is 24 h.
- D1: 5M rows read and 100k rows written per day.
- R2: 10 GB storage.

Other services:

- Google Chirp 3 HD: 1M characters per month free. At about 400 characters per POI that is about 2500 unique narrations per month. Cached audio is reused across drivers, so this is the real budget.
- ORS: 2000 directions and 3000 geocodes per day.

Exceeding a Free limit makes that request fail. Cloudflare does not upgrade automatically. Switching to Paid is a dashboard action, and the code must not need changes when that happens.

## Phase 1: backend that works deployed on Free

### 1.1–1.4

- [x] Chunked prepare (`planRoute` → `collect` → `finalize` → TTS) with Free-safe queue batches.
- [x] Corridor filter + per-POI trigger radius.
- [x] Route status terminates on ready/failed; join on script_hash.
- [x] Deployed: https://pa-resande-fot-api.rubensalasamner.workers.dev
- [ ] Measure: prepare a 300 km route and use `wrangler tail` plus dashboard CPU metrics.

## Phase 2: app correctness while driving

### 2.1 Trigger policy

- [x] `TriggerPolicy` strategy (`OncePerSession`, `Cooldown`).
- [x] `ProximityEngine` is geometry + injected policy.
- [x] Driving uses `OncePerSession`; simulator uses `Cooldown(60s)`.

### 2.2 Playback robustness

- [x] `PrerecordedAudioStrategy` rejects on error/timeout (duration + margin, else 45s).
- [x] `DeviceSpeechStrategy` wrapped in estimated timeout; errors reject for fallback.

### 2.3 Stale queue items

- [x] `NarrationQueue` freshness predicate; skips stale items before play.
- [x] Driving wires proximity freshness (age + distance margin).

### 2.4 Persist the active route

- [x] Persist active `routeId`; restore manifest on launch.
- [x] Clear route deletes pack directory + active id.

### 2.5 Split POI sourcing

- [x] `RoutePoiSource` / `NearbyPoiSource` / `PreferRoutePoiSource`.
- [x] `DrivingCoordinator` orchestrates; hook only starts/stops.

## Phase 3: running on the phone without the computer

- [x] `eas.json` preview APK profile; Android `package`; Expo project linked.
- [x] `expo-keep-awake` during active drive.
- [x] Background TaskManager feeds the same `locationBridge` → `DrivingCoordinator` as foreground GPS.
- [ ] Install preview APK on phone and verify: ducks music, screen lock, call interruption.

## Phase 4: observability for test drives

- [x] `TripLog` JSONL (positions, triggers, narration events).
- [x] Share/export action on home screen.
- [x] Route status includes `failedNarrations` with error messages.

## Done when

- A 300 km route prepares on deployed Free without errors.
- All POIs end as `ready` or `failed`, and the app stops polling.
- On a real drive, every kept POI plays once, nothing plays twice, and a broken clip falls back to speech.
- The app survives a restart mid-route and works with the screen locked.
- The trip log explains every missed POI.
