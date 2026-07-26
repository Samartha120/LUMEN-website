/**
 * Feature 5 — optimised engineer assignment.
 *
 * Assigning N open complaints to M field engineers is an instance of the
 * classic assignment problem. The naive approach used by most complaint
 * systems is greedy: walk the complaints in priority order and give each one
 * to the nearest free engineer. That is locally sensible but globally poor —
 * an early complaint can consume the one engineer a later, closer complaint
 * needed, inflating total travel.
 *
 * We solve it exactly with the Hungarian algorithm (Kuhn–Munkres), O(n³),
 * minimising total assignment cost across the whole batch simultaneously.
 *
 * Cost model per (complaint, engineer) pair:
 *     cost = travel_km
 *          + skillPenalty      (engineer not trained on this damage class)
 *          + workloadPenalty   (engineer already carrying open jobs)
 *          + urgencyWeight     (severe complaints pay less to be served first)
 * Infeasible pairs (off-duty, wrong department) are set to a large constant so
 * the algorithm avoids them unless nothing else exists.
 */
import { haversineMeters } from "./geo";

export type AssignComplaint = {
  id: string;
  ref: string;
  lat: number;
  lng: number;
  category: string;
  severityScore: number;
  departmentId: string;
};

export type AssignEngineer = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  skills: string;
  status: string;
  departmentId: string;
  openJobs: number;
};

export const INFEASIBLE = 1e6;
const SKILL_PENALTY_KM = 8;
const WORKLOAD_PENALTY_KM = 3;
const URGENCY_WEIGHT_KM = 12;

export function pairCost(c: AssignComplaint, e: AssignEngineer): number {
  if (e.status === "OFF_DUTY" || e.departmentId !== c.departmentId) return INFEASIBLE;

  const km = haversineMeters(c.lat, c.lng, e.lat, e.lng) / 1000;
  const skilled = e.skills.split(",").map((s) => s.trim()).includes(c.category);
  const skillPenalty = skilled ? 0 : SKILL_PENALTY_KM;
  const workloadPenalty = e.openJobs * WORKLOAD_PENALTY_KM;
  // Severe complaints get a cost rebate so the optimiser serves them first.
  const urgencyRebate = (c.severityScore / 100) * URGENCY_WEIGHT_KM;

  return km + skillPenalty + workloadPenalty - urgencyRebate;
}

