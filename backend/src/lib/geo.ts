/** Great-circle distance between two WGS-84 points, in metres (Haversine). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Small, deterministic word-overlap score for duplicate complaint text. */
export function textSimilarity(a: string, b: string): number {
  const words = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
  const left = words(a), right = words(b);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const word of left) if (right.has(word)) common++;
  return common / (left.size + right.size - common);
}
