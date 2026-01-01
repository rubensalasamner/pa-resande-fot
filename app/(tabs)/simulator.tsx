import { POISimulationMap } from "@/components/POISimulationMap";
import { StyleSheet, View } from "react-native";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://your-vercel-api.vercel.app";

export default function SimulatorScreen() {
  // Only show in dev mode
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <POISimulationMap apiUrl={API_URL} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

