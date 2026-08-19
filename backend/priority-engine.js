/**
 * Smart Complaint Prioritization Engine - IMPROVED v3
 *
 * DIRECT SUM FORMULA (each component already in correct weighted range):
 * priorityScore =
 *   categoryScore   (0-25)   Damage category severity: 25%
 * + confidenceScore (0-15)   YOLO confidence:          15%
 * + duplicateScore  (0-15)   Duplicate complaints:     15%
 * + locationScore   (0-20)   Location risk:            20%
 * + ageScore        (0-10)   Complaint age:            10%
 * + departmentScore (0-15)   Department rules:         15%
 *                       = 100 points maximum
 *
 * Priority Levels:
 *   0-24    LOW
 *  25-49    MEDIUM
 *  50-74    HIGH
 *  75-100   CRITICAL
 *
 * Returns:
 * {
 *   priorityScore: number,
 *   priorityLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
 *   priorityReasons: string[],
 *   factors: {
 *     categoryScore, confidenceScore, duplicateScore,
 *     locationScore, ageScore, departmentScore
 *   },
 *   duplicateCount: number,
 *   nearbyLocations: string[]
 * }
 */

// Important location coordinates (lat, lng) with radii in meters
const IMPORTANT_LOCATIONS = [
  { name: 'Hospital',        lat: 12.9637, lng: 77.5961, radius: 1000, weight: 3 },
  { name: 'School',          lat: 12.9691, lng: 77.5993, radius: 800,  weight: 2 },
  { name: 'Highway Junction',lat: 12.9720, lng: 77.5946, radius: 600,  weight: 2.5 },
  { name: 'Emergency Route', lat: 12.9650, lng: 77.6050, radius: 700,  weight: 2 },
  { name: 'Government Office', lat: 12.9676, lng: 77.5938, radius: 500, weight: 1.5 },
];

// Damage class severity weights (maps to 0-25 categoryScore)
const DAMAGE_CLASS_WEIGHTS = {
  'Pothole':            { severity: 23, label: 'Severe pothole' },
  'Alligator Crack':    { severity: 25, label: 'Severe alligator cracking' },
  'Transverse Crack':   { severity: 19, label: 'Transverse road crack' },
  'Longitudinal Crack': { severity: 17, label: 'Longitudinal road crack' },
  'Pavement Distress':  { severity: 13, label: 'Pavement surface distress' },
  'Road Crack':         { severity: 15, label: 'Road surface crack' },
  'Drainage Blockage':  { severity: 21, label: 'Drainage blockage' },
  'Traffic Light Fault':{ severity: 22, label: 'Traffic signal failure' },
  'Unknown':            { severity: 10, label: 'Unclassified damage' },
};

// Department-specific rules (maps to 0-15 departmentScore)
const DEPARTMENT_RULES = {
  'Road Maintenance': {
    baseScore: 8,
    peakScore: 11,
    label: 'Road maintenance response',
    peakHours: [6, 7, 8, 17, 18, 19],
  },
  'Traffic Control': {
    baseScore: 11,
    peakScore: 15,
    label: 'Traffic priority response',
    peakHours: [6, 7, 8, 9, 17, 18, 19, 20],
  },
  'Drainage': {
    baseScore: 10,
    peakScore: 14,
    label: 'Drainage urgency rule',
    peakHours: [7, 8, 9, 17, 18, 19, 20, 21],
  },
  'Public Works': {
    baseScore: 7,
    peakScore: 10,
    label: 'Public works priority',
    peakHours: [8, 9, 10, 16, 17, 18],
  },
};

const DEFAULT_DEPT_RULE = { baseScore: 5, peakScore: 7, label: 'Standard department rule', peakHours: [] };

// Priority level boundaries
const LEVELS = [
  { min: 75, level: 'CRITICAL' },
  { min: 50, level: 'HIGH' },
  { min: 25, level: 'MEDIUM' },
  { min: 0,  level: 'LOW' },
];

/** Haversine distance in meters between two WGS-84 points */
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (typeof lat1 !== 'number' || typeof lng1 !== 'number' ||
      typeof lat2 !== 'number' || typeof lng2 !== 'number' ||
      Number.isNaN(lat1) || Number.isNaN(lng1) ||
      Number.isNaN(lat2) || Number.isNaN(lng2)) {
    return Infinity;
  }
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * IMPROVEMENT 4: LOCATION RISK ANALYSIS
 * Returns 0-20 points + list of matched important locations for reasons
 * Safe if GPS missing (lat/lng invalid) → returns 0 + empty list, no failure
 */
