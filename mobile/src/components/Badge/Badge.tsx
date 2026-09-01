import { Text, View } from "react-native";
import { styles, TONES } from "./Badge.styles";
import type { BadgeProps } from "./Badge.types";

/**
 * A short status word on a tinted pill.
 *
 * The tone carries the meaning and the colour comes from it, so a screen never
 * picks a hex value for a status. Foreground and fill are always taken from
 * the same pair, which is what keeps the text legible when the palette moves.
 */
export function Badge({ label, tone = "neutral", size = "md", dot, style }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.base, size === "sm" ? styles.sm : styles.md, { backgroundColor: t.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text style={[size === "sm" ? styles.labelSm : styles.labelMd, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}
