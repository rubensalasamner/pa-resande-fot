import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  onRoutePrepared: () => void;
  apiUrl: string;
}

export function RoutePlanningModal({
  visible,
  onClose,
  onRoutePrepared,
  apiUrl,
}: Props) {
  const [origin, setOrigin] = useState("Stockholm, Sweden");
  const [destination, setDestination] = useState("Mora, Sweden");
  const [intervalKm, setIntervalKm] = useState("5");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const handlePrepareRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      Alert.alert("Fel", "Vänligen ange både start- och destinationspunkt");
      return;
    }

    const interval = parseFloat(intervalKm);
    if (isNaN(interval) || interval < 1 || interval > 20) {
      Alert.alert("Fel", "Intervall måste vara mellan 1 och 20 km");
      return;
    }

    setIsLoading(true);
    setProgress("Förbereder rutt...");

    try {
      const baseUrl = apiUrl.replace(/\/$/, "");
      const url = `${baseUrl}/api/prepare-route`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
          intervalKm: interval,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Ett fel uppstod");
      }

      Alert.alert(
        "Klart!",
        `Rutt förberedd!\n\n${data.message}\n\nArtiklar hämtade: ${data.articlesFetched}\nArtiklar sparade: ${data.articlesSaved}`,
        [
          {
            text: "OK",
            onPress: () => {
              onRoutePrepared();
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Error preparing route:", error);
      Alert.alert(
        "Fel",
        `Kunde inte förbereda rutt: ${error.message || "Okänt fel"}`
      );
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Förbered Rutt</Text>
          <Text style={styles.subtitle}>
            Ladda ner Wikipedia-artiklar längs rutten innan du kör
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Startpunkt:</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Stockholm, Sweden"
              value={origin}
              onChangeText={setOrigin}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Destination:</Text>
            <TextInput
              style={styles.input}
              placeholder="t.ex. Mora, Sweden"
              value={destination}
              onChangeText={setDestination}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Sampling-intervall (km):{" "}
              <Text style={styles.hint}>(1-20, rekommenderat: 5)</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="5"
              value={intervalKm}
              onChangeText={setIntervalKm}
              keyboardType="numeric"
              editable={!isLoading}
            />
          </View>

          {progress ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.progressText}>{progress}</Text>
            </View>
          ) : null}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Avbryt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, isLoading && styles.buttonDisabled]}
              onPress={handlePrepareRoute}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Förbered Rutt</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.infoText}>
            Detta kan ta flera minuter beroende på rutten. Du kan starta körning
            när det är klart.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 12,
    width: "90%",
    maxWidth: 500,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#f0f7ff",
    borderRadius: 8,
  },
  progressText: {
    marginLeft: 12,
    fontSize: 14,
    color: "#007AFF",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#007AFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoText: {
    fontSize: 12,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
    lineHeight: 18,
  },
});

