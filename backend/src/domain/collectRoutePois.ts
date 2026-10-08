import type { RouteConfig } from "../config";
import type { PoiSource, RawPoi, ScriptWriter } from "../providers/types";
import type { CollectJobMessage, RouteJobMessage } from "../queue/messages";
import { nearestOnPath, type PathPoint } from "./geo";

export interface CollectDeps {
  db: D1Database;
  poiSource: PoiSource;
  scriptWriter: ScriptWriter;
  routeQueue: Queue<RouteJobMessage>;
  config: RouteConfig;
}

export type CollectCompletionDeps = Pick<CollectDeps, "db" | "routeQueue">;

export interface CorridorPoi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  script: string;
  category: string;
  sourceUrl: string | null;
  alongM: number;
  distanceM: number;
  triggerRadiusM: number;
}

export function toCorridorPois(
  found: RawPoi[],
  path: PathPoint[],
  scriptWriter: ScriptWriter,
  config: Pick<
    RouteConfig,
    "maxDistanceFromRouteM" | "defaultRadiusM" | "triggerMarginM"
  >
): CorridorPoi[] {
  const byId = new Map<string, CorridorPoi>();

  for (const poi of found) {
    if (byId.has(poi.id)) continue;

    const { distanceM, alongM } = nearestOnPath(path, {
      lat: poi.latitude,
      lon: poi.longitude,
    });
    if (distanceM > config.maxDistanceFromRouteM) continue;

    byId.set(poi.id, {
      id: poi.id,
      name: poi.name,
      lat: poi.latitude,
      lon: poi.longitude,
      script: scriptWriter.write(poi.fact, poi.name),
      category: poi.category ?? "wikipedia",
      sourceUrl: poi.sourceUrl ?? null,
      alongM: Math.round(alongM),
      distanceM: Math.round(distanceM),
      triggerRadiusM: Math.max(
        config.defaultRadiusM,
        Math.ceil(distanceM + config.triggerMarginM)
      ),
    });
  }

  return [...byId.values()];
}

function completionStatements(
  db: D1Database,
  job: CollectJobMessage,
  status: "done" | "failed",
  error: string | null
): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `UPDATE route_collect_jobs SET status = ?3, error = ?4
         WHERE route_id = ?1 AND job_index = ?2 AND status = 'pending'`
      )
      .bind(job.routeId, job.jobIndex, status, error),
    db
      .prepare(
        `SELECT COUNT(*) AS pending FROM route_collect_jobs
         WHERE route_id = ? AND status = 'pending'`
      )
      .bind(job.routeId),
  ];
}

async function finalizeIfComplete(
  deps: CollectCompletionDeps,
  routeId: string,
  countResult: D1Result | undefined
): Promise<void> {
  const pending = (countResult?.results?.[0] as { pending: number } | undefined)
    ?.pending;
  if (pending === 0) {
    await deps.routeQueue.send({ kind: "finalize", routeId });
  }
}

export async function collectRoutePois(
  deps: CollectDeps,
  job: CollectJobMessage
): Promise<void> {
  const found = await Promise.all(
    job.samples.map((sample) =>
      deps.poiSource.findNear(sample, job.searchRadiusM)
    )
  );
  const pois = toCorridorPois(
    found.flat(),
    job.path,
    deps.scriptWriter,
    deps.config
  );
  const poisJson = JSON.stringify(pois);
  const ts = new Date().toISOString();

  const results = await deps.db.batch([
    deps.db
      .prepare(
        `INSERT INTO pois (id, name, latitude, longitude, radius, fact, category, source_url, updated_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.name'),
                json_extract(value, '$.lat'), json_extract(value, '$.lon'), ?2,
                json_extract(value, '$.script'), json_extract(value, '$.category'),
                json_extract(value, '$.sourceUrl'), ?3
         FROM json_each(?1) WHERE true
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           fact = excluded.fact,
           category = excluded.category,
           source_url = excluded.source_url,
           updated_at = excluded.updated_at`
      )
      .bind(poisJson, deps.config.defaultRadiusM, ts),
    deps.db
      .prepare(
        `INSERT INTO route_pois (route_id, poi_id, distance_along_m, distance_to_route_m, trigger_radius_m)
         SELECT ?1, json_extract(value, '$.id'), json_extract(value, '$.alongM'),
                json_extract(value, '$.distanceM'), json_extract(value, '$.triggerRadiusM')
         FROM json_each(?2) WHERE true
         ON CONFLICT(route_id, poi_id) DO UPDATE SET
           distance_along_m = excluded.distance_along_m,
           distance_to_route_m = excluded.distance_to_route_m,
           trigger_radius_m = excluded.trigger_radius_m
         WHERE excluded.distance_to_route_m < route_pois.distance_to_route_m`
      )
      .bind(job.routeId, poisJson),
    ...completionStatements(deps.db, job, "done", null),
  ]);

  await finalizeIfComplete(deps, job.routeId, results[results.length - 1]);
}

export async function failCollectJob(
  deps: CollectCompletionDeps,
  job: CollectJobMessage,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const results = await deps.db.batch(
    completionStatements(deps.db, job, "failed", message)
  );
  await finalizeIfComplete(deps, job.routeId, results[results.length - 1]);
}
