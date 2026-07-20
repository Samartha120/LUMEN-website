import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { ConditionBadge } from "@/components/badges";
import Link from "next/link";

export const metadata = { title: "Assets" };
export const dynamic = "force-dynamic";

const CATEGORIES = ["ALL", "ROADS", "PIPES", "STREETLIGHTS", "BUILDINGS", "SIGNALS", "VEHICLES", "BRIDGES"];
const CAT_LABEL: Record<string, string> = {
  ALL: "All", ROADS: "Roads", PIPES: "Pipes", STREETLIGHTS: "Street Lights",
  BUILDINGS: "Buildings", SIGNALS: "Signals", VEHICLES: "Vehicles", BRIDGES: "Bridges",
};

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  await requireSession();
  const { category } = await searchParams;
  const cat = category?.toUpperCase();
  const assets = await db.asset.findMany({
    where: cat && cat !== "ALL" ? { category: cat } : {},
    include: { department: true },
    orderBy: { code: "asc" },
  });

  const critical = assets.filter((a) => a.condition === "CRITICAL" || a.condition === "POOR").length;

  return (
    <>
      <PageHeader
        title="Asset Registry"
        subtitle={`${assets.length} physical assets in view · ${critical} in poor or critical condition`}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={c === "ALL" ? "/app/assets" : `/app/assets?category=${c}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${(cat ?? "ALL") === c ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {CAT_LABEL[c]}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Installed</th>
              <th className="px-4 py-3">Last Maintenance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((a) => (
              <tr key={a.id} className="hover:bg-brand-50/40">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{a.name}</div>
                  <div className="font-mono text-xs text-slate-500">{a.code}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{CAT_LABEL[a.category] ?? a.category}</td>
                <td className="px-4 py-3 text-slate-600">{a.zone}</td>
                <td className="px-4 py-3 text-slate-600">{a.department.name}</td>
                <td className="px-4 py-3"><ConditionBadge condition={a.condition} /></td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(a.installedAt)}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(a.lastMaintenance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
