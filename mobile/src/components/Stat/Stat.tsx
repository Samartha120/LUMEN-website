import { Text, View } from "react-native";
import { Icon } from "../../Icon";
import { C, S } from "../../theme";
import { styles } from "./Stat.styles";
import type { StatProps } from "./Stat.types";

/**
 * A number worth reading, with the sentence that explains it.
 *
 * In emphasis form the number sits on black beside its label, which is the one
 * treatment reserved for the figure a screen exists to show. Without emphasis
 * it is a small tile that sits happily three-across.
 */
export function Stat({ value, label, unit, icon, tint, emphasis, style }: StatProps) {
  if (emphasis) {
    return (
      <View style={[styles.card, styles.row, style]}>
        <View style={styles.box}>
          <Text style={styles.boxValue}>{value}</Text>
          {unit ? <Text style={styles.boxUnit}>{unit}</Text> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.card, styles.centre, style]}>
      {icon ? <Icon name={icon} size={16} color={tint ?? C.muted} /> : null}
      <Text style={[styles.plainValue, tint ? { color: tint } : null, icon ? { marginTop: S.xs } : null]}>
        {value}
      </Text>
      <Text style={styles.plainLabel}>{label}</Text>
    </View>
  );
}
