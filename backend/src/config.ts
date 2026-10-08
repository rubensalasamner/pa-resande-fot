import type { Env } from "./env";

export const DEFAULT_VOICE_ID = "sv-SE-Chirp3-HD-Algenib";

export interface RouteConfig {
  voiceId: string;
  defaultRadiusM: number;
  maxDistanceFromRouteM: number;
  triggerMarginM: number;
  samplesPerCollectJob: number;
}

function positiveNumber(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function readRouteConfig(env: Env): RouteConfig {
  return {
    voiceId: env.TTS_VOICE?.trim() || DEFAULT_VOICE_ID,
    defaultRadiusM: positiveNumber(env.DEFAULT_POI_RADIUS_M, 500),
    maxDistanceFromRouteM: Math.min(
      positiveNumber(env.MAX_POI_DISTANCE_FROM_ROUTE_M, 1500),
      7000
    ),
    triggerMarginM: positiveNumber(env.TRIGGER_MARGIN_M, 300),
    samplesPerCollectJob: Math.floor(
      positiveNumber(env.SAMPLES_PER_COLLECT_JOB, 5)
    ),
  };
}
