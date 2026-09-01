import { Text, View } from "react-native";
import { styles } from "./KeyValue.styles";
import type { KeyValueProps } from "./KeyValue.types";

/** A labelled figure in a summary card. The label shrinks before the value. */
export function KeyValue({ label, value, tint, last, style }: KeyValueProps) {
  return (
    <View style={[styles.row, last && styles.last, style]}>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
      <Text style={[styles.value, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}
