import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: S.md,
    paddingHorizontal: S.lg,
    paddingVertical: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { backgroundColor: C.raised },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: R.sm,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  label: { ...F.bodyStrong },
  destructive: { color: C.bad },
  sublabel: { ...F.caption, fontSize: 12, marginTop: 2, lineHeight: 17 },
  value: { ...F.caption, maxWidth: "42%", textAlign: "right" },
});
