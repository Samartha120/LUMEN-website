import { haversineMeters } from "./geo.js";
import { categoryOf, type CategoryKey } from "./taxonomy.js";

type Location = { lat: number; lng: number };

export type PriorityResult = {
  score: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: {
    severity: number;
    confidence: number;
    locationRisk: number;
    duplicateReports: number;
    departmentRisk: number;
    ageHours: number;
    nearbyLandmarks: string[];
  };
};

// These demo locations make the rule explainable and can be replaced with a
// municipal GIS feed without changing the scoring contract.
const SENSITIVE_LOCATIONS: Array<Location & { name: string; risk: number }> = [
  { name: "Hospital", lat: 12.9719, lng: 77.5937, risk: 12 },
  { name: "School", lat: 12.9352, lng: 77.6245, risk: 9 },
  { name: "Major highway", lat: 12.9570, lng: 77.6390, risk: 10 },
];

const DEPARTMENT_RISK: Record<CategoryKey, number> = {
  ROADS: 4, WASTE: 2, WATER: 8,
};

export function calculatePriority(input: {
  severityScore: number;
  confidence: number;
  categoryLabel: string;
  lat: number;
  lng: number;
  nearbyReports: number;
  createdAt?: Date;
}): PriorityResult {
  const nearby = SENSITIVE_LOCATIONS.filter((place) => haversineMeters(input.lat, input.lng, place.lat, place.lng) <= 500);
  const locationRisk = Math.min(18, nearby.reduce((sum, place) => sum + place.risk, 0));
  const category = categoryOf(input.categoryLabel);
  const departmentRisk = category ? DEPARTMENT_RISK[category] : 0;
  const ageHours = input.createdAt ? Math.max(0, (Date.now() - input.createdAt.getTime()) / 3_600_000) : 0;
  const ageRisk = Math.min(10, Math.floor(ageHours / 24) * 2);
  const duplicateRisk = Math.min(12, input.nearbyReports * 3);
  const score = Math.round(Math.min(100,
    input.severityScore * 0.5 + input.confidence * 10 + locationRisk + departmentRisk + duplicateRisk + ageRisk,
  ));
  const priority = score >= 75 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
  return {
    score,
    priority,
    factors: {
      severity: Math.round(input.severityScore), confidence: Math.round(input.confidence * 100),
      locationRisk, duplicateReports: input.nearbyReports, departmentRisk,
      ageHours: Math.round(ageHours), nearbyLandmarks: nearby.map((place) => place.name),
    },
  };
}
