import { STATUS_LABELS } from "../lib/rbac";
import type { PriorityLevel, PriorityFactors } from "../lib/types";
import { FACTOR_LABEL, FACTOR_MAX } from "../lib/types";

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

const PRIORITY_STYLES: Record<PriorityLevel | string, string> = {
  LOW: "bg-slate-100 text-slate-700 ring-slate-200",
  MEDIUM: "bg-sky-100 text-sky-800 ring-sky-200",
  HIGH: "bg-amber-100 text-amber-800 ring-amber-200",
  CRITICAL: "bg-red-100 text-red-800 ring-red-200",
};

const PRIORITY_PROGRESS: Record<PriorityLevel | string, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-sky-500",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-red-500",
};

export function PriorityBadge({ priority, inline = false }: { priority: PriorityLevel | string | null | undefined; inline?: boolean }) {
  const p: PriorityLevel | string =
    priority === "LOW" || priority === "MEDIUM" || priority === "HIGH" || priority === "CRITICAL"
      ? priority
      : "LOW";
  return (
    <span className={`inline-flex items-center ${inline ? "" : "rounded px-2 py-0.5 ring-1 ring-inset "} ${inline ? "" : PRIORITY_STYLES[p]} text-xs font-semibold ${inline ? (p === "CRITICAL" ? "text-red-700" : p === "HIGH" ? "text-amber-700" : p === "MEDIUM" ? "text-sky-700" : "text-slate-600") : ""}`}>
      {p.charAt(0) + p.slice(1).toLowerCase()}
    </span>
  );
}

export function priorityProgressClass(priority?: PriorityLevel | string | null) {
  if (!priority) return PRIORITY_PROGRESS.LOW;
  return PRIORITY_PROGRESS[priority] ?? PRIORITY_PROGRESS.LOW;
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
  score: number | null | undefined;
  band: string | null | undefined;
  compact?: boolean;
}) {
  const s = Math.max(0, Math.min(100, Number(score ?? 0)));
  const b = band ?? "NONE";
  return (
    <div className={compact ? "flex items-center gap-2" : "space-y-1"}>
      <div className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${compact ? "w-20" : "w-full"}`}>
        <div className={`h-full rounded-full ${BAND_COLOR[b] ?? BAND_COLOR.NONE}`} style={{ width: `${s}%` }} />
      </div>
      <span className="whitespace-nowrap text-xs font-semibold text-slate-600">
        {s.toFixed(1)}{compact ? "" : " / 100"}
        {!compact && b !== "NONE" && <span className="ml-1.5 font-normal text-slate-400">{b.toLowerCase()}</span>}
      </span>
    </div>
  );
}

/** Priority score progress — 0-100, color follows priority level. */
export function PriorityProgress({
  score,
  level,
  compact = false,
}: {
  score: number | null | undefined;
  level?: PriorityLevel | string | null;
  compact?: boolean;
}) {
  const s = Math.max(0, Math.min(100, Number(score ?? 0)));
  const cls = priorityProgressClass(level);
  return (
    <div className={compact ? "w-24" : "w-full"}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${s}%` }} />
      </div>
    </div>
  );
}

/**
 * IMPROVEMENT 9: Factor breakdown visual (dashboard + detail).
 * Shows each factor as score / MAX with a mini progress bar.
 *   AI Severity:  23 / 25
 *   Confidence:   14 / 15
 *   Duplicates:   15 / 15
 *   Location:     18 / 20
 *   Age:           8 / 10
 *   Department:    8 / 15
 */
export function FactorBreakdown({
  factors,
  compact = false,
}: {
  factors: PriorityFactors | null | undefined;
  compact?: boolean;
}) {
  if (!factors) return null;
  const keys: (keyof PriorityFactors)[] = [
    "categoryScore",
    "confidenceScore",
    "duplicateScore",
    "locationScore",
    "ageScore",
    "departmentScore",
  ];
  return (
    <dl className={compact ? "space-y-1.5" : "space-y-2"}>
      {keys.map((k) => {
        const max = FACTOR_MAX[k];
        const value = Math.max(0, Math.min(max, Number(factors[k] ?? 0)));
        const pct = max > 0 ? (value / max) * 100 : 0;
        return (
          <div key={k}>
            <div className="flex items-center justify-between text-xs">
              <dt className="font-medium text-slate-600">{FACTOR_LABEL[k]}</dt>
              <dd className="font-mono font-semibold text-slate-900">
                {value.toFixed(0)}<span className="text-slate-400">/{max}</span>
              </dd>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${
                  pct >= 85 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : pct >= 30 ? "bg-sky-500" : "bg-slate-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </dl>
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

export function ModelModeBadge({ mode }: { mode: string | null | undefined }) {
  if (!mode) return null;
  const meta: Record<string, { label: string; cls: string; title: string }> = {
    TRAINED: {
      label: "Trained model",
      cls: "bg-emerald-100 text-emerald-700 ring-emerald-200",
      title: "Predictions from the YOLO model fine-tuned on RDD2022",
    },
    HEURISTIC: {
      label: "Heuristic CV",
      cls: "bg-sky-100 text-sky-800 ring-sky-200",
      title: "Classical OpenCV detector (dark-blob + edge analysis) — not deep learning; the trained model replaces it after train.py",
    },
    FALLBACK: {
      label: "Fallback model",
      cls: "bg-amber-100 text-amber-800 ring-amber-200",
      title: "Pretrained COCO model — generic objects, not road-damage classes",
    },
  };
  const m = meta[mode] ?? meta.FALLBACK;
  return (
    <span
      title={m.title}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
