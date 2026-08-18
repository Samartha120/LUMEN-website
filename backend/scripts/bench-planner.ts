/**
 * Validation for the municipal planning layer.
 *
 * Two things need proving, and they are different claims:
 *   1. CORRECTNESS — the DP knapsack returns the true optimum. Checked against
 *      brute-force enumeration of all 2^n subsets on small instances.
 *   2. VALUE — the optimum actually beats the greedy heuristics a spreadsheet
 *      would use. Measured over many random instances.
 *
 * Routing is a heuristic, not an exact solver, so it is checked for improvement
 * over the naive baseline rather than for optimality.
 *
 *   npx tsx scripts/bench-planner.ts
 */
import {
  knapsack, greedyByRisk, greedyByRatio, routeCrews, unroutedDistance,
  type PlanItem,
} from "../src/lib/planner.js";

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function makeItems(n: number): PlanItem[] {
  return Array.from({ length: n }, (_, i) => {
    const risk = Math.round(rand(5, 100) * 10) / 10;
    return {
      id: `c${i}`, ref: `CMP-${1000 + i}`, title: `Complaint ${i}`,
      category: "Pothole", civicCategory: "ROADS",
      lat: 12.9 + rand(0, 0.14), lng: 77.53 + rand(0, 0.16),
      severityScore: risk, priorityScore: risk, priority: "MEDIUM", slaHours: 48,
      // Cost is deliberately NOT proportional to risk — if it were, greedy
      // would already be optimal and the comparison would be meaningless.
      cost: Math.round(rand(3_000, 90_000) / 500) * 500,
      risk,
    };
  });
}

/** Exhaustive optimum over all subsets. Only tractable for small n. */
function bruteForce(items: PlanItem[], budget: number): number {
  let best = 0;
  for (let mask = 0; mask < 1 << items.length; mask++) {
    let cost = 0, risk = 0;
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) { cost += items[i].cost; risk += items[i].risk; }
    }
    if (cost <= budget && risk > best) best = risk;
  }
  return Math.round(best * 10) / 10;
}

console.log("1. CORRECTNESS — DP knapsack vs brute-force enumeration");
let exact = 0, mismatch = 0;
for (let trial = 0; trial < 400; trial++) {
  const items = makeItems(Math.floor(rand(4, 15)));
  const budget = Math.round(rand(20_000, 400_000) / 500) * 500;
  const dp = knapsack(items, budget);
  const bf = bruteForce(items, budget);
  if (Math.abs(dp.totalRisk - bf) < 0.05) exact++;
  else {
    mismatch++;
    if (mismatch <= 3) console.log(`   MISMATCH n=${items.length} budget=${budget} dp=${dp.totalRisk} bf=${bf}`);
  }
  // The solution must also actually fit the budget.
  if (dp.totalCost > budget) console.log(`   OVER BUDGET: ${dp.totalCost} > ${budget}`);
}
console.log(`   matched brute force: ${exact}/400   mismatches: ${mismatch}\n`);

console.log("2. VALUE — DP optimum vs greedy baselines");
let betterThanRisk = 0, equalRisk = 0, worseRisk = 0;
let betterThanRatio = 0, equalRatio = 0, worseRatio = 0;
let totalGainPct = 0, maxGainPct = 0;
let riskGainPct = 0, maxRiskGainPct = 0;
const TRIALS = 300;
for (let trial = 0; trial < TRIALS; trial++) {
  const items = makeItems(Math.floor(rand(25, 60)));
  const budget = Math.round(rand(150_000, 900_000) / 500) * 500;
  const dp = knapsack(items, budget).totalRisk;
  const gr = greedyByRisk(items, budget).totalRisk;
  const ga = greedyByRatio(items, budget).totalRisk;

  if (dp > gr + 1e-6) betterThanRisk++; else if (Math.abs(dp - gr) < 1e-6) equalRisk++; else worseRisk++;
  if (dp > ga + 1e-6) betterThanRatio++; else if (Math.abs(dp - ga) < 1e-6) equalRatio++; else worseRatio++;

  const best = Math.max(gr, ga);
  if (best > 0) {
    const gain = ((dp - best) / best) * 100;
    totalGainPct += gain;
    maxGainPct = Math.max(maxGainPct, gain);
  }
  // Gain over sort-by-severity specifically — the baseline a municipality
  // actually uses, and the one worth quoting.
  if (gr > 0) {
    const g = ((dp - gr) / gr) * 100;
    riskGainPct += g;
    maxRiskGainPct = Math.max(maxRiskGainPct, g);
  }
}
console.log(`   vs greedy-by-risk : better ${betterThanRisk}  equal ${equalRisk}  worse ${worseRisk}`);
console.log(`   vs greedy-by-ratio: better ${betterThanRatio}  equal ${equalRatio}  worse ${worseRatio}`);
console.log(`   mean gain over sort-by-severity: ${(riskGainPct / TRIALS).toFixed(2)}%   max: ${maxRiskGainPct.toFixed(1)}%`);
console.log(`   mean gain over best greedy     : ${(totalGainPct / TRIALS).toFixed(2)}%   max: ${maxGainPct.toFixed(1)}%\n`);

console.log("3. ROUTING — Clarke-Wright + 2-opt vs naive priority order");
let shorter = 0, longer = 0, totalSave = 0;
const depot = { lat: 12.9716, lng: 77.5946 };
for (let trial = 0; trial < 200; trial++) {
  const items = makeItems(Math.floor(rand(8, 30)));
  const crews = Math.floor(rand(2, 5));
  const routed = routeCrews(items, depot, crews, Math.ceil(items.length / crews) + 2)
    .reduce((s, r) => s + r.distanceKm, 0);
  const naive = unroutedDistance(items, depot, crews);
  if (routed < naive - 1e-9) shorter++; else if (routed > naive + 1e-9) longer++;
  if (naive > 0) totalSave += ((naive - routed) / naive) * 100;
  // Every job must appear exactly once across all routes.
  const stops = routeCrews(items, depot, crews, Math.ceil(items.length / crews) + 2)
    .flatMap((r) => r.stops.map((s) => s.id));
  if (new Set(stops).size !== items.length) {
    console.log(`   LOST OR DUPLICATED STOPS: ${new Set(stops).size} unique of ${items.length}`);
  }
}
console.log(`   shorter than naive: ${shorter}/200   longer: ${longer}`);
console.log(`   mean distance saved: ${(totalSave / 200).toFixed(1)}%`);
