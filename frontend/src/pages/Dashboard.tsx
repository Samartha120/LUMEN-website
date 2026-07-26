import { Link } from "react-router-dom";
import { ClipboardList, ScanSearch, ShieldCheck, Copy, Cpu, AlertTriangle } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { ROLE_LABELS } from "../lib/rbac";
import { fmtDateTime } from "../lib/format";
import { KpiCard, Card, PageHeader } from "../components/ui";
import { StatusBadge, PriorityBadge, SeverityMeter } from "../components/badges";
import { SimpleBarChart, DonutChart } from "../components/charts";

const OPEN = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];
type Complaint = {
  id: string; ref: string; title: string; category: string; status: string; priority: string;
  severityScore: number | null; severityBand: string | null; duplicateOfId: string | null;
  verifyVerdict: string | null; createdAt: string; engineer: { name: string } | null;
};
type Health = { model_mode: string; note: string } | null;

export function Dashboard() {
  const { user } = useAuth();
  const { data, loading } = useApi<{ complaints: Complaint[]; ai: Health }>("/dashboard");

  if (loading || !data) return <p className="text-slate-400">Loading…</p>;
  const complaints = data.complaints;
  const health = data.ai;

  const open = complaints.filter((c) => OPEN.includes(c.status));
  const dups = complaints.filter((c) => c.duplicateOfId !== null);
  const verified = complaints.filter((c) => c.verifyVerdict === "VERIFIED");
  const rejected = complaints.filter((c) => c.verifyVerdict === "REJECTED");
  const scored = complaints.filter((c) => (c.severityScore ?? 0) > 0);
  const avgSeverity = scored.length ? scored.reduce((s, c) => s + (c.severityScore ?? 0), 0) / scored.length : 0;

  const byClass = Object.entries(complaints.reduce<Record<string, number>>((a, c) => { a[c.category] = (a[c.category] ?? 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const bandColors: Record<string, string> = { SEVERE: "#ef4444", SIGNIFICANT: "#f59e0b", MODERATE: "#0ea5e9", MINOR: "#94a3b8", NONE: "#cbd5e1" };
  const byBand = Object.entries(complaints.reduce<Record<string, number>>((a, c) => { const b = c.severityBand ?? "NONE"; a[b] = (a[b] ?? 0) + 1; return a; }, {}))
    .map(([name, value]) => ({ name: name.charAt(0) + name.slice(1).toLowerCase(), value, color: bandColors[name] ?? "#cbd5e1" }));

  return (
    <>
      <PageHeader title={`Good day, ${user?.name.split(" ")[0]}`} subtitle={`${ROLE_LABELS[user!.role]} · AI-assisted civic damage operations`} />

      {!health ? (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={16} /><span><strong>AI service offline.</strong> Detection, duplicate checking and verification are unavailable.</span>
        </div>
      ) : (
        <div className={`mb-5 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm ${health.model_mode === "TRAINED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : health.model_mode === "HEURISTIC" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          <Cpu size={16} /><span><strong>AI service online</strong> — {health.note}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Complaints" value={open.length} sub={`${complaints.length} total`} icon={ClipboardList} tone="brand" />
        <KpiCard label="Mean Severity" value={avgSeverity.toFixed(1)} sub="CV-derived, 0–100" icon={ScanSearch} tone={avgSeverity >= 50 ? "red" : "amber"} />
        <KpiCard label="Duplicates Caught" value={dups.length} sub="image + geo matched" icon={Copy} tone="amber" />
        <KpiCard label="Repairs Verified" value={verified.length} sub={`${rejected.length} rejected by AI`} icon={ShieldCheck} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Complaints by Damage Class" className="lg:col-span-2"><SimpleBarChart data={byClass} horizontal /></Card>
        <Card title="Severity Distribution"><DonutChart data={byBand} /></Card>
      </div>

      <Card title="Highest-Severity Open Complaints" className="mt-6">
        <div className="divide-y divide-slate-100">
          {open.sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0)).slice(0, 6).map((c) => (
            <Link key={c.id} to={`/app/complaints/${c.ref}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand-700">{c.ref}</span>
                  <PriorityBadge priority={c.priority} />
                </div>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{c.title}</p>
                <p className="text-xs text-slate-500">{c.category} · {c.engineer?.name ?? "unassigned"} · {fmtDateTime(c.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge status={c.status} />
                <SeverityMeter score={c.severityScore} band={c.severityBand} compact />
              </div>
            </Link>
          ))}
          {open.length === 0 && <p className="py-4 text-sm text-slate-400">No open complaints.</p>}
        </div>
      </Card>
    </>
  );
}
