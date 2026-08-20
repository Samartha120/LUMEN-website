import { Activity, ClipboardList, FileText, Users } from "lucide-react";
import { useAuth } from "../auth";
import { DonutChart, SimpleBarChart } from "../components/charts";
import { Card, KpiCard, PageHeader } from "../components/ui";
import { fmtDateTime } from "../lib/format";
import { ROLE_LABELS } from "../lib/rbac";
import { useApi } from "../lib/useApi";

type DashboardData = {
  totalUsers: number;
  totalComplaints: number;
  usersByRole: { _count: { _all: number }; role: string }[];
  complaintsByStatus: { _count: { _all: number }; status: string }[];
  recentAuditLogs: {
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    user: { fullName: string; email: string };
  }[];
};

type ComplaintSummary = {
  id: string;
  trackingId: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
};

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRATOR";
  const { data, loading, error } = useApi<DashboardData | { complaints: ComplaintSummary[] }>(isAdmin ? "/v1/admin/dashboard" : "/complaints");

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error || !data) return <p className="text-slate-400">Dashboard unavailable.</p>;

  if (!isAdmin) {
    const complaints = (data as { complaints: ComplaintSummary[] }).complaints;
    const openComplaintsCount = complaints.filter((c) => ["PENDING", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"].includes(c.status)).length;
    const highPriorityCount = complaints.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL").length;
    const recentComplaints = [...complaints].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);

    return (
      <>
        <PageHeader
          title={`Good day, ${user?.name.split(" ")[0] || "Supervisor"}`}
          subtitle={`${ROLE_LABELS[user?.role ?? ""] || user?.role || "Supervisor"} · LUMEN City Operations`}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total Complaints" value={complaints.length} sub="Current complaint queue" icon={ClipboardList} tone="brand" />
          <KpiCard label="Open Issues" value={openComplaintsCount} sub="Pending, assigned, or active" icon={Activity} tone={openComplaintsCount > 0 ? "amber" : "green"} />
          <KpiCard label="High Priority" value={highPriorityCount} sub="High and critical reports" icon={Users} tone="brand" />
          <KpiCard label="Recent Reports" value={recentComplaints.length} sub="Latest complaints shown below" icon={FileText} tone="amber" />
        </div>

        <Card title="Recent Complaints" className="mt-6">
          <div className="divide-y divide-slate-100">
            {recentComplaints.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.trackingId} · {fmtDateTime(item.createdAt)}</p>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.status}</div>
              </div>
            ))}
            {recentComplaints.length === 0 && <p className="py-4 text-sm text-slate-400">No complaints available.</p>}
          </div>
        </Card>
      </>
    );
  }

  const adminData = data as DashboardData;

  const statusData = adminData.complaintsByStatus
    .map((s) => ({
      name: s.status.charAt(0) + s.status.slice(1).toLowerCase(),
      value: s._count._all,
      color:
        s.status === "PENDING"
          ? "#f59e0b"
          : s.status === "RESOLVED"
            ? "#10b981"
            : "#3b82f6",
    }))
    .sort((a, b) => b.value - a.value);

  const roleData = adminData.usersByRole
    .map((r) => ({
      label: r.role,
      value: r._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  const openComplaintsCount = adminData.complaintsByStatus
    .filter((s) => s.status === "PENDING" || s.status === "ASSIGNED")
    .reduce((acc, s) => acc + s._count._all, 0);

  return (
    <>
      <PageHeader
        title={`Good day, ${user?.name.split(" ")[0] || "Admin"}`}
        subtitle={`${ROLE_LABELS[user!.role] || user!.role} · LUMEN City Operations`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Complaints"
          value={adminData.totalComplaints}
          sub="All time reports"
          icon={ClipboardList}
          tone="brand"
        />
        <KpiCard
          label="Open Issues"
          value={openComplaintsCount}
          sub="Pending or Assigned"
          icon={Activity}
          tone={openComplaintsCount > 0 ? "amber" : "green"}
        />
        <KpiCard
          label="Total Users"                 
          value={adminData.totalUsers}
          sub="Active citizens & admins"
          icon={Users}
          tone="brand"
        />
        <KpiCard
          label="Audit Events"
          value={adminData.recentAuditLogs.length}
          sub="Recent actions"
          icon={FileText}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Complaints by Status" className="lg:col-span-1">
          <DonutChart data={statusData} />
        </Card>
        <Card title="Users by Role" className="lg:col-span-2">
          <SimpleBarChart data={roleData} horizontal />
        </Card>
      </div>

      <Card title="Recent System Activity" className="mt-6">
        <div className="divide-y divide-slate-100">
          {adminData.recentAuditLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="mt-0.5 truncate text-sm font-medium text-slate-800">
                  {log.action} on {log.entityType}
                </p>
                <p className="text-xs text-slate-500">
                  By {log.user.fullName} ({log.user.email}) ·{" "}
                  {fmtDateTime(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {adminData.recentAuditLogs.length === 0 && (
            <p className="py-4 text-sm text-slate-400">No recent activity.</p>
          )}
        </div>
      </Card>
    </>
  );
}
