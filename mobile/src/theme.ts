import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * One design system, so screens compose from tokens instead of inventing
 * numbers. Everything below is deliberately small: a handful of greys, one
 * accent, one spacing rhythm. A civic tool is read quickly, often outdoors,
 * frequently by someone who is annoyed — legibility beats decoration.
 */

export const C = {
  // After the Mobi reference: warm cream ground, one strong yellow, and black
  // reserved for the thing you are meant to read first. Yellow can never carry
  // text, so it always appears as a fill with ink on top of it.
  brand: "#ffc93c",
  brandDeep: "#f0b21b",
  brandSoft: "#fff4d1",
  accent: "#7b61ff",
  accentSoft: "#efeaff",
  coral: "#ff5c5c",
  coralSoft: "#ffe9e9",
  sky: "#5bc0eb",
  skySoft: "#e4f5fd",

  // The emphasis surface. One per screen at most.
  dark: "#141414",
  darkSoft: "#2a2a2a",
  onDark: "#ffffff",
  onDarkMuted: "#a3a3a3",

  bg: "#fdfaf1",
  surface: "#ffffff",
  raised: "#f6f2e7",
  line: "#ece7da",
  lineStrong: "#dcd5c4",

  ink: "#141414",
  body: "#4a4a4a",
  muted: "#8c8779",
  onBrand: "#141414",

  ok: "#1f9d55",
  okSoft: "#e6f6ed",
  warn: "#c07d0a",
  warnSoft: "#fdf3df",
  bad: "#e23b3b",
  badSoft: "#ffe9e9",
};

/**
 * Where a report has got to, in the three steps a citizen cares about.
 *
 * The workflow has more states than this, and none of them mean anything to
 * the person who filed it. Filed, being worked on, done.
 */
export const STAGES = ["Filed", "In progress", "Resolved"] as const;

export function stageOf(status?: string | null): number {
  switch ((status ?? "").toUpperCase()) {
    case "RESOLVED":
    case "CLOSED":
    case "REJECTED":
      return 2;
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "PENDING_REVIEW":
      return 1;
    default:
      return 0;
  }
}

/** 4-point rhythm. Every margin and pad in the app comes from here. */
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const R = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 };

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
    color: C.muted, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
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
      shadowColor: "#3a3226", shadowOpacity: 0.05,
      shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 1 },
    default: {},
  })!,
  raised: Platform.select({
    ios: {
      shadowColor: "#3a3226", shadowOpacity: 0.09,
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
