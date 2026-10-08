import type { RoutePhase, RouteStatusResponse } from "../../../shared/apiTypes";
import { toPoiDto, type PoiRow } from "../poiMapper";

interface RouteRow {
  id: string;
  origin: string;
  destination: string;
  interval_km: number;
  status: "collecting" | "finalized" | "failed";
  voice_id: string | null;
  error: string | null;
}

interface JobCounts {
  total: number;
  finished: number | null;
  failed: number | null;
}

function phaseOf(
  route: RouteRow,
  audioTotal: number,
  audioTerminal: number
): RoutePhase {
  if (route.status === "failed") return "failed";
  if (route.status === "collecting") return "collecting";
  return audioTerminal < audioTotal ? "generating" : "ready";
}

export async function getRouteStatus(
  db: D1Database,
  routeId: string,
  fallbackVoiceId: string,
  audioOrigin: string
): Promise<RouteStatusResponse | null> {
  const route = await db
    .prepare(
      `SELECT id, origin, destination, interval_km, status, voice_id, error
       FROM routes WHERE id = ?`
    )
    .bind(routeId)
    .first<RouteRow>();
  if (!route) return null;

  const voiceId = route.voice_id ?? fallbackVoiceId;
  const [jobsResult, poisResult] = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS total,
                SUM(status != 'pending') AS finished,
                SUM(status = 'failed') AS failed
         FROM route_collect_jobs WHERE route_id = ?`
      )
      .bind(routeId),
    db
      .prepare(
        `SELECT p.id, p.name, p.latitude, p.longitude, rp.trigger_radius_m AS radius,
                p.fact, p.category, p.source_url, n.r2_key, n.status AS narration_status,
                n.error AS narration_error
         FROM route_pois rp
         JOIN pois p ON p.id = rp.poi_id
         LEFT JOIN narrations n
           ON n.poi_id = rp.poi_id AND n.voice_id = ?2 AND n.script_hash = rp.script_hash
         WHERE rp.route_id = ?1 AND rp.selected = 1
         ORDER BY rp.distance_along_m ASC`
      )
      .bind(routeId, voiceId),
  ]);

  const jobs = (jobsResult.results?.[0] as JobCounts | undefined) ?? {
    total: 0,
    finished: 0,
    failed: 0,
  };
  const rows = (poisResult.results ?? []) as Array<
    PoiRow & { narration_error?: string | null }
  >;
  const audioReady = rows.filter((r) => r.narration_status === "ready").length;
  const audioFailed = rows.filter((r) => r.narration_status === "failed").length;
  const status = phaseOf(route, rows.length, audioReady + audioFailed);

  return {
    routeId: route.id,
    origin: route.origin,
    destination: route.destination,
    intervalKm: route.interval_km,
    status,
    error: route.error ?? undefined,
    collectJobsTotal: jobs.total,
    collectJobsDone: jobs.finished ?? 0,
    collectJobsFailed: jobs.failed ?? 0,
    pois: rows.map((row) => toPoiDto(row, audioOrigin)),
    audioReady,
    audioFailed,
    audioTotal: rows.length,
    failedNarrations: rows
      .filter((r) => r.narration_status === "failed")
      .map((r) => ({
        poiId: r.id,
        name: r.name,
        error: r.narration_error || "unknown",
      })),
  };
}
