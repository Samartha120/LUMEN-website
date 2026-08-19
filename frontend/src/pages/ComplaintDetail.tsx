import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  ScanSearch,
  Copy,
  ShieldCheck,
  GitBranch,
  UserPlus,
  PlusCircle,
  Sparkles,
  Route,
  Camera,
  Loader2,
  Layers,
  AlertTriangle,
  History,
  Building2,
} from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { TRANSITIONS } from "../lib/rbac";
import { fmtDateTime, ageOf } from "../lib/format";
import { Card } from "../components/ui";
import {
  StatusBadge,
  PriorityBadge,
  SeverityMeter,
  VerdictBadge,
  ModelModeBadge,
  FactorBreakdown,
  PriorityProgress,
} from "../components/badges";
import type {
  ComplaintDetail as ComplaintDetailT,
  Detection,
  TimelineEvent,
  PriorityFactors,
} from "../lib/types";

const EVENT_ICON: Record<string, typeof GitBranch> = {
  CREATED: PlusCircle,
  AI_DETECTION: ScanSearch,
  AI_DUPLICATE: Copy,
  AI_VERIFICATION: ShieldCheck,
  ASSIGNMENT: UserPlus,
  STATUS_CHANGE: GitBranch,
};

function ComplaintImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={`flex h-full min-h-[160px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 ${className ?? ""}`}
      >
        <span className="inline-flex flex-col items-center gap-1 p-3 text-center">
          <AlertTriangle size={18} className="text-slate-400" />
          No image available
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`w-full rounded-lg border border-slate-200 object-cover ${className ?? ""}`}
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
}

