import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

/** All three demo accounts share one password; hashed once at seed time.
 *  Cost 10 is the usual default — slow enough to matter, fast enough to seed. */
const DEMO_HASH = bcrypt.hashSync("lumen123", 10);

const db = new PrismaClient();

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

/**
 * Departments mirror the civic taxonomy: one department per category, so the
 * detected damage class routes the complaint automatically.
 * (see backend/src/lib/taxonomy.ts and backend/ai-service/taxonomy.py)
 */
const DEPARTMENTS: [string, string, string, number][] = [
  // code, name, civicCategory, slaTarget hours
  ["RDS", "Roads & Infrastructure", "ROADS", 48],
  ["ELC", "Electricity", "ELECTRICAL", 12],
  ["SAN", "Sanitation", "WASTE", 24],
  ["WTR", "Water Supply", "WATER", 24],
  ["PWD", "Public Works", "PUBLIC", 72],
];

/** Engineers carry the damage classes they are trained to handle. */
const ENGINEERS: [string, string, string, string, number, number][] = [
  // name, deptCode, skills (classes), zone, lat, lng
  ["Amit Sharma", "RDS", "Pothole,Alligator Crack", "North Zone", 12.995, 77.58],
  ["Neha Gupta", "RDS", "Pothole,Transverse Crack,Longitudinal Crack", "South Zone", 12.915, 77.61],
  ["Karthik R", "RDS", "Longitudinal Crack,Transverse Crack", "East Zone", 12.96, 77.68],
  ["Lakshmi V", "ELC", "Broken Streetlight,Damaged Pole", "Central Zone", 12.97, 77.6],
  ["Rohit Verma", "ELC", "Exposed Wire,Open Transformer,Damaged Pole", "North Zone", 13.01, 77.63],
  ["Deepa Nair", "SAN", "Garbage Pile,Overflowing Bin", "West Zone", 12.94, 77.52],
  ["Manoj Kumar", "SAN", "Debris,Garbage Pile", "South Zone", 12.92, 77.59],
  ["Farhan Ali", "WTR", "Open Manhole,Pipe Leak", "East Zone", 12.965, 77.66],
  ["Asha Patel", "WTR", "Waterlogging,Pipe Leak", "Central Zone", 12.975, 77.6],
  ["Sunil Yadav", "PWD", "Broken Footpath,Broken Railing", "North Zone", 13.005, 77.62],
  ["Rekha Singh", "PWD", "Damaged Signage,Broken Footpath", "West Zone", 12.935, 77.54],
];

