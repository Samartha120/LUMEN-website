import { Text, View } from "react-native";
import { DIMENSIONS, TINTS, styles } from "./Avatar.styles";
import type { AvatarProps } from "./Avatar.types";

/** A stable hash, so a name always lands on the same colour. */
function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({ name, size = "md", tint, style }: AvatarProps) {
  const clean = String(name ?? "?").trim();
  const initial = (clean.charAt(0) || "?").toUpperCase();
  const d = DIMENSIONS[size];
  const bg = tint ?? tintFor(clean || "?");
  return (
    <View
      style={[
        styles.base,
        { width: d.box, height: d.box, borderRadius: d.box / 2, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: d.text }]}>{initial}</Text>
    </View>
  );
}
