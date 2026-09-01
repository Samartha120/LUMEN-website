/**
 * Mathematical, statistical, and data interpolation helpers.
 */

/**
 * Clamp a number within minimum and maximum bounds
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Calculate arithmetic mean
 */
export function mean(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return sum / numbers.length;
}

/**
 * Calculate median
 */
export function median(numbers: number[]): number {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

/**
 * Normalize an array of numbers to sum to 1.0 (or 100%)
 */
export function normalizeDistribution(values: number[]): number[] {
  const sum = values.reduce((acc, v) => acc + v, 0);
  if (sum === 0) return values.map(() => 0);
  return values.map(v => Math.round((v / sum) * 100) / 100);
}

/**
 * Calculate simple moving average
 */
export function movingAverage(data: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const windowStart = Math.max(0, i - windowSize + 1);
    const subset = data.slice(windowStart, i + 1);
    result.push(Math.round(mean(subset) * 10) / 10);
  }
  return result;
}
