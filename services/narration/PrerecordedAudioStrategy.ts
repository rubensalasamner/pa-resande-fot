import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import type { PointOfInterest } from "@/types";
import type { NarrationStrategy } from "./NarrationStrategy";

const FALLBACK_TIMEOUT_MS = 45_000;
const DURATION_MARGIN_MS = 3_000;

export class PrerecordedAudioStrategy implements NarrationStrategy {
  private player: AudioPlayer | null = null;
  private settle: ((result: "ok" | "error", error?: Error) => void) | null =
    null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private statusSub: { remove: () => void } | null = null;
  private paused = false;

  async canPlay(poi: PointOfInterest): Promise<boolean> {
    return Boolean(poi.localAudioPath || poi.audioUrl);
  }

  async play(poi: PointOfInterest): Promise<void> {
    const source = poi.localAudioPath || poi.audioUrl;
    if (!source) return;

    await this.stop();

    const player = createAudioPlayer(source);
    this.player = player;
    this.paused = false;

    return new Promise((resolve, reject) => {
      this.settle = (result, error) => {
        this.settle = null;
        this.clearTimer();
        this.statusSub?.remove();
        this.statusSub = null;
        if (result === "ok") resolve();
        else reject(error ?? new Error("prerecorded audio failed"));
      };

      this.armTimeout(FALLBACK_TIMEOUT_MS);

      this.statusSub = player.addListener("playbackStatusUpdate", (status) => {
        const durationSec =
          typeof status.duration === "number" && status.duration > 0
            ? status.duration
            : null;
        if (durationSec != null && !this.paused) {
          this.armTimeout(durationSec * 1000 + DURATION_MARGIN_MS);
        }

        if ("error" in status && status.error) {
          this.finish("error", new Error(String(status.error)));
          return;
        }

        if (status.didJustFinish) {
          this.finish("ok");
        }
      });

      try {
        player.play();
      } catch (error) {
        this.finish(
          "error",
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
  }

  async pause(): Promise<void> {
    if (!this.player || this.paused) return;
    this.player.pause();
    this.paused = true;
    this.clearTimer();
  }

  async resume(): Promise<void> {
    if (!this.player || !this.paused) return;
    this.paused = false;
    this.player.play();
    this.armTimeout(FALLBACK_TIMEOUT_MS);
  }

  async stop(): Promise<void> {
    this.clearTimer();
    this.statusSub?.remove();
    this.statusSub = null;
    this.paused = false;

    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // ignore
      }
      this.player = null;
    }

    // Resolve pending play so the queue can continue / exit.
    if (this.settle) {
      const settle = this.settle;
      this.settle = null;
      settle("ok");
    }
  }

  private armTimeout(ms: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.finish("error", new Error("prerecorded audio timed out"));
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private finish(result: "ok" | "error", error?: Error): void {
    if (!this.settle) return;
    const settle = this.settle;
    this.settle = null;
    this.clearTimer();
    this.statusSub?.remove();
    this.statusSub = null;
    if (this.player) {
      try {
        this.player.pause();
        this.player.remove();
      } catch {
        // ignore
      }
      this.player = null;
    }
    settle(result, error);
  }
}
