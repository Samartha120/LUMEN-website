import type { ViewStyle } from "react-native";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export interface SkeletonListProps {
  /** How many placeholder cards to draw. */
  count?: number;
  style?: ViewStyle;
}
