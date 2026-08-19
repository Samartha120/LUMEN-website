import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Route, TrendingDown, CheckCircle2, AlertCircle, Layers, MapPin, History, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { PageHeader, Card, KpiCard, EmptyState } from "../components/ui";
import { PriorityBadge, FactorBreakdown } from "../components/badges";
import { PRIORITY_LEVEL_ORDER, toPriorityLevel } from "../lib/types";
import type { AssignmentData, PriorityLevel, AssignmentTitlesMap } from "../lib/types";
import { ageOf } from "../lib/format";

function sortAssignmentsUrgentFirst<T extends { complaint: { priorityLevel?: string; priorityScore?: number; createdAt?: string } }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const la = PRIORITY_LEVEL_ORDER[toPriorityLevel(a.complaint.priorityLevel)];
    const lb = PRIORITY_LEVEL_ORDER[toPriorityLevel(b.complaint.priorityLevel)];
    if (la !== lb) return lb - la;
    const sa = a.complaint.priorityScore ?? 0;
    const sb = b.complaint.priorityScore ?? 0;
    if (sa !== sb) return sb - sa;
    const ta = a.complaint.createdAt ? new Date(a.complaint.createdAt).getTime() : 0;
    const tb = b.complaint.createdAt ? new Date(b.complaint.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return 0;
  });
}

