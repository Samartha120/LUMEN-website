import { Pressable, Text, View } from "react-native";
import { C } from "../../theme";
import { Icon } from "../../Icon";
import { styles } from "./EmptyState.styles";
import type { EmptyStateProps } from "./EmptyState.types";

/**
 * Nothing here, and what to do about it.
 *
 * An empty list should say why it is empty and offer the way out. "No results"
 * on its own leaves the reader to guess whether the app is broken.
 */
export function EmptyState({ icon, title, body, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.disc}><Icon name={icon} size={26} color={C.ink} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.action, pressed && { opacity: 0.9 }]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
