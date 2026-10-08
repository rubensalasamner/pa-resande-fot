import { apiClient } from "@/services/ApiClient";
import { ContentProvider } from "@/services/ContentProvider";
import { haversineMeters } from "@/services/geo";
import type { ActiveRoute, Location, PointOfInterest } from "@/types";

export interface DrivingPoiSource {
  getPois(location: Location): Promise<PointOfInterest[]>;
}

export class RoutePoiSource implements DrivingPoiSource {
  constructor(private readonly getRoute: () => ActiveRoute | null) {}

  async getPois(_location: Location): Promise<PointOfInterest[]> {
    return this.getRoute()?.pois ?? [];
  }
}

export class NearbyPoiSource implements DrivingPoiSource {
  private lastFetchLocation: Location | null = null;
  private cached: PointOfInterest[] = [];
  private readonly contentProvider = new ContentProvider();

  constructor(
    private readonly radiusM = 5000,
    private readonly refetchDistanceM = 2000
  ) {}

  async getPois(location: Location): Promise<PointOfInterest[]> {
    const last = this.lastFetchLocation;
    if (
      last &&
      haversineMeters(last, location) < this.refetchDistanceM &&
      this.cached.length > 0
    ) {
      return this.cached;
    }

    try {
      const pois = await apiClient.getPois(
        location.latitude,
        location.longitude,
        this.radiusM
      );
      this.cached = pois;
      this.lastFetchLocation = location;
      return pois;
    } catch (error) {
      console.error("Failed to fetch nearby POIs", error);
      this.cached = this.contentProvider.getAllPOIs();
      return this.cached;
    }
  }
}

/** Prefer packed route POIs; fall back to live nearby fetch. */
export class PreferRoutePoiSource implements DrivingPoiSource {
  constructor(
    private readonly routeSource: DrivingPoiSource,
    private readonly nearbySource: DrivingPoiSource
  ) {}

  async getPois(location: Location): Promise<PointOfInterest[]> {
    const routePois = await this.routeSource.getPois(location);
    if (routePois.length > 0) return routePois;
    return this.nearbySource.getPois(location);
  }
}
