import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";

/**
 * Every operational surface in this router is for staff.
 *
 * These endpoints previously carried `requireAuth` alone, which was correct
 * while every account was staff. Adding the CITIZEN role silently opened them:
 * a resident could read city-wide statistics from /api/dashboard and the
 * location of every complaint in the city from /api/gis. Naming the roles is
 * the fix — a new role now starts with no access and has to be granted it.
 */
const requireStaff = requireRole("ADMINISTRATOR", "SUPERVISOR", "ENGINEER");
import { aiHealth } from "../lib/ai.js";
import { buildClusters, RADIUS_M, type Clusterable } from "../lib/clusters.js";
import { estimateMaterials, type RoadType } from "../lib/materials.js";
import { computeAssignmentPlan } from "../lib/assignment.js";
import { LANDMARKS } from "../lib/landmarks.js";

const router = Router();
const OPEN = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];

// The map serves the same LANDMARKS that priority.ts scores against, imported
// rather than copied, so a place shown on the map always counts and a place
// that counts is always shown.

router.get("/health", async (_req, res) => {
  res.json({ ai: await aiHealth() });
});

router.get("/dashboard", requireAuth, requireStaff, async (_req, res) => {
  const complaints = await db.complaint.findMany({ include: { engineer: true, department: true }, orderBy: { createdAt: "desc" } });
  res.json({ complaints, ai: await aiHealth() });
});

/**
 * Map data. Only the fields a marker and its popup need — the previous version
 * returned whole complaint rows including detection JSON and base64 image
 * paths, roughly 200 KB for a view that draws dots.
 */
router.get("/gis", requireAuth, requireStaff, async (_req, res) => {
  const [complaints, engineers] = await Promise.all([
    db.complaint.findMany({
      where: { status: { in: OPEN }, duplicateOfId: null },
      select: {
        id: true, ref: true, title: true, lat: true, lng: true, zone: true,
        category: true, civicCategory: true, status: true, priority: true,
        severityScore: true, severityBand: true, createdAt: true, slaHours: true,
        engineer: { select: { code: true, name: true } },
      },
    }),
    db.engineer.findMany({
      where: { status: { not: "OFF_DUTY" } },
      select: {
        id: true, code: true, name: true, zone: true, status: true,
        lat: true, lng: true, skills: true,
        department: { select: { name: true } },
        complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } },
      },
    }),
  ]);
  res.json({
    complaints,
    engineers: engineers.map((e) => ({ ...e, openJobs: e.complaints.length, complaints: undefined })),
    // The landmarks the priority rule scores against, so the map can show why
    // a complaint near one is ranked higher.
    landmarks: LANDMARKS,
  });
});

