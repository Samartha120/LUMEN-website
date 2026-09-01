import type { ViewStyle } from "react-native";

export interface KeyValueProps {
  label: string;
  value: string;
  /** Colours the value, for a figure that is good or bad news. */
  tint?: string;
  last?: boolean;
  style?: ViewStyle;
}
