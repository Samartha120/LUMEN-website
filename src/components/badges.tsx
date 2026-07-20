import { STATUS_LABELS } from "@/lib/rbac";

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700 ring-slate-200",
  UNDER_REVIEW: "bg-sky-50 text-sky-700 ring-sky-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200",
  PENDING_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  ESCALATED: "bg-red-50 text-red-700 ring-red-200",
  CLOSED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REOPENED: "bg-orange-50 text-orange-700 ring-orange-200",
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

const SLA_STYLES: Record<string, [string, string]> = {
  ON_TRACK: ["bg-emerald-500", "On Track"],
  AT_RISK: ["bg-amber-500", "At Risk"],
  BREACHED: ["bg-red-500", "Breached"],
  MET: ["bg-emerald-500", "SLA Met"],
};

export function SlaBadge({ state }: { state: string }) {
  const [dot, label] = SLA_STYLES[state] ?? SLA_STYLES.ON_TRACK;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const CONDITION_STYLES: Record<string, string> = {
  GOOD: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAIR: "bg-sky-50 text-sky-700 ring-sky-200",
  POOR: "bg-amber-50 text-amber-700 ring-amber-200",
  CRITICAL: "bg-red-50 text-red-700 ring-red-200",
};

export function ConditionBadge({ condition }: { condition: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${CONDITION_STYLES[condition] ?? CONDITION_STYLES.FAIR}`}>
      {condition.charAt(0) + condition.slice(1).toLowerCase()}
    </span>
  );
}
