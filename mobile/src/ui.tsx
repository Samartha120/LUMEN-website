import { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle,
} from "react-native";
import { C, S, R, F, E, card, tone, STAGES, stageOf } from "./theme";
import { Icon, IconName } from "./Icon";

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
  variant?: "primary" | "secondary" | "ghost" | "dark";
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
        <ActivityIndicator color={variant === "dark" ? "#fff" : C.ink} />
      ) : (
        <Text style={[
          u.btnLabel,
          variant === "dark" ? u.btnLabelOnDark : u.btnLabelPrimary,
        ]}>
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

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={u.empty}>
      <View style={u.emptyIconWrap}><Icon name={icon} size={26} color={C.ink} /></View>
      <Text style={u.emptyTitle}>{title}</Text>
      <Text style={u.emptyBody}>{body}</Text>
    </View>
  );
}



/**
 * A coloured square, then a line of text — the row the reference repeats down
 * its home screen. The square carries the colour so the card never has to, and
 * the text sits on white where it is always legible.
 */
export function TileRow({ icon, tint, title, value, onPress }: {
  icon: IconName;
  tint: "brand" | "coral" | "dark" | "accent" | "sky";
  title: string;
  value?: string;
  onPress?: () => void;
}) {
  const fills = {
    brand: C.brand, coral: C.coral, dark: C.dark, accent: C.accent, sky: C.sky,
  } as const;
  const onFill = tint === "brand" ? C.ink : "#fff";
  const body = (
    <View style={u.tileRow}>
      <View style={[u.tile, { backgroundColor: fills[tint] }]}>
        <Icon name={icon} size={20} color={onFill} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={u.tileTitle} numberOfLines={2}>{title}</Text>
        {value ? <Text style={u.tileValue}>{value}</Text> : null}
      </View>
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>{body}</Pressable>
    : body;
}

/** A number that matters, on black, with its unit under it. */
export function BigStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <View style={u.bigRow}>
      <View style={u.bigBox}>
        <Text style={u.bigValue}>{value}</Text>
        {unit ? <Text style={u.bigUnit}>{unit}</Text> : null}
      </View>
      <Text style={u.bigLabel}>{label}</Text>
    </View>
  );
}

/**
 * The dark card at the top of a report.
 *
 * Everything else on the screen is a form or a list — white, quiet, waiting for
 * input. This is the one surface where the app talks back, so it is inverted:
 * the reporter's eye lands on the answer to the only question they came with,
 * which is what is happening to my report.
 */
export function StatusCard({ ref_, title, status, priority, onPress }: {
  ref_: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  onPress?: () => void;
}) {
  const t = tone(priority);
  const body = (
    <View style={u.statusCard}>
      <View style={u.statusTop}>
        <Text style={u.statusRef}>{ref_}</Text>
        {priority ? (
          <View style={[u.statusPill, { backgroundColor: t.fg }]}>
            <Text style={u.statusPillText}>{priority.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>
      <Text style={u.statusTitle} numberOfLines={2}>{title}</Text>
      <Tracker stage={stageOf(status)} />
    </View>
  );
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.92 }}>{body}</Pressable>
    : body;
}

/** Filed → In progress → Resolved, drawn on the dark card. */
export function Tracker({ stage }: { stage: number }) {
  return (
    <View style={u.tracker}>
      <View style={u.trackRail}>
        {STAGES.map((_, i) => (
          <View key={i} style={u.trackSeg}>
            <View style={[u.dot, i <= stage && u.dotOn, i === stage && u.dotNow]} />
            {i < STAGES.length - 1 && (
              <View style={[u.bar, i < stage && u.barOn]} />
            )}
          </View>
        ))}
      </View>
      <View style={u.trackLabels}>
        {STAGES.map((label, i) => (
          <Text key={label} style={[
            u.trackLabel,
            i === 0 && { textAlign: "left" },
            i === STAGES.length - 1 && { textAlign: "right" },
            i <= stage && u.trackLabelOn,
          ]}>
            {label}
          </Text>
        ))}
      </View>
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
  dark: { backgroundColor: C.dark },
  secondary: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.lineStrong },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  busy: { opacity: 0.75 },
  btnLabel: { fontSize: 16, fontWeight: "700", letterSpacing: 0.1 },
  btnLabelPrimary: { color: C.ink },
  btnLabelOnDark: { color: "#fff" },

  card: { padding: S.lg },
  cardPressed: { backgroundColor: C.raised },

  chip: {
    paddingHorizontal: S.md, paddingVertical: 6,
    borderRadius: R.pill, alignSelf: "flex-start",
  },
  chipOn: { backgroundColor: C.dark },
  chipOff: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.lineStrong },
  chipText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  chipTextOn: { color: "#fff" },
  chipTextOff: { color: C.body },

  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },

  empty: { alignItems: "center", paddingHorizontal: S.xxl, paddingVertical: S.xxxl },
  emptyIconWrap: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: C.brand,
    alignItems: "center", justifyContent: "center", marginBottom: S.lg,
  },
  emptyTitle: { ...F.heading, textAlign: "center" },
  emptyBody: { ...F.body, textAlign: "center", marginTop: S.sm, color: C.muted },



  tileRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderRadius: R.lg, padding: S.md, gap: S.md,
    borderWidth: 1, borderColor: C.line, ...E.card,
  },
  tile: {
    width: 46, height: 46, borderRadius: R.md,
    alignItems: "center", justifyContent: "center",
  },
  tileTitle: { ...F.caption, color: C.body },
  tileValue: { ...F.heading, marginTop: 1 },

  bigRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: C.surface,
    borderRadius: R.lg, padding: S.md, gap: S.lg,
    borderWidth: 1, borderColor: C.line, ...E.card,
  },
  bigBox: {
    backgroundColor: C.dark, borderRadius: R.md, paddingVertical: S.md,
    paddingHorizontal: S.lg, alignItems: "center", minWidth: 74,
  },
  bigValue: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  bigUnit: { color: C.onDarkMuted, fontSize: 11, fontWeight: "600", marginTop: -2 },
  bigLabel: { ...F.bodyStrong, flex: 1 },

  statusCard: {
    backgroundColor: C.dark, borderRadius: R.xl, padding: S.xl,
    ...E.raised,
  },
  statusTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusRef: {
    color: C.onDarkMuted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8,
  },
  statusPill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.sm },
  statusPillText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statusTitle: {
    color: C.onDark, fontSize: 19, lineHeight: 25, fontWeight: "800",
    marginTop: S.md, letterSpacing: -0.3,
  },

  tracker: { marginTop: S.xl },
  trackRail: { flexDirection: "row", alignItems: "center" },
  trackSeg: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3d3d3d" },
  dotOn: { backgroundColor: C.brand },
  dotNow: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 4, borderColor: "#fff",
    backgroundColor: C.brand,
  },
  bar: { flex: 1, height: 2, backgroundColor: "#3d3d3d", marginHorizontal: 4 },
  barOn: { backgroundColor: C.brand },
  trackLabels: { flexDirection: "row", marginTop: S.md },
  trackLabel: {
    flex: 1, color: C.onDarkMuted, fontSize: 11, fontWeight: "600", textAlign: "center",
  },
  trackLabelOn: { color: C.onDark, fontWeight: "700" },

  meterTrack: {
    height: 8, backgroundColor: C.line, borderRadius: R.pill, overflow: "hidden",
  },
  meterFill: { height: 8, borderRadius: R.pill },
});
