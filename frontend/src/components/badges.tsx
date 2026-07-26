import { STATUS_LABELS } from "../lib/rbac";

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700 ring-slate-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  CLOSED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] ?? STATUS_STYLES.SUBMITTED}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-100 text-sky-800",
  HIGH: "bg-amber-100 text-amber-800",
  CRITICAL: "bg-red-100 text-red-800",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.LOW}`}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

const BAND_COLOR: Record<string, string> = {
  SEVERE: "bg-red-500",
  SIGNIFICANT: "bg-amber-500",
  MODERATE: "bg-sky-500",
  MINOR: "bg-slate-400",
  NONE: "bg-slate-300",
};

/** Severity meter — the score computed by the CV service (Feature 2). */
export function SeverityMeter({ score, band, compact = false }: {
  score: number | null;
  band: string | null;
  compact?: boolean;
}) {
  const s = score ?? 0;
  const b = band ?? "NONE";
  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
      <div className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${compact ? "w-20" : "w-full"}`}>
        <div className={`h-full rounded-full ${BAND_COLOR[b] ?? BAND_COLOR.NONE}`} style={{ width: `${Math.min(100, s)}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs font-semibold text-slate-600">
        {s.toFixed(1)}{compact ? "" : " / 100"}
        {!compact && b !== "NONE" && <span className="ml-1.5 font-normal text-slate-400">{b.toLowerCase()}</span>}
      </span>
    </div>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INCONCLUSIVE: "bg-amber-50 text-amber-700 ring-amber-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
};

export function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${VERDICT_STYLES[verdict] ?? VERDICT_STYLES.INCONCLUSIVE}`}>
      {verdict.charAt(0) + verdict.slice(1).toLowerCase()}
    </span>
  );
}

export function ModelModeBadge({ mode }: { mode: string | null }) {
  if (!mode) return null;
  const meta: Record<string, { label: string; cls: string; title: string }> = {
    TRAINED: {
      label: "Trained model",
      cls: "bg-emerald-100 text-emerald-700",
      title: "Predictions from the YOLO model fine-tuned on RDD2022",
    },
    HEURISTIC: {
      label: "Heuristic CV",
      cls: "bg-sky-100 text-sky-800",
      title: "Classical OpenCV detector (dark-blob + edge analysis) — not deep learning; the trained model replaces it after train.py",
    },
    FALLBACK: {
      label: "Fallback model",
      cls: "bg-amber-100 text-amber-800",
      title: "Pretrained COCO model — generic objects, not road-damage classes",
    },
  };
  const m = meta[mode] ?? meta.FALLBACK;
  return (
    <span title={m.title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.cls}`}>
      {m.label}
    </span>
  );
}
