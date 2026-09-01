import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";
import type { BannerTone } from "./Banner.types";

export const TONES: Record<BannerTone, { fg: string; bg: string; border: string; icon: string }> = {
  info: { fg: C.ink, bg: C.skySoft, border: "#cfe9f7", icon: "info" },
  good: { fg: C.ok, bg: C.okSoft, border: "#c9e9d8", icon: "check-circle" },
  warn: { fg: C.warn, bg: C.warnSoft, border: "#f3ddc0", icon: "alert-triangle" },
  bad: { fg: C.bad, bg: C.badSoft, border: "#f6cfcc", icon: "alert-octagon" },
};

export const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    gap: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    padding: S.lg,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800" },
  text: { ...F.caption, fontSize: 13, lineHeight: 19, marginTop: 3 },
  action: { fontSize: 13, fontWeight: "800", marginTop: S.sm },
});
