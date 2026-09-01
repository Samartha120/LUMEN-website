import type { ViewStyle } from "react-native";
import type { IconName } from "../../Icon";

export type IconButtonVariant = "plain" | "filled" | "dark";

export interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: number;
  /** Read aloud by a screen reader. An icon alone says nothing. */
  label: string;
  disabled?: boolean;
  style?: ViewStyle;
}
