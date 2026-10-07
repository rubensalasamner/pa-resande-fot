import type { AudioStore } from "./types";

export class R2AudioStore implements AudioStore {
  constructor(private readonly bucket: R2Bucket) {}

  keyFor(voiceId: string, poiId: string, scriptHash: string): string {
    const safePoi = poiId.replace(/[^a-zA-Z0-9:_-]/g, "_");
    return `narrations/${voiceId}/${safePoi}-${scriptHash}.mp3`;
  }

  async put(
    key: string,
    data: ArrayBuffer,
    contentType = "audio/mpeg"
  ): Promise<void> {
    await this.bucket.put(key, data, {
      httpMetadata: { contentType },
    });
  }

  async get(key: string): Promise<ReadableStream | null> {
    const obj = await this.bucket.get(key);
    return obj?.body ?? null;
  }
}
