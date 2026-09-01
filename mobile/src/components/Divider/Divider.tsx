import { View } from "react-native";
import { styles } from "./Divider.styles";
import type { DividerProps } from "./Divider.types";

/** A hairline. Inset when it should start under a row's text, not its icon. */
export function Divider({ inset = 0, style }: DividerProps) {
  return <View style={[styles.line, inset ? { marginLeft: inset } : null, style]} />;
}
