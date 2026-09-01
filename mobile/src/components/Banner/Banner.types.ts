import type { ViewStyle } from "react-native";
import type { IconName } from "../../Icon";

export type BannerTone = "info" | "good" | "warn" | "bad";

export interface BannerProps {
  tone?: BannerTone;
  title: string;
  body?: string;
  icon?: IconName;
  /** A single action, right-aligned. More than one belongs on the page. */
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}
