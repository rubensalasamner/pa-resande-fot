import type { PointOfInterest } from "@/types";
import type { NarrationStrategy } from "./NarrationStrategy";

export class NarrationQueue {
  private queue: PointOfInterest[] = [];
  private playing = false;

  constructor(private readonly strategies: NarrationStrategy[]) {}

  async speak(poi: PointOfInterest): Promise<void> {
    this.queue.push(poi);
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
      const poi = this.queue.shift()!;
      let played = false;
      for (const strategy of this.strategies) {
        if (await strategy.canPlay(poi)) {
          try {
            await strategy.play(poi);
            played = true;
            break;
          } catch (error) {
            console.warn("Narration strategy failed, trying next", error);
          }
        }
      }
      if (!played) {
        console.warn("No narration strategy could play POI", poi.id);
      }
    }
    this.playing = false;
  }
}
