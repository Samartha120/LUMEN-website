import { Fragment, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, MapPin, ScanSearch, Copy, GitBranch, UserPlus,
  PlusCircle, Sparkles, Check, Ruler, Plus, Trash2, Calculator, Wand2,
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { TRANSITIONS } from "../lib/rbac";
import { fmtDateTime, ageOf } from "../lib/format";
import { Card } from "../components/ui";
import { StatusBadge, PriorityBadge, SeverityMeter, ModelModeBadge } from "../components/badges";
import { CategoryBadge } from "../components/CategoryBadge";

type Det = {
  label: string; confidence: number; box: number[]; area_ratio: number;
  /** Segmentation outline in image pixels; absent for box-only detections. */
  polygon?: number[][] | null;
};
type Img = { id: string; kind: string; path: string; annotated: string | null; severity: number | null };
type Ev = { id: string; type: string; message: string; actor: string; createdAt: string };
type Complaint = {
  id: string; ref: string; title: string; description: string; category: string; zone: string; address: string;
  lat: number; lng: number; status: string; priority: string; slaHours: number; createdAt: string;
  civicCategory: string | null; autoRouted: boolean;
  aiModelMode: string | null; aiConfidence: number | null; detections: string | null;
  severityScore: number | null; severityBand: string | null;
  priorityScore: number | null; priorityFactors: string | null;
  duplicateOfId: string | null; dupSimilarity: number | null; dupDistanceM: number | null; dupScore: number | null; dupDescriptionSimilarity: number | null;
  assignMethod: string | null; assignDistance: number | null;
  department: { name: string }; engineer: { name: string; code: string; zone: string } | null;
  images: Img[]; events: Ev[]; duplicateOf: { ref: string; title: string } | null;
  roadType: string | null; potholes: Pothole[];
};

type Pothole = {
  id: string; label: string; lengthM: number; widthM: number; depthM: number;
  volumeM3: number; perimeterM: number; recordedBy: string; source: string;
};

const EVENT_ICON: Record<string, typeof GitBranch> = {
  CREATED: PlusCircle, AI_DETECTION: ScanSearch, AI_DUPLICATE: Copy,
  ASSIGNMENT: UserPlus, STATUS_CHANGE: GitBranch, SITE_MEASUREMENT: Ruler,
};

type PriorityFactors = {
  severity?: number; confidence?: number; locationRisk?: number;
  duplicateReports?: number; departmentRisk?: number; ageHours?: number;
  nearbyLandmarks?: string[];
};

/** What a category means in plain words when it raises the priority. */
const HAZARD_LABEL: Record<string, string> = {
  ROADS: "Road Hazard",
  WATER: "Water Hazard",
  WASTE: "Sanitation Issue",
};

/**
 * Turn the stored priority factors into the reasons a person would give.
 *
 * Only factors that actually contributed are listed, each with the points it
 * added, so the explanation adds up to the score rather than restating it.
 */
function priorityReasons(
  f: PriorityFactors | null,
  civicCategory: string | null,
  severity: number | null,
): { text: string; points: number }[] {
  if (!f) return [];
  const out: { text: string; points: number }[] = [];

  for (const place of f.nearbyLandmarks ?? []) {
    // locationRisk is the summed cap; split it across the landmarks that fired.
    const share = Math.round((f.locationRisk ?? 0) / (f.nearbyLandmarks?.length || 1));
    out.push({ text: `Near ${place}`, points: share });
  }
  if (f.duplicateReports) {
    out.push({
      text: `${f.duplicateReports} Duplicate Report${f.duplicateReports === 1 ? "" : "s"}`,
      points: Math.min(12, f.duplicateReports * 3),
    });
  }
  const hours = f.ageHours ?? 0;
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    out.push({ text: `Waiting ${days} Day${days === 1 ? "" : "s"}`, points: Math.min(10, days * 2) });
  }
  if (civicCategory && f.departmentRisk) {
    out.push({ text: HAZARD_LABEL[civicCategory] ?? "Departmental Risk", points: f.departmentRisk });
  }
  if ((severity ?? 0) >= 60) {
    out.push({ text: "Severe Damage Detected", points: Math.round((severity ?? 0) * 0.5) });
  }
  return out.sort((a, b) => b.points - a.points);
}

