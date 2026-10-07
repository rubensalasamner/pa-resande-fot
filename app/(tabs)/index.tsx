import { LocationSimulatorControls } from "@/components/LocationSimulatorControls";
import { RoutePlanningModal } from "@/components/RoutePlanningModal";
import { useDrivingSession } from "@/hooks/useDrivingSession";
import { LocationSimulator } from "@/services/LocationSimulator";
import { useAppStore } from "@/store/useAppStore";
import type { Location as LocationType } from "@/types";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const locationSimulator = new LocationSimulator();

export default function DrivingScreen() {
  const {
    isDriving,
    currentLocation,
    nearbyPOIs,
    nextPOI,
    activeRoute,
    locationService,
    toggleDriving,
    loadedPoiCount,
  } = useDrivingSession();

  const setCurrentLocation = useAppStore((s) => s.setCurrentLocation);
  const [showRoutePlanning, setShowRoutePlanning] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Travel Guide</Text>
        <Text style={styles.subtitle}>
          {isDriving ? "Tracking your journey" : "Ready to start"}
        </Text>
        {activeRoute && (
          <Text style={styles.routeHint}>
            Rutt: {activeRoute.origin} → {activeRoute.destination} (
            {activeRoute.pois.length} POIs)
          </Text>
        )}
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

        {nextPOI && isDriving && (
          <View style={styles.nextPOICard}>
            <Text style={styles.nextPOILabel}>Next POI:</Text>
            <Text style={styles.nextPOIName}>{nextPOI.poi.name}</Text>
            <Text style={styles.nextPOIDistance}>
              {nextPOI.distance < 1000
                ? `${Math.round(nextPOI.distance)} m ahead`
                : `${(nextPOI.distance / 1000).toFixed(1)} km ahead`}
              {" · "}
              {Math.round(nextPOI.distance / 1000)} min
            </Text>
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
            <Text style={styles.debugText}>POIs loaded: {loadedPoiCount}</Text>
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
  routeHint: {
    fontSize: 13,
    color: "#007AFF",
    marginTop: 8,
    textAlign: "center",
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
  nextPOICard: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nextPOILabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextPOIName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  nextPOIDistance: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "500",
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
