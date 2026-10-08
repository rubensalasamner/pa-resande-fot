import type { PointOfInterest } from "@/types";

export interface NarrationStrategy {
  canPlay(poi: PointOfInterest): Promise<boolean>;
  play(poi: PointOfInterest): Promise<void>;
  stop(): Promise<void>;
  /** Optional mid-clip pause. Default: stop. */
  pause?(): Promise<void>;
  /** Resume after pause(). Default: no-op. */
  resume?(): Promise<void>;
}
