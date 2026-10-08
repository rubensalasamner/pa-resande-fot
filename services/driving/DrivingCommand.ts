export type DrivingCommand =
  | { type: "replay" }
  | { type: "skip" }
  | { type: "next" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "quiet"; minutes?: number };

export const DEFAULT_QUIET_MINUTES = 5;

export interface DrivingControlState {
  paused: boolean;
  quietUntil: number | null;
  canReplay: boolean;
  canNext: boolean;
  isPlaying: boolean;
}
