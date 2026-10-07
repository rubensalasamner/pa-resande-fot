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
  intervalKm: number;
}

export interface PrepareRouteResponse {
  routeId: string;
  message: string;
  articlesFetched: number;
  articlesSaved: number;
  audioPending: number;
}

export interface RouteStatusResponse {
  routeId: string;
  origin: string;
  destination: string;
  intervalKm: number;
  pois: PoiDto[];
  audioReady: number;
  audioTotal: number;
  ready: boolean;
}

export interface PoisListResponse {
  success: boolean;
  pois: PoiDto[];
}