export function Assignment() {
  const { data, loading, error, reload } = useApi<AssignmentData>("/assignment");
  const [applying, setApplying] = useState(false);
  const [filter, setFilter] = useState<PriorityLevel | "ALL">("ALL");
  const { result: r, titles, engineerCount } = data ?? { result: { assignments: [], unassigned: [], totalCost: 0, naiveTotalCost: 0, totalDistanceKm: 0, naiveTotalDistanceKm: 0, costImprovementPct: 0 }, titles: {}, engineerCount: 0 };

  const sortedAssignments = useMemo(() => sortAssignmentsUrgentFirst(r.assignments), [r.assignments]);

  const visible = useMemo(() => {
    if (filter === "ALL") return sortedAssignments;
    return sortedAssignments.filter((a) => toPriorityLevel(a.complaint.priorityLevel ?? titles[a.complaint.id]?.priorityLevel) === filter);
  }, [sortedAssignments, filter, titles]);

  const filterCounts = useMemo(() => {
    const c: Record<PriorityLevel, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of sortedAssignments) {
      const lv = toPriorityLevel(a.complaint.priorityLevel ?? titles[a.complaint.id]?.priorityLevel);
      c[lv]++;
    }
    return c;
  }, [sortedAssignments, titles]);

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error || !data) return <EmptyState title="Assignment optimiser unavailable" hint={error || "This backend does not expose assignment data yet."} />;

  async function apply() {
    setApplying(true);
    try { await api.post("/assignment/apply"); reload(); } finally { setApplying(false); }
  }

  const priorityFilters: Array<PriorityLevel | "ALL"> = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"];

  return (
    <>
      <PageHeader title="Assignment Optimiser" subtitle="Hungarian algorithm minimising total cost. Urgent complaints surface first with full priority context for engineers." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Unassigned Complaints" value={sortedAssignments.length + r.unassigned.length} sub={`${engineerCount} engineers available`} icon={AlertCircle} tone="brand" />
        <KpiCard label="Optimised Cost" value={r.totalCost.toFixed(2)} sub={`Hungarian O(n³) · ${r.totalDistanceKm} km travel`} icon={Route} tone="green" />
        <KpiCard label="Greedy Baseline Cost" value={r.naiveTotalCost.toFixed(2)} sub={`Nearest-free heuristic · ${r.naiveTotalDistanceKm} km`} icon={Route} tone="amber" />
        <KpiCard label="Cost Reduction" value={r.costImprovementPct > 0 ? `${r.costImprovementPct}%` : "0%"} sub={r.costImprovementPct > 0 ? "lower objective than baseline" : "baseline already optimal"} icon={TrendingDown} tone={r.costImprovementPct > 0 ? "green" : "brand"} />
      </div>

      {sortedAssignments.length === 0 ? (
        <div className="mt-6"><EmptyState title="No complaints awaiting assignment" hint="Create a complaint, or check that submitted complaints are not all flagged as duplicates." /></div>
      ) : (
        <>
          <Card
            title="Proposed Assignment Plan"
            className="mt-6"
          >
            <p className="mb-4 -mt-1 text-xs text-slate-500 border-b border-slate-100 pb-3">Sorted: CRITICAL → HIGH → MEDIUM → LOW, then higher score first, then oldest complaint first.</p>
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
              {priorityFilters.map((p) => (
                <button
                  key={p}
                  onClick={() => setFilter(p)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition " +
                    (filter === p
                      ? "bg-slate-900 text-white shadow"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                  }
                >
                  {p === "ALL" ? "All" : <PriorityBadge priority={p} inline />}
                  <span className="text-slate-500">{p === "ALL" ? sortedAssignments.length : filterCounts[p as PriorityLevel]}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No assignments match the selected priority filter.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {visible.map((a) => {
                  const titleInfo = (titles[a.complaint.id] ?? {}) as AssignmentTitlesMap[string];
                  const title = titleInfo.title ?? a.complaint.category;
                  const priorityLevel = toPriorityLevel(a.complaint.priorityLevel ?? titleInfo.priorityLevel);
                  const priorityScore = a.complaint.priorityScore ?? titleInfo.priorityScore ?? 0;
                  const reasons = a.complaint.priorityReasons ?? titleInfo.priorityReasons ?? [];
                  const factors = a.complaint.priorityFactors ?? titleInfo.priorityFactors;
                  const duplicateCount = a.complaint.duplicateCount ?? titleInfo.duplicateCount ?? 0;
                  const createdAt = a.complaint.createdAt ?? titleInfo.createdAt;
                  return (
                    <div key={a.complaint.id} className="grid gap-4 py-4 sm:grid-cols-12">
                      <div className="sm:col-span-7 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/app/complaints/${a.complaint.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">{a.complaint.ref}</Link>
                          <PriorityBadge priority={priorityLevel} />
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                            {priorityScore.toFixed(0)}/100
                          </span>
                          {duplicateCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                              <Layers size={11} />
                              {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-slate-800">{title}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><History size={12} /> {createdAt ? ageOf(createdAt) : "—"} old</span>
                          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {a.complaint.zone ?? "—"}</span>
                          <span className="capitalize">{(a.complaint.category ?? "UNKNOWN_CATEGORY").replace(/_/g, " ").toLowerCase()}</span>
                          <span>severity {(a.complaint.severityScore ?? 0).toFixed(1)}</span>
                          <span className="font-medium text-slate-700">{a.complaint.department?.name ?? ""}</span>
                        </div>
                        {reasons.length > 0 && (
                          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              <Sparkles size={11} /> Why this priority
                            </div>
                            <ul className="space-y-0.5 text-xs text-slate-600">
                              {reasons.slice(0, 3).map((r: string, i: number) => (
                                <li key={i}>• {r}</li>
                              ))}
                              {reasons.length > 3 && <li className="text-slate-400">• …+{reasons.length - 3} more</li>}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-3">
                        {factors && <FactorBreakdown factors={factors} compact />}
                      </div>

                      <div className="sm:col-span-2 space-y-3 border-l-0 sm:border-l sm:border-slate-100 sm:pl-4">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Engineer</div>
                          <div className="mt-0.5 font-medium text-slate-800">{a.engineer?.name ?? "Unassigned"}</div>
                          <div className="text-xs text-slate-500">{a.engineer ? `${a.engineer.code} · ${a.engineer.openJobs ?? 0} open · zone ${a.engineer.zone ?? "—"}` : "No engineer assigned"}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-slate-400">Distance</div>
                            <div className="font-mono font-semibold text-slate-700">{a.distanceKm}km</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Skill</div>
                            <div>{a.skillMatch ? <span className="inline-flex items-center gap-0.5 text-emerald-700"><CheckCircle2 size={12} /> match</span> : <span className="text-amber-600">penalty</span>}</div>
                          </div>
                          <div>
                            <div className="text-slate-400">Cost</div>
                            <div className="font-mono font-semibold text-slate-700">{a.cost}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              <button onClick={apply} disabled={applying} className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60">
                {applying ? "Applying…" : `Apply ${sortedAssignments.length} Assignment${sortedAssignments.length === 1 ? "" : "s"}`}
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
                <p><strong className="text-slate-800">Priority-aware triage.</strong> The work queue on this page surfaces CRITICAL/HIGH items above skill/cost so engineers see life-safety issues first — the optimiser still produces the same minimum-cost matching underneath.</p>
              </div>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
