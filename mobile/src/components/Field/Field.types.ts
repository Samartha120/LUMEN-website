import type { TextInputProps, ViewStyle } from "react-native";

export interface FieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  /** Shown under the field in red, and turns the border red. */
  error?: string | null;
  /** Shown under the field in grey when there is no error. */
  hint?: string;
  /** Grows the box for a sentence or two. */
  multiline?: boolean;
  style?: ViewStyle;
}
