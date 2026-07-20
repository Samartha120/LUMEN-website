import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { TrendAreaChart, SimpleBarChart, MultiLineChart, DonutChart } from "@/components/charts";
import { TrendingUp, Timer, Star, Target } from "lucide-react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireSession();
  const [complaints, departments] = await Promise.all([
    db.complaint.findMany({ include: { department: true } }),
    db.department.findMany({ include: { complaints: true } }),
  ]);

  const closed = complaints.filter((c) => c.status === "CLOSED" && c.closedAt);
  const mttr = closed.length
    ? Math.round(closed.reduce((s, c) => s + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / closed.length / 3600000)
    : 0;
  const slaMet = closed.filter((c) => new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime() <= c.slaHours * 3600000);
  const slaRate = closed.length ? Math.round((slaMet.length / closed.length) * 100) : 0;
  const rated = closed.filter((c) => c.rating != null);
  const avgRating = rated.length ? (rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length).toFixed(1) : "—";

  // Weekly intake vs resolution over 8 weeks
  const weekly: Record<string, string | number>[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (w + 1) * 7);
    const end = new Date(start.getTime() + 7 * 86400000);
    weekly.push({
      label: `W-${w}`,
      intake: complaints.filter((c) => c.createdAt >= start && c.createdAt < end).length,
      resolved: closed.filter((c) => c.closedAt! >= start && c.closedAt! < end).length,
    });
  }

  const byDept = departments.map((d) => ({ label: d.name, value: d.complaints.length })).sort((a, b) => b.value - a.value);

  const deptMttr = departments
    .map((d) => {
      const dc = d.complaints.filter((c) => c.status === "CLOSED" && c.closedAt);
      return {
        label: d.name,
        value: dc.length
          ? Math.round(dc.reduce((s, c) => s + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / dc.length / 3600000)
          : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  const byZone = Object.entries(
    complaints.reduce<Record<string, number>>((acc, c) => {
      acc[c.zone] = (acc[c.zone] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value], i) => ({
    name, value,
    color: ["#3d63ec", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"][i % 5],
  }));

  // 14-day daily trend
  const trend: { label: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
    const next = new Date(day.getTime() + 86400000);
    trend.push({
      label: day.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: complaints.filter((c) => c.createdAt >= day && c.createdAt < next).length,
    });
  }

  return (
    <>
      <PageHeader title="City Analytics" subtitle="Operational performance across departments, zones and time" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Complaints" value={complaints.length} sub="All time, all departments" icon={TrendingUp} tone="brand" />
        <KpiCard label="Mean Time to Resolution" value={`${mttr}h`} sub="Across all closed complaints" icon={Timer} tone="amber" />
        <KpiCard label="SLA Compliance" value={`${slaRate}%`} sub={`${slaMet.length} of ${closed.length} closures within SLA`} icon={Target} tone={slaRate >= 70 ? "green" : "red"} />
        <KpiCard label="Citizen Satisfaction" value={`${avgRating} / 5`} sub={`${rated.length} rated closures`} icon={Star} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Weekly Intake vs Resolution (8 weeks)">
          <MultiLineChart
            data={weekly}
            series={[
              { key: "intake", name: "Intake", color: "#3d63ec" },
              { key: "resolved", name: "Resolved", color: "#10b981" },
            ]}
          />
        </Card>
        <Card title="Daily Intake — Last 14 Days">
          <TrendAreaChart data={trend} />
        </Card>
        <Card title="Complaint Volume by Department">
          <SimpleBarChart data={byDept} horizontal />
        </Card>
        <Card title="MTTR by Department (hours)">
          <SimpleBarChart data={deptMttr} color="#f59e0b" name="Hours" horizontal />
        </Card>
        <Card title="Distribution by Zone" className="lg:col-span-2">
          <DonutChart data={byZone} />
        </Card>
      </div>
    </>
  );
}
