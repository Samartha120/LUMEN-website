import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { writeFile, readFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../lib/db.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { TRANSITIONS, STATUS_LABELS } from "../lib/rbac.js";
import { detect, embed, AiUnavailableError, type DetectResult } from "../lib/ai.js";
import { estimateMaterials, potholeVolume, potholePerimeter, type RoadType } from "../lib/materials.js";
import { suggestDimensions, ESTIMATE_NOTE } from "../lib/dimensions.js";
import { haversineMeters, cosineSimilarity, textSimilarity } from "../lib/geo.js";
import { categoryOf, CATEGORIES, type CategoryKey } from "../lib/taxonomy.js";
import { calculatePriority } from "../lib/priority.js";
import { notifyReporter, notifyDepartment } from "../lib/notify.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

/** Photographs accepted per complaint. Each one costs a detection pass, so the
 *  cap keeps a single submission from tying up the AI service. */
const MAX_PHOTOS = 5;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const DUP_SCORE_MIN = Number(process.env.DUP_SCORE_MIN ?? 0.78);

// The photograph is the evidence; place and category only corroborate it. The
// weighted score alone could not enforce that: category match and a zero
// distance contribute 0.40 before the images are compared at all, so two
// unrelated potholes reported from the same coordinates started at 0.40 and
// needed only ~0.77 image similarity to be declared the same damage. That is
// what linked a muddy street to a kerbside puddle — 0.785, over the line by
// five thousandths.
//
// So similarity is now a gate rather than a term. Measured over 18 scenes
// re-photographed (cropped, brightened, recompressed) against 153 pairs of
// genuinely different complaint photographs:
//
//     same scene again    min 0.918   median 0.946
//     different images    max 0.822   median 0.561
//
// The two populations do not overlap, and 0.88 sits in the empty gap between
// them: every true duplicate is kept, and none of the 153 different pairs is
// admitted.
const DUP_SIM_MIN = Number(process.env.DUP_SIM_MIN ?? 0.88);
const DUP_RADIUS_M = Number(process.env.DUP_RADIUS_M ?? 30);
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

/** Re-evaluate the age component whenever a complaint is read, without losing its audit trail. */
function currentPriority(c: { severityScore: number | null; aiConfidence: number | null; category: string; lat: number; lng: number; createdAt: Date; priorityFactors: string | null }) {
  let nearbyReports = 0;
  try { nearbyReports = Number(JSON.parse(c.priorityFactors ?? "{}").duplicateReports ?? 0); } catch { /* legacy record */ }
  const result = calculatePriority({
    severityScore: c.severityScore ?? 0, confidence: c.aiConfidence ?? 0, categoryLabel: c.category,
    lat: c.lat, lng: c.lng, nearbyReports, createdAt: c.createdAt,
  });
  return { priority: result.priority, priorityScore: result.score, priorityFactors: JSON.stringify(result.factors) };
}

// GET /api/complaints  (list, role-scoped, filterable)
router.get("/", requireAuth, async (req, res) => {
  const s = req.session!;
  const { status, q, cat } = req.query as { status?: string; q?: string; cat?: string };
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (cat) where.civicCategory = cat;
  if (q) where.OR = [{ title: { contains: String(q) } }, { ref: { contains: String(q).toUpperCase() } }];
  if (s.role === "ENGINEER") {
    const eng = await db.engineer.findFirst({ where: { name: s.name } });
    where.engineerId = eng?.id ?? "__none__";
  }
  // A citizen sees the reports they filed and nothing else. Scoped in the
  // query rather than filtered after fetching, so another resident's complaint
  // never leaves the database in the first place.
  if (s.role === "CITIZEN") where.reporterId = s.sub;
  const complaints = await db.complaint.findMany({
    where, include: { department: true, engineer: true, duplicateOf: { select: { ref: true } } },
    orderBy: [{ severityScore: "desc" }, { createdAt: "desc" }], take: 100,
  });
  res.json({ complaints: complaints.map((complaint) => ({ ...complaint, ...currentPriority(complaint) })) });
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
      potholes: { orderBy: { recordedAt: "asc" } },
    },
  });
  if (!c) return res.status(404).json({ error: "Complaint not found." });
  // 404 rather than 403 when a citizen asks for someone else's complaint.
  // "Forbidden" would confirm the reference exists, which lets an outsider map
  // the queue by trying CMP-10245, CMP-10246 and reading the status codes.
  if (req.session!.role === "CITIZEN" && c.reporterId !== req.session!.sub)
    return res.status(404).json({ error: "Complaint not found." });
  res.json({ complaint: { ...c, ...currentPriority(c) } });
});

