import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: S.md },
  track: { flex: 1, backgroundColor: C.raised, borderRadius: R.pill, overflow: "hidden" },
  fill: { borderRadius: R.pill },
  value: { ...F.caption, fontWeight: "800", minWidth: 38, textAlign: "right" },
});
