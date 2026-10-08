import type { PathPoint, RouteSample } from "../domain/geo";

export const QUEUE_NAMES = {
  routeJobs: "route-jobs",
  tts: "tts-jobs",
} as const;

export interface CollectJobMessage {
  kind: "collect";
  routeId: string;
  jobIndex: number;
  searchRadiusM: number;
  samples: RouteSample[];
  path: PathPoint[];
}

export interface FinalizeRouteMessage {
  kind: "finalize";
  routeId: string;
}

export type RouteJobMessage = CollectJobMessage | FinalizeRouteMessage;

export interface TtsJobMessage {
  poiId: string;
  voiceId: string;
  scriptHash: string;
  script: string;
}
