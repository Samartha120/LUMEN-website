import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { STATUS_LABELS } from "@/lib/rbac";
import { ageOf, slaStatus } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";
import { StatusBadge, PriorityBadge, SlaBadge } from "@/components/badges";

export const metadata = { title: "Complaints" };
export const dynamic = "force-dynamic";

type Search = { status?: string; priority?: string; dept?: string; q?: string };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await requireSession();
  const sp = await searchParams;

  const scoped = ["DEPARTMENT_MANAGER", "SUPERVISOR", "ENGINEER"].includes(session.role) && session.departmentId;

  const where: Record<string, unknown> = {};
  if (scoped) where.departmentId = session.departmentId;
  if (sp.status) where.status = sp.status;
  if (sp.priority) where.priority = sp.priority;
  if (sp.dept && !scoped) where.departmentId = sp.dept;
  if (sp.q) where.OR = [{ title: { contains: sp.q } }, { ref: { contains: sp.q.toUpperCase() } }];

  const [complaints, departments] = await Promise.all([
    db.complaint.findMany({
      where,
      include: { department: true, engineer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const canCreate = ["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"].includes(session.role);

  const filterLink = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    const merged = { ...sp, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return `/app/complaints${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Complaint Queue"
        subtitle={`${complaints.length} complaint${complaints.length === 1 ? "" : "s"} in view${scoped ? " · scoped to your department" : ""}`}
        action={
          canCreate ? (
            <Link
              href="/app/complaints/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
            >
              <Plus size={16} /> New Complaint
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="mr-2">
          {Object.entries(sp).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search title or CMP ref…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
        </form>
        <Link
          href={filterLink({ status: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!sp.status ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        >
          All Statuses
        </Link>
        {Object.keys(STATUS_LABELS).map((s) => (
          <Link
            key={s}
            href={filterLink({ status: sp.status === s ? undefined : s })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sp.status === s ? "bg-brand-700 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => (
          <Link
            key={p}
            href={filterLink({ priority: sp.priority === p ? undefined : p })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${sp.priority === p ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {p.charAt(0) + p.slice(1).toLowerCase()} Priority
          </Link>
        ))}
        {!scoped &&
          departments.map((d) => (
            <Link
              key={d.id}
              href={filterLink({ dept: sp.dept === d.id ? undefined : d.id })}
              className={`rounded-full px-3 py-1 text-xs font-medium ${sp.dept === d.id ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {d.name}
            </Link>
          ))}
      </div>

      {complaints.length === 0 ? (
        <EmptyState title="No complaints match these filters" hint="Try clearing a filter above." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Complaint</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Engineer</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {complaints.map((c) => (
                <tr key={c.id} className="hover:bg-brand-50/40">
                  <td className="px-4 py-3">
                    <Link href={`/app/complaints/${c.ref}`} className="font-mono text-xs font-bold text-brand-700 hover:underline">
                      {c.ref}
                    </Link>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/app/complaints/${c.ref}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                      {c.title}
                    </Link>
                    <span className="text-xs text-slate-500">{c.category} · {c.subcategory} · {c.zone}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.department.name}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{c.engineer?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{ageOf(c.createdAt)}</td>
                  <td className="px-4 py-3"><SlaBadge state={slaStatus(c.createdAt, c.slaHours, c.closedAt)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