router.get("/engineers", requireAuth, requireRole("ADMINISTRATOR", "SUPERVISOR"), async (_req, res) => {
  const engineers = await db.engineer.findMany({
    include: { department: true, complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ engineers });
});

router.get("/audit-logs", requireAuth, requireRole("ADMINISTRATOR", "SUPERVISOR"), async (_req, res) => {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  res.json({ logs });
});

/**
 * GET /api/estimate?roadType=CONCRETE&wastage=5   (Feature 6)
 *
 * City-wide bill of quantities: every open road complaint that has been
 * measured on site, summed into one material order. This is the number a
 * supervisor takes to procurement — one delivery for a batch of repairs
 * rather than one per pothole.
 *
 * Complaints are grouped by their own recorded road type, because a
 * bituminous road and a concrete road need entirely different materials and
 * summing them into a single figure would be meaningless.
 */
router.get("/estimate", requireAuth, requireStaff, async (req, res) => {
  const wastageRaw = Number(req.query.wastage ?? 5);
  const wastage = Number.isFinite(wastageRaw) ? Math.min(50, Math.max(0, wastageRaw)) : 5;

  const measured = await db.complaint.findMany({
    where: {
      duplicateOfId: null,
      status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"] },
      potholes: { some: {} },
    },
    select: {
      ref: true, title: true, roadType: true, zone: true, priority: true,
      potholes: { select: { volumeM3: true, perimeterM: true, source: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const groups: Record<RoadType, { refs: typeof measured; volume: number; count: number }> = {
    BITUMINOUS: { refs: [], volume: 0, count: 0 },
    CONCRETE: { refs: [], volume: 0, count: 0 },
  };
  for (const c of measured) {
    // Unset road type falls to bituminous — the commoner surface, and the
    // estimate is flagged provisional either way.
    const key: RoadType = c.roadType === "CONCRETE" ? "CONCRETE" : "BITUMINOUS";
    groups[key].refs.push(c);
    groups[key].volume += c.potholes.reduce((t, p) => t + p.volumeM3, 0);
    groups[key].count += c.potholes.length;
  }

  res.json({
    wastagePct: wastage,
    complaintsMeasured: measured.length,
    groups: (Object.keys(groups) as RoadType[])
      .filter((k) => groups[k].count > 0)
      .map((k) => ({
        roadType: k,
        complaints: groups[k].refs.map((c) => ({
          ref: c.ref, title: c.title, zone: c.zone, priority: c.priority,
          potholeCount: c.potholes.length,
          volumeM3: Number(c.potholes.reduce((t, p) => t + p.volumeM3, 0).toFixed(3)),
          estimated: c.potholes.every((p) => p.source === "ESTIMATED"),
        })),
        estimate: estimateMaterials(groups[k].volume, groups[k].count, k, wastage),
      })),
  });
});

/**
 * GET /api/plan?budget=500000&crews=3&horizon=7   (Municipal planning layer)
 *
 * Two questions a supervisor actually has to answer each week: which repairs
 * fit the budget, and in what order should the crews drive.
 *
 *   Which  — 0/1 knapsack by dynamic programming, maximising public risk
 *            removed. Reported against greedy baselines, because the whole
 *            claim of the feature is that greedy is not optimal.
 *   Order  — Clarke-Wright savings then 2-opt, per crew.
 *
 * Cost comes from the site-measured bill of quantities where one exists
 * (Feature 6), and falls back to the indicative rate card elsewhere. Mixing
 * the two is deliberate: a plan that ignored real measurements because some
 * complaints lack them would be worse, not purer.
 */
router.get("/plan", requireAuth, requireStaff, async (req, res) => {
  const budget = Math.max(0, Number(req.query.budget ?? 500_000));
  const crews = Math.min(10, Math.max(1, Number(req.query.crews ?? 3)));
  const horizonDays = Math.min(30, Math.max(1, Number(req.query.horizon ?? 7)));

  const complaints = await db.complaint.findMany({
    where: { duplicateOfId: null, status: { in: OPEN } },
    select: {
      id: true, ref: true, title: true, category: true, civicCategory: true,
      lat: true, lng: true, severityScore: true, priorityScore: true,
      priority: true, slaHours: true, roadType: true,
      potholes: { select: { volumeM3: true, source: true } },
    },
  });

  const { buildItems, plan } = await import("../lib/planner.js");
  const items = buildItems(complaints);

  // Replace the assumed cost with the real one wherever the site has been
  // measured. Same order as `complaints`, so index alignment holds.
  for (const [i, c] of complaints.entries()) {
    if (c.potholes.length === 0) continue;
    const volume = c.potholes.reduce((t, p) => t + p.volumeM3, 0);
    const rt: RoadType = c.roadType === "CONCRETE" ? "CONCRETE" : "BITUMINOUS";
    items[i].cost = Math.round(estimateMaterials(volume, c.potholes.length, rt, 5).cost.totalInr);
    // A cost derived from photo-estimated geometry is still an estimate, so
    // only geometry someone actually measured earns the "measured" label.
    items[i].costMeasured = c.potholes.some((p) => p.source === "MEASURED");
  }

  // Bengaluru city centre stands in for the works depot the crews start from.
  const depot = { lat: 12.9716, lng: 77.5946 };
  const result = plan(items, { budget, crews, horizonDays, depot });

  res.json({
    ...result,
    measuredCount: items.filter((i) => i.costMeasured).length,
  });
});

/** Complaints waiting for an engineer, and everyone who could take them. */
async function assignmentInputs() {
  const [complaints, engineers] = await Promise.all([
    db.complaint.findMany({
      where: { engineerId: null, duplicateOfId: null, status: "SUBMITTED" },
      select: {
        id: true, ref: true, title: true, category: true, priority: true,
        lat: true, lng: true, severityScore: true, departmentId: true,
      },
      orderBy: { severityScore: "desc" },
    }),
    db.engineer.findMany({
      select: {
        id: true, code: true, name: true, zone: true, skills: true, status: true,
        lat: true, lng: true, departmentId: true,
        complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } },
      },
    }),
  ]);
  return { complaints, engineers };
}

// GET /api/assignment — propose an allocation without committing to it.
router.get("/assignment", requireAuth, requireRole("ADMINISTRATOR", "SUPERVISOR"), async (_req, res) => {
  const { complaints, engineers } = await assignmentInputs();
  res.json(computeAssignmentPlan(complaints, engineers));
});

// POST /api/assignment/apply — commit the proposal.
//
// The plan is recomputed here rather than trusted from the client: the queue
// may have moved since it was previewed, and an assignment is a real dispatch.
router.post("/assignment/apply", requireAuth, requireRole("ADMINISTRATOR", "SUPERVISOR"), async (req, res) => {
  const s = req.session!;
  const { complaints, engineers } = await assignmentInputs();
  const plan = computeAssignmentPlan(complaints, engineers);

  for (const a of plan.assignments) {
    await db.complaint.update({
      where: { id: a.complaint.id },
      data: {
        engineerId: a.engineer.id, status: "ASSIGNED",
        assignMethod: "HUNGARIAN", assignDistance: a.distanceKm,
      },
    });
    await db.timelineEvent.create({
      data: {
        complaintId: a.complaint.id, type: "ASSIGNMENT", actor: "Assignment Optimiser",
        message: `Assigned to ${a.engineer.name} (${a.engineer.code}) — ${a.distanceKm} km away, ` +
          `${a.skillMatch ? "skill match" : "no skill match"}, ${a.engineer.openJobs} open jobs`,
      },
    });
  }
  await db.auditLog.create({
    data: {
      actor: s.name, actorRole: s.role, action: "ASSIGNMENT_APPLIED", module: "Complaints",
      target: `${plan.assignments.length} complaints`,
      details: `Hungarian allocation, ${plan.totalDistanceKm} km total, ${plan.costImprovementPct}% cheaper than greedy`,
    },
  });

  res.json({ applied: plan.assignments.length, plan });
});

/**
 * GET /api/clusters
 *
 * Open complaints grouped into single work orders — see lib/clusters.ts for
 * why grouping is single-linkage and never crosses departments.
 *
 * Only open work is grouped. A closed complaint on the same street is history,
 * not something to dispatch a crew for.
 */
router.get("/clusters", requireAuth, requireStaff, async (_req, res) => {
  const open = await db.complaint.findMany({
    where: { status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"] } },
    select: {
      id: true, ref: true, title: true, lat: true, lng: true, category: true,
      civicCategory: true, status: true, severityScore: true, priorityScore: true,
      slaHours: true, createdAt: true, zone: true, address: true,
    },
  });

  const clusters = buildClusters(open as Clusterable[]);
  const grouped = clusters.reduce((n, c) => n + c.members.length, 0);

  res.json({
    radiusM: RADIUS_M,
    clusters,
    summary: {
      openComplaints: open.length,
      clusters: clusters.length,
      complaintsInClusters: grouped,
      // The headline: dispatches avoided by sending one crew per cluster
      // instead of one per complaint.
      visitsSaved: clusters.reduce((n, c) => n + c.visitsSaved, 0),
    },
  });
});

/**
 * GET /api/notifications
 *
 * What has happened to this person's complaints that they have not yet seen.
 * Available to every signed-in role: a resident is told their report was
 * assigned, a supervisor that a resident disputed a closure.
 */
router.get("/notifications", requireAuth, async (req, res) => {
  const items = await db.notification.findMany({
    where: { userId: req.session!.sub },
    include: { complaint: { select: { ref: true, title: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  res.json({
    notifications: items,
    unread: items.filter((n) => !n.readAt).length,
  });
});

/** Mark one notification read, or all of them when no id is given. */
router.post("/notifications/read", requireAuth, async (req, res) => {
  const id = req.body?.id ? String(req.body.id) : null;
  await db.notification.updateMany({
    // Scoped by userId as well as id — without it, posting someone else's
    // notification id would mark their unread items as read.
    where: { userId: req.session!.sub, ...(id ? { id } : { readAt: null }) },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
