import type { LucideIcon } from "lucide-react";

export function PageHeader({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "" }: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`surface rounded-xl p-5 ${className}`}>
      {title && (
        <h2 className="mb-4 text-[0.8rem] font-semibold uppercase tracking-[0.07em] text-slate-500">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

export function KpiCard({ label, value, sub, icon: Icon, tone = "brand" }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  tone?: "brand" | "green" | "amber" | "red";
}) {
  // The icon tile is given its own small elevation and a gradient, so the KPI
  // reads as two planes — the card, and the tile sitting on it — rather than
  // one flat rectangle with a coloured square printed on it.
  const tones = {
    brand: "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-brand-200/60",
    green: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 ring-emerald-200/60",
    amber: "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-700 ring-amber-200/60",
    red:   "bg-gradient-to-br from-red-50 to-red-100 text-red-700 ring-red-200/60",
  };
  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
          <p className="tabular mt-2 text-[1.75rem] font-bold leading-none tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-1.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}
          style={{ boxShadow: "var(--elev-1), var(--lip)" }}
        >
          <Icon size={19} />
        </span>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}
