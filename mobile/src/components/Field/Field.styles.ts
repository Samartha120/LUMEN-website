import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";

export const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...F.caption, color: C.body, fontWeight: "700" },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 13,
    fontSize: 16,
    color: C.ink,
  },
  // Focus is a black border rather than a coloured glow: on a cream ground a
  // tinted ring reads as a warning.
  focused: { borderColor: C.ink },
  errored: { borderColor: C.bad },
  multiline: { minHeight: 78, textAlignVertical: "top", paddingTop: S.md },
  hint: { ...F.caption, fontSize: 12 },
  error: { ...F.caption, fontSize: 12, color: C.bad },
});
