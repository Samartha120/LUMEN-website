/**
 * Checks a form can make before the server has to.
 *
 * Deliberately permissive: the server is the authority, and a client-side rule
 * that is stricter than the server's rejects addresses and names that are
 * perfectly valid. These exist to catch the obvious mistake early, not to
 * define what is allowed.
 */

/** Not a full RFC check — those reject real addresses. Just a shape. */
export function isEmail(value: string): boolean {
  const v = value.trim();
  return v.length >= 5 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export function isStrongEnough(password: string): boolean {
  return password.length >= 8;
}

export function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
}

/** A report title the server will accept and a supervisor can read. */
export function titleProblem(title: string): string | null {
  const t = title.trim();
  if (!t) return "Please describe what you are reporting.";
  if (t.length < 5) return "Add a little more detail.";
  if (t.length > 160) return "That is too long for a title.";
  return null;
}

/** Coordinates that could plausibly be on Earth. */
export function isCoordinate(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)   // the null island a broken GPS reports
  );
}
