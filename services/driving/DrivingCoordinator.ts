import {
  DEFAULT_QUIET_MINUTES,
  type DrivingCommand,
  type DrivingControlState,
} from "@/services/driving/DrivingCommand";
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
 * Driver intent (buttons / future voice) goes through dispatch().
 */
export class DrivingCoordinator {
  private readonly proximity = new ProximityEngine(new OncePerSessionPolicy());
  private poiSource: DrivingPoiSource;
  private active = false;
  private lastPois: PointOfInterest[] = [];
  private lastSpokenPoi: PointOfInterest | null = null;
  private lastLocation: Location | null = null;
  private suppressUntil = 0;
  private processing: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private controlSnapshot: DrivingControlState = {
    paused: false,
    quietUntil: null,
    canReplay: false,
    canNext: false,
    isPlaying: false,
  };

  constructor() {
    this.poiSource = this.buildDefaultSource();
    narrator.setFreshnessCheck(
      createProximityFreshness({
        getLocation: () => useAppStore.getState().currentLocation,
      })
    );
    narrator.setEventHandler((event) => {
      void tripLog.logNarration(event);
      if (
        event.type === "start" ||
        event.type === "end" ||
        event.type === "pause" ||
        event.type === "resume" ||
        event.type === "skip"
      ) {
        this.notify();
      }
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

  getControlState(): DrivingControlState {
    return this.controlSnapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private refreshControlState(): void {
    const location =
      this.lastLocation ?? useAppStore.getState().currentLocation;
    const next = location
      ? this.proximity.getNextPOI(location, this.lastPois)
      : null;
    this.controlSnapshot = {
      paused: narrator.isPaused,
      quietUntil: this.suppressUntil > Date.now() ? this.suppressUntil : null,
      canReplay: Boolean(this.lastSpokenPoi),
      canNext: Boolean(next),
      isPlaying: narrator.isPlaying,
    };
  }

  private notify(): void {
    this.refreshControlState();
    for (const listener of this.listeners) listener();
  }

  getNextPOI(
    location: Location
  ): { poi: PointOfInterest; distance: number } | null {
    return this.proximity.getNextPOI(location, this.lastPois);
  }

  async start(): Promise<void> {
    this.proximity.resetTriggers();
    this.poiSource = this.buildDefaultSource();
    this.lastSpokenPoi = null;
    this.suppressUntil = 0;
    this.active = true;
    const routeId = useAppStore.getState().activeRoute?.routeId;
    await tripLog.start(routeId);
    this.notify();
  }

  async stop(): Promise<void> {
    this.active = false;
    this.suppressUntil = 0;
    await narrator.stop();
    await tripLog.end();
    useAppStore.getState().setNearbyPOIs([]);
    this.notify();
  }

  processLocation(location: Location): void {
    this.lastLocation = location;
    useAppStore.getState().setCurrentLocation(location);
    this.processing = this.processing
      .then(() => this.handleLocation(location))
      .catch((error) => console.error("DrivingCoordinator error", error));
  }

  async dispatch(command: DrivingCommand): Promise<void> {
    if (!this.active) return;
    await tripLog.logCommand(command);
    switch (command.type) {
      case "replay":
        await this.replayLast();
        break;
      case "skip":
        await this.skipCurrent();
        break;
      case "next":
        await this.playNext();
        break;
      case "pause":
        await narrator.pause();
        break;
      case "resume":
        await narrator.resume();
        break;
      case "quiet":
        await this.quiet(command.minutes ?? DEFAULT_QUIET_MINUTES);
        break;
    }
    this.notify();
  }

  private async replayLast(): Promise<void> {
    if (!this.lastSpokenPoi) return;
    await narrator.skip();
    await narrator.speak(this.lastSpokenPoi, { force: true });
  }

  private async skipCurrent(): Promise<void> {
    await narrator.skip();
  }

  private async playNext(): Promise<void> {
    const location =
      this.lastLocation ?? useAppStore.getState().currentLocation;
    if (!location) return;

    const next = this.proximity.getNextPOI(location, this.lastPois);
    if (!next) return;

    await narrator.skip();
    this.proximity.markTriggered(next.poi.id);
    this.lastSpokenPoi = next.poi;
    await tripLog.logTrigger(next.poi);
    await narrator.speak(next.poi, { force: true });
  }

  private async quiet(minutes: number): Promise<void> {
    if (minutes <= 0) {
      this.suppressUntil = 0;
      return;
    }
    this.suppressUntil = Date.now() + minutes * 60_000;
    await narrator.skip();
  }

  private autoTriggersAllowed(): boolean {
    return !narrator.isPaused && Date.now() >= this.suppressUntil;
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
    this.notify();

    if (!this.autoTriggersAllowed()) return;
    if (triggerable.length === 0) return;

    const poi = triggerable[0];
    this.proximity.markTriggered(poi.id);
    this.lastSpokenPoi = poi;
    await tripLog.logTrigger(poi);
    await narrator.speak(poi);
  }
}

export const drivingCoordinator = new DrivingCoordinator();