/**
 * Hungarian algorithm (Jonker–Volgenant style potentials), rectangular-safe.
 * Returns assignment[j] = row index assigned to column j, or -1.
 */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0].length;
  const dim = Math.max(n, m);

  // pad to square with zero-cost dummy cells
  const a: number[][] = Array.from({ length: dim }, (_, i) =>
    Array.from({ length: dim }, (_, j) => (i < n && j < m ? cost[i][j] : 0))
  );

  const INF = Number.POSITIVE_INFINITY;
  const u = new Array(dim + 1).fill(0);
  const v = new Array(dim + 1).fill(0);
  const p = new Array(dim + 1).fill(0); // p[j] = row matched to column j
  const way = new Array(dim + 1).fill(0);

  for (let i = 1; i <= dim; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(dim + 1).fill(INF);
    const used = new Array(dim + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= dim; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= dim; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const assignment = new Array(m).fill(-1);
  for (let j = 1; j <= dim; j++) {
    const row = p[j] - 1;
    if (row >= 0 && row < n && j - 1 < m) assignment[j - 1] = row;
  }
  return assignment;
}

export type Assignment = {
  complaint: AssignComplaint;
  engineer: AssignEngineer;
  distanceKm: number;
  cost: number;
  skillMatch: boolean;
};

export type OptimiseResult = {
  assignments: Assignment[];
  unassigned: AssignComplaint[];
  /** Objective actually minimised — the fair basis for comparison. */
  totalCost: number;
  naiveTotalCost: number;
  costImprovementPct: number;
  /** Reported for context only; distance is one term of the cost, not the objective. */
  totalDistanceKm: number;
  naiveTotalDistanceKm: number;
};

/** Greedy baseline: highest severity first, each takes its nearest feasible engineer. */
export function greedyAssign(
  complaints: AssignComplaint[],
  engineers: AssignEngineer[]
): { assignments: Assignment[]; totalDistanceKm: number; totalCost: number } {
  const taken = new Set<string>();
  const out: Assignment[] = [];
  const order = [...complaints].sort((x, y) => y.severityScore - x.severityScore);

  for (const c of order) {
    let best: AssignEngineer | null = null;
    let bestKm = Infinity;
    for (const e of engineers) {
      if (taken.has(e.id)) continue;
      if (pairCost(c, e) >= INFEASIBLE) continue;
      const km = haversineMeters(c.lat, c.lng, e.lat, e.lng) / 1000;
      if (km < bestKm) {
        bestKm = km;
        best = e;
      }
    }
    if (best) {
      taken.add(best.id);
      out.push({
        complaint: c,
        engineer: best,
        distanceKm: Math.round(bestKm * 100) / 100,
        cost: Math.round(pairCost(c, best) * 100) / 100,
        skillMatch: best.skills.split(",").map((s) => s.trim()).includes(c.category),
      });
    }
  }
  return {
    assignments: out,
    totalDistanceKm: Math.round(out.reduce((s, a) => s + a.distanceKm, 0) * 100) / 100,
    totalCost: Math.round(out.reduce((s, a) => s + a.cost, 0) * 100) / 100,
  };
}

export function optimiseAssignments(
  complaints: AssignComplaint[],
  engineers: AssignEngineer[]
): OptimiseResult {
  if (complaints.length === 0 || engineers.length === 0) {
    return {
      assignments: [],
      unassigned: complaints,
      totalCost: 0,
      naiveTotalCost: 0,
      costImprovementPct: 0,
      totalDistanceKm: 0,
      naiveTotalDistanceKm: 0,
    };
  }

  // rows = complaints, columns = engineers
  const cost = complaints.map((c) => engineers.map((e) => pairCost(c, e)));
  const colToRow = hungarian(cost);

  const assignments: Assignment[] = [];
  const assignedRows = new Set<number>();

  for (let j = 0; j < engineers.length; j++) {
    const i = colToRow[j];
    if (i < 0 || i >= complaints.length) continue;
    if (cost[i][j] >= INFEASIBLE) continue; // never force an infeasible pair
    const c = complaints[i];
    const e = engineers[j];
    const km = haversineMeters(c.lat, c.lng, e.lat, e.lng) / 1000;
    assignments.push({
      complaint: c,
      engineer: e,
      distanceKm: Math.round(km * 100) / 100,
      cost: Math.round(cost[i][j] * 100) / 100,
      skillMatch: e.skills.split(",").map((s) => s.trim()).includes(c.category),
    });
    assignedRows.add(i);
  }

  const totalDistanceKm =
    Math.round(assignments.reduce((s, a) => s + a.distanceKm, 0) * 100) / 100;
  const totalCost = Math.round(assignments.reduce((s, a) => s + a.cost, 0) * 100) / 100;
  const naive = greedyAssign(complaints, engineers);

  // Compare on cost — the objective the Hungarian algorithm minimises. Comparing
  // on distance alone would be unfair in both directions: the optimiser will
  // happily accept a longer drive to reach a skilled, less-loaded engineer.
  // Costs can be negative (urgency rebates), so normalise by magnitude.
  const denom = Math.abs(naive.totalCost);
  const costImprovementPct =
    denom > 1e-9 ? Math.round(((naive.totalCost - totalCost) / denom) * 1000) / 10 : 0;

  return {
    assignments,
    unassigned: complaints.filter((_, i) => !assignedRows.has(i)),
    totalCost,
    naiveTotalCost: naive.totalCost,
    costImprovementPct,
    totalDistanceKm,
    naiveTotalDistanceKm: naive.totalDistanceKm,
  };
}
