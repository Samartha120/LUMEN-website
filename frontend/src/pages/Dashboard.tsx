import { Link } from "react-router-dom";
import { ClipboardList, ScanSearch, ShieldCheck, Copy, Cpu, AlertTriangle, MapPin, History, Layers } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { ROLE_LABELS } from "../lib/rbac";
import { fmtDateTime } from "../lib/format";
import { KpiCard, Card, PageHeader } from "../components/ui";
import { StatusBadge, PriorityBadge, SeverityMeter, FactorBreakdown } from "../components/badges";
import { SimpleBarChart, DonutChart } from "../components/charts";
import type { DashboardComplaint, PriorityLevel, PriorityFactors } from "../lib/types";
import { PRIORITY_LEVEL_ORDER } from "../lib/types";

const OPEN = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];

type Health = { model_mode: string; note: string } | null;

function sortDashboardComplaints<T extends DashboardComplaint>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const la = PRIORITY_LEVEL_ORDER[(a.priorityLevel as PriorityLevel) ?? "LOW"] ?? 1;
    const lb = PRIORITY_LEVEL_ORDER[(b.priorityLevel as PriorityLevel) ?? "LOW"] ?? 1;
    if (la !== lb) return lb - la;
    const sa = a.priorityScore ?? 0;
    const sb = b.priorityScore ?? 0;
    if (Math.abs(sa - sb) > 0.001) return sb - sa;
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
  });
}

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useApi<{ complaints: DashboardComplaint[]; ai: Health }>("/dashboard");

  if (loading || !data) return <p className="text-slate-400">Loading…</p>;
  const complaints = data.complaints;
  const health = data.ai;

  const open = complaints.filter((c) => OPEN.includes(c.status as (typeof OPEN)[number]));
  const dups = complaints.filter((c) => c.duplicateOfId !== null);
  const verified = complaints.filter((c) => c.verifyVerdict === "VERIFIED");
  const rejected = complaints.filter((c) => c.verifyVerdict === "REJECTED");
  const scored = complaints.filter((c) => (c.severityScore ?? 0) > 0);
  const avgSeverity = scored.length
    ? scored.reduce((s, c) => s + (c.severityScore ?? 0), 0) / scored.length
    : 0;

  const byClass = Object.entries(
    complaints.reduce<Record<string, number>>((a, c) => {
      a[c.category] = (a[c.category] ?? 0) + 1;
      return a;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const bandColors: Record<string, string> = {
    SEVERE: "#ef4444",
    SIGNIFICANT: "#f59e0b",
    MODERATE: "#0ea5e9",
    MINOR: "#94a3b8",
    NONE: "#cbd5e1",
  };
  const byBand = Object.entries(
    complaints.reduce<Record<string, number>>((a, c) => {
      const b = c.severityBand ?? "NONE";
      a[b] = (a[b] ?? 0) + 1;
      return a;
    }, {}),
  ).map(([name, value]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    value,
    color: bandColors[name] ?? "#cbd5e1",
  }));

  const byPriority = Object.entries(
    open.reduce<Record<string, number>>((a, c) => {
      const lv = (c.priorityLevel ?? c.priority ?? "LOW") as string;
      a[lv] = (a[lv] ?? 0) + 1;
      return a;
    }, {}),
  ).map(([name, value]) => ({ label: name, value }));

  const topOpen = sortDashboardComplaints(open).slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Good day, ${(user?.name ?? "Operator").split(" ")[0] ?? "Operator"}`}
        subtitle={`${ROLE_LABELS[(user?.role ?? "SUPERVISOR") as keyof typeof ROLE_LABELS]} · AI-assisted civic damage operations`}
      />

      {!health ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} />
          <span>
            <strong>AI service offline.</strong> Detection, duplicate checking and verification are unavailable.
          </span>
        </div>
      ) : (
        <div
          className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm ${
            health.model_mode === "TRAINED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : health.model_mode === "HEURISTIC"
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <Cpu size={16} />
          <span>
            <strong>AI service online</strong> — {health.note}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Complaints" value={open.length} sub={`${complaints.length} total`} icon={ClipboardList} tone="brand" />
        <KpiCard label="Mean Severity" value={avgSeverity.toFixed(1)} sub="CV-derived, 0–100" icon={ScanSearch} tone={avgSeverity >= 50 ? "red" : "amber"} />
        <KpiCard label="Duplicates Caught" value={dups.length} sub="image + geo matched" icon={Copy} tone="amber" />
        <KpiCard label="Repairs Verified" value={verified.length} sub={`${rejected.length} rejected by AI`} icon={ShieldCheck} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Complaints by Damage Class" className="lg:col-span-1">
          <SimpleBarChart data={byClass} horizontal />
        </Card>
        <Card title="Severity Distribution" className="lg:col-span-1">
          <DonutChart data={byBand} />
        </Card>
        <Card title="Open By Priority Level" className="lg:col-span-1">
          <SimpleBarChart data={byPriority} horizontal />
        </Card>
      </div>

      <Card
        title="Highest-Priority Open Complaints"
        className="mt-6"
      >
        <p className="mb-4 -mt-1 text-xs text-slate-500 border-b border-slate-100 pb-3">Sorted CRITICAL → HIGH → MEDIUM → LOW, then by score, then by complaint age (oldest first).</p>
        <div className="divide-y divide-slate-100">
          {topOpen.length === 0 && <p className="py-4 text-sm text-slate-400">No open complaints.</p>}
          {topOpen.map((c) => (
            <div key={c.id} className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/complaints/${c.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">
                    {c.ref}
                  </Link>
                  <PriorityBadge priority={c.priorityLevel ?? c.priority} />
                  <div className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                    {Math.round(c.priorityScore ?? 0)}<span className="text-slate-400">/100</span>
                  </div>
                  {typeof c.duplicateCount === "number" && c.duplicateCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                      <Layers size={11} />
                      {c.duplicateCount} duplicate{c.duplicateCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <Link to={`/app/complaints/${c.ref}`} className="mt-1 block truncate text-sm font-medium text-slate-800 hover:text-brand-700">
                  {c.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{c.category}</span>
                  <span>·</span>
                  <span>{c.engineer?.name ?? "unassigned"}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1"><History size={11} /> {fmtDateTime(c.createdAt)}</span>
                  {c.zone && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1"><MapPin size={11} /> {c.zone}</span>
                    </>
                  )}
                </div>
                {c.priorityReasons && c.priorityReasons.length > 0 && (
                  <ul className="mt-2 space-y-0.5 pl-1 text-xs text-slate-500">
                    {c.priorityReasons.slice(0, 2).map((r, i) => (
                      <li key={i} className="truncate">
                        <span className="text-brand-500 font-bold">•</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2 md:min-w-[220px]">
                <div className="flex w-full items-center justify-end gap-2">
                  <StatusBadge status={c.status} />
                </div>
                <SeverityMeter score={c.severityScore} band={c.severityBand} compact />
                <div className="w-full rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-100">
                  <FactorBreakdown factors={c.priorityFactors as PriorityFactors | undefined} compact />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
