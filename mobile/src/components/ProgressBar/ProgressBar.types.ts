import type { ViewStyle } from "react-native";

export interface ProgressBarProps {
  /** 0 to 100. Clamped, so a bad server number cannot overflow the track. */
  value: number;
  colour?: string;
  height?: number;
  /** Draws the percentage to the right of the track. */
  showValue?: boolean;
  style?: ViewStyle;
}
