/**
 * Turning numbers and strings into something a person reads.
 *
 * Kept apart from the components so the rules can be tested without rendering
 * anything, and so two screens cannot round the same figure differently.
 */

/** 1200 -> "1.2k". Used where a count has to fit in a chip. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${(n / 1000).toFixed(abs < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Indian rupees, grouped the Indian way: 12,34,567 rather than 1,234,567. */
export function rupees(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  const whole = Math.round(Math.abs(n)).toString();
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `${n < 0 ? "-" : ""}₹${grouped}`;
}

/** Metres below a kilometre, kilometres above it. */
export function distance(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return "—";
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

/** "1 report" / "2 reports", without a library. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cuts to a length without leaving a word half-finished. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/** Title Case from A_CONSTANT_LIKE_THIS. */
export function humanise(value?: string | null): string {
  if (!value) return "";
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
