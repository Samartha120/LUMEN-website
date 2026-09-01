import { Pressable, Text, View } from "react-native";
import { styles } from "./Segmented.styles";
import type { SegmentedProps } from "./Segmented.types";

/**
 * Two to four mutually exclusive views of the same data.
 *
 * Not a tab bar: tabs change where you are, this changes what you are looking
 * at without leaving the screen. Anything beyond four options belongs in a
 * list, because the labels stop fitting.
 */
export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  return (
    <View style={[styles.track, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
