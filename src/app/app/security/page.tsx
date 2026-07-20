import { redirect } from "next/navigation";
import { ShieldCheck, ShieldAlert, KeyRound, MonitorSmartphone } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccess, ROLE_LABELS } from "@/lib/rbac";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, Card, KpiCard } from "@/components/ui";

export const metadata = { title: "Security Center" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await requireSession();
  if (!canAccess(session.role, "security")) redirect("/app/dashboard");

  const logins = await db.auditLog.findMany({
    where: { module: "Authentication" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const THREATS = [
    ["Repeated failed logins", "5 attempts against auditor@lumen.gov from 203.0.113.42", "Blocked · IP rate-limited", "HIGH"],
    ["New device sign-in", "Administrator signed in from an unrecognized device fingerprint", "Verified via OTP", "MEDIUM"],
    ["Unusual export volume", "Analyst exported 3 large reports within 10 minutes", "Flagged for review", "LOW"],
  ];

  const SESSIONS = [
    ["Meera Krishnan", "DEPARTMENT_MANAGER", "Chrome · macOS", "10.14.2.21", "Active now"],
    ["Suresh Pillai", "SUPERVISOR", "Edge · Windows 11", "10.14.2.28", "Active now"],
    ["Divya Menon", "ANALYST", "Firefox · Ubuntu", "10.14.2.33", "12 min ago"],
    ["Joseph Thomas", "AUDITOR", "Chrome · Windows 10", "10.14.2.35", "1 h ago"],
  ];

  return (
    <>
      <PageHeader title="Security Center" subtitle="Threat detection, active sessions and authentication posture" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Security Posture" value="Strong" sub="0 critical findings open" icon={ShieldCheck} tone="green" />
        <KpiCard label="Active Threat Flags" value={THREATS.length} sub="1 high, 1 medium, 1 low" icon={ShieldAlert} tone="amber" />
        <KpiCard label="MFA Coverage" value="100%" sub="All privileged roles enrolled" icon={KeyRound} tone="green" />
        <KpiCard label="Active Sessions" value={SESSIONS.length} sub="Across all staff accounts" icon={MonitorSmartphone} tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Threat Detection (demo signals)">
          <div className="space-y-3">
            {THREATS.map(([title, detail, action, sev]) => (
              <div key={title} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{title}</span>
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${sev === "HIGH" ? "bg-red-100 text-red-700" : sev === "MEDIUM" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                    {sev}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{detail}</p>
                <p className="mt-1 text-xs font-medium text-emerald-600">{action}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Active Sessions">
          <div className="divide-y divide-slate-100">
            {SESSIONS.map(([name, role, device, ip, last]) => (
              <div key={name as string} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-800">{name}</p>
                  <p className="text-xs text-slate-500">{ROLE_LABELS[role as string]} · {device}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-slate-500">{ip}</p>
                  <p className="text-xs text-emerald-600">{last}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent Authentication Events" className="lg:col-span-2">
          <div className="divide-y divide-slate-100">
            {logins.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700">
                  <span className="font-mono text-xs font-semibold text-slate-500">{l.action}</span> — {l.details}
                </span>
                <span className="text-xs text-slate-400">{fmtDateTime(l.createdAt)}</span>
              </div>
            ))}
            {logins.length === 0 && <p className="py-3 text-sm text-slate-400">No authentication events recorded yet.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