// POST /api/complaints  (Features 1,2,3)
// Citizens may report; only staff may do anything else to a complaint.
router.post("/", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR", "CITIZEN"), upload.array("photos", MAX_PHOTOS), async (req, res) => {
  const s = req.session!;
  const b = req.body ?? {};
  const title = String(b.title ?? "").trim();
  if (!title) return res.status(400).json({ error: "A title is required." });

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "At least one photograph is required — class and severity come from it." });
  if (files.some((f) => !f.mimetype.startsWith("image/"))) return res.status(400).json({ error: "Every file must be an image." });

  const lat = parseFloat(String(b.lat ?? "12.97"));
  const lng = parseFloat(String(b.lng ?? "77.59"));

  // Analyse every photograph. One complaint often needs several angles — a wide
  // shot for context and a close one for the defect — and which of them shows
  // the damage best is not knowable in advance, so all are run.
  let analysed: { file: Express.Multer.File; result: DetectResult }[];
  try {
    analysed = await Promise.all(
      files.map(async (f) => ({ file: f, result: await detect(f.buffer, f.originalname, f.mimetype) })),
    );
  } catch (e) {
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: e.message });
    return res.status(500).json({ error: e instanceof Error ? e.message : "Image analysis failed." });
  }

  // Reject only if EVERY photograph fails the scene check. One bad frame among
  // several good ones is not worth refusing the whole complaint over.
  const civic = analysed.filter((a) => !a.result.scene || a.result.scene.looks_civic);
  if (civic.length === 0) {
    // The service supplies the wording for a single rejected photograph, so
    // the phrasing lives in one place rather than being duplicated here.
    const fromService = files.length === 1 ? analysed[0].result.message : null;
    return res.status(422).json({
      error: fromService ?? (files.length === 1
        ? "That photograph does not appear to show a road or civic area. Please upload a clear photo of the damage itself."
        : "None of those photographs appear to show a road or civic area. Please upload clear photos of the damage itself."),
      hint: files.length === 1 ? analysed[0].result.hint ?? undefined : undefined,
      sceneReason: analysed[0].result.scene?.reason,
    });
  }

  // The photograph that found the most damage drives classification, severity
  // and routing; the rest are kept as supporting evidence. Picking the most
  // informative frame beats picking whichever the user happened to select first.
  const primary = civic.reduce((best, a) =>
    a.result.severity.score > best.result.severity.score ? a : best, civic[0]);
  const result = primary.result;
  const buf = primary.file.buffer;

  let embedding: number[];
  try {
    // Duplicate detection compares one image per complaint, so it uses the
    // primary — the same frame the classification came from.
    embedding = await embed(buf, primary.file.originalname, primary.file.mimetype);
  } catch (e) {
    if (e instanceof AiUnavailableError) return res.status(503).json({ error: e.message });
    return res.status(500).json({ error: e instanceof Error ? e.message : "Image analysis failed." });
  }

  const top = [...result.detections].sort((a, b) => b.confidence - a.confidence)[0];
  const category = top?.label ?? "Unclassified";
  const sev = result.severity;

  // --- AI-driven department routing (multi-category taxonomy).
  // The detected damage class determines its civic category, and each category
  // is owned by one department — so the model routes the complaint, not a form.
  const routedCategory = (result.routing?.category ?? categoryOf(category)) as CategoryKey | null;
  const routedDeptCode = result.routing?.department ?? (routedCategory ? CATEGORIES[routedCategory]?.dept ?? null : null);

  const dept =
    (routedDeptCode ? await db.department.findFirst({ where: { code: routedDeptCode } }) : null) ??
    (routedCategory ? await db.department.findFirst({ where: { civicCategory: routedCategory } }) : null) ??
    (await db.department.findFirst());
  if (!dept) return res.status(500).json({ error: "No department configured." });
  const autoRouted = Boolean(routedDeptCode && dept.code === routedDeptCode);

  const since = new Date(Date.now() - DUP_WINDOW_HOURS * 3600_000);
  const description = String(b.description ?? "").trim() || title;
  const cands = await db.complaint.findMany({
    where: { createdAt: { gte: since }, status: { notIn: ["CLOSED", "REJECTED"] }, duplicateOfId: null },
    select: { id: true, ref: true, lat: true, lng: true, embedding: true, category: true, title: true, description: true },
  });
  let nearbyReports = 0;
  let dup: { id: string; ref: string; sim: number; dist: number; score: number; categoryMatch: boolean; descriptionSimilarity: number } | null = null;
  for (const cand of cands) {
    const dist = haversineMeters(lat, lng, cand.lat, cand.lng);
    if (dist > DUP_RADIUS_M) continue;
    const categoryMatch = cand.category === category;
    if (categoryMatch) nearbyReports++;
    const sim = cand.embedding ? Math.max(0, cosineSimilarity(embedding, JSON.parse(cand.embedding))) : 0;
    const descriptionSimilarity = textSimilarity(`${title} ${description}`, `${cand.title} ${cand.description}`);
    const distanceScore = Math.max(0, 1 - dist / DUP_RADIUS_M);
    const score = 0.5 * sim + 0.2 * distanceScore + 0.2 * Number(categoryMatch) + 0.1 * descriptionSimilarity;
    if (categoryMatch && sim >= DUP_SIM_MIN && score >= DUP_SCORE_MIN && (!dup || score > dup.score)) {
      dup = { id: cand.id, ref: cand.ref, sim, dist, score, categoryMatch, descriptionSimilarity };
    }
  }
  const smartPriority = calculatePriority({ severityScore: sev.score, confidence: top?.confidence ?? 0, categoryLabel: category, lat, lng, nearbyReports });

  const last = await db.complaint.findFirst({ orderBy: { ref: "desc" }, select: { ref: true } });
  const ref = `CMP-${last ? parseInt(last.ref.split("-")[1]) + 1 : 10245}`;

  // Store every accepted photograph with its own detections and annotated
  // overlay, primary first so the detail page leads with the decisive frame.
  const ordered = [primary, ...civic.filter((a) => a !== primary)];
  const storedImages = await Promise.all(
    ordered.map(async (a) => ({
      kind: "CITIZEN",
      path: await saveBuf(a.file.buffer, "citizen", a.file.originalname.split(".").pop() ?? "jpg"),
      annotated: await savePng(a.result.annotated_png_b64, "annotated"),
      detections: JSON.stringify(a.result.detections),
      severity: a.result.severity.score,
    })),
  );

  const complaint = await db.complaint.create({
    data: {
      ref, title, description,
      zone: String(b.zone ?? "Central Zone"), address: String(b.address ?? "").trim() || String(b.zone ?? "Central Zone"),
      lat, lng, category,
      civicCategory: routedCategory ?? null,
      autoRouted,
      aiPredicted: Boolean(top), aiConfidence: top?.confidence ?? null,
      aiModelMode: result.model_mode, detections: JSON.stringify(result.detections),
      severityScore: sev.score, severityBand: sev.band, priority: smartPriority.priority,
      priorityScore: smartPriority.score, priorityFactors: JSON.stringify(smartPriority.factors),
      slaHours: result.routing?.sla_hours ?? dept.slaTarget,
      embedding: embedding.length ? JSON.stringify(embedding) : null,
      duplicateOfId: dup?.id ?? null, dupSimilarity: dup?.sim ?? null, dupDistanceM: dup ? Math.round(dup.dist) : null,
      dupScore: dup?.score ?? null, dupCategoryMatch: dup?.categoryMatch ?? null, dupDescriptionSimilarity: dup?.descriptionSimilarity ?? null,
      status: "SUBMITTED", departmentId: dept.id,
      // Recorded only for citizen reports. Staff entering a complaint on
      // someone's behalf are the actor in the timeline, not the reporter, so
      // leaving this null keeps "my reports" meaning what a citizen expects.
      reporterId: s.role === "CITIZEN" ? s.sub : null,
      images: { create: storedImages },
    },
  });

  await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "CREATED", message: `Complaint created with photograph by ${s.name}`, actor: s.name } });
  await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "AI_DETECTION",
    message: top
      ? `Detector identified ${category}${routedCategory ? ` (${routedCategory})` : ""} (confidence ${top.confidence.toFixed(2)}) across ${sev.instances} region(s) — severity ${sev.score}/100; smart priority ${smartPriority.score}/100 → ${smartPriority.priority}${autoRouted ? `; auto-routed to ${dept.name}` : ""} [${result.model_mode} model]`
      : `No damage detected [${result.model_mode} model] — manual triage required`,
    actor: "AI Service" } });
  if (dup) {
    await db.timelineEvent.create({ data: { complaintId: complaint.id, type: "AI_DUPLICATE",
      message: `Flagged as a probable duplicate of ${dup.ref} — duplicate score ${(dup.score * 100).toFixed(0)}% (image ${(dup.sim * 100).toFixed(0)}%, text ${(dup.descriptionSimilarity * 100).toFixed(0)}%), ${Math.round(dup.dist)} m apart`, actor: "AI Service" } });
  }
  await audit(s.name, s.role, "COMPLAINT_CREATED", ref, `${category}, severity ${sev.score}${dup ? `, duplicate of ${dup.ref}` : ""}`);

  // Report the duplicate decision back to the submitter. The complaint is
  // still created and linked rather than rejected: the extra report is
  // evidence that more people are affected, and it feeds the nearby-report
  // term in the priority rule. The submitter simply needs to be told, instead
  // of being sent to a new case number as though nobody had reported it.
  res.json({
    ref,
    duplicate: dup
      ? {
          of: dup.ref,
          score: Math.round(dup.score * 100),
          imageSimilarity: Math.round(dup.sim * 100),
          distanceM: Math.round(dup.dist),
          nearbyReports,
        }
      : null,
  });
});

