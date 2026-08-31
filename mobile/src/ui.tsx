import { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle,
} from "react-native";
import { C, S, R, F, card, tone } from "./theme";

/**
 * The parts every screen is built from.
 *
 * Kept deliberately few. A civic app has one primary action per screen, one way
 * to show status, one card. Anything a screen needs beyond these is a sign the
 * screen is doing too much.
 */

export function Button({ label, onPress, busy, variant = "primary", style }: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
}) {
  const v = u[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      // Pressed state is a slight darkening rather than an opacity fade, which
      // on a white card reads as the button briefly disappearing.
      style={({ pressed }) => [u.btn, v, pressed && !busy && u.pressed, busy && u.busy, style]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? C.onBrand : C.brand} />
      ) : (
        <Text style={[u.btnLabel, variant === "primary" ? u.btnLabelPrimary : u.btnLabelQuiet]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[card, u.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [card, u.card, pressed && u.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({ label, priority, selected, onPress }: {
  label: string;
  priority?: string | null;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = priority !== undefined ? tone(priority) : null;
  const body = (
    <View style={[
      u.chip,
      t ? { backgroundColor: t.bg } : selected ? u.chipOn : u.chipOff,
    ]}>
      <Text style={[
        u.chipText,
        t ? { color: t.fg } : selected ? u.chipTextOn : u.chipTextOff,
      ]}>
        {label}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={u.section}>{children}</Text>;
}

export function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={u.empty}>
      <View style={u.emptyIconWrap}><Text style={u.emptyIcon}>{icon}</Text></View>
      <Text style={u.emptyTitle}>{title}</Text>
      <Text style={u.emptyBody}>{body}</Text>
    </View>
  );
}

/** A labelled meter. Used for severity, where the number alone means little. */
export function Meter({ value, priority }: { value: number; priority?: string | null }) {
  const t = tone(priority);
  return (
    <View style={u.meterTrack}>
      <View style={[u.meterFill, {
        width: `${Math.min(100, Math.max(3, value))}%`,
        backgroundColor: t.fg,
      }]} />
    </View>
  );
}

const u = StyleSheet.create({
  btn: {
    borderRadius: R.md, paddingVertical: 15, paddingHorizontal: S.xl,
    alignItems: "center", justifyContent: "center", minHeight: 52,
  },
  primary: { backgroundColor: C.brand },
  secondary: { backgroundColor: C.brandSoft, borderWidth: 1, borderColor: "#d6ddff" },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  busy: { opacity: 0.75 },
  btnLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },
  btnLabelPrimary: { color: C.onBrand },
  btnLabelQuiet: { color: C.brand },

  card: { padding: S.lg },
  cardPressed: { backgroundColor: C.raised },

  chip: {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.pill, alignSelf: "flex-start",
  },
  chipOn: { backgroundColor: C.brand },
  chipOff: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  chipText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  chipTextOn: { color: C.onBrand },
  chipTextOff: { color: C.body },

  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },

  empty: { alignItems: "center", paddingHorizontal: S.xxl, paddingVertical: S.xxxl },
  emptyIconWrap: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: C.brandSoft,
    alignItems: "center", justifyContent: "center", marginBottom: S.lg,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { ...F.heading, textAlign: "center" },
  emptyBody: { ...F.body, textAlign: "center", marginTop: S.sm, color: C.muted },

  meterTrack: {
    height: 8, backgroundColor: C.line, borderRadius: R.pill, overflow: "hidden",
  },
  meterFill: { height: 8, borderRadius: R.pill },
});
