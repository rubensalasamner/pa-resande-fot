export interface PoiDto {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  fact: string;
  category?: string;
  sourceUrl?: string;
  audioUrl?: string;
}

export interface PrepareRouteRequest {
  origin: string;
  destination: string;
  /** Minimum spacing in km between narrated POIs along the route. */
  intervalKm: number;
}

export interface PrepareRouteResponse {
  routeId: string;
  message: string;
  distanceM: number;
  collectJobs: number;
}

export type RoutePhase = "collecting" | "generating" | "ready" | "failed";

export interface RouteStatusResponse {
  routeId: string;
  origin: string;
  destination: string;
  intervalKm: number;
  status: RoutePhase;
  error?: string;
  collectJobsTotal: number;
  collectJobsDone: number;
  collectJobsFailed: number;
  pois: PoiDto[];
  audioReady: number;
  audioFailed: number;
  audioTotal: number;
  failedNarrations?: Array<{
    poiId: string;
    name: string;
    error: string;
  }>;
}

export interface PoisListResponse {
  success: boolean;
  pois: PoiDto[];
}
