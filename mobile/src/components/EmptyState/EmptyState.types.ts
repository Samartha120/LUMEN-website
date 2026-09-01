import type { ViewStyle } from "react-native";
import type { IconName } from "../../Icon";

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}
