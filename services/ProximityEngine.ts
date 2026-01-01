import { Location, PointOfInterest } from "@/types";

export class ProximityEngine {
  private lastTriggeredPOIs: Map<string, number> = new Map();
  private cooldownPeriod: number = 60000; // 1 minute cooldown per POI

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Find POIs near the current location
   */
  findNearbyPOIs(
    location: Location,
    allPOIs: PointOfInterest[]
  ): PointOfInterest[] {
    const nearby: PointOfInterest[] = [];

    for (const poi of allPOIs) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        poi.latitude,
        poi.longitude
      );

      if (distance <= poi.radius) {
        nearby.push(poi);
      }
    }

    return nearby;
  }

  /**
   * Check if a POI should be triggered (not in cooldown)
   */
  shouldTriggerPOI(poiId: string): boolean {
    const lastTriggered = this.lastTriggeredPOIs.get(poiId);
    if (!lastTriggered) {
      return true;
    }

    const now = Date.now();
    return now - lastTriggered > this.cooldownPeriod;
  }

  /**
   * Mark a POI as triggered
   */
  markTriggered(poiId: string) {
    this.lastTriggeredPOIs.set(poiId, Date.now());
  }

  /**
   * Get POIs that are nearby and ready to be triggered
   */
  getTriggerablePOIs(
    location: Location,
    allPOIs: PointOfInterest[]
  ): PointOfInterest[] {
    const nearby = this.findNearbyPOIs(location, allPOIs);
    return nearby.filter((poi) => this.shouldTriggerPOI(poi.id));
  }

  /**
   * Find the next POI (closest untriggered POI)
   * Returns the POI and its distance in meters
   */
  getNextPOI(
    location: Location,
    allPOIs: PointOfInterest[]
  ): { poi: PointOfInterest; distance: number } | null {
    const untriggeredPOIs = allPOIs.filter((poi) =>
      this.shouldTriggerPOI(poi.id)
    );

    if (untriggeredPOIs.length === 0) {
      return null;
    }

    // Find the closest POI
    let closestPOI: PointOfInterest | null = null;
    let closestDistance = Infinity;

    for (const poi of untriggeredPOIs) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        poi.latitude,
        poi.longitude
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPOI = poi;
      }
    }

    if (!closestPOI) {
      return null;
    }

    return { poi: closestPOI, distance: closestDistance };
  }
}
