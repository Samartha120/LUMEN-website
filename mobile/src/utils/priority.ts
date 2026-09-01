/**
 * Priority scoring, risk assessment, and SLA calculation utilities.
 */

import { CivicCategory, CivicDamageClass, PriorityLevel } from '../types/civic.types';

const CLASS_SEVERITY_WEIGHTS: Record<CivicDamageClass, number> = {
  // Roads
  pothole: 65,
  longitudinal_crack: 30,
  transverse_crack: 30,
  alligator_crack: 45,
  // Electrical (Highest safety hazard)
  exposed_wire: 98,
  open_transformer: 95,
  damaged_pole: 80,
  broken_streetlight: 40,
  // Waste
  garbage_pile: 40,
  overflowing_bin: 35,
  debris: 30,
  // Water
  open_manhole: 96,
  waterlogging: 70,
  pipe_leak: 60,
  // Public property
  broken_footpath: 35,
  damaged_signage: 25,
  broken_railing: 55,
};

const DEPARTMENT_SLA_HOURS: Record<CivicCategory, number> = {
  electrical: 12,
  water: 24,
  roads: 48,
  waste: 24,
  public_property: 72,
};

export interface PriorityCalculationInput {
  damageClass: CivicDamageClass;
  aiConfidence: number; // 0.0 - 1.0
  nearbyComplaintsCount?: number;
  isNearSensitiveZone?: boolean; // school, hospital, highway
  ageHours?: number;
  upvotesCount?: number;
}

/**
 * Calculate multi-factor explainable priority score (0 - 100)
 */
export function calculatePriorityScore(input: PriorityCalculationInput): {
  score: number;
  priorityLevel: PriorityLevel;
  breakdown: {
    baseClassWeight: number;
    aiConfidenceMultiplier: number;
    sensitiveZoneBonus: number;
    densityBonus: number;
    communityUpvoteBonus: number;
    agingBonus: number;
  };
} {
  const baseClassWeight = CLASS_SEVERITY_WEIGHTS[input.damageClass] || 50;
  const aiConfidenceMultiplier = 0.8 + input.aiConfidence * 0.2; // 0.8 - 1.0

  let sensitiveZoneBonus = 0;
  if (input.isNearSensitiveZone) {
    sensitiveZoneBonus = 15;
  }

  let densityBonus = 0;
  if (input.nearbyComplaintsCount && input.nearbyComplaintsCount > 0) {
    densityBonus = Math.min(15, input.nearbyComplaintsCount * 3);
  }

  let communityUpvoteBonus = 0;
  if (input.upvotesCount && input.upvotesCount > 0) {
    communityUpvoteBonus = Math.min(10, Math.floor(input.upvotesCount / 5));
  }

  let agingBonus = 0;
  if (input.ageHours && input.ageHours > 0) {
    agingBonus = Math.min(15, Math.floor(input.ageHours / 6));
  }

  const rawScore =
    baseClassWeight * aiConfidenceMultiplier +
    sensitiveZoneBonus +
    densityBonus +
    communityUpvoteBonus +
    agingBonus;

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  let priorityLevel: PriorityLevel = 'LOW';
  if (score >= 90) {
    priorityLevel = 'EMERGENCY';
  } else if (score >= 75) {
    priorityLevel = 'CRITICAL';
  } else if (score >= 50) {
    priorityLevel = 'HIGH';
  } else if (score >= 30) {
    priorityLevel = 'MEDIUM';
  }

  return {
    score,
    priorityLevel,
    breakdown: {
      baseClassWeight,
      aiConfidenceMultiplier: Math.round(aiConfidenceMultiplier * 100) / 100,
      sensitiveZoneBonus,
      densityBonus,
      communityUpvoteBonus,
      agingBonus,
    },
  };
}

/**
 * Get standard SLA target hours for a category and priority
 */
export function getCategorySLAHours(category: CivicCategory, priority?: PriorityLevel): number {
  const base = DEPARTMENT_SLA_HOURS[category] || 48;
  if (priority === 'EMERGENCY') return Math.max(4, Math.round(base * 0.25));
  if (priority === 'CRITICAL') return Math.max(8, Math.round(base * 0.5));
  if (priority === 'HIGH') return Math.round(base * 0.75);
  return base;
}
