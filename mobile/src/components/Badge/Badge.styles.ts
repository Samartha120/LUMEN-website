import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";
import type { BadgeTone } from "./Badge.types";

/** Foreground and fill for each tone, so a badge is never coloured by hand. */
export const TONES: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: C.body, bg: C.raised },
  brand: { fg: C.ink, bg: C.brandSoft },
  good: { fg: C.ok, bg: C.okSoft },
  warn: { fg: C.warn, bg: C.warnSoft },
  bad: { fg: C.bad, bg: C.badSoft },
  dark: { fg: "#fff", bg: C.dark },
};

export const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: R.pill,
  },
  sm: { paddingHorizontal: S.sm, paddingVertical: 3, gap: 5 },
  md: { paddingHorizontal: S.md, paddingVertical: 5, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  labelSm: { ...F.caption, fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  labelMd: { ...F.caption, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
});
