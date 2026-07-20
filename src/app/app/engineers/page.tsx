import Link from "next/link";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Engineers" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-700",
  ON_TASK: "bg-amber-50 text-amber-700",
  OFF_DUTY: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<string, string> = { AVAILABLE: "Available", ON_TASK: "On Task", OFF_DUTY: "Off Duty" };

export default async function EngineersPage() {
  const session = await requireSession();
  const scoped = ["DEPARTMENT_MANAGER", "SUPERVISOR"].includes(session.role) && session.departmentId;
  const engineers = await db.engineer.findMany({
    where: scoped ? { departmentId: session.departmentId! } : {},
    include: { department: true, complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Engineer Directory"
        subtitle={`${engineers.length} field engineer${engineers.length === 1 ? "" : "s"}${scoped ? " in your department" : " across all departments"}`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {engineers.map((e) => (
          <Link
            key={e.id}
            href={`/app/engineers/${e.code}`}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                  {e.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div>
                  <h2 className="font-semibold text-slate-900">{e.name}</h2>
                  <p className="text-xs text-slate-500">{e.code} · {e.department.name}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status]}`}>
                {STATUS_LABEL[e.status]}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {e.skills.split(",").map((s) => (
                <span key={s} className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{s}</span>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-sm">
              <div>
                <div className="flex items-center justify-center gap-1 font-bold text-slate-900">
                  <Star size={13} className="fill-amber-400 text-amber-400" /> {e.rating}
                </div>
                <div className="text-[11px] text-slate-500">Rating</div>
              </div>
              <div>
                <div className="font-bold text-slate-900">{e.complaints.length}</div>
                <div className="text-[11px] text-slate-500">Active Jobs</div>
              </div>
              <div>
                <div className="font-bold text-slate-900">{e.resolvedJobs}</div>
                <div className="text-[11px] text-slate-500">Resolved</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
