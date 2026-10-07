import { describe, expect, it } from "vitest";
import { scriptHash } from "../src/domain/scriptHash";

describe("scriptHash", () => {
  it("is stable for same inputs", async () => {
    const a = await scriptHash("Hej världen", "sv-SE-Chirp3-HD-Kore");
    const b = await scriptHash("Hej världen", "sv-SE-Chirp3-HD-Kore");
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("changes when voice or script changes", async () => {
    const base = await scriptHash("Hej", "voice-a");
    const otherScript = await scriptHash("Hej!", "voice-a");
    const otherVoice = await scriptHash("Hej", "voice-b");
    expect(base).not.toBe(otherScript);
    expect(base).not.toBe(otherVoice);
  });
});
