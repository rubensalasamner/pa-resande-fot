import type {
  DrivingCommand,
  DrivingControlState,
} from "@/services/driving/DrivingCommand";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  state: DrivingControlState;
  onCommand: (command: DrivingCommand) => void;
}

export function DrivingControls({ state, onCommand }: Props) {
  const quietActive = state.quietUntil != null;
  const quietLabel = quietActive
    ? `Tyst ${Math.max(1, Math.ceil((state.quietUntil! - Date.now()) / 60_000))} min`
    : "Tyst 5 min";

  return (
    <View style={styles.wrap} accessibilityRole="toolbar">
      <View style={styles.row}>
        <ControlButton
          label="Säg igen"
          disabled={!state.canReplay}
          onPress={() => onCommand({ type: "replay" })}
        />
        <ControlButton
          label="Hoppa över"
          onPress={() => onCommand({ type: "skip" })}
        />
        <ControlButton
          label="Nästa"
          disabled={!state.canNext}
          onPress={() => onCommand({ type: "next" })}
        />
      </View>
      <View style={styles.row}>
        <ControlButton
          label={state.paused ? "Fortsätt" : "Paus"}
          primary={state.paused}
          onPress={() =>
            onCommand({ type: state.paused ? "resume" : "pause" })
          }
        />
        <ControlButton
          label={quietLabel}
          primary={quietActive}
          onPress={() =>
            onCommand(
              quietActive
                ? { type: "quiet", minutes: 0 }
                : { type: "quiet", minutes: 5 }
            )
          }
        />
      </View>
    </View>
  );
}

function ControlButton({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        primary && styles.buttonPrimary,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text
        style={[
          styles.buttonText,
          primary && styles.buttonTextPrimary,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#333",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  buttonTextPrimary: {
    color: "#fff",
  },
  buttonTextDisabled: {
    color: "#666",
  },
});
