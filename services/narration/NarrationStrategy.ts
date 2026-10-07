import type { PointOfInterest } from "@/types";

export interface NarrationStrategy {
  canPlay(poi: PointOfInterest): Promise<boolean>;
  play(poi: PointOfInterest): Promise<void>;
  stop(): Promise<void>;
}
