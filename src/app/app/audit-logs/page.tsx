import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canAccess, ROLE_LABELS } from "@/lib/rbac";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Audit Logs" };
export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const session = await requireSession();
  if (!canAccess(session.role, "audit-logs")) redirect("/app/dashboard");

  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <>
      <PageHeader
        title="Audit Log Explorer"
        subtitle="Immutable, append-only record of every state-changing action on the platform"
      />
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <Lock size={15} className="text-slate-400" />
        Entries cannot be edited or deleted — retention is enforced at the storage layer per government compliance requirements.
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="hover:bg-brand-50/40">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDateTime(l.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{l.actor}</div>
                  <div className="text-xs text-slate-500">{ROLE_LABELS[l.actorRole] ?? l.actorRole}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{l.action}</span>
                </td>
                <td className="px-4 py-3 text-slate-600">{l.module}</td>
                <td className="max-w-md px-4 py-3 text-slate-600">{l.details}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
