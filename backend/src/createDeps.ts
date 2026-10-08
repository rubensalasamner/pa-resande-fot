import { readRouteConfig } from "./config";
import type { CollectDeps } from "./domain/collectRoutePois";
import type { FinalizeDeps } from "./domain/finalizeRoute";
import type { NarrationJobDeps } from "./domain/narrationJob";
import type { PlanRouteDeps } from "./domain/planRoute";
import type { Env } from "./env";
import { ExtractScriptWriter } from "./providers/ExtractScriptWriter";
import { GoogleChirpTtsProvider } from "./providers/GoogleChirpTtsProvider";
import { OpenRouteServiceProvider } from "./providers/OpenRouteServiceProvider";
import { R2AudioStore } from "./providers/R2AudioStore";
import { WikipediaPoiSource } from "./providers/WikipediaPoiSource";

export function createPlanDeps(env: Env): PlanRouteDeps {
  if (!env.ORS_API_KEY?.trim()) {
    throw new Error("ORS_API_KEY is not configured on the worker");
  }
  return {
    db: env.DB,
    routeProvider: new OpenRouteServiceProvider(env.ORS_API_KEY),
    routeQueue: env.ROUTE_QUEUE,
    config: readRouteConfig(env),
  };
}

export function createCollectDeps(env: Env): CollectDeps {
  return {
    db: env.DB,
    poiSource: new WikipediaPoiSource("sv"),
    scriptWriter: new ExtractScriptWriter(),
    routeQueue: env.ROUTE_QUEUE,
    config: readRouteConfig(env),
  };
}

export function createFinalizeDeps(env: Env): FinalizeDeps {
  return { db: env.DB, ttsQueue: env.TTS_QUEUE };
}

export function createNarrationDeps(env: Env): NarrationJobDeps {
  if (!env.GCP_SERVICE_ACCOUNT_JSON?.trim()) {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON is not configured on the worker");
  }
  return {
    db: env.DB,
    tts: new GoogleChirpTtsProvider(env.GCP_SERVICE_ACCOUNT_JSON),
    audioStore: new R2AudioStore(env.AUDIO),
  };
}
