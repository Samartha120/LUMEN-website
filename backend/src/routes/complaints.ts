import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { TRANSITIONS, STATUS_LABELS } from "../lib/rbac.js";
import { detect, embed, verifyRepair, AiUnavailableError } from "../lib/ai.js";
import { haversineMeters, cosineSimilarity } from "../lib/geo.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const DUP_COSINE_MIN = 0.85;
const DUP_RADIUS_M = 150;
const DUP_WINDOW_HOURS = 72;

async function savePng(b64: string, prefix: string): Promise<string | null> {
  if (!b64) return null;
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${prefix}-${randomUUID()}.png`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(b64, "base64"));
  return `/uploads/${name}`;
}
async function saveBuf(buf: Buffer, prefix: string, ext: string): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const clean = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const name = `${prefix}-${randomUUID()}.${clean}`;
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}
async function audit(actor: string, role: string, action: string, target: string, details: string) {
  await db.auditLog.create({ data: { actor, actorRole: role, action, module: "Complaints", target, details } });
}

// GET /api/complaints  (list, role-scoped, filterable)
router.get("/", requireAuth, async (req, res) => {
  const s = req.session!;
  const { status, q } = req.query as { status?: string; q?: string };
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) where.OR = [{ title: { contains: String(q) } }, { ref: { contains: String(q).toUpperCase() } }];
  if (s.role === "ENGINEER") {
    const eng = await db.engineer.findFirst({ where: { name: s.name } });
    where.engineerId = eng?.id ?? "__none__";
  }
  const complaints = await db.complaint.findMany({
    where, include: { department: true, engineer: true, duplicateOf: { select: { ref: true } } },
    orderBy: [{ severityScore: "desc" }, { createdAt: "desc" }], take: 100,
  });
  res.json({ complaints });
});

// GET /api/complaints/:ref
router.get("/:ref", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({
    where: { ref: req.params.ref },
    include: {
      department: true, engineer: true,
      images: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
      duplicateOf: { select: { ref: true, title: true } },
      duplicates: { select: { ref: true, title: true } },
    },
  });
  if (!c) return res.status(404).json({ error: "Complaint not found." });
  res.json({ complaint: c });
});

// POST /api/complaints  (Features 1,2,3)
router.post("/", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR"), upload.single("photo"), async (req, res) => {
  const s = req.session!;
  const b = req.body ?? {};
  const title = String(b.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "A title is required." });
  if (!req.file) return res.status(400).json({ error: "A photograph is required — class and severity come from it." });
  if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "The file must be an image." });

  const lat = parseFloat(String(b.lat ?? "12.97"));
  const lng = parseFloat(String(b.lng ?? "77.59"));
  const buf = req.file.buffer;

  let result, embedding: number[];
  try {
    result = await detect(buf, req.file.originalname, req.file.mimetype);
    embedding = await embed(buf, req.file.originalname, req.file.mimetype);
  } catch (e) {
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: e.message });
    return res.status(500).json({ error: e instanceof Error ? e.message : "Image analysis failed." });
  }

  const top = [...result.detections].sort((a, b) => b.confidence - a.confidence)[0];
  const category = top?.label ?? "Unclassified";
  const sev = result.severity;
  const dept =
    (await db.department.findFirst({ where: { code: category === "Pothole" || category === "Longitudinal Crack" ? "RDS" : "PWD" } })) ??
    (await db.department.findFirst());
  if (!dept) return res.status(500).json({ error: "No department configured." });

  const since = new Date(Date.now() - DUP_WINDOW_HOURS * 3600_000);
  const cands = await db.complaint.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["CLOSED", "REJECTED"] }, duplicateOfId: null },
    select: { id: true, ref: true, lat: true, lng: true, embedding: true },
  });
  let dup: { id: string; ref: string; sim: number; dist: number } | null = null;
  for (const cand of cands) {
    if (!cand.embedding) continue;
    const dist = haversineMeters(lat, lng, cand.lat, cand.lng);
    if (dist > DUP_RADIUS_M) continue;
    const sim = cosineSimilarity(embedding, JSON.parse(cand.embedding));
    if (sim >= DUP_COSINE_MIN && (!dup || sim > dup.sim)) dup = { id: cand.id, ref: cand.ref, sim, dist };
  }

  const last = await db.complaint.findFirst({ orderBy: { ref: "desc" }, select: { ref: true } });
  const ref = `CMP-${last ? parseInt(last.ref.split("-")[1]) + 1 : 10245}`;
  const imgPath = await saveBuf(buf, "citizen", req.file.originalname.split(".").pop() ?? "jpg");
  const annPath = await savePng(result.annotated_png_b64, "annotated");

  const complaint = await db.complaint.create({
    data: {
      ref, title, description: String(b.description ?? "").trim() || title,
      zone: String(b.zone ?? "Central Zone"), address: String(b.address ?? "").trim() || String(b.zone ?? "Central Zone"),
      lat, lng, category, aiPredicted: Boolean(top), aiConfidence: top?.confidence ?? null,
      aiModelMode: result.model_mode, detections: JSON.stringify(result.detections),
      severityScore: sev.score, severityBand: sev.band, priority: sev.priority, slaHours: dept.slaTarget,
      embedding: embedding.length ? JSON.stringify(embedding) : null,
      duplicateOfId: dup?.id ?? null, dupSimilarity: dup?.sim ?? null, dupDistanceM: dup ? Math.round(dup.dist) : null,
      status: "SUBMITTED", departmentId: dept.id,
      images: { create: { kind: "CITIZEN", path: imgPath, annotated: annPath, detections: JSON.stringify(result.detections), severity: sev.score } },
    },
  });

  await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "CREATED", message: `Complaint created with photograph by ${s.name}`, actor: s.name } });
  await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "AI_DETECTION",
    message: top
      ? `Detector identified ${category} (confidence ${top.confidence.toFixed(2)}) across ${sev.instances} region(s) — severity ${sev.score}/100 → ${sev.priority} [${result.model_mode} model]`
      : `No damage detected [${result.model_mode} model] — manual triage required`,
    actor: "AI Service" } });
  if (dup) {
    await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "AI_DUPLICATE",
      message: `Flagged as a probable duplicate of ${dup.ref} — visual similarity ${(dup.sim * 100).toFixed(1)}%, ${Math.round(dup.dist)} m apart`, actor: "AI Service" } });
  }
  await audit(s.name, s.role, "COMPLAINT_CREATED", ref, `${category}, severity ${sev.score}${dup ? `, duplicate of ${dup.ref}` : ""}`);
  res.json({ ref });
});

// POST /api/complaints/:ref/transition
router.post("/:ref/transition", requireAuth, async (req, res) => {
  const s = req.session!;
  const to = String(req.body?.to ?? "");
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref } });
  if (!c) return res.status(404).json({ error: "Not found." });
  const allowed = (TRANSITIONS[c.status] ?? []).find((t) => t.to === to && t.roles.includes(s.role));
  if (!allowed) return res.status(403).json({ error: "Transition not allowed for your role." });
  if (to === "CLOSED" && c.verifyVerdict === "REJECTED") return res.status(400).json({ error: "Closure blocked: repair not verified." });

  await db.complaint.update({ where: { ref: c.ref }, data: { status: to, closedAt: to === "CLOSED" ? new Date() : c.closedAt } });
  await db.timelineEvent.create({ data: { complaintId: c.id, type: "STATUS_CHANGE", message: `${STATUS_LABELS[c.status]} → ${STATUS_LABELS[to]}`, actor: s.name } });
  await audit(s.name, s.role, `COMPLAINT_${to}`, c.ref, `Status ${c.status} → ${to}`);
  res.json({ ok: true });
});

// POST /api/complaints/:ref/verify  (Feature 4)
router.post("/:ref/verify", requireAuth, requireRole("ENGINEER", "SUPERVISOR", "ADMINISTRATOR"), upload.single("photo"), async (req, res) => {
  const s = req.session!;
  if (!req.file) return res.status(400).json({ error: "An after-photograph is required." });
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref }, include: { images: true } });
  if (!c) return res.status(404).json({ error: "Not found." });
  const before = c.images.find((i) => i.kind === "CITIZEN");
  if (!before) return res.status(400).json({ error: "No original photograph on record." });

  let beforeBuf: Buffer;
  try {
    beforeBuf = await readFile(path.join(UPLOAD_DIR, before.path.replace("/uploads/", "")));
  } catch {
    return res.status(500).json({ error: "Original photograph could not be read." });
  }

  let v;
  try {
    v = await verifyRepair(beforeBuf, req.file.buffer);
  } catch (e) {
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: e.message });
    return res.status(500).json({ error: e instanceof Error ? e.message : "Verification failed." });
  }

  const afterPath = await saveBuf(req.file.buffer, "after", req.file.originalname.split(".").pop() ?? "jpg");
  const annAfter = await savePng(v.annotated_after_b64, "after-annotated");
  await db.complaintImage.create({ data: { complaintId: c.id, kind: "ENGINEER_AFTER", path: afterPath, annotated: annAfter, severity: v.severity_after } });
  await db.complaint.update({ where: { ref: c.ref }, data: {
    verifyVerdict: v.verdict, verifyReason: v.reason, verifyReduction: v.reduction_pct, verifySsim: v.ssim,
    status: v.verdict === "REJECTED" ? "IN_PROGRESS" : "PENDING_REVIEW",
  } });
  await db.timelineEvent.create({ data: { complaintId: c.id, type: "AI_VERIFICATION",
    message: `Repair verification: ${v.verdict} — ${v.reason} (severity ${v.severity_before} → ${v.severity_after}, SSIM ${v.ssim})`, actor: "AI Service" } });
  await audit(s.name, s.role, "REPAIR_VERIFICATION", c.ref, `${v.verdict}: ${v.reason}`);
  res.json({ verdict: v.verdict });
});

// POST /api/complaints/:ref/duplicate
router.post("/:ref/duplicate", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR"), async (req, res) => {
  const s = req.session!;
  const action = String(req.body?.action ?? "");
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref }, include: { duplicateOf: { select: { ref: true } } } });
  if (!c) return res.status(404).json({ error: "Not found." });
  if (action === "reject") {
    await db.complaint.update({ where: { ref: c.ref }, data: { duplicateOfId: null, dupSimilarity: null, dupDistanceM: null } });
    await db.timelineEvent.create({ data: { complaintId: c.id, type: "AI_DUPLICATE", message: `Duplicate link to ${c.duplicateOf?.ref ?? "primary"} rejected by ${s.name} — treated as a distinct issue`, actor: s.name } });
  } else {
    await db.complaint.update({ where: { ref: c.ref }, data: { status: "REJECTED" } });
    await db.timelineEvent.create({ data: { complaintId: c.id, type: "AI_DUPLICATE", message: `Confirmed duplicate of ${c.duplicateOf?.ref ?? "primary"} — consolidated by ${s.name}`, actor: s.name } });
  }
  await audit(s.name, s.role, "DUPLICATE_RESOLVED", c.ref, `Action: ${action}`);
  res.json({ ok: true });
});

export default router;
