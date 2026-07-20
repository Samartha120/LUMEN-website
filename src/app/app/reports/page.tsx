import { FileText, Download, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { slaStatus } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireSession();
  const departments = await db.department.findMany({ include: { complaints: true }, orderBy: { name: "asc" } });

  const rows = departments.map((d) => {
    const closed = d.complaints.filter((c) => c.status === "CLOSED" && c.closedAt);
    const open = d.complaints.filter((c) => !["CLOSED", "REJECTED"].includes(c.status));
    const met = closed.filter((c) => slaStatus(c.createdAt, c.slaHours, c.closedAt) === "MET");
    return {
      name: d.name,
      total: d.complaints.length,
      open: open.length,
      closed: closed.length,
      slaRate: closed.length ? Math.round((met.length / closed.length) * 100) : 0,
      mttr: closed.length
        ? Math.round(closed.reduce((s, c) => s + (new Date(c.closedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / closed.length / 3600000)
        : 0,
    };
  });

  const SCHEDULED = [
    ["Weekly SLA Compliance Summary", "Every Monday 08:00", "Commissioner, Department Managers"],
    ["Monthly Department Performance", "1st of month 06:00", "Commissioner, Administrator"],
    ["Daily Escalation Digest", "Daily 18:00", "Supervisors, Department Managers"],
    ["Quarterly Audit Trail Export", "Quarter end", "Auditor"],
  ];

  return (
    <>
      <PageHeader title="Report Center" subtitle="Generated performance reports and scheduled distributions" />
      <Card title="Department SLA Compliance Report — Live">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Open</th>
                <th className="py-2 pr-4">Closed</th>
                <th className="py-2 pr-4">MTTR (h)</th>
                <th className="py-2">SLA Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="py-2.5 pr-4 font-medium text-slate-800">{r.name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.total}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.open}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.closed}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{r.mttr}</td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full ${r.slaRate >= 70 ? "bg-emerald-500" : r.slaRate >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${r.slaRate}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{r.slaRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-900">
          <Download size={14} /> Export CSV (demo)
        </button>
      </Card>

      <div className="mt-6">
        <Card title="Scheduled Reports">
          <div className="divide-y divide-slate-100">
            {SCHEDULED.map(([name, cadence, audience]) => (
              <div key={name} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <FileText size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{name}</p>
                    <p className="text-xs text-slate-500">Audience: {audience}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <CalendarClock size={13} /> {cadence}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
