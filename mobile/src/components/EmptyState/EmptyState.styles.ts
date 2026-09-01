import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";

export const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingHorizontal: S.xxl, paddingVertical: S.xxxl },
  disc: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: S.lg,
  },
  title: { ...F.heading, textAlign: "center" },
  body: { ...F.body, textAlign: "center", marginTop: S.sm, color: C.muted },
  action: {
    marginTop: S.xl,
    backgroundColor: C.dark,
    borderRadius: R.pill,
    paddingHorizontal: S.xxl,
    paddingVertical: S.md,
  },
  actionText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
