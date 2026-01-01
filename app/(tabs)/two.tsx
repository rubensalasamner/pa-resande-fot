import { POIMapView } from "@/components/POIMapView";
import { StyleSheet, View } from "react-native";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://your-vercel-api.vercel.app";

export default function DevMapScreen() {
  // Only show in dev mode
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <POIMapView apiUrl={API_URL} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
