import { redirect } from "next/navigation";
import { Server, Database, Gauge, HardDrive } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { PageHeader, Card, KpiCard } from "@/components/ui";
import { TrendAreaChart } from "@/components/charts";

export const metadata = { title: "Monitoring" };
export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const session = await requireSession();
  if (!canAccess(session.role, "monitoring")) redirect("/app/dashboard");

  const latency = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}:00`,
    value: Math.round(120 + Math.sin(i / 3) * 40 + Math.random() * 30),
  }));

  const SERVICES = [
    ["API Gateway", "Operational", "99.98%"],
    ["PostgreSQL Primary", "Operational", "99.99%"],
    ["Redis (Cache/Queues)", "Operational", "99.97%"],
    ["BullMQ Workers", "Operational", "99.95%"],
    ["Object Storage (S3)", "Operational", "100%"],
    ["AI/ML Service", "Degraded", "98.20%"],
    ["SMS Gateway", "Operational", "99.90%"],
    ["Email Provider", "Operational", "99.94%"],
  ];

  return (
    <>
      <PageHeader title="System Monitoring" subtitle="Platform health, service status and performance (demo telemetry)" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="API Uptime (30d)" value="99.98%" sub="SLO: 99.9%" icon={Server} tone="green" />
        <KpiCard label="P95 Response Time" value="184ms" sub="Across all endpoints" icon={Gauge} tone="brand" />
        <KpiCard label="DB Connections" value="42 / 200" sub="Primary pool utilization" icon={Database} tone="brand" />
        <KpiCard label="Queue Depth" value="17 jobs" sub="Notifications, reports, AI jobs" icon={HardDrive} tone="amber" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="API P95 Latency — Last 24h (ms)">
          <TrendAreaChart data={latency} color="#8b5cf6" name="ms" />
        </Card>
        <Card title="Service Status">
          <div className="divide-y divide-slate-100">
            {SERVICES.map(([name, status, uptime]) => (
              <div key={name} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${status === "Operational" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-medium text-slate-800">{name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-medium ${status === "Operational" ? "text-emerald-600" : "text-amber-600"}`}>{status}</span>
                  <span className="w-14 text-right font-mono text-xs text-slate-500">{uptime}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