// POST /api/complaints/:ref/transition
router.post("/:ref/transition", requireAuth, async (req, res) => {
  const s = req.session!;
  const to = String(req.body?.to ?? "");
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref } });
  if (!c) return res.status(404).json({ error: "Not found." });
  const allowed = (TRANSITIONS[c.status] ?? []).find((t) => t.to === to && t.roles.includes(s.role));
  if (!allowed) return res.status(403).json({ error: "Transition not allowed for your role." });

  await db.complaint.update({ where: { ref: c.ref }, data: { status: to, closedAt: to === "CLOSED" ? new Date() : c.closedAt } });
  await db.timelineEvent.create({ data: { complaintId: c.id, type: "STATUS_CHANGE", message: `${STATUS_LABELS[c.status]} → ${STATUS_LABELS[to]}`, actor: s.name } });
  await audit(s.name, s.role, `COMPLAINT_${to}`, c.ref, `Status ${c.status} → ${to}`);

  // Tell the resident who reported it. Worded for someone who did not read the
  // status machine — "Pending Review" means nothing outside this building.
  const said: Record<string, string> = {
    ASSIGNED: `An engineer has been assigned to your report ${c.ref}.`,
    IN_PROGRESS: `Work has started on your report ${c.ref}.`,
    PENDING_REVIEW: `The work on ${c.ref} is finished and awaiting a supervisor's sign-off.`,
    CLOSED: `Your report ${c.ref} has been completed and closed. If the problem is still there, you can reopen it.`,
    REJECTED: `Your report ${c.ref} was reviewed and closed without work being scheduled.`,
  };
  if (said[to]) await notifyReporter(c.id, to, said[to]);

  res.json({ ok: true });
});

