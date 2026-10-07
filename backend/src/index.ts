import { createApp } from "./app";
import { createPrepareDeps } from "./createDeps";
import { processNarrationJob } from "./domain/narrationJob";
import type { Env, TtsJobMessage } from "./env";
import { GoogleChirpTtsProvider } from "./providers/GoogleChirpTtsProvider";
import { R2AudioStore } from "./providers/R2AudioStore";

const app = createApp();

export default {
  fetch: app.fetch,

  async queue(
    batch: MessageBatch<TtsJobMessage>,
    env: Env
  ): Promise<void> {
    if (!env.GCP_SERVICE_ACCOUNT_JSON) {
      console.error("GCP_SERVICE_ACCOUNT_JSON missing; skipping TTS batch");
      return;
    }

    const tts = new GoogleChirpTtsProvider(env.GCP_SERVICE_ACCOUNT_JSON);
    const audioStore = new R2AudioStore(env.AUDIO);

    for (const message of batch.messages) {
      try {
        const result = await processNarrationJob(
          { db: env.DB, tts, audioStore },
          message.body
        );
        if (result === "failed") {
          message.retry();
        } else {
          message.ack();
        }
      } catch (error) {
        console.error("queue message failed", error);
        message.retry();
      }
    }
  },
};

export { createPrepareDeps };