export function scoreLocationProximity(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      Number.isNaN(lat) || Number.isNaN(lng)) {
    return { score: 0, nearbyLocations: [] };
  }

  let score = 0;
  const nearbyLocations = [];
  for (const location of IMPORTANT_LOCATIONS) {
    const distance = calculateDistance(lat, lng, location.lat, location.lng);
    if (distance <= location.radius) {
      score += location.weight * 2.5;
      nearbyLocations.push(location.name);
    } else if (distance <= location.radius * 2) {
      score += location.weight * 1.25;
    }
  }
  return { score: Math.min(20, score), nearbyLocations };
}

/**
 * IMPROVEMENT 1: AI CONFIDENCE scoring (0-15 pts, 15% weight)
 * High confidence ALONE should NOT make CRITICAL (max 15/100 contribution)
 */
export function scoreAiConfidence(confidence) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 0;
  if (confidence < 0.3) return 0;
  if (confidence < 0.5) return 3;
  if (confidence < 0.7) return 7;
  if (confidence < 0.85) return 11;
  if (confidence < 0.95) return 13;
  return 15;
}

/**
 * IMPROVEMENT 1: DAMAGE CATEGORY scoring (0-25 pts, 25% weight)
 * Primary driver of priority
 */
export function scoreDamageCategory(category) {
  const key = String(category ?? 'Unknown');
  const meta = DAMAGE_CLASS_WEIGHTS[key] ?? DAMAGE_CLASS_WEIGHTS['Unknown'];
  return Math.min(25, Math.max(0, meta.severity));
}

export function getDamageLabel(category) {
  const key = String(category ?? 'Unknown');
  return (DAMAGE_CLASS_WEIGHTS[key] ?? DAMAGE_CLASS_WEIGHTS['Unknown']).label;
}

/**
 * IMPROVEMENT 5: COMPLAINT AGE scoring (0-10 pts, 10% weight)
 * Bucket rules requested:
 *   0-1 days:  low score   (0-2 pts)
 *   2-3 days:  medium score (4-6 pts)
 *   4-7 days:  high score   (8 pts)
 *   7+ days:   maximum score (10 pts)
 *
 * ONLY unresolved complaints receive age score — caller should pass
 * status='CLOSED'/'REJECTED' and calculatePriority skips entirely.
 */
export function scoreComplaintAge(createdAt) {
  if (!createdAt) return 0;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;
  const now = new Date();
  const ageMs = now - created;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 0;
  if (ageDays <= 1) return Math.min(2, Math.round(ageDays * 2));
  if (ageDays < 3) return 4;
  if (ageDays <= 7) return 8;
  return 10;
}

/**
 * IMPROVEMENT 3: DUPLICATE COUNT scoring (0-15 pts, 15% weight)
 * Exact rules requested:
 *   0 duplicates:   0 pts
 *   1 duplicate:    5 pts
 *   2-4 duplicates: 10 pts
 *   5+ duplicates:  15 pts
 */
export function scoreDuplicateCount(duplicateCount) {
  const n = typeof duplicateCount === 'number' && !Number.isNaN(duplicateCount)
    ? Math.max(0, Math.floor(duplicateCount))
    : 0;
  if (n === 0) return 0;
  if (n === 1) return 5;
  if (n <= 4) return 10;
  return 15;
}

/**
 * IMPROVEMENT 6: DEPARTMENT RULE ENGINE (0-15 pts, 15% weight)
 * Centralized. No fake departments. Supports Road, Traffic, Drainage, Public Works.
 */
export function scoreDepartmentRules(department, createdAt) {
  const key = String(department ?? 'Road Maintenance');
  const rules = DEPARTMENT_RULES[key] ?? DEFAULT_DEPT_RULE;
  let hour = -1;
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) hour = d.getHours();
  }
  const isPeak = hour >= 0 && rules.peakHours.includes(hour);
  return Math.min(15, Math.max(0, isPeak ? rules.peakScore : rules.baseScore));
}

export function getDepartmentLabel(department, createdAt) {
  const key = String(department ?? 'Road Maintenance');
  const rules = DEPARTMENT_RULES[key] ?? DEFAULT_DEPT_RULE;
  let hour = -1;
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) hour = d.getHours();
  }
  const isPeak = hour >= 0 && rules.peakHours.includes(hour);
  return { label: rules.label, isPeak };
}

/**
 * IMPROVEMENT 2: DYNAMIC PRIORITY REASONS
 * Generated directly from the actual factor values — nothing hardcoded.
 * Each reason references the specific underlying data: damage label,
 * exact AI confidence %, exact duplicate count, which hospital/school was
 * near, exact complaint age in days, and department rule.
 */
