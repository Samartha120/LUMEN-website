import { StyleSheet } from "react-native";
import { C } from "../../theme";

export const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  plain: { backgroundColor: "transparent" },
  filled: { backgroundColor: C.brand },
  dark: { backgroundColor: C.dark },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});
