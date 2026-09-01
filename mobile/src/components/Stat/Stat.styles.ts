import { StyleSheet } from "react-native";
import { C, S, R, F, E } from "../../theme";

export const styles = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.lg,
    ...E.card,
  },
  row: { flexDirection: "row", alignItems: "center", gap: S.lg },
  box: {
    backgroundColor: C.dark,
    borderRadius: R.md,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    alignItems: "center",
    minWidth: 74,
  },
  boxValue: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  boxUnit: { color: C.onDarkMuted, fontSize: 11, fontWeight: "600", marginTop: -2 },
  plainValue: { fontSize: 24, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  label: { ...F.bodyStrong, flex: 1 },
  plainLabel: { ...F.caption, fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },
  centre: { alignItems: "center" },
});
