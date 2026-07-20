"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { TRANSITIONS, STATUS_LABELS } from "@/lib/rbac";

async function audit(actor: string, actorRole: string, action: string, target: string, details: string) {
  await db.auditLog.create({
    data: { actor, actorRole, action, module: "Complaints", target, details, ip: "127.0.0.1" },
  });
}

export async function transitionComplaint(formData: FormData) {
  const session = await requireSession();
  const ref = String(formData.get("ref"));
  const to = String(formData.get("to"));
  const note = String(formData.get("note") ?? "").trim();

  const complaint = await db.complaint.findUnique({ where: { ref } });
  if (!complaint) return;

  // Enforce the Part 8 state machine + role permissions server-side.
  const allowed = (TRANSITIONS[complaint.status] ?? []).find(
    (t) => t.to === to && t.roles.includes(session.role)
  );
  if (!allowed) return;

  const isEscalation = to === "ESCALATED";
  const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  // BR-8.6: escalation bumps priority one level
  const newPriority = isEscalation
    ? priorities[Math.min(priorities.indexOf(complaint.priority) + 1, 3)]
    : complaint.priority;

  await db.complaint.update({
    where: { ref },
    data: {
      status: to,
      priority: newPriority,
      closedAt: to === "CLOSED" ? new Date() : to === "REOPENED" ? null : complaint.closedAt,
      engineerId: to === "ESCALATED" ? complaint.engineerId : complaint.engineerId,
    },
  });

  await db.timelineEvent.create({
    data: {
      complaintId: complaint.id,
      type: isEscalation ? "ESCALATION" : "STATUS_CHANGE",
      message: `${STATUS_LABELS[complaint.status]} → ${STATUS_LABELS[to]}${note ? ` — ${note}` : ""}${isEscalation && newPriority !== complaint.priority ? ` (priority raised to ${newPriority})` : ""}`,
      actor: session.name,
    },
  });

  await audit(session.name, session.role, `COMPLAINT_${to}`, ref, `Status changed ${complaint.status} → ${to}${note ? `: ${note}` : ""}`);
  revalidatePath(`/app/complaints/${ref}`);
  revalidatePath("/app/complaints");
}

export async function assignEngineer(formData: FormData) {
  const session = await requireSession();
  if (!["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"].includes(session.role)) return;

  const ref = String(formData.get("ref"));
  const engineerId = String(formData.get("engineerId"));
  const complaint = await db.complaint.findUnique({ where: { ref } });
  const engineer = await db.engineer.findUnique({ where: { id: engineerId } });
  if (!complaint || !engineer) return;

  const fromReview = ["UNDER_REVIEW", "ESCALATED", "REOPENED"].includes(complaint.status);
  await db.complaint.update({
    where: { ref },
    data: { engineerId, status: fromReview ? "ASSIGNED" : complaint.status },
  });

  await db.timelineEvent.create({
    data: {
      complaintId: complaint.id,
      type: "ASSIGNMENT",
      message: `Assigned to ${engineer.name} (${engineer.code}) by ${session.name}`,
      actor: session.name,
    },
  });

  await audit(session.name, session.role, "COMPLAINT_ASSIGNED", ref, `Assigned to ${engineer.name}`);
  revalidatePath(`/app/complaints/${ref}`);
  revalidatePath("/app/complaints");
}

export async function createComplaint(formData: FormData) {
  const session = await requireSession();
  if (!["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"].includes(session.role)) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const departmentId = String(formData.get("departmentId"));
  const category = String(formData.get("category") ?? "General");
  const subcategory = String(formData.get("subcategory") ?? "Other").trim() || "Other";
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const zone = String(formData.get("zone") ?? "Central Zone");
  const address = String(formData.get("address") ?? "").trim();
  if (!title || !departmentId) return;

  const dept = await db.department.findUnique({ where: { id: departmentId } });
  if (!dept) return;

  const last = await db.complaint.findFirst({ orderBy: { ref: "desc" } });
  const seq = last ? parseInt(last.ref.split("-")[1]) + 1 : 10245;
  const ref = `CMP-${seq}`;

  const complaint = await db.complaint.create({
    data: {
      ref,
      title,
      description: description || title,
      category,
      subcategory,
      priority,
      status: "UNDER_REVIEW",
      zone,
      address: address || zone,
      lat: 12.9 + Math.random() * 0.2,
      lng: 77.5 + Math.random() * 0.2,
      slaHours: dept.slaTarget,
      source: "MANUAL",
      departmentId,
    },
  });

  await db.timelineEvent.create({
    data: {
      complaintId: complaint.id,
      type: "CREATED",
      message: `Complaint created manually (walk-in/phone-in intake) by ${session.name}`,
      actor: session.name,
    },
  });

  await audit(session.name, session.role, "COMPLAINT_CREATED", ref, `Manual intake: ${title}`);
  revalidatePath("/app/complaints");
  redirect(`/app/complaints/${ref}`);
}
