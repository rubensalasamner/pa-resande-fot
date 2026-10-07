import { POISimulationMap } from "@/components/POISimulationMap";
import { StyleSheet, View } from "react-native";

export default function SimulatorScreen() {
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <POISimulationMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
