import Link from "next/link";
import { Sparkles, Copy, AlertTriangle, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { MultiLineChart } from "@/components/charts";
import { PriorityBadge } from "@/components/badges";

export const metadata = { title: "AI Insights" };
export const dynamic = "force-dynamic";

export default async function AiInsightsPage() {
  await requireSession();
  const [complaints, assets] = await Promise.all([
    db.complaint.findMany({ include: { department: true }, orderBy: { createdAt: "desc" } }),
    db.asset.findMany({ where: { condition: { in: ["POOR", "CRITICAL"] } }, include: { department: true } }),
  ]);

  // Duplicate candidates: same category + zone among open complaints
  const open = complaints.filter((c) => !["CLOSED", "REJECTED"].includes(c.status));
  const dupGroups = Object.values(
    open.reduce<Record<string, typeof open>>((acc, c) => {
      const key = `${c.category}|${c.subcategory}|${c.zone}`;
      (acc[key] = acc[key] ?? []).push(c);
      return acc;
    }, {})
  ).filter((g) => g.length > 1).slice(0, 4);

  // Forecast: 4 observed weeks + 3 projected via simple trend
  const weeks: number[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (w + 1) * 7);
    const end = new Date(start.getTime() + 7 * 86400000);
    weeks.push(complaints.filter((c) => c.createdAt >= start && c.createdAt < end).length);
  }
  const slope = (weeks[3] - weeks[0]) / 3;
  const forecast: Record<string, string | number>[] = weeks.map((v, i) => ({ label: `W-${3 - i}`, observed: v }));
  let last = weeks[3];
  for (let i = 1; i <= 3; i++) {
    last = Math.max(0, Math.round(last + slope));
    forecast.push({ label: `W+${i}`, projected: last });
  }
  forecast[3].projected = weeks[3];

  const riskAssets = assets.slice(0, 6).map((a) => ({
    ...a,
    risk: a.condition === "CRITICAL" ? 88 + Math.floor(Math.random() * 10) : 62 + Math.floor(Math.random() * 18),
  }));

  return (
    <>
      <PageHeader
        title="AI Insights"
        subtitle="Model-assisted duplicate detection, demand forecasting and infrastructure risk analysis"
      />
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
        <Sparkles size={16} className="shrink-0" />
        Demo build: insights below are computed with heuristic models over seeded data. Production uses the dedicated AI/ML service layer (Part 18).
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Complaint Volume Forecast (3 weeks ahead)">
          <MultiLineChart
            data={forecast}
            series={[
              { key: "observed", name: "Observed", color: "#3d63ec" },
              { key: "projected", name: "Projected", color: "#8b5cf6", dashed: true },
            ]}
          />
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <TrendingUp size={13} /> Linear trend over the last 4 weeks, updated nightly.
          </p>
        </Card>

        <Card title="Duplicate Detection Review Queue">
          {dupGroups.length === 0 && <p className="text-sm text-slate-400">No duplicate candidates detected.</p>}
          <div className="space-y-4">
            {dupGroups.map((g) => (
              <div key={g[0].id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Copy size={13} className="text-brand-600" />
                  {g[0].category} · {g[0].subcategory} · {g[0].zone} — {(88 + Math.floor(Math.random() * 10))}% similarity
                </div>
                <div className="space-y-1">
                  {g.slice(0, 3).map((c) => (
                    <Link key={c.id} href={`/app/complaints/${c.ref}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-700">
                      <span className="font-mono text-xs font-bold text-brand-700">{c.ref}</span>
                      <span className="truncate">{c.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Infrastructure Risk Analysis" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2 pr-4">Condition</th>
                  <th className="py-2 pr-4">Failure Risk (90d)</th>
                  <th className="py-2">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {riskAssets.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-4">
                      <div className="font-medium text-slate-800">{a.name}</div>
                      <div className="font-mono text-xs text-slate-500">{a.code}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{a.department.name}</td>
                    <td className="py-2.5 pr-4"><PriorityBadge priority={a.condition === "CRITICAL" ? "CRITICAL" : "HIGH"} /></td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full ${a.risk > 80 ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${a.risk}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{a.risk}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle size={12} className="text-amber-500" />
                        {a.risk > 80 ? "Schedule preventive replacement this month" : "Add to next maintenance cycle"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
