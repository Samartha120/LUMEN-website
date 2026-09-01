import type { ViewStyle } from "react-native";
import type { IconName } from "../../Icon";

export interface ListRowProps {
  icon?: IconName;
  /** Fill behind the icon. Defaults to the neutral raised surface. */
  iconTint?: string;
  iconColor?: string;
  label: string;
  /** Second line, for the explanation a label cannot carry. */
  sublabel?: string;
  /** Right-aligned value, truncated before the label is. */
  value?: string;
  onPress?: () => void;
  /** Hides the divider. Set on the last row of a group. */
  last?: boolean;
  destructive?: boolean;
  style?: ViewStyle;
}
