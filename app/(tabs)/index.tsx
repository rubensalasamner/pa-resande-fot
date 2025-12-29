import { ContentProvider } from "@/services/ContentProvider";
import { LocationService } from "@/services/LocationService";
import { NarrationService } from "@/services/NarrationService";
import { ProximityEngine } from "@/services/ProximityEngine";
import { useAppStore } from "@/store/useAppStore";
import React, { useEffect, useRef } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const locationService = new LocationService();
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

  const allPOIs = useRef(contentProvider.getAllPOIs());

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

  const checkForNearbyPOIs = () => {
    if (!currentLocation) return;

    // Reload POIs in case JSON was updated
    const pois = contentProvider.getAllPOIs();
    allPOIs.current = pois;

    console.log(
      "Current location:",
      currentLocation.latitude,
      currentLocation.longitude
    );
    console.log("Total POIs loaded:", pois.length);

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
            {allPOIs.current.length > 0 && (
              <Text style={styles.debugText}>
                Test POI:{" "}
                {allPOIs.current.find((p) => p.id === "poi-test-current")
                  ?.name || "Not found"}
              </Text>
            )}
          </View>
        )}

        {!currentLocation && isDriving && (
          <Text style={styles.waitingText}>Waiting for location...</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, isDriving && styles.buttonStop]}
        onPress={toggleDriving}
      >
        <Text style={styles.buttonText}>
          {isDriving ? "Stop Driving" : "Start Driving"}
        </Text>
      </TouchableOpacity>
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
  button: {
    backgroundColor: "#4CAF50",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
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
