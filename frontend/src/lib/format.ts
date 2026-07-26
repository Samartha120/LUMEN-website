export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)} Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function ageOf(d: Date | string): string {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 3600000));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

// SLA status per Part 8: Green on-track, Amber within 20% of deadline, Red breached.
export function slaStatus(createdAt: Date | string, slaHours: number, closedAt?: Date | string | null): "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" {
  const start = new Date(createdAt).getTime();
  const deadline = start + slaHours * 3600000;
  const ref = closedAt ? new Date(closedAt).getTime() : Date.now();
  if (closedAt) return ref <= deadline ? "MET" : "BREACHED";
  if (ref > deadline) return "BREACHED";
  if (ref > deadline - slaHours * 3600000 * 0.2) return "AT_RISK";
  return "ON_TRACK";
}
