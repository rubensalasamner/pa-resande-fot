import type { RouteJobMessage, TtsJobMessage } from "./queue/messages";

export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  ROUTE_QUEUE: Queue<RouteJobMessage>;
  TTS_QUEUE: Queue<TtsJobMessage>;
  TTS_VOICE: string;
  DEFAULT_POI_RADIUS_M: string;
  MAX_POI_DISTANCE_FROM_ROUTE_M: string;
  TRIGGER_MARGIN_M: string;
  SAMPLES_PER_COLLECT_JOB: string;
  ORS_API_KEY: string;
  GCP_SERVICE_ACCOUNT_JSON: string;
}