// POST /api/complaints/:ref/duplicate
router.post("/:ref/duplicate", requireAuth, requireRole("SUPERVISOR", "ADMINISTRATOR"), async (req, res) => {
  const s = req.session!;
  const action = String(req.body?.action ?? "");
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref }, include: { duplicateOf: { select: { ref: true } } } });
  if (!c) return res.status(404).json({ error: "Not found." });
  if (action === "reject") {
    await db.complaint.update({ where: { ref: c.ref }, data: { duplicateOfId: null, dupSimilarity: null, dupDistanceM: null, dupScore: null, dupCategoryMatch: null, dupDescriptionSimilarity: null } });
    await db.timelineEvent.create({ data: { complaintId: c.id, type: "AI_DUPLICATE", message: `Duplicate link to ${c.duplicateOf?.ref ?? "primary"} rejected by ${s.name} — treated as a distinct issue`, actor: s.name } });
  } else {
    await db.complaint.update({ where: { ref: c.ref }, data: { status: "REJECTED" } });
    await db.timelineEvent.create({ data: { complaintId: c.id, type: "AI_DUPLICATE", message: `Confirmed duplicate of ${c.duplicateOf?.ref ?? "primary"} — consolidated by ${s.name}`, actor: s.name } });
  }
  await audit(s.name, s.role, "DUPLICATE_RESOLVED", c.ref, `Action: ${action}`);
  res.json({ ok: true });
});

