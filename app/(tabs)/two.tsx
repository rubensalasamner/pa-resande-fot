import { POIMapView } from "@/components/POIMapView";
import { StyleSheet, View } from "react-native";

export default function DevMapScreen() {
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.container}>
      <POIMapView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
