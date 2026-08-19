import { Wrench } from "lucide-react";
import { useApi } from "../lib/useApi";
import { PageHeader, EmptyState } from "../components/ui";

type E = {
  id: string; code: string; name: string; status: string; skills: string; lat: number; lng: number; resolvedJobs: number;
  department: { name: string }; complaints: { id: string }[];
};
const STATUS_STYLE: Record<string, string> = { AVAILABLE: "bg-emerald-50 text-emerald-700", ON_TASK: "bg-amber-50 text-amber-700", OFF_DUTY: "bg-slate-100 text-slate-500" };

export function Engineers() {
  const { data, loading, error } = useApi<{ engineers: E[] }>("/engineers");
  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error || !data) return <EmptyState title="Engineers view unavailable" hint={error || "This backend does not expose engineer data yet."} />;
  return (
    <>
      <PageHeader title="Field Engineers" subtitle="Skills and live positions feed the assignment optimiser" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.engineers.map((e) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{(e.name ?? "?").split(" ").map((p) => p[0] ?? "").slice(0, 2).join("")}</span>
                <div><h2 className="font-semibold text-slate-900">{e.name ?? "Unknown"}</h2><p className="text-xs text-slate-500">{e.code} · {e.department?.name ?? "—"}</p></div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>{e.status === "AVAILABLE" ? "Available" : e.status === "ON_TASK" ? "On Task" : "Off Duty"}</span>
            </div>
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><Wrench size={11} /> Damage classes handled</p>
              <div className="flex flex-wrap gap-1.5">{(e.skills ?? "").split(",").filter(Boolean).map((s) => <span key={s.trim()} className="rounded bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">{s.trim()}</span>)}</div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-sm">
              <div><div className="font-bold text-slate-900">{(e.complaints ?? []).length}</div><div className="text-[11px] text-slate-500">Open jobs</div></div>
              <div><div className="font-bold text-slate-900">{e.resolvedJobs ?? 0}</div><div className="text-[11px] text-slate-500">Resolved</div></div>
              <div><div className="font-mono text-[11px] font-bold text-slate-700">{e.lat != null ? e.lat.toFixed(3) : "—"}<br />{e.lng != null ? e.lng.toFixed(3) : "—"}</div><div className="text-[11px] text-slate-500">Position</div></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
