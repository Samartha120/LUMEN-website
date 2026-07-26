import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { optimiseAssignments, type AssignComplaint, type AssignEngineer } from "../lib/assignment.js";

const router = Router();

async function loadInputs() {
  const [complaints, engineers] = await Promise.all([
    db.complaint.findMany({
      where: { status: "SUBMITTED", duplicateOfId: null },
      orderBy: { severityScore: "desc" },
      select: { id: true, ref: true, title: true, lat: true, lng: true, category: true, severityScore: true, departmentId: true, priority: true },
    }),
    db.engineer.findMany({ include: { complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } } } }),
  ]);
  const cs: AssignComplaint[] = complaints.map((c) => ({
    id: c.id, ref: c.ref, lat: c.lat, lng: c.lng, category: c.category, severityScore: c.severityScore ?? 0, departmentId: c.departmentId,
  }));
  const es: AssignEngineer[] = engineers.map((e) => ({
    id: e.id, code: e.code, name: e.name, lat: e.lat, lng: e.lng, skills: e.skills, status: e.status, departmentId: e.departmentId, openJobs: e.complaints.length,
  }));
  return {
    result: optimiseAssignments(cs, es),
    titles: Object.fromEntries(complaints.map((c) => [c.id, { title: c.title, priority: c.priority }])),
    engineerCount: engineers.length,
  };
}

router.get("/", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR"), async (_req, res) => {
  res.json(await loadInputs());
});

router.post("/apply", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR"), async (req, res) => {
  const s = req.session!;
  const { result } = await loadInputs();
  if (result.assignments.length === 0) return res.json({ applied: 0 });

  for (const a of result.assignments) {
    await db.complaint.update({ where: { id: a.complaint.id }, data: { engineerId: a.engineer.id, status: "ASSIGNED", assignMethod: "OPTIMISED", assignDistance: a.distanceKm } });
    await db.timelineEvent.create({ data: { complaintId: a.complaint.id, type: "ASSIGNMENT",
      message: `Optimiser assigned ${a.engineer.name} (${a.engineer.code}) — ${a.distanceKm} km, ${a.skillMatch ? "skill match" : "no skill match"}, cost ${a.cost}`, actor: s.name } });
  }
  await db.auditLog.create({ data: {
    actor: s.name, actorRole: s.role, action: "BATCH_ASSIGNMENT_APPLIED", module: "Assignment",
    target: `${result.assignments.length} complaints`,
    details: `Hungarian optimiser: cost ${result.totalCost} vs greedy ${result.naiveTotalCost} (${result.costImprovementPct}% lower); ${result.totalDistanceKm} km travel`,
  } });
  res.json({ applied: result.assignments.length });
});

export default router;
