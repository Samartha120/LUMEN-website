import { useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, Route as RouteIcon, TrendingUp, AlertTriangle, Ruler } from "lucide-react";
import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";
import { PriorityBadge } from "../components/badges";

type Item = {
  id: string; ref: string; title: string; category: string; civicCategory: string | null;
  priority: string; cost: number; risk: number; costMeasured?: boolean;
};
type Selection = { chosen: Item[]; totalCost: number; totalRisk: number };
type Route = { crew: number; stops: Item[]; distanceKm: number };
type Deferred = {
  count: number; riskNow: number; riskLater: number; increasePct: number;
  crossingToCritical: { ref: string; title: string; from: string }[];
};
type Plan = {
  budget: number; crews: number; horizonDays: number; considered: number;
  optimal: Selection; greedyRisk: Selection; greedyRatio: Selection;
  gainOverGreedy: number; gainPct: number;
  routes: Route[]; routedKm: number; unroutedKm: number;
  deferred: Deferred; measuredCount: number;
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/**
 * Municipal planning layer — what to fix with the money available.
 *
 * Two decisions, two algorithms. Which repairs to fund is a 0/1 knapsack,
 * solved exactly by dynamic programming against the risk each repair removes.
 * What order the crews drive is a vehicle-routing problem, solved by
 * Clarke-Wright savings and improved with 2-opt.
 *
 * The greedy baselines are shown next to the optimal answer on purpose. The
 * claim being made is that funding the worst complaints first is not the best
 * use of a fixed budget, and that claim is only worth anything if the
 * comparison is on screen rather than asserted.
 */
export function Budget() {
  const [budget, setBudget] = useState(500_000);
  const [crews, setCrews] = useState(3);
  const [horizon, setHorizon] = useState(7);
  const { data, loading } = useApi<Plan>(`/plan?budget=${budget}&crews=${crews}&horizon=${horizon}`);

  const bestGreedy = data ? Math.max(data.greedyRisk.totalRisk, data.greedyRatio.totalRisk) : 0;

  return (
    <>
      <PageHeader
        title="Budget & Repair Planner"
        subtitle="Which repairs fit the budget, and in what order the crews should drive · knapsack for selection, Clarke-Wright + 2-opt for routing"
      />

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <label className="text-xs font-medium text-slate-600">
          Budget (₹)
          <input type="number" min="0" step="50000" value={budget} onChange={(e) => setBudget(Number(e.target.value))}
            className="mt-1 block w-36 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Crews
          <input type="number" min="1" max="10" value={crews} onChange={(e) => setCrews(Number(e.target.value))}
            className="mt-1 block w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Horizon (days)
          <input type="number" min="1" max="30" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 block w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
        </label>
      </div>

      {loading && !data && <p className="text-slate-400">Planning…</p>}

      {data && (
        <>
          <Card className="mb-6 border-brand-200 bg-brand-50/40">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Repairs funded</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-brand-800">{data.optimal.chosen.length}</p>
                <p className="text-xs text-slate-600">of {data.considered} open</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Budget used</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{inr(data.optimal.totalCost)}</p>
                <p className="text-xs text-slate-600">{inr(data.budget - data.optimal.totalCost)} left over</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Public risk removed</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{Math.round(data.optimal.totalRisk)}</p>
                <p className="text-xs text-slate-600">summed priority scores</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Crew travel</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{data.routedKm} km</p>
                <p className="text-xs text-slate-600">across {data.routes.length} route{data.routes.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            {data.measuredCount > 0 && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-brand-200 pt-2 text-xs text-slate-600">
                <Ruler size={13} className="text-brand-600" />
                {data.measuredCount} complaint{data.measuredCount === 1 ? " uses its" : "s use their"} site-measured
                bill of quantities for cost; the rest use the indicative rate card.
              </p>
            )}
          </Card>

          {/* The comparison the feature exists to make. */}
          <Card className="mb-6" title="Optimal vs greedy">
            <p className="mb-3 text-sm text-slate-500">
              Funding the highest-risk complaints first is the obvious approach, and it is not optimal —
              an expensive repair can crowd out several cheaper ones that together remove more risk.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Strategy</th>
                    <th className="px-3 py-2">Repairs</th>
                    <th className="px-3 py-2">Cost</th>
                    <th className="px-3 py-2">Risk removed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-emerald-50/50">
                    <td className="px-3 py-2 font-semibold text-slate-900">Knapsack (dynamic programming)</td>
                    <td className="px-3 py-2 text-slate-700">{data.optimal.chosen.length}</td>
                    <td className="px-3 py-2 text-slate-700">{inr(data.optimal.totalCost)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-700">{Math.round(data.optimal.totalRisk)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-700">Greedy — highest risk first</td>
                    <td className="px-3 py-2 text-slate-600">{data.greedyRisk.chosen.length}</td>
                    <td className="px-3 py-2 text-slate-600">{inr(data.greedyRisk.totalCost)}</td>
                    <td className="px-3 py-2 text-slate-600">{Math.round(data.greedyRisk.totalRisk)}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-700">Greedy — best risk per rupee</td>
                    <td className="px-3 py-2 text-slate-600">{data.greedyRatio.chosen.length}</td>
                    <td className="px-3 py-2 text-slate-600">{inr(data.greedyRatio.totalCost)}</td>
                    <td className="px-3 py-2 text-slate-600">{Math.round(data.greedyRatio.totalRisk)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
              <TrendingUp size={15} className="text-emerald-600" />
              {data.gainOverGreedy > 0 ? (
                <>Knapsack removes <strong>{Math.round(data.gainOverGreedy)}</strong> more risk than the
                  better greedy baseline ({data.gainPct}% improvement) for the same money.</>
              ) : (
                <>Greedy matches the optimal solution at this budget — the two agree when costs and risks
                  happen to line up. Try a tighter budget to separate them.</>
              )}
            </p>
            {bestGreedy > 0 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (bestGreedy / data.optimal.totalRisk) * 100)}%` }} />
              </div>
            )}
          </Card>

          <Card className="mb-6" title={`Funded repairs (${data.optimal.chosen.length})`}>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-2.5 py-1.5">Ref</th>
                    <th className="px-2.5 py-1.5">Complaint</th>
                    <th className="px-2.5 py-1.5">Priority</th>
                    <th className="px-2.5 py-1.5">Cost</th>
                    <th className="px-2.5 py-1.5">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.optimal.chosen.map((c) => (
                    <tr key={c.ref}>
                      <td className="px-2.5 py-1.5">
                        <Link to={`/app/complaints/${c.ref}`} className="font-medium text-brand-700 hover:underline">{c.ref}</Link>
                      </td>
                      <td className="max-w-[300px] truncate px-2.5 py-1.5 text-slate-700">{c.title}</td>
                      <td className="px-2.5 py-1.5"><PriorityBadge priority={c.priority} /></td>
                      <td className="px-2.5 py-1.5 font-medium text-slate-800">
                        {inr(c.cost)}
                        {c.costMeasured && <span className="ml-1 text-[10px] font-semibold text-brand-600" title="From the site-measured bill of quantities">measured</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-slate-600">{Math.round(c.risk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mb-6" title={`Crew routes (${data.routes.length})`}>
            <p className="mb-3 text-sm text-slate-500">
              Stops ordered by Clarke-Wright savings, then improved with 2-opt. Each route starts and ends at the depot.
            </p>
            <div className="space-y-3">
              {data.routes.map((r) => (
                <div key={r.crew} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <RouteIcon size={15} className="text-brand-600" />
                    <span className="text-sm font-semibold text-slate-900">Crew {r.crew}</span>
                    <span className="text-xs text-slate-500">{r.stops.length} stops · {r.distanceKm} km</span>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Depot → {r.stops.map((s) => s.ref).join(" → ")} → Depot
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {data.deferred.count > 0 && (
            <Card title="Cost of deferring the rest">
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div className="text-sm text-amber-900">
                  <p>
                    <strong>{data.deferred.count}</strong> complaint{data.deferred.count === 1 ? "" : "s"} go
                    unfunded. Their combined risk rises from <strong>{Math.round(data.deferred.riskNow)}</strong> to{" "}
                    <strong>{Math.round(data.deferred.riskLater)}</strong> over {data.horizonDays} days —
                    a {data.deferred.increasePct}% increase, because priority climbs with age.
                  </p>
                  {data.deferred.crossingToCritical.length > 0 && (
                    <p className="mt-2">
                      {data.deferred.crossingToCritical.length} will cross into Critical:{" "}
                      {data.deferred.crossingToCritical.slice(0, 6).map((c) => c.ref).join(", ")}
                      {data.deferred.crossingToCritical.length > 6 && " …"}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Wallet size={13} />
            Costs are indicative unless marked <span className="font-semibold text-brand-600">measured</span>.
            See the <Link to="/app/estimate" className="underline">Material Estimate</Link> page for the bill of quantities behind them.
          </p>
        </>
      )}
    </>
  );
}
