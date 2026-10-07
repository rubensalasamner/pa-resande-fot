import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import type { PointOfInterest } from "@/types";
import type { NarrationStrategy } from "./NarrationStrategy";

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
      const finish = () => {
        sub.remove();
        resolve();
      };

      const sub = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          finish();
        }
      });

      try {
        player.play();
      } catch (error) {
        sub.remove();
        reject(error);
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
