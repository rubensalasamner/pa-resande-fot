export interface Env {
  DB: D1Database;
  AUDIO: R2Bucket;
  TTS_QUEUE: Queue;
  TTS_VOICE: string;
  DEFAULT_POI_RADIUS_M: string;
  INLINE_TTS_MAX: string;
  ORS_API_KEY: string;
  GCP_SERVICE_ACCOUNT_JSON: string;
}

export interface TtsJobMessage {
  poiId: string;
  voiceId: string;
  scriptHash: string;
  script: string;
}
