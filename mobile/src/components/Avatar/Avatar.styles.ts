import { StyleSheet } from "react-native";
import { C } from "../../theme";
import type { AvatarSize } from "./Avatar.types";

export const DIMENSIONS: Record<AvatarSize, { box: number; text: number }> = {
  sm: { box: 30, text: 13 },
  md: { box: 38, text: 16 },
  lg: { box: 62, text: 26 },
};

/**
 * The palette an avatar can land on.
 *
 * Picked from the name rather than at random, so the same person is the same
 * colour on every screen and in every session.
 */
export const TINTS = [C.brand, C.accent, C.sky, C.ok, C.coral];

export const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  text: { color: C.ink, fontWeight: "800" },
});
