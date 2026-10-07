import { API_URL } from "@/config/api";
import type {
  PoisListResponse,
  PrepareRouteRequest,
  PrepareRouteResponse,
  RouteStatusResponse,
} from "@/shared/apiTypes";
import type { PointOfInterest } from "@/types";

function baseUrl(): string {
  return API_URL.replace(/\/$/, "");
}

function toPointOfInterest(poi: {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius?: number;
  fact: string;
  category?: string;
  audioUrl?: string;
}): PointOfInterest | null {
  if (
    poi.latitude == null ||
    poi.longitude == null ||
    Number.isNaN(Number(poi.latitude)) ||
    Number.isNaN(Number(poi.longitude))
  ) {
    return null;
  }

  return {
    id: poi.id,
    name: poi.name,
    latitude: Number(poi.latitude),
    longitude: Number(poi.longitude),
    radius: poi.radius ?? 200,
    fact: poi.fact,
    category: poi.category,
    audioUrl: poi.audioUrl,
  };
}

export class ApiClient {
  constructor(private readonly apiUrl: string = baseUrl()) {}

  async getPois(
    lat: number,
    lon: number,
    radius = 5000
  ): Promise<PointOfInterest[]> {
    const url = `${this.apiUrl}/api/pois?lat=${lat}&lon=${lon}&radius=${radius}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = (await response.json()) as PoisListResponse;
    return (data.pois ?? [])
      .map(toPointOfInterest)
      .filter((p): p is PointOfInterest => p != null);
  }

  async getAllPois(): Promise<PointOfInterest[]> {
    const url = `${this.apiUrl}/api/all-pois`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = (await response.json()) as PoisListResponse;
    if (!data.success || !Array.isArray(data.pois)) {
      throw new Error("Unexpected API response format");
    }
    return data.pois
      .map(toPointOfInterest)
      .filter((p): p is PointOfInterest => p != null);
  }

  async prepareRoute(
    body: PrepareRouteRequest
  ): Promise<PrepareRouteResponse> {
    const response = await fetch(`${this.apiUrl}/api/prepare-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Kunde inte förbereda rutt"
      );
    }
    return data as PrepareRouteResponse;
  }

  async getRoute(routeId: string): Promise<RouteStatusResponse> {
    const response = await fetch(`${this.apiUrl}/api/routes/${routeId}`);
    if (!response.ok) {
      throw new Error(`Route status error: ${response.status}`);
    }
    return (await response.json()) as RouteStatusResponse;
  }
}

export const apiClient = new ApiClient();
