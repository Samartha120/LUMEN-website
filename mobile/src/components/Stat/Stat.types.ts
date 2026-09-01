import type { ViewStyle } from "react-native";
import type { IconName } from "../../Icon";

export interface StatProps {
  value: string | number;
  label: string;
  /** Small word under the number, e.g. "open". */
  unit?: string;
  icon?: IconName;
  tint?: string;
  /** Draws the number on black, for the one figure that matters most. */
  emphasis?: boolean;
  style?: ViewStyle;
}
