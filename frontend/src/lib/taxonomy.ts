/**
 * Civic damage taxonomy — mirrors backend/ai-service/taxonomy.py.
 *
 * Three civic categories, five damage classes. A complaint's department, SLA
 * and severity weighting are all derived from the detected class, so the
 * model's prediction is what routes the complaint — no manual dropdown.
 *
 * Only classes the trained model can actually detect are declared. Types with
 * no training data (electrical faults, waterlogging, pipe leaks, signage,
 * railings, debris, transverse cracking, footpaths) were removed: declaring a class the
 * detector can never return advertises a capability that does not exist.
 *
 * Keep this in sync with taxonomy.py (same labels, same categories).
 */

export type CategoryKey = "ROADS" | "WASTE" | "WATER";

export const CATEGORIES: Record<CategoryKey, { label: string; dept: string; deptName: string; sla: number }> = {
  ROADS:  { label: "Roads",            dept: "RDS", deptName: "Roads & Infrastructure", sla: 48 },
  WASTE:  { label: "Waste",            dept: "SAN", deptName: "Sanitation",             sla: 24 },
  WATER:  { label: "Water",            dept: "WTR", deptName: "Water Supply",           sla: 24 },
};

export const CLASSES: Record<string, { category: CategoryKey; weight: number }> = {
  // Roads
  "Pothole":            { category: "ROADS", weight: 1.0 },
  "Alligator Crack":    { category: "ROADS", weight: 0.85 },
  // Waste
  "Garbage Pile":       { category: "WASTE", weight: 0.5 },
  "Overflowing Bin":    { category: "WASTE", weight: 0.45 },
  // Water
  "Open Manhole":       { category: "WATER", weight: 1.0 },
  "Closed Manhole":     { category: "WATER", weight: 0.05 },
};

export const ALL_CLASSES = Object.keys(CLASSES);
export const ALL_CATEGORIES = Object.keys(CATEGORIES) as CategoryKey[];

export function categoryOf(label: string): CategoryKey | null {
  return CLASSES[label]?.category ?? null;
}

/** Department code the complaint should be routed to, from the detected class. */
export function departmentCodeOf(label: string): string | null {
  const cat = categoryOf(label);
  return cat ? CATEGORIES[cat].dept : null;
}

export function slaHoursOf(label: string): number | null {
  const cat = categoryOf(label);
  return cat ? CATEGORIES[cat].sla : null;
}

export function classesInCategory(cat: CategoryKey): string[] {
  return ALL_CLASSES.filter((c) => CLASSES[c].category === cat);
}