export function ComplaintDetail() {
  const { ref } = useParams();
  const { user } = useAuth();
  const { data, loading, reload } = useApi<{ complaint: Complaint }>(`/complaints/${ref}`);
  const [shownId, setShownId] = useState<string | null>(null);

  // Only blank the page on the very first load. reload() flips `loading` back
  // to true, and blanking then would unmount the whole tree — throwing away
  // local state such as the material estimate the engineer just calculated.
  if (!data) return <p className="text-slate-400">{loading ? "Loading…" : "Not found."}</p>;
  const c = data.complaint;
  const dets: Det[] = c.detections ? JSON.parse(c.detections) : [];
  const potholeCount = dets.filter((d) => d.label === "Pothole").length;
  // How many carry a real outline rather than a rectangle — the segmentation
  // model supplies masks, the multi-class detector does not.
  const segCount = dets.filter((d) => d.label === "Pothole" && d.polygon?.length).length;
  const citizenImgs = c.images.filter((i) => i.kind === "CITIZEN");
  // Which angle the viewer is looking at; defaults to the primary (first).
  const shown = citizenImgs.find((i) => i.id === shownId) ?? citizenImgs[0];
  const priorityFactors = c.priorityFactors ? JSON.parse(c.priorityFactors) as PriorityFactors : null;
  const reasons = priorityReasons(priorityFactors, c.civicCategory, c.severityScore);

  const transitions = (TRANSITIONS[c.status] ?? []).filter((t) => t.roles.includes(user!.role));
  // Whoever goes to site records the measurements; supervisors can correct them.
  const canMeasure = ["ENGINEER", "SUPERVISOR", "ADMINISTRATOR"].includes(user!.role);

  async function transition(to: string) { await api.post(`/complaints/${c.ref}/transition`, { to }); reload(); }
  async function resolveDup(action: string) { await api.post(`/complaints/${c.ref}/duplicate`, { action }); reload(); }

  return (
    <>
      <Link to="/app/complaints" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"><ArrowLeft size={15} /> Complaint Queue</Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-700">{c.ref}</span>
          <StatusBadge status={c.status} /><PriorityBadge priority={c.priority} />
          <CategoryBadge category={c.civicCategory} /><ModelModeBadge mode={c.aiModelMode} />
        </div>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-900">{c.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{c.category} · {c.department.name}{c.autoRouted && <span className="ml-1 text-brand-600">(auto-routed by AI)</span>} · reported {fmtDateTime(c.createdAt)} · {ageOf(c.createdAt)} old</p>
      </div>

      {c.duplicateOf && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Copy size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Probable duplicate of <Link to={`/app/complaints/${c.duplicateOf.ref}`} className="underline">{c.duplicateOf.ref}</Link></p>
                <p className="mt-0.5 text-sm text-amber-800">Duplicate score {((c.dupScore ?? 0) * 100).toFixed(0)}% · image {((c.dupSimilarity ?? 0) * 100).toFixed(0)}% · text {((c.dupDescriptionSimilarity ?? 0) * 100).toFixed(0)}% · {c.dupDistanceM} m apart</p>
              </div>
            </div>
            {["SUPERVISOR", "ADMINISTRATOR"].includes(user!.role) && (
              <div className="flex gap-2">
                <button onClick={() => resolveDup("confirm")} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">Confirm duplicate</button>
                <button onClick={() => resolveDup("reject")} className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100">Not a duplicate</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What a resident actually wants to know: has anyone looked at this,
          who is fixing it, and by when. The staff view answers those across
          three separate panels in operational language; this says it once, in
          a sentence. The completion date is the SLA clock the department is
          actually held to, not a guess. */}
      {user?.role === "CITIZEN" && <CitizenStatus c={c} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Damage Detection">
            {shown ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Original</p><img src={shown.path} alt="Reported" className="w-full rounded-lg border border-slate-200 object-cover" /></div>
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Model output</p>
                      {shown.annotated && (
                        // The overlay is the evidence a supervisor attaches to a
                        // work order, so it has to leave the browser.
                        <a
                          href={shown.annotated}
                          download={`${data.complaint.ref}-detections.png`}
                          className="text-[11px] font-medium text-brand-700 underline hover:text-brand-800"
                        >
                          Download
                        </a>
                      )}
                    </div>
                    {shown.annotated ? <img src={shown.annotated} alt="Detections" className="w-full rounded-lg border border-slate-200 object-cover" /> : <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">No annotated image</div>}
                    {potholeCount > 0 && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        <b className="text-slate-800">{potholeCount}</b> pothole{potholeCount === 1 ? "" : "s"} outlined
                        {segCount > 0 && ` · ${segCount} with a segmentation mask`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Several angles can be submitted per complaint. The first is
                    the one classification came from — the rest are evidence. */}
                {citizenImgs.length > 1 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {citizenImgs.length} photographs submitted
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {citizenImgs.map((img, i) => (
                        <button
                          key={img.id}
                          onClick={() => setShownId(img.id)}
                          title={i === 0 ? "Primary — used for classification" : `Angle ${i + 1}`}
                          className={`relative overflow-hidden rounded-lg border-2 transition ${
                            img.id === shown.id ? "border-brand-600" : "border-transparent hover:border-slate-300"
                          }`}
                        >
                          <img src={img.path} alt={`Angle ${i + 1}`} className="h-16 w-24 object-cover" />
                          {i === 0 && (
                            <span className="absolute left-1 top-1 rounded bg-brand-700/90 px-1 py-0.5 text-[9px] font-semibold text-white">
                              Primary
                            </span>
                          )}
                          {img.severity != null && (
                            <span className="absolute bottom-1 right-1 rounded bg-slate-900/70 px-1 py-0.5 text-[9px] font-medium text-white">
                              {img.severity.toFixed(0)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <p className="text-sm text-slate-400">No photograph on record.</p>}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {dets.length === 0 ? <p className="text-sm text-slate-500">No damage regions detected — severity 0, manual triage required.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400"><th className="pb-2">Class</th><th className="pb-2">Category</th><th className="pb-2">Confidence</th><th className="pb-2">Frame area</th><th className="pb-2">Box</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {dets.map((d, i) => (
                      <tr key={i}><td className="py-2 font-medium text-slate-800">{d.label}</td><td className="py-2"><CategoryBadge category={(d as any).category ?? null} /></td><td className="py-2 text-slate-600">{(d.confidence * 100).toFixed(1)}%</td><td className="py-2 text-slate-600">{(d.area_ratio * 100).toFixed(2)}%</td><td className="py-2 font-mono text-xs text-slate-400">{d.box.map((v) => Math.round(v)).join(", ")}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {c.civicCategory === "ROADS" && (
            <SiteMeasurements complaint={c} onSaved={reload} canEdit={canMeasure} />
          )}

          {(transitions.length > 0 || c.status === "SUBMITTED") && (
            <Card title="Actions">
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => {
                  return (
                    <button key={t.to} onClick={() => transition(t.to)}
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${t.to === "CLOSED" ? "bg-emerald-600 text-white hover:bg-emerald-700" : t.to === "REJECTED" ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100" : "bg-brand-700 text-white hover:bg-brand-800"}`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {c.status === "SUBMITTED" && <p className="mt-3 text-xs text-slate-500">Nearest available engineers by travel distance, skill match and current workload.</p>}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Priority Assessment">
            <SeverityMeter score={c.severityScore} band={c.severityBand} />
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
              {/* Ordered so each line follows from the one above it. Severity is
                  what the detector saw; the priority score adds where it is, how
                  long it has waited and how many people reported it; the level is
                  a band on that score. Shown the other way round, the badge sat
                  under the severity figure and read as if it came from it —
                  which is how a complaint at severity 61 showing MEDIUM looks
                  like a bug rather than a road with no hospital next to it. */}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Damage severity<span className="block text-xs text-slate-400">what the photo shows</span></dt><dd className="font-medium text-slate-800">{c.severityScore?.toFixed(1) ?? "—"} / 100</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Priority score<span className="block text-xs text-slate-400">severity + location, age, reports</span></dt><dd className="font-medium text-slate-800">{c.priorityScore ?? "—"} / 100</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Priority level<span className="block text-xs text-slate-400">band on the score above</span></dt><dd><PriorityBadge priority={c.priority} /></dd></div>
            </dl>

            {reasons.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Why this priority?</p>
                <ul className="space-y-1.5">
                  {reasons.map((r) => (
                    <li key={r.text} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-slate-700">
                        <Check size={14} className="shrink-0 text-emerald-600" />
                        <span className="truncate">{r.text}</span>
                      </span>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                        +{r.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Detected regions</dt><dd className="font-medium text-slate-800">{dets.length}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Top confidence</dt><dd className="font-medium text-slate-800">{c.aiConfidence ? `${(c.aiConfidence * 100).toFixed(1)}%` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Resolution SLA</dt><dd className="font-medium text-slate-800">{c.slaHours} h</dd></div>
            </dl>

            <p className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
              <Sparkles size={12} className="mt-0.5 shrink-0" /> Priority is recalculated on every view, so a complaint rises on its own as it ages.
            </p>
          </Card>

          <Card title="Location & Assignment">
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-2 text-slate-700"><MapPin size={15} className="mt-0.5 text-slate-400" /><span>{c.address}<span className="block text-xs text-slate-500">{c.zone} · {c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span></span></p>
              <div className="border-t border-slate-100 pt-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Assigned engineer</div>
                <div className="font-medium text-slate-800">{c.engineer?.name ?? "Unassigned"}</div>
                {c.engineer && <div className="text-xs text-slate-500">{c.engineer.code} · {c.engineer.zone}{c.assignDistance != null && ` · ${c.assignDistance} km away`}{c.assignMethod === "OPTIMISED" && " · optimiser"}</div>}
              </div>
            </div>
          </Card>

          <Card title={`Timeline (${c.events.length})`}>
            <ol>
              {c.events.map((ev, i) => {
                const Icon = EVENT_ICON[ev.type] ?? GitBranch;
                const isAi = ev.type.startsWith("AI_");
                return (
                  <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < c.events.length - 1 && <span className="absolute left-[13px] top-8 h-full w-px bg-slate-200" />}
                    <span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isAi ? "bg-violet-100 text-violet-700" : "bg-brand-50 text-brand-700"}`}><Icon size={13} /></span>
                    <div className="min-w-0 pt-0.5"><p className="text-sm leading-snug text-slate-700">{ev.message}</p><p className="mt-0.5 text-xs text-slate-400">{ev.actor} · {fmtDateTime(ev.createdAt)}</p></div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * Lets a resident say the work was not actually done.
 *
 * A reason is required rather than optional: "reopened" with no explanation
 * tells the crew returning to the site nothing, and the whole value of this
 * over filing a fresh complaint is that the history travels with it.
 */
function ReopenControl({ refId }: { refId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) { setError("Please say what is still wrong."); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/complaints/${refId}/reopen`, { reason: reason.trim() });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reopen this report.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-4 border-t border-white/70 pt-3">
        <p className="text-sm text-slate-600">
          Still not fixed?{" "}
          <button onClick={() => setOpen(true)} className="font-semibold text-brand-700 hover:underline">
            Reopen this report
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 border-t border-white/70 pt-3">
      <label className="block text-sm font-medium text-slate-700">What is still wrong?</label>
      <textarea
        value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus
        placeholder="The pothole is still there / it was filled but has sunk again"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy}
          className="rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
          {busy ? "Reopening…" : "Reopen report"}
        </button>
        <button onClick={() => { setOpen(false); setError(null); }}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * The resident-facing answer to "what is happening about my report".
 *
 * Written as plain sentences rather than fields. A resident does not need
 * SLA hours, a priority score or a department code — they need to know
 * somebody has it, who, and by when. The date is computed from the SLA the
 * department is actually held to, so it is a commitment rather than a guess.
 */
function CitizenStatus({ c }: { c: Complaint }) {
  const due = new Date(new Date(c.createdAt).getTime() + (c.slaHours ?? 48) * 3600_000);
  const done = c.status === "CLOSED";
  const rejected = c.status === "REJECTED";
  const dueText = due.toLocaleDateString(undefined, { day: "numeric", month: "long" });

  const line = rejected
    ? "After review this report was closed without work being scheduled."
    : done
      ? "The work on this report has been completed and signed off."
      : c.engineer
        ? `${c.engineer.name} has been assigned and is expected to complete the work by ${dueText}.`
        : `Your report has reached ${c.department?.name ?? "the department"} and an engineer will be assigned shortly. Work is due to be completed by ${dueText}.`;

  const tone = rejected
    ? "border-slate-300 bg-slate-50"
    : done
      ? "border-emerald-300 bg-emerald-50"
      : "border-brand-300 bg-brand-50";

  return (
    <div className={`surface mb-6 rounded-xl border ${tone} p-5`}>
      <p className="text-[0.78rem] font-semibold uppercase tracking-[0.07em] text-slate-500">
        {rejected ? "Closed" : done ? "Completed" : "In progress"}
      </p>
      <p className="mt-2 text-[1.05rem] leading-relaxed text-slate-800">{line}</p>
      {done && <ReopenControl refId={c.ref} />}
      {!done && !rejected && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/70 pt-3 text-sm">
          <div>
            <dt className="text-slate-500">Reference</dt>
            <dd className="font-semibold text-slate-800">{c.ref}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Handled by</dt>
            <dd className="font-semibold text-slate-800">{c.department?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Engineer</dt>
            <dd className="font-semibold text-slate-800">{c.engineer?.name ?? "Being assigned"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Due by</dt>
            <dd className="font-semibold text-slate-800">{dueText}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

type Row = { label: string; lengthM: string; widthM: string; depthM: string; source: "ESTIMATED" | "MEASURED" };
type EstLine = {
  material: string; perM3: number; unit: string; quantity: number;
  procurement: number; formula: string; basis: string; provisional: boolean;
  inrPerUnit: number; costInr: number;
};
type Cost = {
  materialInr: number; labourInr: number; labourPct: number;
  overheadInr: number; overheadPct: number; totalInr: number; perM3Inr: number; note: string;
};
type Est = {
  roadTypeLabel: string; totalVolumeM3: number; potholeCount: number; wastagePct: number;
  lines: EstLine[]; cementBags: number | null; hasProvisional: boolean; cost: Cost;
};

/** Rupees, grouped the Indian way — 3,50,516 rather than 350,516. */
export const inr = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

const n3 = (v: number) => v.toFixed(3);

/** Mirrors the limits the server enforces on POST /measurements. */
const MAX_SPAN_M = 50;
const MAX_DEPTH_M = 5;

/**
 * Feature 6 — site measurements and the material estimate that follows.
 *
 * The engineer's team measures each pothole, and the quantities of cement,
 * aggregate, bitumen and so on fall out of the total volume. The estimate is
 * fetched from the server rather than computed here, so the figure on screen
 * is the same one the API would put in a submitted BOQ.
 */
function SiteMeasurements({ complaint, onSaved, canEdit }: { complaint: Complaint; onSaved: () => void; canEdit: boolean }) {
  const existing = complaint.potholes ?? [];
  const [rows, setRows] = useState<Row[]>(
    existing.length
      ? existing.map((p) => ({
          label: p.label, lengthM: String(p.lengthM), widthM: String(p.widthM), depthM: String(p.depthM),
          source: (p.source === "ESTIMATED" ? "ESTIMATED" : "MEASURED") as Row["source"],
        }))
      : [{ label: "P1", lengthM: "", widthM: "", depthM: "", source: "MEASURED" as const }],
  );
  const [roadType, setRoadType] = useState(complaint.roadType ?? "BITUMINOUS");
  const [wastage, setWastage] = useState(5);
  const [est, setEst] = useState<Est | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const num = (v: string) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0; };
  const volOf = (r: Row) => num(r.lengthM) * num(r.widthM) * num(r.depthM);
  const perimOf = (r: Row) => 2 * (num(r.lengthM) + num(r.widthM));
  const total = rows.reduce((t, r) => (rowError(r) ? t : t + volOf(r)), 0);
  const complete = rows.filter((r) => volOf(r) > 0).length;

  /**
   * Same limits the server enforces, checked as the engineer types.
   *
   * A pothole is measured in metres, and the commonest mistake is entering
   * centimetres — 150 x 80 x 12 instead of 1.5 x 0.8 x 0.12, which orders
   * material for 144 m3 instead of 1.44. Catching it on the row is far clearer
   * than letting the total read 210 m3 and rejecting the whole form on save.
   */
  function rowError(r: Row): string | null {
    const l = num(r.lengthM), w = num(r.widthM), d = num(r.depthM);
    const anyEntered = [r.lengthM, r.widthM, r.depthM].some((v) => v.trim() !== "");
    if (!anyEntered) return null;
    if (l <= 0 || w <= 0 || d <= 0) return "Length, width and depth must all be greater than zero.";
    if (l > MAX_SPAN_M || w > MAX_SPAN_M) return `Length and width are in metres — ${MAX_SPAN_M} m is the limit. Did you enter centimetres?`;
    if (d > MAX_DEPTH_M) return `Depth is in metres — ${MAX_DEPTH_M} m is the limit. A deep pothole is about 0.15 m.`;
    return null;
  }
  const rowErrors = rows.map(rowError);
  const hasError = rowErrors.some(Boolean);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch, source: "MEASURED" } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { label: `P${rs.length + 1}`, lengthM: "", widthM: "", depthM: "", source: "MEASURED" }]);
  }

  /**
   * Pull first-pass dimensions off the photograph. Typing over any of them
   * flips that row to MEASURED — an edited estimate is a measurement, and
   * pretending otherwise would understate how much of the plan is real.
   */
  async function estimateFromPhoto() {
    setSuggesting(true); setError(null);
    try {
      const r = await api.get(`/complaints/${complaint.ref}/suggest-dimensions`) as
        { potholes: { label: string; lengthM: number; widthM: number; depthM: number }[]; note: string };
      setRows(r.potholes.map((p) => ({
        label: p.label, lengthM: String(p.lengthM), widthM: String(p.widthM), depthM: String(p.depthM),
        source: "ESTIMATED" as const,
      })));
      setNote(r.note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not estimate from the photograph.");
    } finally { setSuggesting(false); }
  }
  function removeRow(i: number) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, j) => j !== i)));
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const potholes = rows.filter((r) => volOf(r) > 0)
        .map((r) => ({ label: r.label, lengthM: num(r.lengthM), widthM: num(r.widthM), depthM: num(r.depthM), source: r.source }));
      await api.post(`/complaints/${complaint.ref}/measurements`, { roadType, potholes });
      const res = await api.get(`/complaints/${complaint.ref}/estimate?wastage=${wastage}`) as { estimate: Est };
      setEst(res.estimate);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the measurements.");
    } finally { setBusy(false); }
  }

  return (
    <Card title="Site Measurements & Material Estimate">
      <p className="mb-4 text-sm text-slate-500">
        Measure each pothole on site in metres. Volume is length x width x depth; the material
        quantities follow from the total.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-2">Length (m)</th>
              <th className="pb-2 pr-2">Width (m)</th>
              <th className="pb-2 pr-2">Depth (m)</th>
              <th className="pb-2 pr-2">Perimeter</th>
              <th className="pb-2 pr-2">Volume</th>
              {canEdit && <th className="pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <Fragment key={i}>
                <tr>
                  <td className="py-1.5 pr-2 font-medium text-slate-700">
                    {r.label}
                    {r.source === "ESTIMATED" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700" title="Read off the photograph, not measured">est</span>
                    )}
                  </td>
                  {(["lengthM", "widthM", "depthM"] as const).map((f) => (
                    <td key={f} className="py-1.5 pr-2">
                      <input type="number" step="0.01" min="0" disabled={!canEdit} value={r[f]}
                        onChange={(e) => setRow(i, { [f]: e.target.value } as Partial<Row>)}
                        className={`w-20 rounded border px-2 py-1 text-sm outline-none disabled:bg-slate-50 ${
                          rowErrors[i] ? "border-red-400 bg-red-50 focus:border-red-500" : "border-slate-300 focus:border-brand-500"
                        }`} />
                    </td>
                  ))}
                  <td className="py-1.5 pr-2 text-slate-500">{!rowErrors[i] && volOf(r) > 0 ? `${perimOf(r).toFixed(2)} m` : "—"}</td>
                  <td className="py-1.5 pr-2 font-medium text-slate-800">
                    {rowErrors[i] ? <span className="text-red-600">check units</span> : volOf(r) > 0 ? `${n3(volOf(r))} m³` : "—"}
                  </td>
                  {canEdit && (
                    <td className="py-1.5">
                      <button onClick={() => removeRow(i)} disabled={rows.length === 1}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
                {rowErrors[i] && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="pb-2 text-xs font-medium text-red-700">{rowErrors[i]}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {canEdit && (
          <button onClick={addRow} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            <Plus size={13} /> Add pothole
          </button>
        )}
        {canEdit && (
          <button onClick={estimateFromPhoto} disabled={suggesting}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">
            <Wand2 size={13} /> {suggesting ? "Reading photo…" : "Estimate from photo"}
          </button>
        )}
        <span className="text-sm text-slate-600">
          <strong className="text-slate-900">{complete}</strong>{" "}
          {rows.some((r) => r.source === "ESTIMATED")
            ? (rows.every((r) => r.source === "ESTIMATED") ? "estimated" : "recorded")
            : "measured"}{" "}
          · total <strong className="text-slate-900">{n3(total)} m³</strong>
        </span>
      </div>

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
          <label className="text-xs font-medium text-slate-600">
            Road type
            <select value={roadType} onChange={(e) => setRoadType(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500">
              <option value="BITUMINOUS">Bituminous (normal road)</option>
              <option value="CONCRETE">Concrete road</option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Wastage %
            <input type="number" min="0" max="50" value={wastage} onChange={(e) => setWastage(Number(e.target.value))}
              className="mt-1 block w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500" />
          </label>
          <button onClick={save} disabled={busy || complete === 0 || hasError}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            <Calculator size={15} /> {busy ? "Calculating…" : "Save & estimate materials"}
          </button>
        </div>
      )}

      {note && rows.some((r) => r.source === "ESTIMATED") && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Estimated, not measured.</strong> {note}
        </p>
      )}

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {est && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-800">
            {est.roadTypeLabel} · {est.totalVolumeM3} m³ across {est.potholeCount} pothole{est.potholeCount === 1 ? "" : "s"} · {est.wastagePct}% wastage
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-2.5 py-1.5">Material</th>
                  <th className="px-2.5 py-1.5">Per m³</th>
                  <th className="px-2.5 py-1.5">Quantity</th>
                  <th className="px-2.5 py-1.5">Procure (+{est.wastagePct}%)</th>
                  <th className="px-2.5 py-1.5">Rate</th>
                  <th className="px-2.5 py-1.5">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {est.lines.map((l) => (
                  <tr key={l.material}>
                    <td className="px-2.5 py-1.5 text-slate-800">
                      {l.material}
                      {l.provisional && <span className="ml-1 text-amber-600" title={l.basis}>*</span>}
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-500">{l.perM3} {l.unit}</td>
                    <td className="px-2.5 py-1.5 text-slate-700">{l.quantity} {l.unit}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-900">{l.procurement} {l.unit}</td>
                    <td className="px-2.5 py-1.5 text-slate-500">₹{l.inrPerUnit}/{l.unit}</td>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-900">{inr(l.costInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {est.cementBags !== null && (
            <p className="mt-2 text-sm text-slate-700">Cement to order: <strong>{est.cementBags} bags</strong> (50 kg each).</p>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estimated cost to repair</p>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">Materials</dt><dd className="text-slate-800">{inr(est.cost.materialInr)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Labour &amp; machinery ({est.cost.labourPct}%)</dt><dd className="text-slate-800">{inr(est.cost.labourInr)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">Overhead &amp; profit ({est.cost.overheadPct}%)</dt><dd className="text-slate-800">{inr(est.cost.overheadInr)}</dd></div>
              <div className="flex justify-between border-t border-slate-300 pt-1.5 text-base font-bold text-slate-900">
                <dt>Total</dt><dd>{inr(est.cost.totalInr)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-slate-500">{inr(est.cost.perM3Inr)} per m³ · {est.cost.note}</p>
          </div>
          {est.hasProvisional && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <strong>*</strong> These quantities are preliminary estimating assumptions, not an approved mix
              design. A bituminous repair is specified by the road authority against aggregate gradation,
              binder content and compaction. Replace them with the project specification before submitting
              this as a government BOQ.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
