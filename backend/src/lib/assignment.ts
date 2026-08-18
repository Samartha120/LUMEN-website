/**
 * Engineer assignment — Hungarian (Kuhn–Munkres) minimum-cost matching.
 *
 * Ported from Samartha's `backend/index.ts`. His cost model is kept as-is,
 * because the shape of it is sound:
 *
 *   cost = distance + skillPenalty + workloadPenalty − severityRebate
 *
 * with a prohibitive cost for any pairing that is not allowed at all. Two
 * things are adapted to this schema rather than copied literally:
 *
 *   Skill match — his version substring-matched free text ("road" in the
 *   category against "road" in the skills). Here `Engineer.skills` is an exact
 *   comma-separated list of damage classes from the taxonomy, and the
 *   complaint carries its detected class, so the two can be compared exactly.
 *   Substring matching on this data would be strictly worse: "Pothole" and
 *   "Open Manhole" both contain "hole".
 *
 *   Availability — his check was `status !== 'OFF_DUTY'`. Same here, using
 *   this schema's Engineer.status.
 *
 * Why Hungarian rather than assigning each complaint to its nearest engineer:
 * greedy is locally sensible and globally worse. The first complaint takes the
 * one engineer a later, closer complaint needed, and every subsequent choice
 * inherits that mistake. Hungarian solves the whole board at once in O(n³) and
 * is provably minimal. The greedy baseline is computed alongside and returned,
 * because that comparison is the entire justification for the algorithm.
 */
import computeMunkres from "munkres-js";
import { haversineMeters } from "./geo.js";

/** Pairing forbidden outright — wrong department, or engineer off duty. */
const FORBIDDEN = 1_000_000;
/** Added when the engineer does not hold the detected damage class. */
const SKILL_PENALTY = 8;
/** Added per job already on the engineer's plate, to spread load. */
const WORKLOAD_PENALTY = 3;
/** Subtracted at full severity, so bad damage outbids mere convenience. */
const SEVERITY_REBATE = 12;

export type AssignComplaint = {
  id: string; ref: string; title: string; category: string; priority: string;
  lat: number; lng: number; severityScore: number | null; departmentId: string;
};
export type AssignEngineer = {
  id: string; code: string; name: string; zone: string; skills: string;
  status: string; lat: number; lng: number; departmentId: string;
  complaints: { id: string }[];
};

export type Assignment = {
  complaint: { id: string; ref: string; title: string; category: string; priority: string; severityScore: number };
  engineer: { id: string; code: string; name: string; zone: string; openJobs: number };
  distanceKm: number;
  cost: number;
  skillMatch: boolean;
};

export type AssignmentPlan = {
  assignments: Assignment[];
  unassigned: { ref: string; title: string; reason: string }[];
  totalCost: number;
  totalDistanceKm: number;
  /** Greedy worst-first baseline under the same one-job-per-engineer rule. */
  naiveTotalCost: number;
  naiveTotalDistanceKm: number;
  /** How many jobs greedy allocated — should equal the optimal count. */
  naiveAssigned: number;
  costImprovementPct: number;
  engineersConsidered: number;
};

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000;

/** Exact match against the engineer's declared damage classes. */
function hasSkill(engineer: AssignEngineer, damageClass: string): boolean {
  return engineer.skills
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(damageClass.trim().toLowerCase());
}

function pairCost(c: AssignComplaint, e: AssignEngineer): number {
  if (e.departmentId !== c.departmentId || e.status === "OFF_DUTY") return FORBIDDEN;
  const distance = km(c, e);
  const skill = hasSkill(e, c.category) ? 0 : SKILL_PENALTY;
  const workload = WORKLOAD_PENALTY * e.complaints.length;
  const rebate = SEVERITY_REBATE * ((c.severityScore ?? 0) / 100);
  return Math.max(0, distance + skill + workload - rebate);
}

export function computeAssignmentPlan(
  complaints: AssignComplaint[],
  engineers: AssignEngineer[],
): AssignmentPlan {
  const empty: AssignmentPlan = {
    assignments: [], unassigned: [], totalCost: 0, totalDistanceKm: 0,
    naiveTotalCost: 0, naiveTotalDistanceKm: 0, naiveAssigned: 0, costImprovementPct: 0,
    engineersConsidered: engineers.length,
  };
  if (complaints.length === 0 || engineers.length === 0) return empty;

  const matrix = complaints.map((c) => engineers.map((e) => pairCost(c, e)));

  // Greedy baseline, under the same constraint as the optimal solution: one
  // engineer takes one job this round. Complaints are served worst-first —
  // the order a supervisor would work in — and each takes the cheapest
  // engineer still free.
  //
  // The constraint matters. The original version let greedy reuse engineers,
  // so it summed a cost for every complaint while Hungarian summed one per
  // engineer. That produced a flattering ~90% "improvement" which was really
  // just 28 assignments being compared against 6. Both sides now allocate the
  // same number of jobs, so the difference is the algorithm and nothing else.
  let naiveCost = 0, naiveDist = 0, naiveCount = 0;
  const takenByGreedy = new Set<number>();
  for (const [i, c] of complaints.entries()) {
    let best = Infinity, bestIdx = -1;
    for (const [j, cost] of matrix[i].entries()) {
      if (takenByGreedy.has(j)) continue;
      if (cost < best && cost < FORBIDDEN) { best = cost; bestIdx = j; }
    }
    if (bestIdx >= 0) {
      takenByGreedy.add(bestIdx);
      naiveCost += best;
      naiveDist += km(c, engineers[bestIdx]);
      naiveCount++;
    }
  }

  const assignments: Assignment[] = [];
  let totalCost = 0, totalDist = 0;

  for (const [ci, ei] of computeMunkres(matrix) as number[][]) {
    const cost = matrix[ci][ei];
    // Munkres pads to a square matrix and will happily return a forbidden
    // pairing when there are more complaints than engineers. Drop those.
    if (cost >= FORBIDDEN) continue;
    const c = complaints[ci], e = engineers[ei];
    const distanceKm = km(c, e);
    totalCost += cost;
    totalDist += distanceKm;
    assignments.push({
      complaint: {
        id: c.id, ref: c.ref, title: c.title, category: c.category,
        priority: c.priority, severityScore: c.severityScore ?? 0,
      },
      engineer: { id: e.id, code: e.code, name: e.name, zone: e.zone, openJobs: e.complaints.length },
      distanceKm: Math.round(distanceKm * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      skillMatch: hasSkill(e, c.category),
    });
  }

  const taken = new Set(assignments.map((a) => a.complaint.id));
  const unassigned = complaints
    .filter((c) => !taken.has(c.id))
    .map((c) => {
      const eligible = engineers.filter(
        (e) => e.departmentId === c.departmentId && e.status !== "OFF_DUTY",
      );
      return {
        ref: c.ref,
        title: c.title,
        reason: eligible.length === 0
          ? "No available engineer in the responsible department"
          : "Every eligible engineer was matched to a higher-priority complaint this round",
      };
    });

  return {
    assignments,
    unassigned,
    totalCost: Math.round(totalCost * 100) / 100,
    totalDistanceKm: Math.round(totalDist * 10) / 10,
    naiveTotalCost: Math.round(naiveCost * 100) / 100,
    naiveTotalDistanceKm: Math.round(naiveDist * 10) / 10,
    naiveAssigned: naiveCount,
    costImprovementPct: naiveCost > 0
      ? Math.round(((naiveCost - totalCost) / naiveCost) * 1000) / 10
      : 0,
    engineersConsidered: engineers.length,
  };
}
