import type { ViewStyle } from "react-native";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
  /** Full name. Only the first letter is drawn. */
  name?: string | null;
  size?: AvatarSize;
  /** Overrides the derived colour, for a fixed brand avatar. */
  tint?: string;
  style?: ViewStyle;
}
