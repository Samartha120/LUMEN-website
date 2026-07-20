import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, CheckCircle2, HardHat, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtINR, slaStatus, ageOf } from "@/lib/format";
import { PageHeader, KpiCard, Card } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

const OPEN = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "ESCALATED", "REOPENED"];

export default async function DepartmentDetailPage({ params }: { params: Promise<{ code: string }> }) {
  await requireSession();
  const { code } = await params;
  const dept = await db.department.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      complaints: { orderBy: { createdAt: "desc" }, include: { engineer: true } },
      engineers: true,
      assets: true,
    },
  });
  if (!dept) notFound();

  const open = dept.complaints.filter((c) => OPEN.includes(c.status));
  const closed = dept.complaints.filter((c) => c.status === "CLOSED");
  const breached = open.filter((c) => slaStatus(c.createdAt, c.slaHours) === "BREACHED");
  const mttr = closed.length
    ? Math.round(closed.reduce((s, c) => s + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / closed.length / 3600000)
    : 0;

  return (
    <>
      <Link href="/app/departments" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft size={15} /> All Departments
      </Link>
      <PageHeader title={dept.name} subtitle={`${dept.description} · Head: ${dept.headName}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Complaints" value={open.length} sub={`${breached.length} SLA breached`} icon={ClipboardList} tone={breached.length ? "red" : "brand"} />
        <KpiCard label="Resolved" value={closed.length} sub={`MTTR ${mttr}h (target ${dept.slaTarget}h)`} icon={CheckCircle2} tone="green" />
        <KpiCard label="Field Engineers" value={dept.engineers.length} sub={`${dept.engineers.filter((e) => e.status === "AVAILABLE").length} available now`} icon={HardHat} tone="brand" />
        <KpiCard label="Budget Utilized" value={`${Math.round((dept.budgetUsed / dept.budget) * 100)}%`} sub={`${fmtINR(dept.budgetUsed)} of ${fmtINR(dept.budget)}`} icon={Wallet} tone="amber" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recent Complaints">
          <div className="divide-y divide-slate-100">
            {dept.complaints.slice(0, 8).map((c) => (
              <Link key={c.id} href={`/app/complaints/${c.ref}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-brand-700">{c.ref}</span>
                  <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.zone} · {ageOf(c.createdAt)} old · {c.engineer?.name ?? "Unassigned"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={c.status} />
                  <PriorityBadge priority={c.priority} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Engineers">
            <div className="divide-y divide-slate-100">
              {dept.engineers.map((e) => (
                <Link key={e.id} href={`/app/engineers/${e.code}`} className="flex items-center justify-between py-2.5 hover:bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.name}</p>
                    <p className="text-xs text-slate-500">{e.code} · {e.zone} · {e.skills.split(",").join(", ")}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${e.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" : e.status === "ON_TASK" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {e.status === "AVAILABLE" ? "Available" : e.status === "ON_TASK" ? "On Task" : "Off Duty"}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
          <Card title={`Assets (${dept.assets.length})`}>
            <div className="flex flex-wrap gap-2">
              {dept.assets.map((a) => (
                <span key={a.id} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {a.name}
                </span>
              ))}
              {dept.assets.length === 0 && <span className="text-sm text-slate-400">No assets registered.</span>}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
