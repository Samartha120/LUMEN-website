import { Text, View } from "react-native";
import { C } from "../../theme";
import { styles } from "./ProgressBar.styles";
import type { ProgressBarProps } from "./ProgressBar.types";

/**
 * A proportion.
 *
 * The value is clamped rather than trusted: a severity of 103 from a future
 * scoring change should show as a full bar, not one that runs off the card.
 * A non-zero minimum keeps a 1% bar visible instead of invisible.
 */
export function ProgressBar({ value, colour = C.brand, height = 8, showValue, style }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.track, { height }]}>
        <View style={[styles.fill, {
          width: `${Math.max(pct, pct > 0 ? 3 : 0)}%`,
          height,
          backgroundColor: colour,
        }]} />
      </View>
      {showValue ? <Text style={styles.value}>{Math.round(pct)}%</Text> : null}
    </View>
  );
}
