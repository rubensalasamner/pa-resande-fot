import type { TtsJobMessage } from "../env";
import type {
  AudioStore,
  PoiSource,
  RouteProvider,
  ScriptWriter,
  TtsProvider,
} from "../providers/types";
import { sampleLineString } from "./geo";
import { processNarrationJob } from "./narrationJob";
import { scriptHash } from "./scriptHash";

export interface PrepareRouteDeps {
  db: D1Database;
  routeProvider: RouteProvider;
  poiSource: PoiSource;
  scriptWriter: ScriptWriter;
  audioStore: AudioStore;
  tts?: TtsProvider;
  queue?: Queue;
  voiceId: string;
  defaultRadiusM: number;
  /** When queue is unavailable (Free tier), synthesize inline for at most this many POIs. */
  inlineTtsMax: number;
}

export interface PrepareRouteResult {
  routeId: string;
  articlesFetched: number;
  articlesSaved: number;
  audioPending: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function prepareRoute(
  deps: PrepareRouteDeps,
  input: { origin: string; destination: string; intervalKm: number }
): Promise<PrepareRouteResult> {
  const origin = await deps.routeProvider.geocode(input.origin);
  const destination = await deps.routeProvider.geocode(input.destination);
  const geometry = await deps.routeProvider.getDrivingRoute(
    origin,
    destination
  );

  const samples = sampleLineString(geometry.coordinates, input.intervalKm);
  const searchRadiusM = Math.min(
    Math.max(input.intervalKm * 1000 * 0.6, 2000),
    10000
  );

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      fact: string;
      category?: string;
      sourceUrl?: string;
      distanceAlongM: number;
    }
  >();

  let articlesFetched = 0;
  for (const sample of samples) {
    const found = await deps.poiSource.findNear(sample, searchRadiusM);
    articlesFetched += found.length;
    for (const poi of found) {
      const existing = byId.get(poi.id);
      if (!existing || sample.distanceAlongM < existing.distanceAlongM) {
        byId.set(poi.id, {
          ...poi,
          distanceAlongM: sample.distanceAlongM,
        });
      }
    }
  }

  const ordered = [...byId.values()].sort(
    (a, b) => a.distanceAlongM - b.distanceAlongM
  );

  const id = crypto.randomUUID();
  const ts = nowIso();

  await deps.db
    .prepare(
      `INSERT INTO routes (id, origin, destination, interval_km, geometry_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.origin,
      input.destination,
      input.intervalKm,
      JSON.stringify(geometry.coordinates),
      ts
    )
    .run();

  let articlesSaved = 0;
  const pendingJobs: TtsJobMessage[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const poi = ordered[i];
    const script = deps.scriptWriter.write(poi.fact, poi.name);
    const hash = await scriptHash(script, deps.voiceId);

    await deps.db
      .prepare(
        `INSERT INTO pois (id, name, latitude, longitude, radius, fact, category, source_url, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           fact = excluded.fact,
           category = excluded.category,
           source_url = excluded.source_url,
           updated_at = excluded.updated_at`
      )
      .bind(
        poi.id,
        poi.name,
        poi.latitude,
        poi.longitude,
        deps.defaultRadiusM,
        script,
        poi.category ?? "wikipedia",
        poi.sourceUrl ?? null,
        ts
      )
      .run();

    await deps.db
      .prepare(
        `INSERT INTO route_pois (route_id, poi_id, order_index, distance_along_m)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(route_id, poi_id) DO UPDATE SET
           order_index = excluded.order_index,
           distance_along_m = excluded.distance_along_m`
      )
      .bind(id, poi.id, i, poi.distanceAlongM)
      .run();

    articlesSaved += 1;

    const existing = await deps.db
      .prepare(
        `SELECT status FROM narrations
         WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
      )
      .bind(poi.id, deps.voiceId, hash)
      .first<{ status: string }>();

    if (existing?.status === "ready") {
      continue;
    }

    await deps.db
      .prepare(
        `INSERT INTO narrations (poi_id, voice_id, script_hash, r2_key, status, error, updated_at)
         VALUES (?, ?, ?, NULL, 'pending', NULL, ?)
         ON CONFLICT(poi_id, voice_id, script_hash) DO UPDATE SET
           status = 'pending',
           error = NULL,
           updated_at = excluded.updated_at`
      )
      .bind(poi.id, deps.voiceId, hash, ts)
      .run();

    pendingJobs.push({
      poiId: poi.id,
      voiceId: deps.voiceId,
      scriptHash: hash,
      script,
    });
  }

  let audioPending = pendingJobs.length;

  if (deps.queue && pendingJobs.length > 0) {
    await deps.queue.sendBatch(pendingJobs.map((body) => ({ body })));
  } else if (deps.tts && pendingJobs.length > 0) {
    const inline = pendingJobs.slice(0, deps.inlineTtsMax);
    for (const job of inline) {
      await processNarrationJob(
        {
          db: deps.db,
          tts: deps.tts,
          audioStore: deps.audioStore,
        },
        job
      );
    }
    audioPending = pendingJobs.length - inline.length;
  }

  return {
    routeId: id,
    articlesFetched,
    articlesSaved,
    audioPending,
  };
}
