import { Info, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const KIND: Record<string, { icon: typeof Info; style: string }> = {
  INFO: { icon: Info, style: "bg-sky-50 text-sky-600" },
  WARNING: { icon: AlertTriangle, style: "bg-amber-50 text-amber-600" },
  CRITICAL: { icon: ShieldAlert, style: "bg-red-50 text-red-600" },
  SUCCESS: { icon: CheckCircle2, style: "bg-emerald-50 text-emerald-600" },
};

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await db.notification.findMany({
    where: { role: { in: [session.role, "ALL"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Notification Center"
        subtitle={`Alerts and announcements targeted to your role (${notifications.length})`}
      />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" hint="You're all caught up." />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const k = KIND[n.kind] ?? KIND.INFO;
            const Icon = k.icon;
            return (
              <div key={n.id} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${k.style}`}>
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-900">{n.title}</h2>
                    <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  <span className="mt-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {n.role === "ALL" ? "Broadcast" : "Role-targeted"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
