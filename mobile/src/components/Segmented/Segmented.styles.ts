import { StyleSheet } from "react-native";
import { C, S, R, F } from "../../theme";

export const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: C.raised,
    borderRadius: R.pill,
    padding: 4,
  },
  item: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.pill,
  },
  // The selected segment is a raised white pill rather than a tint, so the
  // control reads the same way on the cream ground as on a white card.
  itemOn: { backgroundColor: C.surface },
  label: { ...F.caption, fontWeight: "700" },
  labelOn: { color: C.ink, fontWeight: "800" },
});
