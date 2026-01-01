import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

interface POI {
  id: string;
  name: string;
  title?: string;
  latitude: number;
  longitude: number;
  fact?: string;
  category?: string;
}

interface Props {
  apiUrl: string;
}

// Sweden bounding box for initial region
const SWEDEN_REGION = {
  latitude: 62.0, // Center of Sweden
  longitude: 15.0,
  latitudeDelta: 14.0, // Covers all of Sweden
  longitudeDelta: 12.0,
};

export function POIMapView({ apiUrl }: Props) {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  useEffect(() => {
    fetchAllPOIs();
  }, []);

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
        // Filter out any POIs with invalid coordinates
        const validPOIs = data.pois.filter((poi: any) => {
          const isValid =
            poi.latitude != null &&
            poi.longitude != null &&
            !isNaN(Number(poi.latitude)) &&
            !isNaN(Number(poi.longitude));
          if (!isValid) {
            console.warn("Invalid POI coordinates:", poi);
          }
          return isValid;
        });
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
        <Text style={styles.title}>POI Coverage Map</Text>
        <Text style={styles.subtitle}>Total POIs: {pois.length}</Text>
      </View>

      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={SWEDEN_REGION}
        showsUserLocation={false}
      >
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{
              latitude: poi.latitude,
              longitude: poi.longitude,
            }}
            title={poi.name || poi.title || "POI"}
            description={poi.fact?.substring(0, 100) || ""}
            onPress={() => setSelectedPOI(poi)}
          />
        ))}
      </MapView>

      {selectedPOI && (
        <View style={styles.poiInfo}>
          <Text style={styles.poiTitle}>
            {selectedPOI.name || selectedPOI.title}
          </Text>
          {selectedPOI.fact && (
            <Text style={styles.poiFact} numberOfLines={2}>
              {selectedPOI.fact}
            </Text>
          )}
          <Text style={styles.poiCoords}>
            {selectedPOI.latitude.toFixed(4)},{" "}
            {selectedPOI.longitude.toFixed(4)}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedPOI(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
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
  poiInfo: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  poiTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  poiFact: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  poiCoords: {
    fontSize: 12,
    color: "#999",
    marginBottom: 12,
  },
  closeButton: {
    alignSelf: "flex-end",
  },
  closeButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