export function ComplaintDetail() {
  const { ref } = useParams();
  const { user } = useAuth();
  const { data, loading, reload } = useApi<{ complaint: ComplaintDetailT }>(`/complaints/${ref}`);

  if (loading || !data) return <p className="text-slate-400">Loading…</p>;
  const c = data.complaint;
  const dets: Detection[] = c.detections ? JSON.parse(c.detections) : [];
  const citizenImg = c.images.find((i) => i.kind === "CITIZEN");
  const afterImg = [...c.images].reverse().find((i) => i.kind === "ENGINEER_AFTER");
  const factors = c.priorityFactors as PriorityFactors | undefined;

  const transitions = (TRANSITIONS[c.status] ?? []).filter((t) =>
    t.roles.includes(user!.role),
  );
  const canUploadRepair =
    ["IN_PROGRESS", "ASSIGNED"].includes(c.status) &&
    ["ENGINEER", "SUPERVISOR", "ADMINISTRATOR"].includes(user!.role);
  const closureBlocked = c.verifyVerdict === "REJECTED";

  async function transition(to: string) {
    await api.post(`/complaints/${c.ref}/transition`, { to });
    reload();
  }
  async function resolveDup(action: string) {
    await api.post(`/complaints/${c.ref}/duplicate`, { action });
    reload();
  }

  return (
    <>
      <Link
        to="/app/complaints"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft size={15} /> Complaint Queue
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm font-bold text-brand-700">{c.ref}</span>
          <StatusBadge status={c.status} />
          <PriorityBadge priority={c.priorityLevel ?? c.priority} />
          <span className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            Priority {Math.round(c.priorityScore ?? 0)}<span className="text-slate-400">/100</span>
          </span>
          <ModelModeBadge mode={c.aiModelMode} />
          {typeof c.duplicateCount === "number" && c.duplicateCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              <Layers size={12} />
              {c.duplicateCount} duplicate{c.duplicateCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-900">
          {c.title}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span>
            {c.category} · {c.department?.name ?? "Road Maintenance"}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <History size={13} /> reported {fmtDateTime(c.createdAt)} · {ageOf(c.createdAt)} old
          </span>
        </p>
      </div>

      {c.duplicateOf && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Copy size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Probable duplicate of{" "}
                  <Link to={`/app/complaints/${c.duplicateOf.ref}`} className="underline">
                    {c.duplicateOf.ref}
                  </Link>
                </p>
                <p className="mt-0.5 text-sm text-amber-800">
                  {c.duplicateOf.title}
                </p>
              </div>
            </div>
            {["SUPERVISOR", "ADMINISTRATOR"].includes(user!.role) && (
              <div className="flex gap-2">
                <button
                  onClick={() => resolveDup("confirm")}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Confirm duplicate
                </button>
                <button
                  onClick={() => resolveDup("reject")}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
                >
                  Not a duplicate
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Damage Detection">
            {citizenImg ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Original (citizen upload)
                  </p>
                  <ComplaintImage src={citizenImg.path} alt="Reported damage" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Model output (YOLO detections)
                  </p>
                  <ComplaintImage
                    src={citizenImg.annotated ?? citizenImg.path}
                    alt="Detections overlay"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No photograph on record.</p>
            )}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {dets.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No damage regions detected — severity 0, manual triage required.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="pb-2">Class</th>
                        <th className="pb-2">Confidence</th>
                        <th className="pb-2">Frame area</th>
                        <th className="pb-2">Box (x,y,w,h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dets.map((d, i) => (
                        <tr key={i}>
                          <td className="py-2 font-medium text-slate-800">{d.label}</td>
                          <td className="py-2 text-slate-600">
                            {(d.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 text-slate-600">
                            {(d.area_ratio * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 font-mono text-xs text-slate-400">
                            {(d.box ?? []).map((v) => Math.round(Number(v) || 0)).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card title="Repair Verification">
            {c.verifyVerdict ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <VerdictBadge verdict={c.verifyVerdict} />
                  <span className="text-sm text-slate-600">{c.verifyReason}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      {c.verifyReduction?.toFixed(0)}%
                    </div>
                    <div className="text-[11px] text-slate-500">severity reduction</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      {c.verifySsim?.toFixed(3)}
                    </div>
                    <div className="text-[11px] text-slate-500">SSIM</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900">
                      {afterImg?.severity?.toFixed(1) ?? "—"}
                    </div>
                    <div className="text-[11px] text-slate-500">severity after</div>
                  </div>
                </div>
                {afterImg && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        After-photo
                      </p>
                      <ComplaintImage src={afterImg.path} alt="After repair" />
                    </div>
                    {afterImg.annotated && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Re-detection
                        </p>
                        <ComplaintImage
                          src={afterImg.annotated}
                          alt="Re-detection output"
                        />
                      </div>
                    )}
                  </div>
                )}
                {closureBlocked && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    Closure is blocked — the repair was not verified. Re-work and resubmit
                    evidence.
                  </p>
                )}
              </div>
            ) : canUploadRepair ? (
              <RepairForm complaintRef={c.ref} onDone={reload} />
            ) : (
              <p className="text-sm text-slate-400">
                Awaiting the engineer&apos;s after-photograph.
              </p>
            )}
          </Card>

          {(transitions.length > 0 || c.status === "SUBMITTED") && (
            <Card title="Actions">
              <div className="flex flex-wrap gap-2">
                {transitions.map((t) => {
                  const blocked = t.to === "CLOSED" && closureBlocked;
                  return (
                    <button
                      key={t.to}
                      onClick={() => !blocked && transition(t.to)}
                      disabled={blocked}
                      title={
                        blocked
                          ? "Blocked: repair verification was rejected"
                          : undefined
                      }
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                        t.to === "CLOSED"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : t.to === "REJECTED"
                          ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                          : "bg-brand-700 text-white hover:bg-brand-800"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {c.status === "SUBMITTED" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Route size={13} /> Use the{" "}
                  <Link to="/app/assignment" className="font-medium text-brand-700 underline">
                    Assignment Optimiser
                  </Link>{" "}
                  to allocate engineers across all open complaints at once.
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Smart Priority">
            <div className="space-y-4">
              <div className="grid grid-cols-2 items-center gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Priority Score
                  </div>
                  <div className="mt-1 inline-flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                      {Math.round(c.priorityScore ?? 0)}
                    </span>
                    <span className="text-sm font-semibold text-slate-400">/100</span>
                  </div>
                  <div className="mt-2">
                    <PriorityProgress
                      score={c.priorityScore}
                      level={c.priorityLevel ?? c.priority}
                    />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Level
                  </div>
                  <div className="mt-1">
                    <PriorityBadge priority={c.priorityLevel ?? c.priority} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {factors
                      ? `Σ ${Object.values(factors)
                          .reduce((a, b) => a + (Number(b) || 0), 0)
                          .toFixed(0)} components`
                      : ""}
                  </div>
                </div>
              </div>

              {factors && (
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Factor breakdown
                  </div>
                  <FactorBreakdown factors={factors} />
                </div>
              )}

              {c.priorityReasons && c.priorityReasons.length > 0 && (
                <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Sparkles size={12} /> Why this priority
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {c.priorityReasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-700">
                        <span className="text-brand-600 mt-0.5 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card title="Severity Score">
            <SeverityMeter score={c.severityScore} band={c.severityBand} />
            <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Derived priority</dt>
                <dd>
                  <PriorityBadge priority={c.priorityLevel ?? c.priority} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Detected regions</dt>
                <dd className="font-medium text-slate-800">{dets.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Top confidence</dt>
                <dd className="font-medium text-slate-800">
                  {c.aiConfidence ? `${(c.aiConfidence * 100).toFixed(1)}%` : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Resolution SLA</dt>
                <dd className="font-medium text-slate-800">{c.slaHours} h</dd>
              </div>
              {typeof c.duplicateCount === "number" && c.duplicateCount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 inline-flex items-center gap-1">
                    <Layers size={12} /> Nearby duplicates
                  </dt>
                  <dd className="font-medium text-amber-700">{c.duplicateCount}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 flex items-start gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
              <Sparkles size={12} className="mt-0.5 shrink-0" /> Score = Σ class_weight ×
              √(area) × confidence, with a multi-instance bonus.
            </p>
          </Card>

          <Card title="Location & Department">
            <div className="space-y-3 text-sm">
              <p className="flex items-start gap-2 text-slate-700">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <span>
                  {c.address}
                  <span className="block text-xs text-slate-500">
                    {c.zone} · {c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}
                  </span>
                </span>
              </p>
              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 inline-flex items-center gap-1">
                    <Building2 size={11} /> Department
                  </div>
                  <div className="font-medium text-slate-800">
                    {c.department?.name ?? "Road Maintenance"}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 inline-flex items-center gap-1">
                    <UserPlus size={11} /> Assigned engineer
                  </div>
                  <div className="font-medium text-slate-800">
                    {c.engineer?.name ?? "Unassigned"}
                  </div>
                  {c.engineer && (
                    <div className="text-xs text-slate-500">
                      {c.engineer.code} · {c.engineer.zone}
                      {c.assignDistance != null && ` · ${c.assignDistance} km away`}
                      {c.assignMethod === "OPTIMISED" && " · optimiser"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card title={`Timeline (${c.events.length})`}>
            <ol>
              {c.events.map((ev: TimelineEvent, i) => {
                const Icon = EVENT_ICON[ev.type] ?? GitBranch;
                const isAi = ev.type.startsWith("AI_");
                return (
                  <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < c.events.length - 1 && (
                      <span className="absolute left-[13px] top-8 h-full w-px bg-slate-200" />
                    )}
                    <span
                      className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isAi ? "bg-violet-100 text-violet-700" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm leading-snug text-slate-700">{ev.message}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {ev.actor} · {fmtDateTime(ev.createdAt)}
                      </p>
                    </div>
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

function RepairForm({
  complaintRef,
  onDone,
}: {
  complaintRef: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!(form.get("photo") as File)?.size) {
      setError("An after-photograph is required.");
      return;
    }
    setBusy(true);
    try {
      await api.upload(`/complaints/${complaintRef}/verify`, form);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 hover:border-brand-400 hover:bg-brand-50/40">
        {preview ? (
          <ComplaintImage src={preview} alt="After repair preview" className="max-h-44 object-contain" />
        ) : (
          <>
            <Camera size={22} className="mb-1.5 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">
              Upload the after-photograph
            </span>
            <span className="mt-0.5 text-xs text-slate-400">
              Compared against the original automatically
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPreview(URL.createObjectURL(f));
          }}
        />
      </label>
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {busy ? "Comparing images…" : "Submit for AI Verification"}
      </button>
    </form>
  );
}