// POST /api/complaints/:ref/measurements  (Feature 6)
//
// The engineer's team measures each pothole on site and records it here.
// Volume and perimeter are computed server-side so the stored figures cannot
// disagree with the arithmetic the estimate is built on.
router.post("/:ref/measurements", requireAuth, requireRole("ENGINEER", "SUPERVISOR", "ADMINISTRATOR"), async (req, res) => {
  const s = req.session!;
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref } });
  if (!c) return res.status(404).json({ error: "Not found." });

  const roadType = String(req.body?.roadType ?? "");
  if (roadType && roadType !== "BITUMINOUS" && roadType !== "CONCRETE") {
    return res.status(400).json({ error: "Road type must be BITUMINOUS or CONCRETE." });
  }

  const raw = Array.isArray(req.body?.potholes) ? req.body.potholes : [];
  const rows: { label: string; lengthM: number; widthM: number; depthM: number; source: string }[] = [];
  for (const [i, p] of raw.entries()) {
    const lengthM = Number(p?.lengthM), widthM = Number(p?.widthM), depthM = Number(p?.depthM);
    // A zero or negative dimension is a typo, not a pothole. Reject rather than
    // silently store a measurement that would understate the material order.
    if (![lengthM, widthM, depthM].every((v) => Number.isFinite(v) && v > 0)) {
      return res.status(400).json({ error: `Pothole ${i + 1}: length, width and depth must all be greater than zero.` });
    }
    if (lengthM > 50 || widthM > 50 || depthM > 5) {
      return res.status(400).json({ error: `Pothole ${i + 1}: dimensions look wrong — check the units are metres.` });
    }
    const source = p?.source === "ESTIMATED" ? "ESTIMATED" : "MEASURED";
    rows.push({ label: String(p?.label ?? `P${i + 1}`).slice(0, 12), lengthM, widthM, depthM, source });
  }

  // Replace wholesale: the form submits the full current list, so an edit that
  // removes a row must remove it here too.
  await db.potholeMeasurement.deleteMany({ where: { complaintId: c.id } });
  if (rows.length) {
    await db.potholeMeasurement.createMany({
      data: rows.map((r) => ({
        complaintId: c.id, label: r.label,
        lengthM: r.lengthM, widthM: r.widthM, depthM: r.depthM,
        volumeM3: potholeVolume(r.lengthM, r.widthM, r.depthM),
        perimeterM: potholePerimeter(r.lengthM, r.widthM),
        recordedBy: s.name,
        source: r.source,
      })),
    });
  }
  if (roadType) await db.complaint.update({ where: { id: c.id }, data: { roadType } });

  const total = rows.reduce((t, r) => t + potholeVolume(r.lengthM, r.widthM, r.depthM), 0);
  const anyEstimated = rows.some((r) => r.source === "ESTIMATED");
  await db.timelineEvent.create({ data: { complaintId: c.id, type: "SITE_MEASUREMENT",
    message: `${rows.length} pothole${rows.length === 1 ? "" : "s"} ${anyEstimated ? "estimated from the photograph" : "measured on site"} — total volume ${total.toFixed(3)} m³`, actor: s.name } });
  await audit(s.name, s.role, "SITE_MEASUREMENT", c.ref, `${rows.length} potholes, ${total.toFixed(3)} m³`);

  res.json({ ok: true, count: rows.length, totalVolumeM3: Number(total.toFixed(3)) });
});

