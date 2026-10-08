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
      reason: "stale" | "no-strategy" | "user";
    }
  | {
      type: "pause";
      poiId: string;
    }
  | {
      type: "resume";
      poiId: string;
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
  force?: boolean;
}

export interface SpeakOptions {
  /** Bypass freshness check (replay / forced next). */
  force?: boolean;
}

export class NarrationQueue {
  private queue: QueuedItem[] = [];
  private playing = false;
  private paused = false;
  private current: QueuedItem | null = null;
  private activeStrategy: NarrationStrategy | null = null;
  private isFresh: FreshnessCheck = () => true;
  private onEvent: ((event: NarrationEvent) => void) | null = null;

  constructor(private readonly strategies: NarrationStrategy[]) {}

  get isPaused(): boolean {
    return this.paused;
  }

  get isPlaying(): boolean {
    return this.playing && !this.paused;
  }

  get currentPoi(): PointOfInterest | null {
    return this.current?.poi ?? null;
  }

  setFreshnessCheck(check: FreshnessCheck): void {
    this.isFresh = check;
  }

  setEventHandler(handler: ((event: NarrationEvent) => void) | null): void {
    this.onEvent = handler;
  }

  async speak(poi: PointOfInterest, options?: SpeakOptions): Promise<void> {
    this.queue.push({
      poi,
      queuedAt: Date.now(),
      force: options?.force,
    });
    if (!this.playing && !this.paused) {
      await this.drain();
    }
  }

  async stop(): Promise<void> {
    this.queue = [];
    this.current = null;
    this.paused = false;
    this.activeStrategy = null;
    await Promise.all(this.strategies.map((s) => s.stop()));
    this.playing = false;
  }

  /** Abort current clip and clear pending items. */
  async skip(): Promise<void> {
    const poiId = this.current?.poi.id;
    this.queue = [];
    this.current = null;
    this.paused = false;
    this.activeStrategy = null;
    await Promise.all(this.strategies.map((s) => s.stop()));
    if (poiId) {
      this.onEvent?.({ type: "skip", poiId, reason: "user" });
    }
  }

  async pause(): Promise<void> {
    if (this.paused) return;
    this.paused = true;
    const poiId = this.current?.poi.id;

    if (this.activeStrategy?.pause && this.current) {
      await this.activeStrategy.pause();
      if (poiId) this.onEvent?.({ type: "pause", poiId });
      return;
    }

    // No mid-clip pause: stop and put current back at the front.
    if (this.current) {
      this.queue.unshift(this.current);
      if (poiId) this.onEvent?.({ type: "pause", poiId });
      this.current = null;
    }
    this.activeStrategy = null;
    await Promise.all(this.strategies.map((s) => s.stop()));
  }

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;
    const poiId = this.current?.poi.id ?? this.queue[0]?.poi.id;

    if (this.activeStrategy?.resume && this.current) {
      await this.activeStrategy.resume();
      if (poiId) this.onEvent?.({ type: "resume", poiId });
      return;
    }

    if (poiId) this.onEvent?.({ type: "resume", poiId });
    if (!this.playing) {
      await this.drain();
    }
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;

    while (this.queue.length > 0 && !this.paused) {
      const item = this.queue.shift()!;
      this.current = item;

      if (!item.force && !this.isFresh(item.poi, item.queuedAt)) {
        this.onEvent?.({
          type: "skip",
          poiId: item.poi.id,
          reason: "stale",
        });
        this.current = null;
        continue;
      }

      let played = false;
      for (const strategy of this.strategies) {
        const strategyName = strategy.constructor.name;
        if (!(await strategy.canPlay(item.poi))) continue;

        this.activeStrategy = strategy;
        try {
          this.onEvent?.({
            type: "start",
            poiId: item.poi.id,
            strategy: strategyName,
          });
          // May stay pending across pause()/resume() when strategy supports pause.
          await strategy.play(item.poi);

          if (this.current !== item) {
            // skip/stop cleared current mid-play
            break;
          }
          if (this.paused) {
            // Soft-pause path re-queued; exit drain.
            break;
          }

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
        } finally {
          if (!(this.paused && this.activeStrategy?.pause && this.current === item)) {
            this.activeStrategy = null;
          }
        }
      }

      if (this.paused) break;

      if (!played && this.current === item) {
        this.onEvent?.({
          type: "skip",
          poiId: item.poi.id,
          reason: "no-strategy",
        });
        console.warn("No narration strategy could play POI", item.poi.id);
      }

      if (this.current === item) {
        this.current = null;
      }
    }

    this.playing = false;
  }
}
