import Link from "next/link";
import {
  ClipboardList, AlertTriangle, CheckCircle2, Timer, HardHat, Star,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/rbac";
import { fmtDateTime, slaStatus } from "@/lib/format";
import { KpiCard, Card, PageHeader } from "@/components/ui";
import { StatusBadge, PriorityBadge, SlaBadge } from "@/components/badges";
import { TrendAreaChart, DonutChart, SimpleBarChart } from "@/components/charts";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "ESCALATED", "REOPENED"];

export default async function DashboardPage() {
  const session = await requireSession();
  // Department Manager / Supervisor / Engineer see their department's slice (Part 6 scoping)
  const scoped = ["DEPARTMENT_MANAGER", "SUPERVISOR", "ENGINEER"].includes(session.role) && session.departmentId;
  const where = scoped ? { departmentId: session.departmentId! } : {};

  const [complaints, engineers, deptCount] = await Promise.all([
    db.complaint.findMany({ where, include: { department: true, engineer: true }, orderBy: { createdAt: "desc" } }),
    db.engineer.count(scoped ? { where: { departmentId: session.departmentId! } } : undefined),
    db.department.count(),
  ]);

  const open = complaints.filter((c) => OPEN_STATUSES.includes(c.status));
  const escalated = complaints.filter((c) => c.status === "ESCALATED");
  const closed = complaints.filter((c) => c.status === "CLOSED");
  const breached = open.filter((c) => slaStatus(c.createdAt, c.slaHours) === "BREACHED");
  const rated = closed.filter((c) => c.rating != null);
  const avgRating = rated.length
    ? (rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length).toFixed(1)
    : "—";
  const mttr = closed.length
    ? Math.round(
        closed.reduce((s, c) => s + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()), 0) /
          closed.length / 3600000
      )
    : 0;

  // 14-day intake trend
  const trend: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const next = new Date(day.getTime() + 86400000);
    trend.push({
      label: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: complaints.filter((c) => c.createdAt >= day && c.createdAt < next).length,
    });
  }

  const statusColors: Record<string, string> = {
    SUBMITTED: "#94a3b8", UNDER_REVIEW: "#0ea5e9", ASSIGNED: "#6366f1", IN_PROGRESS: "#f59e0b",
    PENDING_REVIEW: "#8b5cf6", ESCALATED: "#ef4444", CLOSED: "#10b981", REOPENED: "#f97316", REJECTED: "#cbd5e1",
  };
  const donut = Object.entries(
    complaints.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([status, value]) => ({ name: STATUS_LABELS[status], value, color: statusColors[status] }));

  const byCategory = Object.entries(
    complaints.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const recent = complaints.slice(0, 6);

  return (
    <>
      <PageHeader
        title={`Good day, ${session.name.split(" ")[0]}`}
        subtitle={`${ROLE_LABELS[session.role]} view · ${scoped ? "Scoped to your department" : "City-wide overview"} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open Complaints" value={open.length} sub={`${complaints.length} total in scope`} icon={ClipboardList} tone="brand" />
        <KpiCard label="Escalated / SLA Breached" value={`${escalated.length} / ${breached.length}`} sub="Requires management attention" icon={AlertTriangle} tone="red" />
        <KpiCard label="Resolved (MTTR)" value={`${closed.length}`} sub={`Avg. resolution ${mttr}h`} icon={CheckCircle2} tone="green" />
        {session.role === "COMMISSIONER" || session.role === "ADMINISTRATOR" || session.role === "SUPER_ADMIN" ? (
          <KpiCard label="Departments Active" value={deptCount} sub={`${engineers} field engineers deployed`} icon={HardHat} tone="amber" />
        ) : (
          <KpiCard label="Citizen Satisfaction" value={`${avgRating} / 5`} sub={`${rated.length} rated closures`} icon={Star} tone="amber" />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Complaint Intake — Last 14 Days" className="lg:col-span-2">
          <TrendAreaChart data={trend} />
        </Card>
        <Card title="Status Distribution">
          <DonutChart data={donut} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Volume by Category">
          <SimpleBarChart data={byCategory} horizontal />
        </Card>
        <Card title="Latest Complaints" className="lg:col-span-2">
          <div className="divide-y divide-slate-100">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/app/complaints/${c.ref}`}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand-700">{c.ref}</span>
                    <PriorityBadge priority={c.priority} />
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500">
                    {c.department.name} · {c.zone} · {fmtDateTime(c.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={c.status} />
                  <SlaBadge state={slaStatus(c.createdAt, c.slaHours, c.closedAt)} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Timer size={16} className="shrink-0" />
        SLA monitor runs every 5 minutes — {breached.length} open complaint{breached.length === 1 ? "" : "s"} currently past deadline,{" "}
        {open.filter((c) => slaStatus(c.createdAt, c.slaHours) === "AT_RISK").length} at risk.
      </div>
    </>
  );
}
