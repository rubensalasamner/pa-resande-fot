import type { PointOfInterest } from "@/types";
import type { NarrationStrategy } from "./NarrationStrategy";

export type FreshnessCheck = (
  poi: PointOfInterest,
  queuedAt: number
) => boolean;

export type NarrationEvent =
  | {
      type: "start";
      poiId: string;
      strategy: string;
    }
  | {
      type: "end";
      poiId: string;
      strategy: string;
    }
  | {
      type: "skip";
      poiId: string;
      reason: "stale" | "no-strategy";
    }
  | {
      type: "error";
      poiId: string;
      strategy: string;
      message: string;
    };

interface QueuedItem {
  poi: PointOfInterest;
  queuedAt: number;
}

export class NarrationQueue {
  private queue: QueuedItem[] = [];
  private playing = false;
  private isFresh: FreshnessCheck = () => true;
  private onEvent: ((event: NarrationEvent) => void) | null = null;

  constructor(private readonly strategies: NarrationStrategy[]) {}

  setFreshnessCheck(check: FreshnessCheck): void {
    this.isFresh = check;
  }

  setEventHandler(handler: ((event: NarrationEvent) => void) | null): void {
    this.onEvent = handler;
  }

  async speak(poi: PointOfInterest): Promise<void> {
    this.queue.push({ poi, queuedAt: Date.now() });
    if (!this.playing) {
      await this.drain();
    }
  }

  async stop(): Promise<void> {
    this.queue = [];
    await Promise.all(this.strategies.map((s) => s.stop()));
    this.playing = false;
  }

  private async drain(): Promise<void> {
    this.playing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      if (!this.isFresh(item.poi, item.queuedAt)) {
        this.onEvent?.({
          type: "skip",
          poiId: item.poi.id,
          reason: "stale",
        });
        continue;
      }

      let played = false;
      for (const strategy of this.strategies) {
        const strategyName = strategy.constructor.name;
        if (!(await strategy.canPlay(item.poi))) continue;

        try {
          this.onEvent?.({
            type: "start",
            poiId: item.poi.id,
            strategy: strategyName,
          });
          await strategy.play(item.poi);
          this.onEvent?.({
            type: "end",
            poiId: item.poi.id,
            strategy: strategyName,
          });
          played = true;
          break;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.onEvent?.({
            type: "error",
            poiId: item.poi.id,
            strategy: strategyName,
            message,
          });
          console.warn("Narration strategy failed, trying next", error);
        }
      }

      if (!played) {
        this.onEvent?.({
          type: "skip",
          poiId: item.poi.id,
          reason: "no-strategy",
        });
        console.warn("No narration strategy could play POI", item.poi.id);
      }
    }
    this.playing = false;
  }
}
