/** One palette, matching the web app's navy so the two read as one product. */
export const T = {
  navy: "#1e2a78",
  navyDark: "#161f5c",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  bg: "#f7f8fc",
  card: "#ffffff",
  accent: "#2563eb",
  ok: "#059669",
  warn: "#d97706",
  bad: "#dc2626",
};

/** Colour for a severity band, matching the supervisor console. */
export function priorityColour(priority?: string | null) {
  switch ((priority ?? "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return T.bad;
    case "MEDIUM":
      return T.warn;
    default:
      return T.ok;
  }
}

export function statusLabel(status?: string | null) {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
