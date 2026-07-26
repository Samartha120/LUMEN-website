import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Copy } from "lucide-react";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { STATUS_LABELS } from "../lib/rbac";
import { ageOf } from "../lib/format";
import { PageHeader, EmptyState } from "../components/ui";
import { StatusBadge, PriorityBadge, SeverityMeter, ModelModeBadge } from "../components/badges";

type Row = {
  id: string; ref: string; title: string; zone: string; category: string; aiModelMode: string | null;
  severityScore: number | null; severityBand: string | null; priority: string; status: string;
  createdAt: string; department: { name: string }; engineer: { name: string } | null; duplicateOf: { ref: string } | null;
};

export function Complaints() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  const { data, loading } = useApi<{ complaints: Row[] }>(`/complaints${qs.toString() ? `?${qs}` : ""}`);

  const canCreate = ["SUPERVISOR", "ADMINISTRATOR"].includes(user!.role);
  const setStatus = (s: string) => {
    const p = new URLSearchParams(params);
    if (s) p.set("status", s); else p.delete("status");
    setParams(p);
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams(params);
    if (search) p.set("q", search); else p.delete("q");
    setParams(p);
  };

  const complaints = data?.complaints ?? [];

  return (
    <>
      <PageHeader
        title="Complaint Queue"
        subtitle={`${complaints.length} complaint${complaints.length === 1 ? "" : "s"}, ranked by CV-derived severity${user!.role === "ENGINEER" ? " · your assignments only" : ""}`}
        action={canCreate ? (
          <Link to="/app/complaints/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">
            <Plus size={16} /> New Complaint
          </Link>
        ) : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="mr-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or CMP ref…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
        </form>
        <button onClick={() => setStatus("")} className={`rounded-full px-3 py-1 text-xs font-medium ${!status ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>All</button>
        {Object.keys(STATUS_LABELS).map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? <p className="text-slate-400">Loading…</p> : complaints.length === 0 ? (
        <EmptyState title="No complaints match" hint="Try clearing a filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Ref</th><th className="px-4 py-3">Complaint</th><th className="px-4 py-3">Damage Class</th>
                <th className="px-4 py-3">Severity</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Engineer</th><th className="px-4 py-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.map((c) => (
                <tr key={c.id} className="hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link to={`/app/complaints/${c.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">{c.ref}</Link>
                    {c.duplicateOf && <span title={`Duplicate of ${c.duplicateOf.ref}`} className="ml-1.5 inline-flex text-amber-600"><Copy size={12} /></span>}
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <Link to={`/app/complaints/${c.ref}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">{c.title}</Link>
                    <span className="text-xs text-slate-500">{c.zone} · {c.department.name}</span>
                  </td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-700">{c.category}</div><ModelModeBadge mode={c.aiModelMode} /></td>
                  <td className="px-4 py-3"><SeverityMeter score={c.severityScore} band={c.severityBand} compact /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.engineer?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{ageOf(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
