import { StyleSheet } from "react-native";
import { C, S, F } from "../../theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: S.md,
    paddingVertical: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  last: { borderBottomWidth: 0 },
  label: { ...F.caption, color: C.body, flexShrink: 1 },
  value: { ...F.bodyStrong, textAlign: "right" },
});
