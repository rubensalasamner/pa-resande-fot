import { ContentProvider } from "@/services/ContentProvider";
import { NarrationService } from "@/services/NarrationService";
import { ProximityEngine } from "@/services/ProximityEngine";
import { Location as LocationType, PointOfInterest } from "@/types";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface Props {
  apiUrl: string;
}

// Sweden bounding box for initial region
const SWEDEN_REGION = {
  latitude: 62.0,
  longitude: 15.0,
  latitudeDelta: 14.0,
  longitudeDelta: 12.0,
};

// Default car position (Stockholm area)
const DEFAULT_CAR_POSITION = {
  latitude: 59.3293,
  longitude: 18.0686,
};

// Create singleton instances (same as in real driving screen)
const proximityEngine = new ProximityEngine();
const narrationService = new NarrationService();
const contentProvider = new ContentProvider();

export function POISimulationMap({ apiUrl }: Props) {
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [carPosition, setCarPosition] = useState(DEFAULT_CAR_POSITION);
  const [nextPOI, setNextPOI] = useState<{
    poi: PointOfInterest;
    distance: number;
  } | null>(null);
  const [nearbyPOIs, setNearbyPOIs] = useState<PointOfInterest[]>([]);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchAllPOIs();
  }, []);

  useEffect(() => {
    if (pois.length > 0 && carPosition) {
      checkForNearbyPOIs();
    }
  }, [carPosition, pois]);

  const fetchAllPOIs = async () => {
    try {
      setLoading(true);
      const baseUrl = apiUrl.replace(/\/$/, "");
      const url = `${baseUrl}/api/all-pois`;
      console.log("Fetching POIs from:", url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("API response:", data);
      console.log("POIs count:", data.pois?.length || 0);

      if (data.success && data.pois && Array.isArray(data.pois)) {
        const validPOIs: PointOfInterest[] = data.pois
          .filter((poi: any) => {
            const isValid =
              poi.latitude != null &&
              poi.longitude != null &&
              !isNaN(Number(poi.latitude)) &&
              !isNaN(Number(poi.longitude));
            if (!isValid) {
              console.warn("Invalid POI coordinates:", poi);
            }
            return isValid;
          })
          .map((poi: any) => ({
            id: poi.id,
            name: poi.name || poi.title,
            latitude: Number(poi.latitude),
            longitude: Number(poi.longitude),
            radius: poi.radius || 200,
            fact: poi.fact || `${poi.name} is an interesting location.`,
            category: poi.category || "wikipedia",
          }));
        console.log("Valid POIs count:", validPOIs.length);
        setPois(validPOIs);
      } else {
        console.warn("Unexpected API response format:", data);
        Alert.alert(
          "Warning",
          "API returned unexpected format. Check console for details."
        );
      }
    } catch (error: any) {
      console.error("Error fetching POIs:", error);
      Alert.alert("Error", `Failed to load POIs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkForNearbyPOIs = () => {
    if (pois.length === 0) return;

    const currentLocation: LocationType = {
      latitude: carPosition.latitude,
      longitude: carPosition.longitude,
      accuracy: 10,
      timestamp: Date.now(),
    };

    console.log(
      "Checking for nearby POIs at:",
      carPosition.latitude,
      carPosition.longitude
    );
    console.log("Total POIs available:", pois.length);

    // Find triggerable POIs (within radius and not in cooldown)
    const triggerablePOIs = proximityEngine.getTriggerablePOIs(
      currentLocation,
      pois
    );
    console.log("Triggerable POIs found:", triggerablePOIs.length);
    setNearbyPOIs(triggerablePOIs);

    // Find next POI (closest untriggered POI)
    const nextPOIData = proximityEngine.getNextPOI(currentLocation, pois);
    setNextPOI(nextPOIData);
    if (nextPOIData) {
      console.log(
        "Next POI:",
        nextPOIData.poi.name,
        "Distance:",
        Math.round(nextPOIData.distance),
        "m"
      );
    }

    // Trigger narration for the first triggerable POI (same logic as real driving)
    if (triggerablePOIs.length > 0) {
      const poi = triggerablePOIs[0];
      // Mark as triggered BEFORE speaking (prevents retriggering during speech)
      proximityEngine.markTriggered(poi.id);
      console.log("🎯 Triggering POI:", poi.name);
      console.log("🔊 Speaking:", poi.fact?.substring(0, 100) || "No fact");
      narrationService.speak(poi.fact);
    } else {
      console.log("No POIs within trigger radius");
    }
  };

  const handleCarDragEnd = (e: any) => {
    const newPosition = {
      latitude: e.nativeEvent.coordinate.latitude,
      longitude: e.nativeEvent.coordinate.longitude,
    };
    setCarPosition(newPosition);
  };

  const resetCarPosition = () => {
    setCarPosition(DEFAULT_CAR_POSITION);
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        ...SWEDEN_REGION,
        latitude: DEFAULT_CAR_POSITION.latitude,
        longitude: DEFAULT_CAR_POSITION.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  };

  const centerOnCar = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: carPosition.latitude,
          longitude: carPosition.longitude,
          latitudeDelta: 0.005, // Zoom in very close
          longitudeDelta: 0.005,
        },
        1000
      ); // 1 second animation
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading POIs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>POI Simulator</Text>
        <Text style={styles.subtitle}>
          Drag the car icon to simulate driving
        </Text>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          ...SWEDEN_REGION,
          latitude: carPosition.latitude,
          longitude: carPosition.longitude,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
        showsUserLocation={false}
      >
        {/* POI Markers */}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{
              latitude: poi.latitude,
              longitude: poi.longitude,
            }}
            title={poi.name}
            description={poi.fact?.substring(0, 100) || ""}
            pinColor="blue"
          />
        ))}

        {/* Car Marker (Draggable) */}
        <Marker
          coordinate={carPosition}
          draggable
          onDragEnd={handleCarDragEnd}
          title="Your Car"
          description="Drag me to simulate driving"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.carMarkerContainer}>
            <View style={styles.carMarker}>
              <Text style={styles.carText}>CAR</Text>
            </View>
          </View>
        </Marker>
      </MapView>

      {/* Center on Car Button */}
      <TouchableOpacity style={styles.centerButton} onPress={centerOnCar}>
        <Text style={styles.centerButtonText}>📍</Text>
        <Text style={styles.centerButtonLabel}>Find Car</Text>
      </TouchableOpacity>

      {/* Info Panel */}
      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Position:</Text>
          <Text style={styles.infoValue}>
            {carPosition.latitude.toFixed(4)},{" "}
            {carPosition.longitude.toFixed(4)}
          </Text>
        </View>

        {nextPOI && (
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
          <View style={styles.nearbyCard}>
            <Text style={styles.nearbyLabel}>
              Triggered POIs: {nearbyPOIs.length}
            </Text>
            {nearbyPOIs.map((poi) => (
              <Text key={poi.id} style={styles.nearbyItem}>
                • {poi.name}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.resetButton} onPress={resetCarPosition}>
          <Text style={styles.resetButtonText}>Reset Position</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  infoPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 300,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
  },
  carMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  carMarker: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  carText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  nextPOICard: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  nextPOILabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  nextPOIName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  nextPOIDistance: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "500",
  },
  nearbyCard: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  nearbyLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
  },
  nearbyItem: {
    fontSize: 12,
    color: "#333",
    marginLeft: 8,
  },
  resetButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  centerButton: {
    position: "absolute",
    top: 80,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 70,
  },
  centerButtonText: {
    fontSize: 24,
  },
  centerButtonLabel: {
    fontSize: 10,
    color: "#333",
    marginTop: 2,
    fontWeight: "600",
  },
});
