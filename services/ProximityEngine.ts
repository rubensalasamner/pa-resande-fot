import type { Location, PointOfInterest } from "@/types";
import {
  OncePerSessionPolicy,
  type TriggerPolicy,
} from "@/services/trigger/TriggerPolicy";

export class ProximityEngine {
  constructor(private policy: TriggerPolicy = new OncePerSessionPolicy()) {}

  setPolicy(policy: TriggerPolicy): void {
    this.policy = policy;
  }

  getPolicy(): TriggerPolicy {
    return this.policy;
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
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

  findNearbyPOIs(
    location: Location,
    allPOIs: PointOfInterest[]
  ): PointOfInterest[] {
    return allPOIs.filter((poi) => {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        poi.latitude,
        poi.longitude
      );
      return distance <= poi.radius;
    });
  }

  getTriggerablePOIs(
    location: Location,
    allPOIs: PointOfInterest[]
  ): PointOfInterest[] {
    return this.findNearbyPOIs(location, allPOIs).filter((poi) =>
      this.policy.shouldTrigger(poi.id)
    );
  }

  markTriggered(poiId: string): void {
    this.policy.markTriggered(poiId);
  }

  resetTriggers(): void {
    this.policy.reset();
  }

  getNextPOI(
    location: Location,
    allPOIs: PointOfInterest[]
  ): { poi: PointOfInterest; distance: number } | null {
    let closestPOI: PointOfInterest | null = null;
    let closestDistance = Infinity;

    for (const poi of allPOIs) {
      if (!this.policy.shouldTrigger(poi.id)) continue;
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

    return closestPOI
      ? { poi: closestPOI, distance: closestDistance }
      : null;
  }
}
