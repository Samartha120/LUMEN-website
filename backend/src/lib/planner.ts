/**
 * Feature 7 — municipal planning layer.
 *
 * Every other feature in LUMEN treats a complaint in isolation: detect it,
 * score it, route it, assign it. A city cannot work that way. It has a fixed
 * repair budget and a fixed number of crews, and its hardest decision is not
 * "what is broken" but "what do we *not* fix this month".
 *
 * This module answers that, in three parts:
 *
 *   A. WHICH REPAIRS      0/1 knapsack, solved exactly by dynamic programming.
 *                         Maximise total risk removed subject to a budget.
 *   B. WHAT ROUTE         Vehicle routing with a crew limit — NP-hard, so
 *                         Clarke–Wright savings construction + 2-opt descent.
 *   C. COST OF DELAY      Project the ageing priority rule forward to show
 *                         what deferring the unfunded work does to city risk.
 *
 * Part A is worth stating precisely, because it is the part that is easy to
 * get wrong. The obvious approach — sort by severity, fund until the money
 * runs out — is greedy, and greedy is not optimal for 0/1 knapsack. It spends
 * the budget on a few expensive high-severity jobs while a larger set of
 * cheaper jobs would have removed more total risk. `plan()` computes both and
 * reports the difference, so the gain is measured rather than claimed.
 */
import { haversineMeters } from "./geo.js";
import { slaHoursOf } from "./taxonomy.js";

// ---------------------------------------------------------------------------
// Cost model
// ---------------------------------------------------------------------------

/**
 * Indicative repair cost per damage class, in rupees. These stand in for a
 * municipal schedule of rates; they are configuration, not physics, and are
 * kept in one place so a real rate card can replace them wholesale.
 */
export const BASE_COST: Record<string, number> = {
  "Pothole": 18_000,
  "Alligator Crack": 60_000,
  "Garbage Pile": 6_000,
  "Overflowing Bin": 3_000,
  "Open Manhole": 15_000,
  "Closed Manhole": 0,
};

const DEFAULT_COST = 20_000;

/**
 * A worse defect of the same class costs more to repair — a hairline crack is
 * a patch, a failed slab is a rebuild. Scaling by severity also makes cost and
 * risk imperfectly correlated, which is exactly the condition under which
 * knapsack beats greedy; if cost were proportional to risk, both would agree.
 */
export function repairCost(category: string, severityScore: number): number {
  const base = BASE_COST[category] ?? DEFAULT_COST;
  const scale = 0.6 + 0.8 * (Math.max(0, Math.min(100, severityScore)) / 100);
  return Math.round((base * scale) / 500) * 500; // round to the nearest ₹500
}

export type PlanItem = {
  id: string;
  ref: string;
  title: string;
  category: string;
  civicCategory: string | null;
  lat: number;
  lng: number;
  severityScore: number;
  priorityScore: number;
  priority: string;
  slaHours: number;
  cost: number;
  /** Public risk removed by doing this repair. */
  risk: number;
  /**
   * True when `cost` came from a site-measured bill of quantities rather than
   * the indicative rate card. Shown in the plan so a supervisor knows which
   * figures are grounded and which are assumed.
   */
  costMeasured?: boolean;
};

/** Risk removed = the complaint's own priority score, which already folds in
 *  severity, confidence, landmark proximity, duplicate reports and age. */
export function riskOf(priorityScore: number): number {
  return Math.max(0, priorityScore);
}

// ---------------------------------------------------------------------------
// A. Which repairs — 0/1 knapsack
// ---------------------------------------------------------------------------

export type Selection = {
  chosen: PlanItem[];
  totalCost: number;
  totalRisk: number;
};

/**
 * Exact 0/1 knapsack by dynamic programming, O(n·W).
 *
 * Costs are quantised to ₹500 units to keep the table small: a ₹50 lakh budget
 * becomes W = 10,000 columns rather than 5,000,000. Quantisation is exact here
 * because `repairCost` already rounds to ₹500, so no precision is lost.
 */
export function knapsack(items: PlanItem[], budget: number): Selection {
  const UNIT = 500;
  const W = Math.floor(budget / UNIT);
  const n = items.length;
  if (n === 0 || W <= 0) return { chosen: [], totalCost: 0, totalRisk: 0 };

  const weights = items.map((i) => Math.ceil(i.cost / UNIT));

  // table[i][w] = best risk using the first i items within weight w.
  // Kept as a full table (not the rolling 1-D form) so the chosen set can be
  // recovered by backtracking rather than re-solved.
  const table: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(W + 1));
  for (let i = 1; i <= n; i++) {
    const wi = weights[i - 1];
    const vi = items[i - 1].risk;
    const prev = table[i - 1];
    const cur = table[i];
    for (let w = 0; w <= W; w++) {
      const skip = prev[w];
      cur[w] = wi <= w ? Math.max(skip, prev[w - wi] + vi) : skip;
    }
  }

  const chosen: PlanItem[] = [];
  let w = W;
  for (let i = n; i > 0; i--) {
    if (table[i][w] !== table[i - 1][w]) {
      chosen.push(items[i - 1]);
      w -= weights[i - 1];
    }
  }
  chosen.reverse();

  return {
    chosen,
    totalCost: chosen.reduce((s, i) => s + i.cost, 0),
    totalRisk: Math.round(chosen.reduce((s, i) => s + i.risk, 0) * 10) / 10,
  };
}

