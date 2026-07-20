import { BadgeCheck, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Citizens" };
export const dynamic = "force-dynamic";

export default async function CitizensPage() {
  await requireSession();
  const citizens = await db.citizen.findMany({
    include: { complaints: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Citizen Directory"
        subtitle="Registered citizens from the external mobile application · identity, activity and moderation"
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Citizen</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Complaints Filed</th>
              <th className="px-4 py-3">Member Since</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {citizens.map((c) => (
              <tr key={c.id} className="hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{c.name}</div>
                  <div className="font-mono text-xs text-slate-500">{c.code}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <div>{c.email}</div>
                  <div className="text-xs text-slate-500">{c.phone}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{c.zone}</td>
                <td className="px-4 py-3">
                  {c.verified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600"><BadgeCheck size={15} /> Verified</span>
                  ) : (
                    <span className="text-slate-400">Pending</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{c.complaints.length}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(c.joinedAt)}</td>
                <td className="px-4 py-3">
                  {c.status === "ACTIVE" ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Active</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      <ShieldAlert size={12} /> Suspended
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
