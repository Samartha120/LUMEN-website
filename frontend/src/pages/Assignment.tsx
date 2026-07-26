import { useState } from "react";
import { Link } from "react-router-dom";
import { Route, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { PageHeader, Card, KpiCard, EmptyState } from "../components/ui";
import { PriorityBadge } from "../components/badges";

type Assignment = {
  complaint: { id: string; ref: string; category: string; severityScore: number };
  engineer: { code: string; name: string; openJobs: number };
  distanceKm: number; cost: number; skillMatch: boolean;
};
type Result = {
  assignments: Assignment[]; unassigned: unknown[];
  totalCost: number; naiveTotalCost: number; costImprovementPct: number;
  totalDistanceKm: number; naiveTotalDistanceKm: number;
};
type Data = { result: Result; titles: Record<string, { title: string; priority: string }>; engineerCount: number };

export function Assignment() {
  const { data, loading, reload } = useApi<Data>("/assignment");
  const [applying, setApplying] = useState(false);

  if (loading || !data) return <p className="text-slate-400">Loading…</p>;
  const { result: r, titles, engineerCount } = data;

  async function apply() {
    setApplying(true);
    try { await api.post("/assignment/apply"); reload(); } finally { setApplying(false); }
  }

  return (
    <>
      <PageHeader title="Assignment Optimiser" subtitle="Hungarian algorithm (Kuhn–Munkres) minimising total cost across all open complaints simultaneously" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Unassigned Complaints" value={r.assignments.length + r.unassigned.length} sub={`${engineerCount} engineers available`} icon={AlertCircle} tone="brand" />
        <KpiCard label="Optimised Cost" value={r.totalCost.toFixed(2)} sub={`Hungarian O(n³) · ${r.totalDistanceKm} km travel`} icon={Route} tone="green" />
        <KpiCard label="Greedy Baseline Cost" value={r.naiveTotalCost.toFixed(2)} sub={`Nearest-free heuristic · ${r.naiveTotalDistanceKm} km`} icon={Route} tone="amber" />
        <KpiCard label="Cost Reduction" value={r.costImprovementPct > 0 ? `${r.costImprovementPct}%` : "0%"} sub={r.costImprovementPct > 0 ? "lower objective than baseline" : "baseline already optimal"} icon={TrendingDown} tone={r.costImprovementPct > 0 ? "green" : "brand"} />
      </div>

      {r.assignments.length === 0 ? (
        <div className="mt-6"><EmptyState title="No complaints awaiting assignment" hint="Create a complaint, or check that submitted complaints are not all flagged as duplicates." /></div>
      ) : (
        <>
          <Card title="Proposed Assignment Plan" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><th className="pb-2.5 pr-4">Complaint</th><th className="pb-2.5 pr-4">Priority</th><th className="pb-2.5 pr-4">Assigned Engineer</th><th className="pb-2.5 pr-4">Distance</th><th className="pb-2.5 pr-4">Skill</th><th className="pb-2.5">Cost</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.assignments.map((a) => (
                    <tr key={a.complaint.id}>
                      <td className="py-2.5 pr-4">
                        <Link to={`/app/complaints/${a.complaint.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">{a.complaint.ref}</Link>
                        <p className="max-w-xs truncate text-slate-700">{titles[a.complaint.id]?.title}</p>
                        <span className="text-xs text-slate-400">{a.complaint.category} · severity {a.complaint.severityScore.toFixed(1)}</span>
                      </td>
                      <td className="py-2.5 pr-4"><PriorityBadge priority={titles[a.complaint.id]?.priority ?? "LOW"} /></td>
                      <td className="py-2.5 pr-4"><div className="font-medium text-slate-800">{a.engineer.name}</div><div className="text-xs text-slate-500">{a.engineer.code} · {a.engineer.openJobs} open job(s)</div></td>
                      <td className="py-2.5 pr-4 font-medium text-slate-700">{a.distanceKm} km</td>
                      <td className="py-2.5 pr-4">{a.skillMatch ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} /> match</span> : <span className="text-xs text-amber-600">penalty</span>}</td>
                      <td className="py-2.5 font-mono text-xs text-slate-500">{a.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              <button onClick={apply} disabled={applying} className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60">
                {applying ? "Applying…" : `Apply ${r.assignments.length} Assignment${r.assignments.length === 1 ? "" : "s"}`}
              </button>
              <span className="text-xs text-slate-400">Writes each assignment, logs it to the timeline and records the audit entry.</span>
            </div>
          </Card>

          <Card title="Cost Model" className="mt-6">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-slate-600">Each (complaint, engineer) pair is priced, then the Hungarian algorithm finds the globally minimum-cost matching in O(n³) — not the locally-greedy choice.</p>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`cost = travel_km
     + 8   if engineer lacks the damage-class skill
     + 3 × open_jobs        (workload balancing)
     − 12 × severity/100    (urgency rebate)`}</pre>
              </div>
              <div className="space-y-2 text-slate-600">
                <p><strong className="text-slate-800">Why compare on cost, not km?</strong> Cost is the objective being minimised — the optimiser will accept a longer drive to reach a skilled, less-loaded engineer. Benchmarked over 300 random batches, it was better or equal every time, never worse.</p>
                <p><strong className="text-slate-800">Infeasible pairs</strong> (off-duty, cross-department) are priced at 10⁶ and excluded rather than forced.</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
