import type { PointOfInterest } from "@/types";
import * as Speech from "expo-speech";
import type { NarrationStrategy } from "./NarrationStrategy";
import { speechTimeoutMs, withTimeout } from "./withTimeout";

export class DeviceSpeechStrategy implements NarrationStrategy {
  private preferredVoiceId: string | null = null;

  async canPlay(poi: PointOfInterest): Promise<boolean> {
    return Boolean(poi.fact?.trim());
  }

  private async resolveVoice(): Promise<string | undefined> {
    if (this.preferredVoiceId) return this.preferredVoiceId;

    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const swedishEnhanced = voices.find(
        (v) =>
          v.language?.toLowerCase().startsWith("sv") &&
          v.quality === Speech.VoiceQuality.Enhanced
      );
      const swedish =
        swedishEnhanced ??
        voices.find((v) => v.language?.toLowerCase().startsWith("sv"));
      this.preferredVoiceId = swedish?.identifier ?? null;
    } catch {
      this.preferredVoiceId = null;
    }

    return this.preferredVoiceId ?? undefined;
  }

  async play(poi: PointOfInterest): Promise<void> {
    await withTimeout(
      this.speak(poi.fact, "sv"),
      speechTimeoutMs(poi.fact),
      "device speech"
    );
  }

  private async speak(text: string, language: string): Promise<void> {
    const voice = await this.resolveVoice();

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language,
        voice,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => {
          if (language === "sv") {
            Speech.speak(text, {
              language: "en",
              pitch: 1.0,
              rate: 0.9,
              onDone: () => resolve(),
              onStopped: () => resolve(),
              onError: (error) =>
                reject(
                  error instanceof Error
                    ? error
                    : new Error("device speech failed")
                ),
            });
          } else {
            reject(new Error("device speech failed"));
          }
        },
      });
    });
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }
}
