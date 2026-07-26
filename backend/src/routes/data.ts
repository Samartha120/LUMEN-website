import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { aiHealth } from "../lib/ai.js";

const router = Router();
const OPEN = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];

router.get("/health", async (_req, res) => {
  res.json({ ai: await aiHealth() });
});

router.get("/dashboard", requireAuth, async (_req, res) => {
  const complaints = await db.complaint.findMany({ include: { engineer: true, department: true }, orderBy: { createdAt: "desc" } });
  res.json({ complaints, ai: await aiHealth() });
});

router.get("/gis", requireAuth, async (_req, res) => {
  const [complaints, engineers] = await Promise.all([
    db.complaint.findMany({ where: { status: { in: OPEN } } }),
    db.engineer.findMany({ where: { status: { not: "OFF_DUTY" } } }),
  ]);
  res.json({ complaints, engineers });
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

export default router;
