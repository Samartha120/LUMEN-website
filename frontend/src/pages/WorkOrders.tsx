import { Link } from "react-router-dom";
import { Route, Layers, Clock } from "lucide-react";
import { useApi } from "../lib/useApi";
import { PageHeader, Card, KpiCard, EmptyState } from "../components/ui";
import { PriorityBadge, StatusBadge } from "../components/badges";
import { CategoryBadge } from "../components/CategoryBadge";

type Member = {
  id: string; ref: string; title: string; status: string;
  severityScore: number | null; priorityScore: number | null; address: string;
};
type Cluster = {
  key: string; category: string; civicCategory: string | null; zone: string;
  members: Member[]; spreadM: number; worstPriorityScore: number;
  worstSeverity: number; dueHours: number; visitsSaved: number;
};
type Payload = {
  radiusM: number;
  clusters: Cluster[];
  summary: { openComplaints: number; clusters: number; complaintsInClusters: number; visitsSaved: number };
};

/** Negative hours are overdue, and saying so is more useful than a minus sign. */
function due(h: number): { text: string; late: boolean } {
  if (h < 0) {
    const d = Math.round(-h / 24);
    return { text: d >= 1 ? `${d} day${d === 1 ? "" : "s"} overdue` : `${-h} h overdue`, late: true };
  }
  const d = Math.round(h / 24);
  return { text: d >= 1 ? `due in ${d} day${d === 1 ? "" : "s"}` : `due in ${h} h`, late: false };
}

export function WorkOrders() {
  const { data, loading } = useApi<Payload>("/clusters");
  if (!data) return <p className="text-slate-400">{loading ? "Loading…" : "Unavailable."}</p>;
  const { clusters, summary, radiusM } = data;

  return (
    <>
      <PageHeader
        title="Work Orders"
        subtitle={`Open complaints within ${radiusM} m of each other, grouped into one visit per crew`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Work Orders" value={summary.clusters} sub={`from ${summary.complaintsInClusters} complaints`} icon={Layers} />
        <KpiCard label="Visits Saved" value={summary.visitsSaved} sub="one crew instead of one per report" icon={Route} tone="green" />
        <KpiCard label="Open Complaints" value={summary.openComplaints} sub={`${summary.openComplaints - summary.complaintsInClusters} standalone`} icon={Clock} tone="amber" />
      </div>

      {clusters.length === 0 ? (
        <EmptyState
          title="No complaints are close enough to group"
          hint={`Grouping needs two or more of the same kind within ${radiusM} m of each other.`}
        />
      ) : (
        <div className="space-y-4">
          {clusters.map((cl) => {
            const d = due(cl.dueHours);
            return (
              <Card key={cl.key}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {cl.members.length} × {cl.category}
                      </h3>
                      <CategoryBadge category={cl.civicCategory} />
                      <PriorityBadge priority={cl.worstPriorityScore >= 75 ? "CRITICAL" : cl.worstPriorityScore >= 55 ? "HIGH" : cl.worstPriorityScore >= 30 ? "MEDIUM" : "LOW"} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {cl.zone} · {cl.spreadM === 0 ? "same location" : `spread over ${cl.spreadM} m`} ·{" "}
                      <span className={d.late ? "font-medium text-red-600" : ""}>{d.text}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-2xl font-bold leading-none text-emerald-700">−{cl.visitsSaved}</p>
                    <p className="text-xs text-slate-500">visits</p>
                  </div>
                </div>

                <ul className="mt-3 divide-y divide-slate-50">
                  {cl.members.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link to={`/app/complaints/${m.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">
                          {m.ref}
                        </Link>
                        <span className="ml-2 text-sm text-slate-700">{m.title}</span>
                        <div className="text-xs text-slate-400">{m.address}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-xs text-slate-500">sev {(m.severityScore ?? 0).toFixed(0)}</span>
                        <StatusBadge status={m.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
