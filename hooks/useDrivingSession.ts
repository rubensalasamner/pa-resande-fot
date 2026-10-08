import { setLocationHandler } from "@/services/driving/locationBridge";
import { drivingCoordinator } from "@/services/driving/DrivingCoordinator";
import { LocationService } from "@/services/LocationService";
import { useAppStore } from "@/store/useAppStore";
import type { PointOfInterest } from "@/types";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

const locationService = new LocationService();
const KEEP_AWAKE_TAG = "driving-session";

export function useDrivingSession() {
  const {
    isDriving,
    currentLocation,
    nearbyPOIs,
    activeRoute,
    setDriving,
  } = useAppStore();

  const [nextPOI, setNextPOI] = useState<{
    poi: PointOfInterest;
    distance: number;
  } | null>(null);
  const [loadedPoiCount, setLoadedPoiCount] = useState(0);

  useEffect(() => {
    setLocationHandler((location) => {
      drivingCoordinator.processLocation(location);
      setNextPOI(drivingCoordinator.getNextPOI(location));
      setLoadedPoiCount(drivingCoordinator.loadedPoiCount);
    });
    return () => setLocationHandler(null);
  }, []);

  useEffect(() => {
    if (isDriving) {
      void startDriving();
    } else {
      void stopDriving();
    }
    return () => {
      void stopDriving();
    };
  }, [isDriving]);

  const startDriving = async () => {
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        "Permission Required",
        "Location permission is required to use this app."
      );
      setDriving(false);
      return;
    }

    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } catch {
      // optional on web
    }

    await drivingCoordinator.start();
    await locationService.startLocationTracking();
  };

  const stopDriving = async () => {
    await locationService.stopLocationTracking();
    await drivingCoordinator.stop();
    deactivateKeepAwake(KEEP_AWAKE_TAG);
    useAppStore.getState().setCurrentLocation(null);
    setNextPOI(null);
    setLoadedPoiCount(0);
  };

  const toggleDriving = () => setDriving(!isDriving);

  return {
    isDriving,
    currentLocation,
    nearbyPOIs,
    nextPOI,
    activeRoute,
    locationService,
    toggleDriving,
    loadedPoiCount,
  };
}
