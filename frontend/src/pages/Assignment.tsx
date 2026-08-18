import { useState } from "react";
import { Link } from "react-router-dom";
import { HardHat, Check, X, TrendingDown, Play } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";
import { PriorityBadge } from "../components/badges";

type Assignment = {
  complaint: { id: string; ref: string; title: string; category: string; priority: string; severityScore: number };
  engineer: { id: string; code: string; name: string; zone: string; openJobs: number };
  distanceKm: number; cost: number; skillMatch: boolean;
};
type Plan = {
  assignments: Assignment[];
  unassigned: { ref: string; title: string; reason: string }[];
  totalCost: number; totalDistanceKm: number;
  naiveTotalCost: number; naiveTotalDistanceKm: number; naiveAssigned: number;
  costImprovementPct: number; engineersConsidered: number;
};

/**
 * Engineer dispatch — Hungarian minimum-cost matching.
 *
 * The greedy baseline is shown beside the optimal answer because that
 * comparison is the point. Both allocate the same number of jobs under the
 * same one-engineer-one-job rule, so the difference between them is the
 * algorithm rather than an artefact of counting.
 */
export function Assignment() {
  const { data, loading, reload } = useApi<Plan>("/assignment");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setApplying(true); setError(null);
    try {
      const r = await api.post("/assignment/apply", {}) as { applied: number };
      setApplied(r.applied);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply the assignment.");
    } finally { setApplying(false); }
  }

  return (
    <>
      <PageHeader
        title="Assignment Optimiser"
        subtitle="Dispatch unassigned complaints to engineers · Hungarian algorithm on distance, skill match, current workload and severity"
      />

      {loading && !data && <p className="text-slate-400">Computing the allocation…</p>}

      {data && (
        <>
          {data.assignments.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                  <HardHat size={20} className="text-slate-400" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">Nothing to dispatch</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                  Every submitted complaint already has an engineer, or no engineer is available
                  in the responsible department.
                </p>
              </div>
            </Card>
          ) : (
            <>
              <Card className="mb-6 border-brand-200 bg-brand-50/40">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Proposed dispatch</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-brand-800">
                      {data.assignments.length} <span className="text-lg font-semibold">jobs</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {data.totalDistanceKm} km total travel · {data.engineersConsidered} engineers considered
                    </p>
                  </div>
                  <div>
                    <button onClick={apply} disabled={applying}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:bg-slate-300">
                      <Play size={15} /> {applying ? "Dispatching…" : "Apply this assignment"}
                    </button>
                    {applied !== null && (
                      <p className="mt-2 text-right text-xs font-medium text-emerald-700">
                        {applied} complaint{applied === 1 ? "" : "s"} dispatched.
                      </p>
                    )}
                  </div>
                </div>
                {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              </Card>

              <Card className="mb-6" title="Optimal vs greedy">
                <p className="mb-3 text-sm text-slate-500">
                  Greedy sends each complaint to its nearest free engineer, worst first. It is
                  locally sensible and globally worse: an early complaint takes the engineer a
                  later, closer one needed. Both allocate {data.assignments.length} jobs here, so
                  the difference is the algorithm alone.
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Strategy</th>
                        <th className="px-3 py-2">Jobs</th>
                        <th className="px-3 py-2">Total cost</th>
                        <th className="px-3 py-2">Travel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-emerald-50/50">
                        <td className="px-3 py-2 font-semibold text-slate-900">Hungarian (optimal)</td>
                        <td className="px-3 py-2 text-slate-700">{data.assignments.length}</td>
                        <td className="px-3 py-2 font-bold text-emerald-700">{data.totalCost}</td>
                        <td className="px-3 py-2 text-slate-700">{data.totalDistanceKm} km</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-slate-700">Greedy — nearest free engineer</td>
                        <td className="px-3 py-2 text-slate-600">{data.naiveAssigned}</td>
                        <td className="px-3 py-2 text-slate-600">{data.naiveTotalCost}</td>
                        <td className="px-3 py-2 text-slate-600">{data.naiveTotalDistanceKm} km</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
                  <TrendingDown size={15} className="text-emerald-600" />
                  {data.costImprovementPct > 0 ? (
                    <>Hungarian is <strong>{data.costImprovementPct}%</strong> cheaper and saves{" "}
                      <strong>{Math.round((data.naiveTotalDistanceKm - data.totalDistanceKm) * 10) / 10} km</strong> of driving.</>
                  ) : (
                    <>Greedy matches the optimal allocation on this queue — they agree when the
                      cheapest choices happen not to compete.</>
                  )}
                </p>
              </Card>

              <Card className="mb-6" title={`Proposed assignments (${data.assignments.length})`}>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="px-2.5 py-1.5">Ref</th>
                        <th className="px-2.5 py-1.5">Damage</th>
                        <th className="px-2.5 py-1.5">Priority</th>
                        <th className="px-2.5 py-1.5">Engineer</th>
                        <th className="px-2.5 py-1.5">Distance</th>
                        <th className="px-2.5 py-1.5">Skill</th>
                        <th className="px-2.5 py-1.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.assignments.map((a) => (
                        <tr key={a.complaint.ref}>
                          <td className="px-2.5 py-1.5">
                            <Link to={`/app/complaints/${a.complaint.ref}`} className="font-medium text-brand-700 hover:underline">{a.complaint.ref}</Link>
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-700">{a.complaint.category}</td>
                          <td className="px-2.5 py-1.5"><PriorityBadge priority={a.complaint.priority} /></td>
                          <td className="px-2.5 py-1.5">
                            <span className="font-medium text-slate-800">{a.engineer.name}</span>
                            <span className="ml-1.5 font-mono text-[10px] text-slate-400">{a.engineer.code}</span>
                            <span className="ml-1.5 text-[10px] text-slate-500">{a.engineer.openJobs} open</span>
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-700">{a.distanceKm} km</td>
                          <td className="px-2.5 py-1.5">
                            {a.skillMatch
                              ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><Check size={12} /> yes</span>
                              : <span className="inline-flex items-center gap-0.5 text-amber-600"><X size={12} /> no</span>}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-600">{a.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {data.unassigned.length > 0 && (
                <Card title={`Not dispatched this round (${data.unassigned.length})`}>
                  <p className="mb-3 text-sm text-slate-500">
                    Each engineer takes one job per round, so a queue longer than the roster
                    carries over. Run the optimiser again once these are completed.
                  </p>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {data.unassigned.map((u) => (
                          <tr key={u.ref}>
                            <td className="px-2.5 py-1.5">
                              <Link to={`/app/complaints/${u.ref}`} className="font-medium text-brand-700 hover:underline">{u.ref}</Link>
                            </td>
                            <td className="max-w-[320px] truncate px-2.5 py-1.5 text-slate-700">{u.title}</td>
                            <td className="px-2.5 py-1.5 text-slate-500">{u.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
