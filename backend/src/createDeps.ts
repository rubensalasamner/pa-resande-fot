import type { Env } from "./env";
import type { PrepareRouteDeps } from "./domain/prepareRoute";
import { ExtractScriptWriter } from "./providers/ExtractScriptWriter";
import { GoogleChirpTtsProvider } from "./providers/GoogleChirpTtsProvider";
import { OpenRouteServiceProvider } from "./providers/OpenRouteServiceProvider";
import { R2AudioStore } from "./providers/R2AudioStore";
import { WikipediaPoiSource } from "./providers/WikipediaPoiSource";

export function createPrepareDeps(env: Env): PrepareRouteDeps {
  const audioStore = new R2AudioStore(env.AUDIO);
  const hasGcp = Boolean(env.GCP_SERVICE_ACCOUNT_JSON?.trim());
  const hasQueue = typeof env.TTS_QUEUE?.send === "function";

  return {
    db: env.DB,
    routeProvider: new OpenRouteServiceProvider(env.ORS_API_KEY),
    poiSource: new WikipediaPoiSource("sv"),
    scriptWriter: new ExtractScriptWriter(),
    audioStore,
    tts: hasGcp
      ? new GoogleChirpTtsProvider(env.GCP_SERVICE_ACCOUNT_JSON)
      : undefined,
    queue: hasQueue ? env.TTS_QUEUE : undefined,
    voiceId: env.TTS_VOICE || "sv-SE-Chirp3-HD-Algenib",
    defaultRadiusM: Number(env.DEFAULT_POI_RADIUS_M || 500),
    inlineTtsMax: Number(env.INLINE_TTS_MAX || 5),
  };
}
