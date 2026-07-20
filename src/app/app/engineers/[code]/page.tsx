import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, Phone, Mail, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ageOf } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import { StatusBadge, PriorityBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function EngineerDetailPage({ params }: { params: Promise<{ code: string }> }) {
  await requireSession();
  const { code } = await params;
  const engineer = await db.engineer.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      department: true,
      complaints: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!engineer) notFound();

  const active = engineer.complaints.filter((c) => ["ASSIGNED", "IN_PROGRESS"].includes(c.status));

  return (
    <>
      <Link href="/app/engineers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Engineer Directory
      </Link>
      <PageHeader
        title={engineer.name}
        subtitle={`${engineer.code} · ${engineer.department.name} · ${engineer.zone}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile">
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2.5 text-slate-700"><Mail size={15} className="text-slate-400" /> {engineer.email}</p>
            <p className="flex items-center gap-2.5 text-slate-700"><Phone size={15} className="text-slate-400" /> {engineer.phone}</p>
            <p className="flex items-center gap-2.5 text-slate-700"><MapPin size={15} className="text-slate-400" /> Last known: {engineer.lat.toFixed(4)}, {engineer.lng.toFixed(4)}</p>
            <div className="flex items-center gap-2.5 text-slate-700">
              <Star size={15} className="fill-amber-400 text-amber-400" /> {engineer.rating} average citizen rating
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-slate-400">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {engineer.skills.split(",").map((s) => (
                  <span key={s} className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{s}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-center">
              <div>
                <div className="text-xl font-bold text-slate-900">{active.length}</div>
                <div className="text-[11px] text-slate-500">Active Assignments</div>
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900">{engineer.resolvedJobs}</div>
                <div className="text-[11px] text-slate-500">Career Resolved</div>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Assignment History" className="lg:col-span-2">
          <div className="divide-y divide-slate-100">
            {engineer.complaints.length === 0 && <p className="py-4 text-sm text-slate-400">No assignments yet.</p>}
            {engineer.complaints.map((c) => (
              <Link key={c.id} href={`/app/complaints/${c.ref}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <span className="font-mono text-xs font-bold text-brand-700">{c.ref}</span>
                  <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                  <p className="text-xs text-slate-500">{c.zone} · {ageOf(c.createdAt)} old</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge status={c.status} />
                  <PriorityBadge priority={c.priority} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
