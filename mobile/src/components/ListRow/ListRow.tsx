import { Pressable, Text, View } from "react-native";
import { C } from "../../theme";
import { Icon } from "../../Icon";
import { styles } from "./ListRow.styles";
import type { ListRowProps } from "./ListRow.types";

/**
 * One line in a settings group.
 *
 * The divider belongs to the row rather than the group, so a group is a plain
 * card with no padding and rows can be added or removed without the last one
 * needing a different card style.
 */
export function ListRow({
  icon, iconTint, iconColor, label, sublabel, value,
  onPress, last, destructive, style,
}: ListRowProps) {
  const body = (
    <View style={[styles.row, last && styles.last, style]}>
      {icon && (
        <View style={[styles.iconWrap, iconTint ? { backgroundColor: iconTint } : null]}>
          <Icon name={icon} size={17} color={iconColor ?? (destructive ? C.bad : C.body)} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Icon name="chevron-right" size={17} color={C.muted} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}
