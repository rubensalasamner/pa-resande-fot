import { apiClient } from "@/services/ApiClient";
import type { PointOfInterest } from "@/types";
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

const SWEDEN_REGION = {
  latitude: 62.0,
  longitude: 15.0,
  latitudeDelta: 14.0,
  longitudeDelta: 12.0,
};

export function POIMapView() {
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);

  useEffect(() => {
    void fetchAllPOIs();
  }, []);

  const fetchAllPOIs = async () => {
    try {
      setLoading(true);
      const all = await apiClient.getAllPois();
      setPois(all);
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
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={SWEDEN_REGION}
      >
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{
              latitude: poi.latitude,
              longitude: poi.longitude,
            }}
            title={poi.name}
            description={poi.fact?.substring(0, 80)}
            onPress={() => setSelectedPOI(poi)}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.count}>{pois.length} POIs</Text>
        <TouchableOpacity style={styles.refresh} onPress={fetchAllPOIs}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {selectedPOI && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{selectedPOI.name}</Text>
          <Text style={styles.cardFact}>{selectedPOI.fact}</Text>
          <TouchableOpacity onPress={() => setSelectedPOI(null)}>
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, color: "#666" },
  overlay: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  count: {
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "600",
  },
  refresh: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: { color: "white", fontWeight: "600" },
  card: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  cardFact: { fontSize: 14, color: "#444", marginBottom: 12 },
  close: { color: "#007AFF", fontWeight: "600" },
});
