import type { TtsJobMessage } from "../queue/messages";
import { sendInBatches } from "../queue/sendInBatches";
import { scriptHash } from "./scriptHash";

export interface FinalizeDeps {
  db: D1Database;
  ttsQueue: Queue<TtsJobMessage>;
}

interface RouteRow {
  interval_km: number;
  voice_id: string | null;
  status: "collecting" | "finalized" | "failed";
}

/**
 * Picks the closest-to-road POI per intervalKm window, creates pending narrations
 * and enqueues TTS for every selected POI whose audio is not ready yet.
 * Safe to run more than once for the same route.
 */
export async function finalizeRoute(
  deps: FinalizeDeps,
  routeId: string,
  fallbackVoiceId: string
): Promise<void> {
  const { db } = deps;
  const route = await db
    .prepare(`SELECT interval_km, voice_id, status FROM routes WHERE id = ?`)
    .bind(routeId)
    .first<RouteRow>();
  if (!route || route.status === "failed") return;

  const voiceId = route.voice_id ?? fallbackVoiceId;

  if (route.status === "collecting") {
    await db
      .prepare(
        `UPDATE route_pois SET selected = 1
         WHERE route_id = ?1 AND poi_id IN (
           SELECT poi_id FROM (
             SELECT poi_id, ROW_NUMBER() OVER (
               PARTITION BY CAST(distance_along_m / ?2 AS INTEGER)
               ORDER BY distance_to_route_m, poi_id
             ) AS rn
             FROM route_pois WHERE route_id = ?1
           ) WHERE rn = 1
         )`
      )
      .bind(routeId, route.interval_km * 1000)
      .run();

    const selected = await db
      .prepare(
        `SELECT rp.poi_id AS poiId, p.fact AS script
         FROM route_pois rp JOIN pois p ON p.id = rp.poi_id
         WHERE rp.route_id = ? AND rp.selected = 1`
      )
      .bind(routeId)
      .all<{ poiId: string; script: string }>();

    const keyed = await Promise.all(
      (selected.results ?? []).map(async (row) => ({
        poiId: row.poiId,
        hash: await scriptHash(row.script, voiceId),
      }))
    );
    const keyedJson = JSON.stringify(keyed);
    const ts = new Date().toISOString();

    await db.batch([
      db
        .prepare(
          `INSERT INTO narrations (poi_id, voice_id, script_hash, r2_key, status, error, updated_at)
           SELECT json_extract(value, '$.poiId'), ?2, json_extract(value, '$.hash'), NULL, 'pending', NULL, ?3
           FROM json_each(?1) WHERE true
           ON CONFLICT(poi_id, voice_id, script_hash) DO UPDATE SET
             status = 'pending',
             error = NULL,
             updated_at = excluded.updated_at
           WHERE narrations.status = 'failed'`
        )
        .bind(keyedJson, voiceId, ts),
      db
        .prepare(
          `UPDATE route_pois SET script_hash = (
             SELECT json_extract(j.value, '$.hash') FROM json_each(?2) j
             WHERE json_extract(j.value, '$.poiId') = route_pois.poi_id
           )
           WHERE route_id = ?1 AND selected = 1`
        )
        .bind(routeId, keyedJson),
      db
        .prepare(
          `UPDATE routes SET status = 'finalized'
           WHERE id = ? AND status = 'collecting'`
        )
        .bind(routeId),
    ]);
  }

  const pending = await db
    .prepare(
      `SELECT rp.poi_id AS poiId, rp.script_hash AS scriptHash, p.fact AS script
       FROM route_pois rp
       JOIN pois p ON p.id = rp.poi_id
       JOIN narrations n
         ON n.poi_id = rp.poi_id AND n.voice_id = ?2 AND n.script_hash = rp.script_hash
       WHERE rp.route_id = ?1 AND rp.selected = 1 AND n.status = 'pending'`
    )
    .bind(routeId, voiceId)
    .all<{ poiId: string; scriptHash: string; script: string }>();

  await sendInBatches(
    deps.ttsQueue,
    (pending.results ?? []).map((row) => ({
      poiId: row.poiId,
      voiceId,
      scriptHash: row.scriptHash,
      script: row.script,
    }))
  );
}

export async function failRoute(
  db: D1Database,
  routeId: string,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db
    .prepare(
      `UPDATE routes SET status = 'failed', error = ? WHERE id = ?`
    )
    .bind(message, routeId)
    .run();
}
