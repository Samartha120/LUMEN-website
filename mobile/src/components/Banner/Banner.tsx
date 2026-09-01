import { Pressable, Text, View } from "react-native";
import { Icon } from "../../Icon";
import { styles, TONES } from "./Banner.styles";
import type { BannerProps } from "./Banner.types";

/**
 * A state the page needs to explain: offline, queued, refused, resolved.
 *
 * Distinct from a toast, which is about something that just happened and then
 * goes away. A banner is about how things are, so it stays until the situation
 * does.
 */
export function Banner({ tone = "info", title, body, icon, actionLabel, onAction, style }: BannerProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <Icon name={(icon ?? t.icon) as never} size={18} color={t.fg} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: t.fg }]}>{title}</Text>
        {body ? <Text style={[styles.text, { color: t.fg }]}>{body}</Text> : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={6}>
            <Text style={[styles.action, { color: t.fg }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
