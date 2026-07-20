import { redirect } from "next/navigation";
import { Building2, ShieldCheck, Bell, Palette, Plug, UserCog } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canAccess, ROLE_LABELS, NAV_ITEMS, ALL_ROLES } from "@/lib/rbac";
import { PageHeader, Card } from "@/components/ui";
import { Check, Minus } from "lucide-react";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  if (!canAccess(session.role, "settings")) redirect("/app/dashboard");

  const GROUPS = [
    { icon: Building2, title: "Organization", desc: "Lumen City Municipal Corporation · 6 departments · 5 zones" },
    { icon: UserCog, title: "Roles & Permissions", desc: "8 system roles · permission overrides per user" },
    { icon: ShieldCheck, title: "Security Policy", desc: "MFA mandatory for privileged roles · 12h session lifetime · reopen window 7 days" },
    { icon: Bell, title: "Notification Rules", desc: "SLA at-risk (80%), breach and escalation alerts enabled" },
    { icon: Palette, title: "Branding", desc: "LUMEN default theme · organization logo and colors" },
    { icon: Plug, title: "Integrations", desc: "Google Maps Platform · Email (SES) · SMS Gateway · Object Storage" },
  ];

  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Organization-wide configuration (Administrator)" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <g.icon size={19} />
            </span>
            <h2 className="font-semibold text-slate-900">{g.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{g.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Card title="Permission Matrix — Module Access by Role (read-only)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left font-semibold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Module</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r} className="px-2 py-2 text-center">{ROLE_LABELS[r].split(" ").map((w) => w[0]).join("")}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {NAV_ITEMS.map((item) => (
                  <tr key={item.key}>
                    <td className="py-2 pr-3 font-medium text-slate-700">{item.label}</td>
                    {ALL_ROLES.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {item.roles.includes(r) ? (
                          <Check size={14} className="mx-auto text-emerald-600" />
                        ) : (
                          <Minus size={14} className="mx-auto text-slate-300" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Column initials: {ALL_ROLES.map((r) => `${ROLE_LABELS[r].split(" ").map((w) => w[0]).join("")} = ${ROLE_LABELS[r]}`).join(" · ")}
          </p>
        </Card>
      </div>
    </>
  );
}
