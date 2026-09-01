import { StyleSheet } from "react-native";
import { C, S, R } from "../../theme";

export const styles = StyleSheet.create({
  block: { backgroundColor: C.raised },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: S.lg,
    marginBottom: S.md,
    gap: S.sm,
  },
  list: { padding: S.xl },
});