/**
 * The baseline this feature exists to beat: fund the highest-risk complaints
 * first until the money runs out. This is what a spreadsheet does.
 */
export function greedyByRisk(items: PlanItem[], budget: number): Selection {
  const chosen: PlanItem[] = [];
  let spent = 0;
  for (const item of [...items].sort((a, b) => b.risk - a.risk)) {
    if (spent + item.cost <= budget) {
      chosen.push(item);
      spent += item.cost;
    }
  }
  return {
    chosen,
    totalCost: spent,
    totalRisk: Math.round(chosen.reduce((s, i) => s + i.risk, 0) * 10) / 10,
  };
}

/** A second baseline: best risk-per-rupee first. Stronger than plain greedy,
 *  and still not optimal — useful to show the gap is real, not a straw man. */
export function greedyByRatio(items: PlanItem[], budget: number): Selection {
  const chosen: PlanItem[] = [];
  let spent = 0;
  for (const item of [...items].sort((a, b) => b.risk / b.cost - a.risk / a.cost)) {
    if (spent + item.cost <= budget) {
      chosen.push(item);
      spent += item.cost;
    }
  }
  return {
    chosen,
    totalCost: spent,
    totalRisk: Math.round(chosen.reduce((s, i) => s + i.risk, 0) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// B. What route — vehicle routing
// ---------------------------------------------------------------------------

export type Route = {
  crew: number;
  stops: PlanItem[];
  distanceKm: number;
};

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000;

/** Total distance of one route, depot -> stops in order -> depot. */
function routeDistance(depot: { lat: number; lng: number }, stops: PlanItem[]): number {
  if (stops.length === 0) return 0;
  let d = km(depot, stops[0]);
  for (let i = 1; i < stops.length; i++) d += km(stops[i - 1], stops[i]);
  return d + km(stops[stops.length - 1], depot);
}

/**
 * 2-opt local search: repeatedly reverse a segment when doing so shortens the
 * route, until no improving reversal exists. Removes the path crossings that
 * savings construction leaves behind.
 */
function twoOpt(depot: { lat: number; lng: number }, stops: PlanItem[]): PlanItem[] {
  if (stops.length < 4) return stops;
  let best = [...stops];
  let bestD = routeDistance(depot, best);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 100) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const d = routeDistance(depot, candidate);
        if (d < bestD - 1e-9) {
          best = candidate;
          bestD = d;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Clarke–Wright savings algorithm, then 2-opt on each route.
 *
 * Vehicle routing is NP-hard, so this is a heuristic, not an exact solver —
 * unlike the Hungarian assignment in assignment.ts, which is exact. The saving
 * of merging routes ending at i and starting at j is
 *     s(i,j) = d(depot,i) + d(depot,j) - d(i,j)
 * Merges are applied in descending saving order while both routes have a free
 * end and the combined length stays within the per-crew stop limit.
 */
export function routeCrews(
  items: PlanItem[],
  depot: { lat: number; lng: number },
  crews: number,
  stopsPerCrew: number,
): Route[] {
  if (items.length === 0 || crews <= 0) return [];

  // Start with one out-and-back route per job.
  let routes: PlanItem[][] = items.map((i) => [i]);

  const savings: { i: number; j: number; s: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      savings.push({ i, j, s: km(depot, items[i]) + km(depot, items[j]) - km(items[i], items[j]) });
    }
  }
  savings.sort((a, b) => b.s - a.s);

  const routeOf = (item: PlanItem) => routes.findIndex((r) => r.includes(item));

  for (const { i, j } of savings) {
    if (routes.length <= crews) break;
    const a = routeOf(items[i]);
    const b = routeOf(items[j]);
    if (a === -1 || b === -1 || a === b) continue;
    if (routes[a].length + routes[b].length > stopsPerCrew) continue;
    // Only merge at route ends, so interior stops are not resequenced here.
    const aEnds = routes[a][routes[a].length - 1] === items[i];
    const bStarts = routes[b][0] === items[j];
    if (aEnds && bStarts) {
      routes[a] = [...routes[a], ...routes[b]];
      routes.splice(b, 1);
    }
  }

  // More routes than crews: hand the shortest leftovers to existing crews.
  routes.sort((x, y) => y.length - x.length);
  if (routes.length > crews) {
    const keep = routes.slice(0, crews);
    for (const extra of routes.slice(crews)) {
      for (const stop of extra) {
        keep.sort((x, y) => x.length - y.length);
        keep[0].push(stop);
      }
    }
    routes = keep;
  }

  return routes.map((stops, idx) => {
    const ordered = twoOpt(depot, stops);
    return { crew: idx + 1, stops: ordered, distanceKm: Math.round(routeDistance(depot, ordered) * 10) / 10 };
  });
}

/** Naive baseline for the routing comparison: visit in priority order. */
export function unroutedDistance(items: PlanItem[], depot: { lat: number; lng: number }, crews: number): number {
  if (items.length === 0 || crews <= 0) return 0;
  const byPriority = [...items].sort((a, b) => b.risk - a.risk);
  const buckets: PlanItem[][] = Array.from({ length: crews }, () => []);
  byPriority.forEach((item, i) => buckets[i % crews].push(item));
  return Math.round(buckets.reduce((s, b) => s + routeDistance(depot, b), 0) * 10) / 10;
}

// ---------------------------------------------------------------------------
// C. Cost of delay
// ---------------------------------------------------------------------------

export type Deferred = {
  count: number;
  riskNow: number;
  riskLater: number;
  increasePct: number;
  crossingToCritical: { ref: string; title: string; from: string }[];
};

/**
 * What deferring the unfunded work costs. The live priority rule adds risk as
 * a complaint ages (2 points per day, capped at 10), so projecting forward is
 * a matter of applying that same ageing term — no new model, and no invented
 * growth curve for the physical damage itself, which we cannot observe.
 */
export function deferredRisk(unfunded: PlanItem[], days: number): Deferred {
  const riskNow = unfunded.reduce((s, i) => s + i.risk, 0);
  const ageRisk = Math.min(10, Math.floor(days / 1) * 2);
  const crossing: Deferred["crossingToCritical"] = [];
  let riskLater = 0;
  for (const item of unfunded) {
    const later = Math.min(100, item.risk + ageRisk);
    riskLater += later;
    if (item.priorityScore < 75 && later >= 75) {
      crossing.push({ ref: item.ref, title: item.title, from: item.priority });
    }
  }
  return {
    count: unfunded.length,
    riskNow: Math.round(riskNow * 10) / 10,
    riskLater: Math.round(riskLater * 10) / 10,
    increasePct: riskNow > 0 ? Math.round(((riskLater - riskNow) / riskNow) * 1000) / 10 : 0,
    crossingToCritical: crossing,
  };
}

// ---------------------------------------------------------------------------
// Top level
// ---------------------------------------------------------------------------

export type Plan = {
  budget: number;
  crews: number;
  horizonDays: number;
  considered: number;
  optimal: Selection;
  greedyRisk: Selection;
  greedyRatio: Selection;
  /** Extra risk removed by the DP solution over the best greedy baseline. */
  gainOverGreedy: number;
  gainPct: number;
  routes: Route[];
  routedKm: number;
  unroutedKm: number;
  deferred: Deferred;
};

export function buildItems(
  complaints: Array<{
    id: string; ref: string; title: string; category: string; civicCategory: string | null;
    lat: number; lng: number; severityScore: number | null; priorityScore: number | null;
    priority: string; slaHours: number | null;
  }>,
): PlanItem[] {
  return complaints.map((c) => {
    const severity = c.severityScore ?? 0;
    const priority = c.priorityScore ?? severity;
    return {
      id: c.id, ref: c.ref, title: c.title,
      category: c.category,
      civicCategory: c.civicCategory,
      lat: c.lat, lng: c.lng,
      severityScore: severity,
      priorityScore: priority,
      priority: c.priority,
      slaHours: c.slaHours ?? slaHoursOf(c.category) ?? 48,
      cost: repairCost(c.category, severity),
      risk: riskOf(priority),
    };
  });
}

export function plan(
  items: PlanItem[],
  opts: { budget: number; crews: number; horizonDays: number; depot: { lat: number; lng: number }; stopsPerCrew?: number },
): Plan {
  const optimal = knapsack(items, opts.budget);
  const greedyRisk = greedyByRisk(items, opts.budget);
  const greedyRatio = greedyByRatio(items, opts.budget);
  const bestGreedy = Math.max(greedyRisk.totalRisk, greedyRatio.totalRisk);

  const stopsPerCrew = opts.stopsPerCrew ?? Math.max(1, Math.ceil(optimal.chosen.length / Math.max(1, opts.crews)));
  const routes = routeCrews(optimal.chosen, opts.depot, opts.crews, stopsPerCrew);
  const routedKm = Math.round(routes.reduce((s, r) => s + r.distanceKm, 0) * 10) / 10;

  const fundedIds = new Set(optimal.chosen.map((i) => i.id));
  const unfunded = items.filter((i) => !fundedIds.has(i.id));

  return {
    budget: opts.budget,
    crews: opts.crews,
    horizonDays: opts.horizonDays,
    considered: items.length,
    optimal,
    greedyRisk,
    greedyRatio,
    gainOverGreedy: Math.round((optimal.totalRisk - bestGreedy) * 10) / 10,
    gainPct: bestGreedy > 0 ? Math.round(((optimal.totalRisk - bestGreedy) / bestGreedy) * 1000) / 10 : 0,
    routes,
    routedKm,
    unroutedKm: unroutedDistance(optimal.chosen, opts.depot, opts.crews),
    deferred: deferredRisk(unfunded, opts.horizonDays),
  };
}
