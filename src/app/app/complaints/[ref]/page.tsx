import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, User, Star, GitBranch, MessageSquare, UserPlus, Flag, PlusCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { TRANSITIONS, STATUS_LABELS } from "@/lib/rbac";
import { fmtDateTime, slaStatus, ageOf } from "@/lib/format";
import { Card } from "@/components/ui";
import { StatusBadge, PriorityBadge, SlaBadge } from "@/components/badges";
import { transitionComplaint, assignEngineer } from "../actions";

export const dynamic = "force-dynamic";

const EVENT_ICONS: Record<string, typeof GitBranch> = {
  CREATED: PlusCircle,
  STATUS_CHANGE: GitBranch,
  ASSIGNMENT: UserPlus,
  ESCALATION: Flag,
  COMMENT: MessageSquare,
};

export default async function ComplaintDetailPage({ params }: { params: Promise<{ ref: string }> }) {
  const session = await requireSession();
  const { ref } = await params;

  const complaint = await db.complaint.findUnique({
    where: { ref: decodeURIComponent(ref) },
    include: {
      department: { include: { engineers: true } },
      engineer: true,
      citizen: true,
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!complaint) notFound();

  const transitions = (TRANSITIONS[complaint.status] ?? []).filter((t) => t.roles.includes(session.role));
  const canAssign =
    ["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"].includes(session.role) &&
    ["UNDER_REVIEW", "ASSIGNED", "ESCALATED", "REOPENED"].includes(complaint.status);
  const sla = slaStatus(complaint.createdAt, complaint.slaHours, complaint.closedAt);

  return (
    <>
      <Link href="/app/complaints" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft size={15} /> Back to Complaint Queue
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-brand-700">{complaint.ref}</span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            <SlaBadge state={sla} />
          </div>
          <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-slate-900">{complaint.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {complaint.category} · {complaint.subcategory} · Reported {fmtDateTime(complaint.createdAt)} · Age {ageOf(complaint.createdAt)} · Source: {complaint.source === "CITIZEN_APP" ? "Citizen Mobile App" : "Manual intake"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <p className="text-sm leading-relaxed text-slate-700">{complaint.description}</p>
            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin size={16} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-800">{complaint.address}</div>
                  <div className="text-xs text-slate-500">{complaint.zone} · {complaint.lat.toFixed(4)}, {complaint.lng.toFixed(4)}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-sm">
                <User size={16} className="mt-0.5 text-slate-400" />
                <div>
                  <div className="font-medium text-slate-800">{complaint.citizen?.name ?? "Internal report"}</div>
                  <div className="text-xs text-slate-500">{complaint.citizen ? `${complaint.citizen.code} · ${complaint.citizen.phone}` : "No citizen linked"}</div>
                </div>
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-400">Department</div>
                <div className="font-medium text-slate-800">{complaint.department.name}</div>
                <div className="text-xs text-slate-500">Resolution SLA: {complaint.slaHours}h</div>
              </div>
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-slate-400">Assigned Engineer</div>
                <div className="font-medium text-slate-800">{complaint.engineer?.name ?? "Unassigned"}</div>
                {complaint.engineer && (
                  <div className="text-xs text-slate-500">{complaint.engineer.code} · {complaint.engineer.zone} · ★ {complaint.engineer.rating}</div>
                )}
              </div>
            </div>
            {complaint.rating != null && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                <Star size={15} className="fill-emerald-500 text-emerald-500" />
                Citizen feedback: {complaint.rating}/5 after closure
              </div>
            )}
          </Card>

          {(transitions.length > 0 || canAssign) && (
            <Card title="Actions (state machine enforced)">
              <div className="space-y-4">
                {transitions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((t) => (
                      <form key={t.to} action={transitionComplaint} className="inline">
                        <input type="hidden" name="ref" value={complaint.ref} />
                        <input type="hidden" name="to" value={t.to} />
                        <button
                          type="submit"
                          className={`rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm ${
                            t.to === "CLOSED"
                              ? "bg-emerald-600 text-white hover:bg-emerald-700"
                              : t.to === "ESCALATED" || t.to === "REJECTED"
                              ? "bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                              : "bg-brand-700 text-white hover:bg-brand-800"
                          }`}
                        >
                          {t.label}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
                {canAssign && complaint.department.engineers.length > 0 && (
                  <form action={assignEngineer} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <input type="hidden" name="ref" value={complaint.ref} />
                    <select
                      name="engineerId"
                      defaultValue={complaint.engineerId ?? complaint.department.engineers[0]?.id}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                    >
                      {complaint.department.engineers.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} · {e.zone} · {e.status === "AVAILABLE" ? "Available" : e.status === "ON_TASK" ? "On Task" : "Off Duty"} · ★ {e.rating}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-900">
                      {complaint.engineerId ? "Re-assign Engineer" : "Assign Engineer"}
                    </button>
                    <span className="text-xs text-slate-400">Ranked by availability and rating</span>
                  </form>
                )}
              </div>
            </Card>
          )}
          {transitions.length === 0 && !canAssign && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              No actions available for your role ({session.role === "AUDITOR" || session.role === "ANALYST" ? "read-only oversight role" : `current status: ${STATUS_LABELS[complaint.status]}`}).
            </div>
          )}
        </div>

        <Card title={`Timeline (${complaint.events.length} events)`}>
          <ol className="space-y-0">
            {complaint.events.map((ev, i) => {
              const Icon = EVENT_ICONS[ev.type] ?? GitBranch;
              return (
                <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < complaint.events.length - 1 && (
                    <span className="absolute left-[13px] top-8 h-full w-px bg-slate-200" />
                  )}
                  <span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ev.type === "ESCALATION" ? "bg-red-100 text-red-600" : "bg-brand-50 text-brand-700"}`}>
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm leading-snug text-slate-700">{ev.message}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{ev.actor} · {fmtDateTime(ev.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </>
  );
}