// GET /api/complaints/:ref/estimate?wastage=5  (Feature 6)
//
// Bill of quantities for one complaint, from its measured potholes.
router.get("/:ref/estimate", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({
    where: { ref: req.params.ref },
    include: { potholes: { orderBy: { recordedAt: "asc" } } },
  });
  if (!c) return res.status(404).json({ error: "Not found." });
  if (c.potholes.length === 0) {
    return res.status(400).json({ error: "No site measurements recorded yet for this complaint." });
  }

  const roadType = (c.roadType === "CONCRETE" ? "CONCRETE" : "BITUMINOUS") as RoadType;
  const wastage = Number(req.query.wastage ?? 5);
  const volume = c.potholes.reduce((t, p) => t + p.volumeM3, 0);

  res.json({
    ref: c.ref,
    title: c.title,
    potholes: c.potholes,
    estimate: estimateMaterials(volume, c.potholes.length, roadType, Number.isFinite(wastage) ? wastage : 5),
  });
});

// GET /api/complaints/:ref/suggest-dimensions  (Feature 6b)
//
// First-pass dimensions read off the photograph, so a budget exists before
// anyone drives to the site. Always ESTIMATED — see lib/dimensions.ts for why
// a single photo cannot give true scale.
router.get("/:ref/suggest-dimensions", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({
    where: { ref: req.params.ref },
    select: { detections: true, severityScore: true, civicCategory: true },
  });
  if (!c) return res.status(404).json({ error: "Not found." });
  if (c.civicCategory !== "ROADS") {
    return res.status(400).json({ error: "Dimension estimates apply to road damage only." });
  }

  let dets: Parameters<typeof suggestDimensions>[0] = [];
  try { dets = JSON.parse(c.detections ?? "[]"); } catch { /* unparseable, treat as none */ }

  const potholes = suggestDimensions(dets, c.severityScore ?? 0);
  if (potholes.length === 0) {
    return res.status(400).json({ error: "No pothole regions confident enough to estimate from." });
  }
  res.json({ potholes, note: ESTIMATE_NOTE });
});

/**
 * POST /api/complaints/:ref/reopen
 *
 * The resident says the work was not actually done. Without this their only
 * recourse is to file a second complaint, which loses the history and shows up
 * as a duplicate of the thing that was supposedly fixed.
 *
 * It returns to SUBMITTED rather than IN_PROGRESS: the original engineer has
 * already reported it finished, so it should be triaged again rather than
 * silently handed back to the same person.
 */
router.post("/:ref/reopen", requireAuth, requireRole("CITIZEN"), async (req, res) => {
  const s = req.session!;
  const reason = String(req.body?.reason ?? "").trim();
  const c = await db.complaint.findUnique({ where: { ref: req.params.ref } });

  // 404 rather than 403 for someone else's complaint, for the same reason the
  // detail route does: a different code confirms the reference exists.
  if (!c || c.reporterId !== s.sub) return res.status(404).json({ error: "Complaint not found." });
  if (c.status !== "CLOSED") return res.status(422).json({ error: "Only a completed report can be reopened." });
  if (!reason) return res.status(400).json({ error: "Please say what is still wrong." });

  await db.complaint.update({
    where: { id: c.id },
    data: { status: "SUBMITTED", reopenedAt: new Date(), closedAt: null, engineerId: null },
  });
  await db.timelineEvent.create({
    data: { complaintId: c.id, type: "STATUS_CHANGE", actor: s.name, message: `Reopened by the resident — ${reason}` },
  });
  await audit(s.name, s.role, "COMPLAINT_REOPENED", c.ref, reason);
  await notifyDepartment(c.departmentId, c.id, "REOPENED",
    `${c.ref} was reopened by the resident: ${reason}`);

  res.json({ ok: true, status: "SUBMITTED" });
});

export default router;
