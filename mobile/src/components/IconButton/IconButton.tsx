import { Pressable } from "react-native";
import { C } from "../../theme";
import { Icon } from "../../Icon";
import { styles } from "./IconButton.styles";
import type { IconButtonProps } from "./IconButton.types";

/**
 * A tappable icon with a hit area big enough to actually hit.
 *
 * The label is required rather than optional: an icon on its own is silent to
 * a screen reader, and "button" is not an answer to what it does.
 */
export function IconButton({
  icon, onPress, variant = "plain", size = 44, label, disabled, style,
}: IconButtonProps) {
  const tint = variant === "dark" ? C.brand : C.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        { width: size, height: size, borderRadius: size / 2 },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} color={tint} />
    </Pressable>
  );
}
