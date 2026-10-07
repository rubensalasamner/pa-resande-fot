import { apiClient } from "@/services/ApiClient";
import { ContentProvider } from "@/services/ContentProvider";
import { LocationService } from "@/services/LocationService";
import { narrator } from "@/services/narration";
import { ProximityEngine } from "@/services/ProximityEngine";
import { useAppStore } from "@/store/useAppStore";
import type { Location, PointOfInterest } from "@/types";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

const REFETCH_DISTANCE_M = 2000;

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371e3;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const locationService = new LocationService();
const proximityEngine = new ProximityEngine();
const contentProvider = new ContentProvider();

export function useDrivingSession() {
  const {
    isDriving,
    currentLocation,
    nearbyPOIs,
    activeRoute,
    setDriving,
    setCurrentLocation,
    setNearbyPOIs,
  } = useAppStore();

  const poisRef = useRef<PointOfInterest[]>(
    activeRoute?.pois ?? contentProvider.getAllPOIs()
  );
  const lastFetchLocation = useRef<Location | null>(null);
  const [nextPOI, setNextPOI] = useState<{
    poi: PointOfInterest;
    distance: number;
  } | null>(null);

  useEffect(() => {
    if (activeRoute?.pois?.length) {
      poisRef.current = activeRoute.pois;
    }
  }, [activeRoute]);

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

  useEffect(() => {
    if (currentLocation && isDriving) {
      void checkForNearbyPOIs(currentLocation);
    }
  }, [currentLocation, isDriving]);

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

    await locationService.startLocationTracking((location) => {
      setCurrentLocation(location);
    });
  };

  const stopDriving = async () => {
    await locationService.stopLocationTracking();
    await narrator.stop();
    setCurrentLocation(null);
    setNearbyPOIs([]);
    setNextPOI(null);
  };

  const ensurePois = async (location: Location) => {
    if (activeRoute?.pois?.length) {
      poisRef.current = activeRoute.pois;
      return;
    }

    const last = lastFetchLocation.current;
    if (
      last &&
      haversineMeters(last, location) < REFETCH_DISTANCE_M &&
      poisRef.current.length > 0
    ) {
      return;
    }

    try {
      const pois = await apiClient.getPois(
        location.latitude,
        location.longitude,
        5000
      );
      poisRef.current = pois;
      lastFetchLocation.current = location;
    } catch (error) {
      console.error("Failed to fetch POIs", error);
      poisRef.current = contentProvider.getAllPOIs();
    }
  };

  const checkForNearbyPOIs = async (location: Location) => {
    await ensurePois(location);
    const pois = poisRef.current;

    const triggerable = proximityEngine.getTriggerablePOIs(location, pois);
    setNearbyPOIs(triggerable);
    setNextPOI(proximityEngine.getNextPOI(location, pois));

    if (triggerable.length > 0) {
      const poi = triggerable[0];
      proximityEngine.markTriggered(poi.id);
      await narrator.speak(poi);
    }
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
    loadedPoiCount: poisRef.current.length,
  };
}