export function generatePriorityReasons(factors, context) {
  const reasons = [];
  const {
    category, aiConfidence, duplicateCount, department,
    createdAt, nearbyLocations,
  } = context;

  // 1. Category severity reason — use the damage label
  if (factors.categoryScore >= 20) {
    reasons.push(`Severe damage detected: ${getDamageLabel(category)}`);
  } else if (factors.categoryScore >= 14) {
    reasons.push(`Significant damage: ${getDamageLabel(category)}`);
  } else if (factors.categoryScore >= 8) {
    reasons.push(`Moderate damage: ${getDamageLabel(category)}`);
  }

  // 2. AI confidence reason — exact percentage (no lie)
  if (typeof aiConfidence === 'number' && !Number.isNaN(aiConfidence)) {
    const pct = Math.round(aiConfidence * 100);
    if (factors.confidenceScore >= 12) {
      reasons.push(`High AI detection confidence: ${pct}%`);
    } else if (factors.confidenceScore >= 7) {
      reasons.push(`AI detection confidence: ${pct}%`);
    } else if (factors.confidenceScore > 0) {
      reasons.push(`Low AI confidence: ${pct}% (manual triage recommended)`);
    }
  }

  // 3. Duplicate reasons — EXACT count from duplicate detection
  if (typeof duplicateCount === 'number' && duplicateCount > 0) {
    if (duplicateCount >= 5) {
      reasons.push(`Critical: ${duplicateCount} duplicate complaints filed — widespread community issue`);
    } else if (duplicateCount >= 2) {
      reasons.push(`${duplicateCount} duplicate complaints found in the area`);
    } else {
      reasons.push(`1 duplicate complaint found nearby`);
    }
  }

  // 4. Location risk — NAMES of near hospital / school / etc.
  if (nearbyLocations && nearbyLocations.length > 0) {
    const locs = nearbyLocations.join(', ');
    if (factors.locationScore >= 15) {
      reasons.push(`Critical location: near ${locs} — safety hazard`);
    } else if (factors.locationScore >= 8) {
      reasons.push(`Near important location: ${locs}`);
    } else {
      reasons.push(`Proximity to ${locs}`);
    }
  }

  // 5. Complaint age — exact days, only if score > 0
  if (factors.ageScore > 0 && createdAt) {
    const created = new Date(createdAt);
    if (!Number.isNaN(created.getTime())) {
      const ageDays = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays >= 7) {
        reasons.push(`Unresolved complaint for ${ageDays}+ days — urgent action required`);
      } else if (ageDays >= 4) {
        reasons.push(`Complaint unresolved for ${ageDays} days`);
      } else if (ageDays >= 2) {
        reasons.push(`Complaint open for ${ageDays} days`);
      } else if (ageDays >= 1) {
        reasons.push(`Complaint open for over 24 hours`);
      }
    }
  }

  // 6. Department rules
  if (factors.departmentScore >= 11) {
    const { label, isPeak } = getDepartmentLabel(department, createdAt);
    if (isPeak) {
      reasons.push(`${label}: peak hours — expedited response`);
    } else {
      reasons.push(`${label}`);
    }
  } else if (factors.departmentScore >= 8) {
    const { label } = getDepartmentLabel(department, createdAt);
    reasons.push(`${label}`);
  }

  // Fallback only if nothing generated
  if (reasons.length === 0) {
    reasons.push('Standard maintenance queue');
  }

  return reasons;
}

/**
 * Count duplicates nearby a complaint (within 500m radius, same category match optional).
 * Returns numeric duplicateCount — safe if complaint lat/lng missing (0 duplicates).
 */
export function countNearbyDuplicates(complaint, allComplaints) {
  const lat = complaint.lat;
  const lng = complaint.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      Number.isNaN(lat) || Number.isNaN(lng)) {
    return 0;
  }
  const list = Array.isArray(allComplaints) ? allComplaints : [];
  let count = 0;
  for (const c of list) {
    if (!c || c.id === complaint.id) continue;
    const d = calculateDistance(lat, lng, c.lat, c.lng);
    if (d <= 500) count++;
  }
  return count;
}

function mapScoreToLevel(score) {
  const s = Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  for (const l of LEVELS) if (s >= l.min) return { score: s, level: l.level };
  return { score: 0, level: 'LOW' };
}

/**
 * MAIN calculatePriority entry-point — IMPROVED with correct direct-sum formula.
 * Returns:
 * {
 *   score, level, reasons,
 *   factors: { categoryScore, confidenceScore, duplicateScore,
 *              locationScore, ageScore, departmentScore },
 *   duplicateCount, nearbyLocations
 * }
 */
