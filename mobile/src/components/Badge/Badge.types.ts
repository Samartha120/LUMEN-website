import type { ViewStyle } from "react-native";

/** The meanings a badge can carry. Colour is derived from this, never passed. */
export type BadgeTone = "neutral" | "brand" | "good" | "warn" | "bad" | "dark";

export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  /** The text. Kept short — a badge that wraps is a label. */
  label: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Draws a filled dot before the label, for status lists. */
  dot?: boolean;
  style?: ViewStyle;
}
