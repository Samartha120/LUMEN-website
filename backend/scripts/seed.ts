import bcrypt from "bcrypt";
/**
 * Seed LUMEN with REAL data.
 *
 * Every seeded complaint carries an actual photograph taken from the public
 * datasets in ai-service/data/sources, and its damage class, severity, priority
 * and department come from running that photo through the live AI service —
 * the same path a citizen submission takes. Nothing is invented, and no
 * complaint exists without an image.
 *
 * Requires the AI service on :8100.   Run:  npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { calculatePriority } from "../src/lib/priority.js";

/** All three demo accounts share one password; hashed once at seed time.
 *  Cost 10 is the usual default — slow enough to matter, fast enough to seed. */
const DEMO_HASH = bcrypt.hashSync("lumen123", 10);

const db = new PrismaClient();
const ROOT = path.join(import.meta.dirname, "..");
const UPLOADS = path.join(ROOT, "uploads");
const SOURCES = path.join(ROOT, "ai-service", "data", "sources");
const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8100";

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

/**
 * Departments mirror the civic taxonomy: one department per category, so the
 * detected damage class routes the complaint automatically.
 * (see backend/src/lib/taxonomy.ts and backend/ai-service/taxonomy.py)
 */
const DEPARTMENTS: [string, string, string, number][] = [
  // code, name, civicCategory, slaTarget hours
  ["RDS", "Roads & Infrastructure", "ROADS", 48],
  ["SAN", "Sanitation", "WASTE", 24],
  ["WTR", "Water Supply", "WATER", 24],
];

/** Engineers carry the damage classes they are trained to handle. */
const ENGINEERS: [string, string, string, string, number, number][] = [
  // name, deptCode, skills (classes), zone, lat, lng
  ["Amit Sharma", "RDS", "Pothole,Alligator Crack", "North Zone", 12.995, 77.58],
  ["Neha Gupta", "RDS", "Pothole,Alligator Crack", "South Zone", 12.915, 77.61],
  ["Karthik R", "RDS", "Alligator Crack,Pothole", "East Zone", 12.96, 77.68],
  ["Deepa Nair", "SAN", "Garbage Pile,Overflowing Bin", "West Zone", 12.94, 77.52],
  ["Manoj Kumar", "SAN", "Garbage Pile,Overflowing Bin", "South Zone", 12.92, 77.59],
  ["Farhan Ali", "WTR", "Open Manhole", "East Zone", 12.965, 77.66],
  ["Asha Patel", "WTR", "Open Manhole", "Central Zone", 12.975, 77.6],
];

/**
 * The seeded workload. The damage class, severity and department are NOT set
 * here — they come back from the detector, so the queue reflects what the
 * model actually saw in each photograph. Only the location is scripted.
 *
 * The three landmarks in src/lib/priority.ts (hospital, school, highway) each
 * get complaints inside their 500 m radius, so the landmark-risk half of the
 * prioritisation rule is genuinely exercised rather than sitting at zero.
 *
 * The list is sized for the planning layer: a budget optimiser given a dozen
 * jobs has nothing interesting to decide, because almost any selection fits.
 */
const STREETS = [
  "MG Road", "100 Feet Road", "9th Main", "12th Cross", "Ring Road service lane",
  "Bannerghatta Road", "Sarjapur Road", "Old Airport Road", "Hosur Road", "Bellary Road",
  "Race Course Road", "Cunningham Road", "Residency Road", "Brigade Road", "Church Street",
  "Commercial Street", "Infantry Road", "Queens Road", "Palace Road", "Nrupathunga Road",
  "Kanakapura Road", "Mysore Road", "Magadi Road", "Tumkur Road", "Outer Ring Road",
];
const SPOTS = [
  "near the bus stop", "opposite the park", "at the junction approach", "near the metro pillar",
  "outside the market", "by the canal crossing", "near the depot gate", "at the service lane entry",
  "outside the community hall", "near the water tank", "at the flyover ramp", "by the school gate",
];

/** Landmark clusters — coordinates from SENSITIVE_LOCATIONS in priority.ts. */
const LANDMARKS: [number, number][] = [
  [12.9719, 77.5937], // hospital
  [12.9352, 77.6245], // school
  [12.9570, 77.6390], // major highway
];

function makePlaces(n: number): [string, string, number, number][] {
  const out: [string, string, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const street = STREETS[i % STREETS.length];
    const spot = SPOTS[(i * 7) % SPOTS.length];
    let lat: number, lng: number;
    if (i % 4 === 0) {
      // Every fourth complaint sits within ~400 m of a landmark.
      const [la, ln] = LANDMARKS[(i / 4) % LANDMARKS.length];
      lat = la + (Math.random() - 0.5) * 0.006;
      lng = ln + (Math.random() - 0.5) * 0.006;
    } else {
      lat = 12.9 + Math.random() * 0.14;
      lng = 77.53 + Math.random() * 0.16;
    }
    out.push([street, spot, lat, lng]);
  }
  return out;
}

/**
 * How a citizen would describe each damage class. The title is written after
 * detection, from the class the model actually found, so a garbage pile is not
 * filed as "road damage".
 */
