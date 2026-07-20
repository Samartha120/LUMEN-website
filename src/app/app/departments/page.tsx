import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtINR } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Departments" };
export const dynamic = "force-dynamic";

const OPEN = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "ESCALATED", "REOPENED"];

export default async function DepartmentsPage() {
  await requireSession();
  const departments = await db.department.findMany({
    include: { complaints: true, engineers: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader title="Departments" subtitle="Organizational units, budgets and operational load" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => {
          const open = d.complaints.filter((c) => OPEN.includes(c.status)).length;
          const closed = d.complaints.filter((c) => c.status === "CLOSED").length;
          const pct = Math.round((d.budgetUsed / d.budget) * 100);
          return (
            <Link
              key={d.id}
              href={`/app/departments/${d.code}`}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">{d.name}</h2>
                  <p className="text-xs text-slate-500">Head: {d.headName} · SLA {d.slaTarget}h</p>
                </div>
                <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">{d.code}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{d.description}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <div>
                  <div className="text-lg font-bold text-slate-900">{open}</div>
                  <div className="text-[11px] text-slate-500">Open</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600">{closed}</div>
                  <div className="text-[11px] text-slate-500">Resolved</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{d.engineers.length}</div>
                  <div className="text-[11px] text-slate-500">Engineers</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                  <span>Budget utilization</span>
                  <span>{fmtINR(d.budgetUsed)} / {fmtINR(d.budget)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${pct > 85 ? "bg-red-500" : pct > 65 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
