import type { TtsJobMessage } from "../queue/messages";
import type { AudioStore, TtsProvider } from "../providers/types";

export interface NarrationJobDeps {
  db: D1Database;
  tts: TtsProvider;
  audioStore: AudioStore;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Throws on failure so the queue can retry; the narration stays `pending`. */
export async function processNarrationJob(
  deps: NarrationJobDeps,
  job: TtsJobMessage
): Promise<"skipped" | "ready"> {
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

  const r2Key = deps.audioStore.keyFor(job.voiceId, job.poiId, job.scriptHash);

  try {
    const audio = await deps.tts.synthesize(job.script, job.voiceId);
    await deps.audioStore.put(r2Key, audio);
  } catch (error) {
    await deps.db
      .prepare(
        `UPDATE narrations SET error = ?, updated_at = ?
         WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
      )
      .bind(
        errorMessage(error),
        new Date().toISOString(),
        job.poiId,
        job.voiceId,
        job.scriptHash
      )
      .run();
    throw error;
  }

  await deps.db
    .prepare(
      `UPDATE narrations
       SET status = 'ready', r2_key = ?, error = NULL, updated_at = ?
       WHERE poi_id = ? AND voice_id = ? AND script_hash = ?`
    )
    .bind(r2Key, new Date().toISOString(), job.poiId, job.voiceId, job.scriptHash)
    .run();

  return "ready";
}

export async function markNarrationFailed(
  db: D1Database,
  job: TtsJobMessage,
  error: unknown
): Promise<void> {
  await db
    .prepare(
      `UPDATE narrations SET status = 'failed', error = ?, updated_at = ?
       WHERE poi_id = ? AND voice_id = ? AND script_hash = ? AND status != 'ready'`
    )
    .bind(
      errorMessage(error),
      new Date().toISOString(),
      job.poiId,
      job.voiceId,
      job.scriptHash
    )
    .run();
}
