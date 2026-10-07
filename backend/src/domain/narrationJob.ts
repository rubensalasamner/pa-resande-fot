import type { TtsJobMessage } from "../env";
import type { AudioStore, TtsProvider } from "../providers/types";

export interface NarrationJobDeps {
  db: D1Database;
  tts: TtsProvider;
  audioStore: AudioStore;
}

export async function processNarrationJob(
  deps: NarrationJobDeps,
  job: TtsJobMessage
): Promise<"skipped" | "ready" | "failed"> {
  const existing = await deps.db
    .prepare(
      `SELECT status, r2_key FROM narrations
       WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
    )
    .bind(job.poiId, job.voiceId, job.scriptHash)
    .first<{ status: string; r2_key: string | null }>();

  if (existing?.status === "ready" && existing.r2_key) {
    return "skipped";
  }

  const r2Key = deps.audioStore.keyFor(
    job.voiceId,
    job.poiId,
    job.scriptHash
  );
  const ts = new Date().toISOString();

  try {
    const audio = await deps.tts.synthesize(job.script, job.voiceId);
    await deps.audioStore.put(r2Key, audio);

    await deps.db
      .prepare(
        `UPDATE narrations
         SET status = 'ready', r2_key = ?, error = NULL, updated_at = ?
         WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
      )
      .bind(r2Key, ts, job.poiId, job.voiceId, job.scriptHash)
      .run();

    return "ready";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.db
      .prepare(
        `UPDATE narrations
         SET status = 'failed', error = ?, updated_at = ?
         WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
      )
      .bind(message, ts, job.poiId, job.voiceId, job.scriptHash)
      .run();
    return "failed";
  }
}
