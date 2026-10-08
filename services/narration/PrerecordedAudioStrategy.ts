import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import type { PointOfInterest } from "@/types";
import type { NarrationStrategy } from "./NarrationStrategy";

const FALLBACK_TIMEOUT_MS = 45_000;
const DURATION_MARGIN_MS = 3_000;

export class PrerecordedAudioStrategy implements NarrationStrategy {
  private player: AudioPlayer | null = null;

  async canPlay(poi: PointOfInterest): Promise<boolean> {
    return Boolean(poi.localAudioPath || poi.audioUrl);
  }

  async play(poi: PointOfInterest): Promise<void> {
    const source = poi.localAudioPath || poi.audioUrl;
    if (!source) return;

    await this.stop();

    const player = createAudioPlayer(source);
    this.player = player;

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer = setTimeout(() => fail(new Error("prerecorded audio timed out")), FALLBACK_TIMEOUT_MS);

      const cleanup = () => {
        sub.remove();
        clearTimeout(timer);
      };

      const succeed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        void this.stop();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      const sub = player.addListener("playbackStatusUpdate", (status) => {
        const durationSec =
          typeof status.duration === "number" && status.duration > 0
            ? status.duration
            : null;
        if (durationSec != null) {
          clearTimeout(timer);
          timer = setTimeout(
            () => fail(new Error("prerecorded audio timed out")),
            durationSec * 1000 + DURATION_MARGIN_MS
          );
        }

        if ("error" in status && status.error) {
          fail(new Error(String(status.error)));
          return;
        }

        if (status.didJustFinish) {
          succeed();
        }
      });

      try {
        player.play();
      } catch (error) {
        fail(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // ignore
      }
      this.player = null;
    }
  }
}
