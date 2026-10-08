import type { RouteConfig } from "../config";
import type { RouteProvider } from "../providers/types";
import type { CollectJobMessage, RouteJobMessage } from "../queue/messages";
import { sendInBatches } from "../queue/sendInBatches";
import { chunk } from "../util/chunk";
import {
  corridorSampling,
  decimateLineString,
  samplePath,
  slicePath,
} from "./geo";

const PATH_SPACING_M = 100;

export interface PlanRouteDeps {
  db: D1Database;
  routeProvider: RouteProvider;
  routeQueue: Queue<RouteJobMessage>;
  config: RouteConfig;
}

export interface PlanRouteInput {
  origin: string;
  destination: string;
  intervalKm: number;
}

export interface PlanRouteResult {
  routeId: string;
  distanceM: number;
  sampleCount: number;
  jobCount: number;
}

export async function planRoute(
  deps: PlanRouteDeps,
  input: PlanRouteInput
): Promise<PlanRouteResult> {
  const [origin, destination] = await Promise.all([
    deps.routeProvider.geocode(input.origin),
    deps.routeProvider.geocode(input.destination),
  ]);
  const geometry = await deps.routeProvider.getDrivingRoute(origin, destination);

  const path = decimateLineString(geometry.coordinates, PATH_SPACING_M);
  if (path.length < 2) {
    throw new Error("Route geometry is empty");
  }

  const { spacingM, searchRadiusM } = corridorSampling(
    deps.config.maxDistanceFromRouteM
  );
  const reachM = 2 * (searchRadiusM + deps.config.maxDistanceFromRouteM);
  const samples = samplePath(path, spacingM);
  const routeId = crypto.randomUUID();

  const jobs: CollectJobMessage[] = chunk(
    samples,
    deps.config.samplesPerCollectJob
  ).map((group, jobIndex) => ({
    kind: "collect",
    routeId,
    jobIndex,
    searchRadiusM,
    samples: group,
    path: slicePath(
      path,
      group[0].alongM - reachM,
      group[group.length - 1].alongM + reachM
    ),
  }));

  await deps.db.batch([
    deps.db
      .prepare(
        `INSERT INTO routes (id, origin, destination, interval_km, geometry_json, created_at, status, voice_id)
         VALUES (?, ?, ?, ?, ?, ?, 'collecting', ?)`
      )
      .bind(
        routeId,
        input.origin,
        input.destination,
        input.intervalKm,
        JSON.stringify(path.map(([lon, lat]) => [lon, lat])),
        new Date().toISOString(),
        deps.config.voiceId
      ),
    deps.db
      .prepare(
        `INSERT INTO route_collect_jobs (route_id, job_index, status)
         SELECT ?1, value, 'pending' FROM json_each(?2)`
      )
      .bind(routeId, JSON.stringify(jobs.map((job) => job.jobIndex))),
  ]);

  await sendInBatches(deps.routeQueue, jobs);

  return {
    routeId,
    distanceM: geometry.distanceM || path[path.length - 1][2],
    sampleCount: samples.length,
    jobCount: jobs.length,
  };
}
