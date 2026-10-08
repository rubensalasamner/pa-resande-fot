import { createProximityFreshness } from "@/services/geo";
import { narrator } from "@/services/narration";
import {
  NearbyPoiSource,
  PreferRoutePoiSource,
  RoutePoiSource,
  type DrivingPoiSource,
} from "@/services/poi/DrivingPoiSource";
import { ProximityEngine } from "@/services/ProximityEngine";
import { OncePerSessionPolicy } from "@/services/trigger/TriggerPolicy";
import { tripLog } from "@/services/TripLog";
import { useAppStore } from "@/store/useAppStore";
import type { Location, PointOfInterest } from "@/types";

/**
 * Owns proximity + POI sourcing + narration for a drive.
 * Foreground watcher and background TaskManager both call processLocation.
 */
export class DrivingCoordinator {
  private readonly proximity = new ProximityEngine(new OncePerSessionPolicy());
  private poiSource: DrivingPoiSource;
  private active = false;
  private lastPois: PointOfInterest[] = [];
  private processing: Promise<void> = Promise.resolve();

  constructor() {
    this.poiSource = this.buildDefaultSource();
    narrator.setFreshnessCheck(
      createProximityFreshness({
        getLocation: () => useAppStore.getState().currentLocation,
      })
    );
    narrator.setEventHandler((event) => {
      void tripLog.logNarration(event);
    });
  }

  private buildDefaultSource(): DrivingPoiSource {
    return new PreferRoutePoiSource(
      new RoutePoiSource(() => useAppStore.getState().activeRoute),
      new NearbyPoiSource()
    );
  }

  get loadedPoiCount(): number {
    return this.lastPois.length;
  }

  getNextPOI(
    location: Location
  ): { poi: PointOfInterest; distance: number } | null {
    return this.proximity.getNextPOI(location, this.lastPois);
  }

  async start(): Promise<void> {
    this.proximity.resetTriggers();
    this.poiSource = this.buildDefaultSource();
    this.active = true;
    const routeId = useAppStore.getState().activeRoute?.routeId;
    await tripLog.start(routeId);
  }

  async stop(): Promise<void> {
    this.active = false;
    await narrator.stop();
    await tripLog.end();
    useAppStore.getState().setNearbyPOIs([]);
  }

  processLocation(location: Location): void {
    useAppStore.getState().setCurrentLocation(location);
    this.processing = this.processing
      .then(() => this.handleLocation(location))
      .catch((error) => console.error("DrivingCoordinator error", error));
  }

  private async handleLocation(location: Location): Promise<void> {
    if (!this.active) return;

    await tripLog.logPosition(location);
    this.lastPois = await this.poiSource.getPois(location);

    const triggerable = this.proximity.getTriggerablePOIs(
      location,
      this.lastPois
    );
    useAppStore.getState().setNearbyPOIs(triggerable);

    if (triggerable.length === 0) return;

    const poi = triggerable[0];
    this.proximity.markTriggered(poi.id);
    await tripLog.logTrigger(poi);
    await narrator.speak(poi);
  }
}

export const drivingCoordinator = new DrivingCoordinator();