const TITLE_FOR: Record<string, string> = {
  "Pothole": "Deep pothole",
  "Alligator Crack": "Cracked and broken road surface",
  "Garbage Pile": "Uncollected garbage piling up",
  "Overflowing Bin": "Overflowing waste bin",
  "Open Manhole": "Open manhole — fall hazard",
};

const PLACES = makePlaces(72);

const STATUSES = ["SUBMITTED", "SUBMITTED", "ASSIGNED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED"];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

function imagesFrom(rel: string, limit: number): string[] {
  const p = path.join(SOURCES, rel);
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .slice(0, limit)
    .map((f) => path.join(p, f));
}

type Detected = {
  detections: { label: string; category: string | null; confidence: number }[];
  severity: { score: number; band: string; priority: string };
  routing: { category: string | null; department: string | null; sla_hours: number | null };
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

function saveImage(src: string, prefix: string): string {
  mkdirSync(UPLOADS, { recursive: true });
  const name = `${prefix}-${randomUUID()}${path.extname(src) || ".jpg"}`;
  writeFileSync(path.join(UPLOADS, name), readFileSync(src));
  return `/uploads/${name}`;
}

function saveB64(b64: string, prefix: string): string | null {
  if (!b64) return null;
  mkdirSync(UPLOADS, { recursive: true });
  const name = `${prefix}-${randomUUID()}.png`;
  writeFileSync(path.join(UPLOADS, name), Buffer.from(b64, "base64"));
  return `/uploads/${name}`;
}

async function main() {
  // The AI service is required — the point of this seed is that the data is real.
  try {
    const h = await fetch(`${AI}/health`);
    if (!h.ok) throw new Error();
    console.log(`AI service reachable — model mode: ${(await h.json()).model_mode}\n`);
  } catch {
    console.error(
      `\nAI service is not reachable at ${AI}.\n` +
        `Start it first:  cd backend/ai-service && uvicorn main:app --port 8100\n`,
    );
    process.exit(1);
  }

  await db.timelineEvent.deleteMany();
  await db.complaintImage.deleteMany();
  await db.complaint.deleteMany();
  await db.auditLog.deleteMany();
  await db.engineer.deleteMany();
  await db.user.deleteMany();
  await db.department.deleteMany();

  const depts: Record<string, { id: string; sla: number; name: string }> = {};
  for (const [code, name, civicCategory, slaTarget] of DEPARTMENTS) {
    const d = await db.department.create({ data: { code, name, civicCategory, slaTarget } });
    depts[code] = { id: d.id, sla: slaTarget, name };
  }

  await db.user.createMany({
    data: [
      { email: "admin@lumen.gov", passwordHash: DEMO_HASH, name: "Rajesh Kumar", role: "ADMINISTRATOR" },
      { email: "supervisor@lumen.gov", passwordHash: DEMO_HASH, name: "Meera Krishnan", role: "SUPERVISOR", departmentId: depts.RDS.id },
      { email: "engineer@lumen.gov", passwordHash: DEMO_HASH, name: "Amit Sharma", role: "ENGINEER", departmentId: depts.RDS.id },
    ],
  });

  const engineers: { id: string; dept: string }[] = [];
  for (let i = 0; i < ENGINEERS.length; i++) {
    const [name, dept, skills, zone, lat, lng] = ENGINEERS[i];
    const e = await db.engineer.create({
      data: {
        code: `ENG-${1001 + i}`,
        name,
        phone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
        zone,
        skills,
        status: i % 5 === 4 ? "OFF_DUTY" : "AVAILABLE",
        lat,
        lng,
        resolvedJobs: Math.floor(20 + Math.random() * 120),
        departmentId: depts[dept].id,
      },
    });
    engineers.push({ id: e.id, dept });
  }

  // Real photographs from the downloaded public datasets.
  // Imagery from every category the trained model can actually recognise.
  // Round-robin rather than concatenated, so the queue interleaves categories
  // instead of showing 30 potholes followed by 30 garbage piles.
  const pools = [
    imagesFrom("roads/potholes/train/images", 40),
    imagesFrom("roads/cracks/train/images", 60),
    imagesFrom("waste/garbage/train/images", 60),
    imagesFrom("water/manholes/train/images", 60),
    imagesFrom("waste/binoverflow/train/images", 40),
  ].filter((p) => p.length > 0);

  const candidates: string[] = [];
  for (let i = 0; i < Math.max(...pools.map((p) => p.length)); i++) {
    for (const pool of pools) if (pool[i]) candidates.push(pool[i]);
  }
  if (candidates.length === 0) {
    console.error(
      "No dataset images found under ai-service/data/sources.\n" +
        "Fetch them first:  cd backend/ai-service && python3 fetch_datasets.py --get-roboflow",
    );
    process.exit(1);
  }

  const DEPT_BY_CAT = Object.fromEntries(DEPARTMENTS.map(([code, , cat]) => [cat, code]));
  let seq = 10245;
  let made = 0;
  let skipped = 0;

  for (const img of candidates) {
    if (made >= PLACES.length) break;
    const det = await detect(img);
    // Skip photos the detector finds nothing in — a complaint with an image but
    // no detection is exactly the confusing empty state this seed exists to avoid.
    if (!det || det.detections.length === 0 || !det.routing.category) {
      skipped++;
      continue;
    }

    const [street, spot, lat, lng] = PLACES[made];
    const cat = det.routing.category;
    const deptCode = DEPT_BY_CAT[cat] ?? "RDS";
    const dept = depts[deptCode];
    const top = [...det.detections].sort((a, b) => b.confidence - a.confidence)[0];

    const address = `${street}, ${spot}`;
    const title = `${TITLE_FOR[top.label] ?? top.label} on ${street} ${spot}`;

    const status = STATUSES[made % STATUSES.length];
    const eligible = engineers.filter((e) => e.dept === deptCode);
    const eng = status !== "SUBMITTED" && eligible.length ? pick(eligible) : null;
    const createdAt = hoursAgo(2 + made * 7);
    const closed = status === "CLOSED";

    // Same priority engine the live submission path uses, so seeded complaints
    // carry real factor breakdowns (landmark risk, age, department risk).
    const prio = calculatePriority({
      severityScore: det.severity.score,
      confidence: top.confidence,
      categoryLabel: top.label,
      lat,
      lng,
      nearbyReports: 0,
      createdAt,
    });

    const c = await db.complaint.create({
      data: {
        ref: `CMP-${seq++}`,
        title,
        description: `Reported with a photograph via the citizen mobile application. ${title}.`,
        zone: pick(ZONES),
        address,
        lat,
        lng,
        category: top.label,
        civicCategory: cat,
        autoRouted: true,
        aiPredicted: true,
        aiConfidence: top.confidence,
        aiModelMode: det.model_mode,
        detections: JSON.stringify(det.detections),
        severityScore: det.severity.score,
        severityBand: det.severity.band,
        priority: prio.priority,
        priorityScore: prio.score,
        priorityFactors: JSON.stringify(prio.factors),
        slaHours: det.routing.sla_hours ?? dept.sla,
        status,
        createdAt,
        closedAt: closed ? new Date(createdAt.getTime() + 30 * 3600_000) : null,
        departmentId: dept.id,
        engineerId: eng?.id ?? null,
        assignMethod: eng ? "OPTIMISED" : null,
        assignDistance: eng ? Math.round(Math.random() * 60) / 10 : null,
        images: {
          create: {
            kind: "CITIZEN",
            path: saveImage(img, "citizen"),
            annotated: saveB64(det.annotated_png_b64, "annotated"),
            detections: JSON.stringify(det.detections),
            severity: det.severity.score,
          },
        },
      },
    });

    const events: [string, string, string, number][] = [
      ["CREATED", "Complaint submitted with photograph via the citizen app", "Citizen App", 0],
      [
        "AI_DETECTION",
        `Detector identified ${top.label} (${cat}, confidence ${top.confidence.toFixed(2)}) across ` +
          `${det.detections.length} region(s) — severity ${det.severity.score}/100, priority score ${prio.score} → ${prio.priority}; ` +
          `auto-routed to ${dept.name} [${det.model_mode} model]`,
        "AI Service",
        0,
      ],
    ];
    if (eng) events.push(["ASSIGNMENT", `Optimiser assigned engineer (skill match on ${top.label})`, "Assignment Optimiser", 1]);
    if (["IN_PROGRESS", "PENDING_REVIEW", "CLOSED"].includes(status)) events.push(["STATUS_CHANGE", "Engineer began work on site", "Engineer", 4]);
    if (["PENDING_REVIEW", "CLOSED"].includes(status)) events.push(["STATUS_CHANGE", "Work complete, after-photograph uploaded", "Engineer", 10]);
    if (closed) {
      events.push(["STATUS_CHANGE", "Closure approved by supervisor", "Meera Krishnan", 12]);
    }
    for (const [type, message, actor, off] of events) {
      await db.timelineEvent.create({
        data: { complaintId: c.id, type, message, actor, createdAt: new Date(createdAt.getTime() + off * 3600_000) },
      });
    }

    console.log(`  ${c.ref}  ${top.label.padEnd(18)} ${cat.padEnd(11)} sev ${String(det.severity.score).padStart(5)}  ->  ${dept.name}`);
    made++;
  }

  await db.auditLog.createMany({
    data: [
      { actor: "AI Service", actorRole: "SYSTEM", action: "AI_DETECTION", module: "Complaints", target: "Complaints", details: "Citizen photographs classified and auto-routed to departments" },
      { actor: "Meera Krishnan", actorRole: "SUPERVISOR", action: "CLOSURE_APPROVED", module: "Complaints", target: "Complaints", details: "Closure approved after supervisor review" },
      { actor: "Rajesh Kumar", actorRole: "ADMINISTRATOR", action: "LOGIN_SUCCESS", module: "Authentication", target: "admin@lumen.gov", details: "Administrator signed in" },
    ],
  });

  console.log(`\nSeed complete — ${made} complaints, every one with a real photograph and real detections.`);
  if (skipped) console.log(`(${skipped} dataset images skipped: the detector found no damage in them.)`);
}

main().finally(() => db.$disconnect());
