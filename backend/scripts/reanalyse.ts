/**
 * Re-run damage detection over the complaints already on record.
 *
 * Detections are stored at submission time, so a change to the detector does
 * not retroactively correct what is displayed. This replays every stored
 * photograph through the current AI service and rewrites the detections,
 * severity, class and annotated overlay.
 *
 * Refs, statuses, assignments, timeline events and duplicate links are left
 * untouched — this corrects what the model saw, not the case history.
 *
 *   npx tsx scripts/reanalyse.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { calculatePriority } from "../src/lib/priority.js";

const db = new PrismaClient();
const ROOT = path.join(import.meta.dirname, "..");
const UPLOADS = path.join(ROOT, "uploads");
const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8100";

type Detected = {
  detections: { label: string; category: string | null; confidence: number }[];
  severity: { score: number; band: string; priority: string };
  routing: { category: string | null; sla_hours: number | null };
  model_mode: string;
  annotated_png_b64: string;
};

async function detect(file: string): Promise<Detected | null> {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(readFileSync(file))], path.basename(file), { type: "image/jpeg" }));
  try {
    const r = await fetch(`${AI}/detect`, { method: "POST", body: fd });
    return r.ok ? ((await r.json()) as Detected) : null;
  } catch {
    return null;
  }
}

function saveB64(b64: string, prefix: string): string | null {
  if (!b64) return null;
  const name = `${prefix}-${randomUUID()}.png`;
  writeFileSync(path.join(UPLOADS, name), Buffer.from(b64, "base64"));
  return `/uploads/${name}`;
}

async function main() {
  try {
    const h = await fetch(`${AI}/health`);
    if (!h.ok) throw new Error();
    console.log(`AI service model mode: ${(await h.json()).model_mode}\n`);
  } catch {
    console.error(`AI service unreachable at ${AI}. Start it first.`);
    process.exit(1);
  }

  const complaints = await db.complaint.findMany({
    include: { images: { where: { kind: "CITIZEN" }, orderBy: { createdAt: "asc" }, take: 1 } },
    orderBy: { ref: "asc" },
  });

  let updated = 0, skipped = 0, changed = 0;
  for (const c of complaints) {
    const img = c.images[0];
    if (!img) { skipped++; continue; }
    const file = path.join(UPLOADS, path.basename(img.path));
    if (!existsSync(file)) { skipped++; continue; }

    const det = await detect(file);
    if (!det) { skipped++; continue; }

    const before = JSON.parse(c.detections ?? "[]").length;
    const after = det.detections.length;
    const top = [...det.detections].sort((a, b) => b.confidence - a.confidence)[0];

    const prio = calculatePriority({
      severityScore: det.severity.score,
      confidence: top?.confidence ?? 0,
      categoryLabel: top?.label ?? c.category,
      lat: c.lat, lng: c.lng,
      nearbyReports: 0,
      createdAt: c.createdAt,
    });

    await db.complaint.update({
      where: { id: c.id },
      data: {
        category: top?.label ?? c.category,
        civicCategory: det.routing.category ?? c.civicCategory,
        aiPredicted: Boolean(top),
        aiConfidence: top?.confidence ?? null,
        aiModelMode: det.model_mode,
        detections: JSON.stringify(det.detections),
        severityScore: det.severity.score,
        severityBand: det.severity.band,
        priority: prio.priority,
        priorityScore: prio.score,
        priorityFactors: JSON.stringify(prio.factors),
      },
    });
    await db.complaintImage.update({
      where: { id: img.id },
      data: {
        annotated: saveB64(det.annotated_png_b64, "annotated") ?? img.annotated,
        detections: JSON.stringify(det.detections),
        severity: det.severity.score,
      },
    });

    if (before !== after) {
      changed++;
      console.log(`  ${c.ref}  ${before} -> ${after} detections   ${top?.label ?? "none"}`);
    }
    updated++;
  }

  console.log(`\nRe-analysed ${updated} complaints (${skipped} skipped, no usable image).`);
  console.log(`${changed} had their detection count change.`);
}

main().finally(() => db.$disconnect());
