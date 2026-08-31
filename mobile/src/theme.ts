import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * One design system, so screens compose from tokens instead of inventing
 * numbers. Everything below is deliberately small: a handful of greys, one
 * accent, one spacing rhythm. A civic tool is read quickly, often outdoors,
 * frequently by someone who is annoyed — legibility beats decoration.
 */

// A single neutral ramp. Named by weight so intent survives a palette change:
// ink is what you read, muted is what you glance at, line is what separates.
const grey = {
  50: "#f6f7fb",
  100: "#eef0f6",
  200: "#e3e6ef",
  300: "#cbd2e0",
  500: "#7b869c",
  700: "#414b60",
  900: "#131a2a",
};

export const C = {
  brand: "#1e2a78",
  brandDeep: "#141c56",
  brandSoft: "#eef1ff",
  accent: "#2f5fe0",

  bg: grey[50],
  surface: "#ffffff",
  raised: grey[100],
  line: grey[200],
  lineStrong: grey[300],

  ink: grey[900],
  body: grey[700],
  muted: grey[500],
  onBrand: "#ffffff",

  ok: "#0f7a52",
  okSoft: "#e6f5ee",
  warn: "#a35a06",
  warnSoft: "#fdf1e3",
  bad: "#b3261e",
  badSoft: "#fdeceb",
};

/** 4-point rhythm. Every margin and pad in the app comes from here. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const R = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/**
 * Type scale. Line heights are set explicitly rather than left to the platform,
 * because Android and iOS disagree and a civic form should not reflow between
 * them.
 */
export const F: Record<string, TextStyle> = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.5, color: C.ink },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.3, color: C.ink },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: C.ink },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400", color: C.body },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600", color: C.ink },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: C.muted },
  overline: {
    fontSize: 11, lineHeight: 14, fontWeight: "800",
    letterSpacing: 1.1, textTransform: "uppercase", color: C.muted,
  },
  mono: {
    fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 0.6,
    color: C.accent, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
};

/**
 * Two elevations only. Shadows are the easiest way to make an interface look
 * cheap, so they stay faint and are used to say "this sits above the page",
 * never for emphasis.
 */
export const E: Record<"card" | "raised", ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: "#0b1220", shadowOpacity: 0.05,
      shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 1 },
    default: {},
  })!,
  raised: Platform.select({
    ios: {
      shadowColor: "#0b1220", shadowOpacity: 0.1,
      shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    default: {},
  })!,
};

export const card: ViewStyle = {
  backgroundColor: C.surface,
  borderRadius: R.lg,
  borderWidth: 1,
  borderColor: C.line,
  ...E.card,
};

/** Foreground/background pair for a status, so chips are legible either way. */
export function tone(priority?: string | null) {
  switch ((priority ?? "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return { fg: C.bad, bg: C.badSoft };
    case "MEDIUM":
      return { fg: C.warn, bg: C.warnSoft };
    default:
      return { fg: C.ok, bg: C.okSoft };
  }
}

export function statusLabel(status?: string | null) {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** "3 days ago" reads better than a timestamp on a report you filed yourself. */
export function ago(iso?: string | null) {
  if (!iso) return "";
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Kept so existing imports keep working while screens migrate to C/S/F.
export const T = {
  navy: C.brand, navyDark: C.brandDeep, ink: C.ink, body: C.body,
  muted: C.muted, line: C.line, bg: C.bg, card: C.surface,
  accent: C.accent, ok: C.ok, warn: C.warn, bad: C.bad,
};
export const priorityColour = (p?: string | null) => tone(p).fg;