/** Severity band -> priority, mirroring ai-service/model.py score_severity(). */
function bandFor(score: number) {
  if (score >= 60) return { band: "SEVERE", priority: "CRITICAL" };
  if (score >= 35) return { band: "SIGNIFICANT", priority: "HIGH" };
  if (score >= 15) return { band: "MODERATE", priority: "MEDIUM" };
  return { band: "MINOR", priority: "LOW" };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

async function main() {
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

  // title, description, damage class, civic category, deptCode, severity, status, hoursAgo
  const SPECS: [string, string, string, string, string, number, string, number][] = [
    ["Deep pothole outside Jayanagar 4th Block bus stop", "Large pothole in the left lane; two-wheelers swerving to avoid it.", "Pothole", "ROADS", "RDS", 72.4, "SUBMITTED", 3],
    ["Alligator cracking across MG Road stretch 4", "Surface broken into interconnected cracks across the lane width.", "Alligator Crack", "ROADS", "RDS", 48.6, "IN_PROGRESS", 26],
    ["Longitudinal crack along 9th Main", "Crack tracking the lane marking for about thirty metres.", "Longitudinal Crack", "ROADS", "RDS", 22.8, "CLOSED", 96],
    ["Exposed live wire hanging near school gate", "Low-hanging wire sparking near the footpath — children pass here daily.", "Exposed Wire", "ELECTRICAL", "ELC", 88.5, "ASSIGNED", 2],
    ["Streetlight out on Lake View Road", "Three lights dark for a week; the stretch is unlit at night.", "Broken Streetlight", "ELECTRICAL", "ELC", 27.3, "ASSIGNED", 14],
    ["Transformer box left open near market", "Access panel missing, internals exposed to rain and the public.", "Open Transformer", "ELECTRICAL", "ELC", 79.1, "PENDING_REVIEW", 30],
    ["Garbage pile blocking service lane", "Waste not collected for over a week, spilling onto the road.", "Garbage Pile", "WASTE", "SAN", 34.2, "SUBMITTED", 8],
    ["Overflowing bin at Central Market", "Bin overflowing, waste scattered around the base.", "Overflowing Bin", "WASTE", "SAN", 21.7, "IN_PROGRESS", 20],
    ["Open manhole on service road", "Cover missing entirely; unlit at night and a serious fall hazard.", "Open Manhole", "WATER", "WTR", 91.2, "ASSIGNED", 5],
    ["Waterlogging near primary school after rain", "Standing water across the approach road for two days.", "Waterlogging", "WATER", "WTR", 52.4, "SUBMITTED", 12],
    ["Pipe leak flooding 4th Cross", "Continuous leak washing out the road edge.", "Pipe Leak", "WATER", "WTR", 58.9, "CLOSED", 120],
    ["Broken footpath tiles outside metro station", "Tiles lifted and uneven where commuters walk.", "Broken Footpath", "PUBLIC", "PWD", 31.5, "IN_PROGRESS", 40],
    ["Railing broken on canal bridge", "Section of railing missing over the water — fall risk.", "Broken Railing", "PUBLIC", "PWD", 62.8, "SUBMITTED", 6],
    ["Faded and bent signage at Ring Road junction", "Direction board bent and illegible.", "Damaged Signage", "PUBLIC", "PWD", 18.4, "CLOSED", 140],
  ];

  let seq = 10245;
  for (const [title, description, cls, civicCategory, deptCode, severity, status, ago] of SPECS) {
    const { band, priority } = bandFor(severity);
    const dept = depts[deptCode];
    const eligible = engineers.filter((e) => e.dept === deptCode);
    const needsEngineer = status !== "SUBMITTED";
    const eng = needsEngineer && eligible.length ? pick(eligible) : null;
    const createdAt = hoursAgo(ago);
    const closed = status === "CLOSED";
    const conf = Math.round((0.7 + Math.random() * 0.27) * 100) / 100;

    const c = await db.complaint.create({
      data: {
        ref: `CMP-${seq++}`,
        title,
        description,
        zone: pick(ZONES),
        address: `${Math.floor(1 + Math.random() * 120)}th Main`,
        lat: 12.9 + Math.random() * 0.14,
        lng: 77.53 + Math.random() * 0.16,
        category: cls,
        civicCategory,
        autoRouted: true,
        aiPredicted: true,
        aiConfidence: conf,
        aiModelMode: "TRAINED",
        detections: JSON.stringify([
          { label: cls, category: civicCategory, confidence: conf, box: [120, 180, 430, 360], area_ratio: Math.round((severity / 100) * 0.3 * 1000) / 1000 },
        ]),
        severityScore: severity,
        severityBand: band,
        priority,
        slaHours: dept.sla,
        status,
        createdAt,
        closedAt: closed ? new Date(createdAt.getTime() + 40 * 3600_000) : null,
        departmentId: dept.id,
        engineerId: eng?.id ?? null,
        assignMethod: eng ? "OPTIMISED" : null,
        assignDistance: eng ? Math.round(Math.random() * 60) / 10 : null,
        verifyVerdict: closed ? "VERIFIED" : null,
        verifyReason: closed ? "No damage detected in the after-photo." : null,
        verifyReduction: closed ? 100 : null,
        verifySsim: closed ? 0.45 : null,
      },
    });

    const events: [string, string, string, number][] = [
      ["CREATED", "Complaint submitted with photograph via the citizen app", "Citizen App", 0],
      ["AI_DETECTION", `Detector identified ${cls} (${civicCategory}, confidence ${conf.toFixed(2)}) — severity ${severity}/100 → ${priority}; auto-routed to ${dept.name}`, "AI Service", 0],
    ];
    if (eng) events.push(["ASSIGNMENT", `Optimiser assigned engineer (skill match on ${cls})`, "Assignment Optimiser", 1]);
    if (["IN_PROGRESS", "PENDING_REVIEW", "CLOSED"].includes(status)) events.push(["STATUS_CHANGE", "Engineer began work on site", "Engineer", 4]);
    if (["PENDING_REVIEW", "CLOSED"].includes(status)) events.push(["STATUS_CHANGE", "Work complete, after-photograph uploaded", "Engineer", 10]);
    if (closed) {
      events.push(["AI_VERIFICATION", "Repair verified — no damage detected in the after-photograph", "AI Service", 11]);
      events.push(["STATUS_CHANGE", "Closure approved by supervisor", "Meera Krishnan", 12]);
    }
    for (const [type, message, actor, off] of events) {
      await db.timelineEvent.create({
        data: { complaintId: c.id, type, message, actor, createdAt: new Date(createdAt.getTime() + off * 3600_000) },
      });
    }
  }

  for (const [actor, actorRole, action, module, details] of [
    ["AI Service", "SYSTEM", "AI_DETECTION", "Complaints", "CMP-10248 classified as Exposed Wire (ELECTRICAL) — auto-routed to Electricity"],
    ["Meera Krishnan", "SUPERVISOR", "CLOSURE_APPROVED", "Complaints", "CMP-10247 closure approved after AI verification"],
    ["Rajesh Kumar", "ADMINISTRATOR", "LOGIN_SUCCESS", "Authentication", "Administrator signed in"],
  ] as [string, string, string, string, string][]) {
    await db.auditLog.create({ data: { actor, actorRole, action, module, target: module, details } });
  }

  console.log(`Seed complete — ${SPECS.length} complaints across ${DEPARTMENTS.length} categories, ${ENGINEERS.length} engineers.`);
}

main().finally(() => db.$disconnect());
