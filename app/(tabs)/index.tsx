import { LocationSimulatorControls } from "@/components/LocationSimulatorControls";
import { RoutePlanningModal } from "@/components/RoutePlanningModal";
import { ContentProvider } from "@/services/ContentProvider";
import { LocationService } from "@/services/LocationService";
import { LocationSimulator } from "@/services/LocationSimulator";
import { NarrationService } from "@/services/NarrationService";
import { ProximityEngine } from "@/services/ProximityEngine";
import { useAppStore } from "@/store/useAppStore";
import { Location as LocationType } from "@/types";
import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const locationService = new LocationService();
const locationSimulator = new LocationSimulator();
const proximityEngine = new ProximityEngine();
const narrationService = new NarrationService();
const contentProvider = new ContentProvider();

export default function DrivingScreen() {
  const {
    isDriving,
    currentLocation,
    nearbyPOIs,
    setDriving,
    setCurrentLocation,
    setNearbyPOIs,
  } = useAppStore();

  const [showRoutePlanning, setShowRoutePlanning] = useState(false);
  const allPOIs = useRef(contentProvider.getAllPOIs());

  // Get API URL from ContentProvider (same as used for POIs)
  const API_URL =
    process.env.EXPO_PUBLIC_API_URL || "https://your-vercel-api.vercel.app";

  useEffect(() => {
    if (isDriving) {
      startDriving();
    } else {
      stopDriving();
    }

    return () => {
      stopDriving();
    };
  }, [isDriving]);

  useEffect(() => {
    if (currentLocation && isDriving) {
      checkForNearbyPOIs();
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
    narrationService.stop();
    setCurrentLocation(null);
    setNearbyPOIs([]);
  };

  const checkForNearbyPOIs = async () => {
    if (!currentLocation) return;

    try {
      // Fetch POIs from API based on current location
      const pois = await contentProvider.fetchPOIsFromAPI(
        currentLocation.latitude,
        currentLocation.longitude,
        5000 // 5km radius
      );

      allPOIs.current = pois;
      console.log(
        "Current location:",
        currentLocation.latitude,
        currentLocation.longitude
      );
      console.log("Total POIs loaded from API:", pois.length);

      const triggerablePOIs = proximityEngine.getTriggerablePOIs(
        currentLocation,
        pois
      );

      console.log("Triggerable POIs found:", triggerablePOIs.length);
      if (triggerablePOIs.length > 0) {
        console.log("POI details:", triggerablePOIs[0]);
      }

      setNearbyPOIs(triggerablePOIs);

      // Narrate the first triggerable POI
      if (triggerablePOIs.length > 0) {
        const poi = triggerablePOIs[0];
        proximityEngine.markTriggered(poi.id);
        console.log("Speaking:", poi.fact);
        narrationService.speak(poi.fact);
      }
    } catch (error) {
      console.error("Error fetching POIs:", error);
      // Fallback to local POIs
      const localPOIs = contentProvider.getAllPOIs();
      allPOIs.current = localPOIs;
      console.log("Using local POIs as fallback:", localPOIs.length);

      const triggerablePOIs = proximityEngine.getTriggerablePOIs(
        currentLocation,
        localPOIs
      );
      setNearbyPOIs(triggerablePOIs);

      if (triggerablePOIs.length > 0) {
        const poi = triggerablePOIs[0];
        proximityEngine.markTriggered(poi.id);
        narrationService.speak(poi.fact);
      }
    }
  };

  const toggleDriving = () => {
    setDriving(!isDriving);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Travel Guide</Text>
        <Text style={styles.subtitle}>
          {isDriving ? "Tracking your journey" : "Ready to start"}
        </Text>
      </View>

      <View style={styles.content}>
        {currentLocation && (
          <View style={styles.locationInfo}>
            <Text style={styles.locationText}>
              Lat: {currentLocation.latitude.toFixed(4)}
            </Text>
            <Text style={styles.locationText}>
              Lon: {currentLocation.longitude.toFixed(4)}
            </Text>
            {currentLocation.accuracy && (
              <Text style={styles.accuracyText}>
                Accuracy: {Math.round(currentLocation.accuracy)}m
              </Text>
            )}
          </View>
        )}

        {nearbyPOIs.length > 0 && (
          <View style={styles.poiSection}>
            <Text style={styles.poiTitle}>Nearby Points of Interest:</Text>
            {nearbyPOIs.map((poi) => (
              <View key={poi.id} style={styles.poiCard}>
                <Text style={styles.poiName}>{poi.name}</Text>
                <Text style={styles.poiFact}>{poi.fact}</Text>
              </View>
            ))}
          </View>
        )}

        {isDriving && currentLocation && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>
              POIs loaded: {allPOIs.current.length}
            </Text>
            <Text style={styles.debugText}>
              Nearby POIs: {nearbyPOIs.length}
            </Text>
          </View>
        )}

        {!currentLocation && isDriving && (
          <Text style={styles.waitingText}>Waiting for location...</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        {!isDriving && (
          <TouchableOpacity
            style={styles.prepareButton}
            onPress={() => setShowRoutePlanning(true)}
          >
            <Text style={styles.prepareButtonText}>Förbered Rutt</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, isDriving && styles.buttonStop]}
          onPress={toggleDriving}
        >
          <Text style={styles.buttonText}>
            {isDriving ? "Stop Driving" : "Start Driving"}
          </Text>
        </TouchableOpacity>
      </View>

      <RoutePlanningModal
        visible={showRoutePlanning}
        onClose={() => setShowRoutePlanning(false)}
        onRoutePrepared={() => {
          Alert.alert("Rutt förberedd", "Du kan nu starta körning!");
        }}
        apiUrl={API_URL}
      />

      {__DEV__ && (
        <LocationSimulatorControls
          locationService={locationService}
          simulator={locationSimulator}
          onLocationSet={(lat, lon) => {
            const location: LocationType = {
              latitude: lat,
              longitude: lon,
              accuracy: 10,
              timestamp: Date.now(),
            };
            setCurrentLocation(location);
            // If driving, check for POIs immediately
            if (isDriving) {
              checkForNearbyPOIs();
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  locationInfo: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  locationText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  poiSection: {
    marginTop: 20,
  },
  poiTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  poiCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  poiName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  poiFact: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  waitingText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    marginTop: 20,
  },
  debugSection: {
    backgroundColor: "#fff3cd",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#ffc107",
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#856404",
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: "#856404",
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  prepareButton: {
    backgroundColor: "#007AFF",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  prepareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    flex: 1,
  },
  buttonStop: {
    backgroundColor: "#f44336",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
