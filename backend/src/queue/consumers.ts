import { readRouteConfig } from "../config";
import {
  createCollectDeps,
  createFinalizeDeps,
  createNarrationDeps,
} from "../createDeps";
import { collectRoutePois, failCollectJob } from "../domain/collectRoutePois";
import { failRoute, finalizeRoute } from "../domain/finalizeRoute";
import {
  markNarrationFailed,
  processNarrationJob,
  type NarrationJobDeps,
} from "../domain/narrationJob";
import type { Env } from "../env";
import { byKind, type QueueConsumer } from "./dispatchBatch";
import {
  QUEUE_NAMES,
  type RouteJobMessage,
  type TtsJobMessage,
} from "./messages";
import { exponentialBackoff } from "./retryPolicy";

export const ROUTE_JOBS_RETRY = exponentialBackoff(4, 10);
export const TTS_RETRY = exponentialBackoff(4, 15);

function routeJobsConsumer(env: Env): QueueConsumer<RouteJobMessage> {
  const collectDeps = createCollectDeps(env);
  const finalizeDeps = createFinalizeDeps(env);
  const voiceId = readRouteConfig(env).voiceId;

  return {
    retry: ROUTE_JOBS_RETRY,
    handler: byKind<RouteJobMessage>({
      collect: {
        handle: (job) => collectRoutePois(collectDeps, job),
        giveUp: (job, error) => failCollectJob(collectDeps, job, error),
      },
      finalize: {
        handle: (job) => finalizeRoute(finalizeDeps, job.routeId, voiceId),
        giveUp: (job, error) => failRoute(env.DB, job.routeId, error),
      },
    }),
  };
}

function ttsConsumer(env: Env): QueueConsumer<TtsJobMessage> {
  let deps: NarrationJobDeps | undefined;

  return {
    retry: TTS_RETRY,
    handler: {
      async handle(job) {
        deps ??= createNarrationDeps(env);
        await processNarrationJob(deps, job);
      },
      giveUp: (job, error) => markNarrationFailed(env.DB, job, error),
    },
  };
}

export function createQueueConsumer(
  queueName: string,
  env: Env
): QueueConsumer<unknown> | null {
  switch (queueName) {
    case QUEUE_NAMES.routeJobs:
      return routeJobsConsumer(env) as QueueConsumer<unknown>;
    case QUEUE_NAMES.tts:
      return ttsConsumer(env) as QueueConsumer<unknown>;
    default:
      return null;
  }
}
