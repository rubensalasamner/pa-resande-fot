import { emitLocation } from "@/services/driving/locationBridge";
import type { Location as LocationType } from "@/types";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { LocationSimulator } from "./LocationSimulator";

export const LOCATION_TASK_NAME = "background-location-task";

function toAppLocation(
  location: Location.LocationObject
): LocationType {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

export class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private backgroundTaskStarted = false;
  private simulator: LocationSimulator | null = null;
  private simulationMode = false;

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      return false;
    }

    try {
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn(
          "Background location permission not granted - foreground tracking will still work"
        );
      }
    } catch (error) {
      console.warn(
        "Background location not available (Expo Go limitation):",
        error
      );
    }

    return true;
  }

  enableSimulation(simulator: LocationSimulator) {
    this.simulator = simulator;
    this.simulationMode = true;
  }

  disableSimulation() {
    this.simulationMode = false;
    this.simulator = null;
  }

  triggerLocationUpdate(location: LocationType) {
    emitLocation(location);
  }

  async startLocationTracking() {
    if (this.simulationMode && this.simulator) {
      return;
    }

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 50,
      },
      (location) => {
        emitLocation(toAppLocation(location));
      }
    );

    try {
      if (TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
        const started = await Location.hasStartedLocationUpdatesAsync(
          LOCATION_TASK_NAME
        );
        if (!started) {
          await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 100,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: "På resande fot",
              notificationBody: "Guidar dig längs vägen",
            },
          });
        }
        this.backgroundTaskStarted = true;
      }
    } catch {
      this.backgroundTaskStarted = false;
    }
  }

  async stopLocationTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    if (this.backgroundTaskStarted) {
      try {
        const isRegistered = await Location.hasStartedLocationUpdatesAsync(
          LOCATION_TASK_NAME
        );
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch {
        // Expo Go / missing task
      }
      this.backgroundTaskStarted = false;
    }
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Location task error:", error);
    return;
  }
  if (!data) return;
  const { locations } = data as { locations?: Location.LocationObject[] };
  const latest = locations?.[locations.length - 1];
  if (latest) {
    emitLocation(toAppLocation(latest));
  }
});
