import { LocationService } from "@/services/LocationService";
import { LocationSimulator } from "@/services/LocationSimulator";
import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  locationService: LocationService;
  simulator: LocationSimulator;
  onLocationSet: (lat: number, lon: number) => void;
}

// Preset test locations (you can add more)
const PRESET_LOCATIONS = [
  { name: "Stockholm Center", lat: 59.3293, lon: 18.0686 },
  { name: "Mora", lat: 61.007, lon: 14.5433 },
];

export function LocationSimulatorControls({
  locationService,
  simulator,
  onLocationSet,
}: Props) {
  const [isSimulating, setIsSimulating] = useState(false);
  const [lat, setLat] = useState("59.3401");
  const [lon, setLon] = useState("18.1125");
  const [showModal, setShowModal] = useState(false);

  const handleSetLocation = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      alert("Invalid coordinates");
      return;
    }

    simulator.setLocation(latitude, longitude);
    onLocationSet(latitude, longitude);
  };

  const handlePresetLocation = (preset: (typeof PRESET_LOCATIONS)[0]) => {
    setLat(preset.lat.toString());
    setLon(preset.lon.toString());
    simulator.setLocation(preset.lat, preset.lon);
    onLocationSet(preset.lat, preset.lon);
  };

  const toggleSimulation = (value: boolean) => {
    setIsSimulating(value);
    if (value) {
      locationService.enableSimulation(simulator);
    } else {
      locationService.disableSimulation();
      simulator.stopSimulation();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowModal(true)}
      >
        <Text style={styles.toggleButtonText}>🧪 Location Simulator</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Location Simulator</Text>

            <View style={styles.switchContainer}>
              <Text>Simulation Mode:</Text>
              <Switch value={isSimulating} onValueChange={toggleSimulation} />
            </View>

            <Text style={styles.sectionTitle}>Preset Locations:</Text>
            {PRESET_LOCATIONS.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                style={styles.presetButton}
                onPress={() => handlePresetLocation(preset)}
              >
                <Text>{preset.name}</Text>
                <Text style={styles.coords}>
                  {preset.lat}, {preset.lon}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.sectionTitle}>Custom Coordinates:</Text>
            <TextInput
              style={styles.input}
              placeholder="Latitude"
              value={lat}
              onChangeText={setLat}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Longitude"
              value={lon}
              onChangeText={setLon}
              keyboardType="numeric"
            />
            <TouchableOpacity style={styles.button} onPress={handleSetLocation}>
              <Text style={styles.buttonText}>Set Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    right: 20,
  },
  toggleButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "90%",
    maxHeight: "80%",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 10,
  },
  presetButton: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  coords: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  closeButton: {
    marginTop: 20,
    padding: 12,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