export function calculatePriority(complaint, allComplaints = []) {
  const c = complaint ?? {};
  const status = String(c.status ?? 'SUBMITTED').toUpperCase();

  // Closed / rejected → zero priority (no aging either, they're done)
  if (status === 'CLOSED' || status === 'REJECTED') {
    return {
      score: 0,
      level: 'LOW',
      reasons: ['Complaint already closed or rejected'],
      factors: {
        categoryScore: 0, confidenceScore: 0, duplicateScore: 0,
        locationScore: 0, ageScore: 0, departmentScore: 0,
      },
      duplicateCount: 0,
      nearbyLocations: [],
    };
  }

  const aiConfidence = typeof c.aiConfidence === 'number' ? c.aiConfidence : NaN;
  const category = c.category;
  const createdAt = c.createdAt;
  const lat = c.lat;
  const lng = c.lng;
  const department = c.department?.name ?? c.department ?? 'Road Maintenance';

  // IMPROVEMENT 4: Location risk (safe with missing lat/lng)
  const { score: locationScore, nearbyLocations } = scoreLocationProximity(lat, lng);

  // IMPROVEMENT 3: Duplicate count - reuse existing detection results
  const duplicateCount = countNearbyDuplicates(
    { id: c.id, lat, lng, category },
    allComplaints
  );

  // Individual components (each in their own weighted 0-XX range)
  const categoryScore   = scoreDamageCategory(category);
  const confidenceScore = scoreAiConfidence(aiConfidence);
  const ageScore        = scoreComplaintAge(createdAt);
  const duplicateScore  = scoreDuplicateCount(duplicateCount);
  const departmentScore = scoreDepartmentRules(department, createdAt);

  // IMPROVEMENT 1: DIRECT SUM — each component is already in the
  // percentage of its weight. No multiplication required.
  //   categoryScore   0-25  = 25%
  //   confidenceScore 0-15  = 15%
  //   duplicateScore  0-15  = 15%
  //   locationScore   0-20  = 20%
  //   ageScore        0-10  = 10%
  //   departmentScore 0-15  = 15%
  //                 SUM  = 100 maximum
  const rawScore =
    categoryScore +
    confidenceScore +
    duplicateScore +
    locationScore +
    ageScore +
    departmentScore;

  const { score: finalScore, level } = mapScoreToLevel(rawScore);

  const factors = {
    categoryScore:   Math.round(categoryScore   * 10) / 10,
    confidenceScore: Math.round(confidenceScore * 10) / 10,
    duplicateScore:  Math.round(duplicateScore  * 10) / 10,
    locationScore:   Math.round(locationScore   * 10) / 10,
    ageScore:        Math.round(ageScore        * 10) / 10,
    departmentScore: Math.round(departmentScore * 10) / 10,
  };

  const reasons = generatePriorityReasons(factors, {
    category, aiConfidence, duplicateCount, department, createdAt, nearbyLocations,
  });

  return {
    score: finalScore,
    level,
    reasons,
    factors,
    duplicateCount,
    nearbyLocations,
  };
}

/**
 * Recalculate priority for every complaint.
 * Updates objects with priorityScore, priorityLevel, priorityReasons,
 * priorityFactors, duplicateCount.
 */
export function recalculateAllPriorities(complaints) {
  const list = Array.isArray(complaints) ? complaints : [];
  return list.map(c => {
    const p = calculatePriority(c, list);
    return {
      ...c,
      priorityScore:   p.score,
      priorityLevel:   p.level,
      priorityReasons: p.reasons,
      priorityFactors: p.factors,
      duplicateCount:  p.duplicateCount,
    };
  });
}

/**
 * Sort complaints by priority DESC.
 *   1) Level: CRITICAL > HIGH > MEDIUM > LOW
 *   2) Same level: higher score FIRST
 *   3) Same score: older complaint FIRST (the one waiting longer)
 */
export function sortByPriority(complaints) {
  const LEVEL_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  return [...complaints].sort((a, b) => {
    const la = LEVEL_ORDER[a.priorityLevel ?? 'LOW'] ?? 1;
    const lb = LEVEL_ORDER[b.priorityLevel ?? 'LOW'] ?? 1;
    if (la !== lb) return lb - la;

    const sa = a.priorityScore ?? 0;
    const sb = b.priorityScore ?? 0;
    if (Math.abs(sa - sb) > 0.001) return sb - sa;

    // Same level & score → older first
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    return ta - tb;
  });
}
