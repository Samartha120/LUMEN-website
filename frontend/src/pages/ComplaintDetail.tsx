
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, PlusCircle, Activity
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { fmtDateTime, ageOf } from "../lib/format";
import { Card } from "../components/ui";
import { StatusBadge, PriorityBadge, SeverityMeter } from "../components/badges";

type AiPrediction = {
  damageClass: string;
  confidenceScore: number;
  boundingBoxes: any;
  metadata: any;
};

type TimelineEvent = {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
};

type Complaint = {
  id: string; trackingId: string; title: string; description: string; category: string;
  latitude: number; longitude: number; status: string; priority: string; createdAt: string;
  severity: number | null; confidence: number | null;
  imageUrl: string; videoUrl: string | null;
  reporter: { fullName: string } | null;
  aiPrediction: AiPrediction | null;
  timeline: TimelineEvent[];
};

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  REJECTED: []
};

export function ComplaintDetail() {
  const { ref } = useParams();
  const { user } = useAuth();
  const { data: complaint, loading, reload } = useApi<Complaint>(`/complaints/${ref}`);

  if (loading || !complaint) return <p className="text-slate-400">Loading…</p>;

  const c = complaint;
  const isSuperAdmin = ["SUPER_ADMIN", "ADMIN", "ADMINISTRATOR"].includes(user!.role);
  const possibleTransitions = isSuperAdmin ? NEXT_STATUSES[c.status] || [] : [];

  async function transition(to: string) {
    await api.patch(`/v1/admin/complaints/${c.id}/status`, { status: to });
    reload();
  }

  const dets = c.aiPrediction?.boundingBoxes ? c.aiPrediction.boundingBoxes : [];

  return (
    <>
      <Link to="/app/complaints" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft size={15} /> Complaint Queue</Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-700">{c.trackingId}</span>
          <StatusBadge status={c.status} /><PriorityBadge priority={c.priority} />
        </div>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-900">{c.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{c.category} · reported {fmtDateTime(c.createdAt)} · {ageOf(c.createdAt)} old</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Damage Detection">
            {c.imageUrl ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Reported Photo</p>
                  <img src={c.imageUrl} alt="Reported" className="w-full rounded-lg border border-slate-200 object-cover" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
                  <div className="flex h-full items-start rounded-lg bg-slate-50 p-4 text-sm text-slate-700 border border-slate-200">
                    {c.description}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-slate-400">No photograph on record.</p>}
            
            <div className="mt-4 border-t border-slate-100 pt-4">
              {!c.aiPrediction ? <p className="text-sm text-slate-500">No AI predictions available yet.</p> : (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-2">AI Analysis</h4>
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2">Predicted Class</th><th className="pb-2">Confidence</th><th className="pb-2">Bounding Boxes</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 font-medium text-slate-800">{c.aiPrediction.damageClass}</td>
                        <td className="py-2 text-slate-600">{(c.aiPrediction.confidenceScore * 100).toFixed(1)}%</td>
                        <td className="py-2 font-mono text-xs text-slate-400">{dets.length || 0} regions detected</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {possibleTransitions.length > 0 && (
            <Card title="Actions">
              <div className="flex flex-wrap gap-2">
                {possibleTransitions.map((statusOption) => (
                  <button key={statusOption} onClick={() => transition(statusOption)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm ${statusOption === "RESOLVED" || statusOption === "CLOSED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : statusOption === "REJECTED" ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100" : "bg-brand-700 text-white hover:bg-brand-800"}`}>
                    Mark as {statusOption}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Severity Score">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 shadow-inner">
                <span className="text-2xl font-black tracking-tighter text-slate-800">{c.severity ?? "?"}</span>
              </div>
              <div>
                <SeverityMeter score={c.severity} band={c.severity && c.severity > 3 ? "SEVERE" : "MODERATE"} />
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">Determined by LUMEN Vision</p>
              </div>
            </div>
          </Card>

          <Card title="Location">
            <div className="h-48 w-full rounded-t-xl bg-slate-100 object-cover">
              <div className="flex h-full items-center justify-center text-slate-400 p-4 text-center">
                <MapPin size={24} className="mr-2" /> 
                {c.latitude?.toFixed(5)}, {c.longitude?.toFixed(5)}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-slate-900">Coordinates</h3>
              <p className="mt-0.5 text-sm text-slate-500">{c.latitude?.toFixed(6)}, {c.longitude?.toFixed(6)}</p>
            </div>
          </Card>

          <Card title="Timeline">
            <div className="p-5">
              <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-3 before:-ml-px before:w-0.5 before:bg-slate-200">
                
                {/* Creation event */}
                <div className="relative flex gap-4">
                  <div className="absolute -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-brand-600"><PlusCircle size={14} className="text-brand-600" /></div>
                  <div className="ml-10">
                    <p className="text-sm font-semibold text-slate-900">Reported by {c.reporter?.fullName ?? "Citizen"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{fmtDateTime(c.createdAt)}</p>
                  </div>
                </div>

                {/* Timeline events */}
                {c.timeline?.map((ev) => (
                  <div key={ev.id} className="relative flex gap-4">
                    <div className="absolute -left-1 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-slate-200"><Activity size={14} className="text-slate-500" /></div>
                    <div className="ml-10">
                      <p className="text-sm font-semibold text-slate-900">Status changed to {ev.status}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{fmtDateTime(ev.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
