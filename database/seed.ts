import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];
const DAMAGE = ["Pothole", "Alligator Crack", "Transverse Crack", "Longitudinal Crack"];

// Severity band -> priority, mirroring ai-service/model.py score_severity().
function bandFor(score: number) {
  if (score >= 60) return { band: "SEVERE", priority: "CRITICAL" };
  if (score >= 35) return { band: "SIGNIFICANT", priority: "HIGH" };
  if (score >= 15) return { band: "MODERATE", priority: "MEDIUM" };
  return { band: "MINOR", priority: "LOW" };
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000);
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

async function main() {
  await db.timelineEvent.deleteMany();
  await db.complaintImage.deleteMany();
  await db.complaint.deleteMany();
  await db.auditLog.deleteMany();
  await db.engineer.deleteMany();
  await db.user.deleteMany();
  await db.department.deleteMany();

  const roads = await db.department.create({
    data: { code: "RDS", name: "Roads & Infrastructure", slaTarget: 48 },
  });
  const pwd = await db.department.create({
    data: { code: "PWD", name: "Public Works", slaTarget: 72 },
  });

  await db.user.createMany({
    data: [
      { email: "admin@lumen.gov", password: "lumen123", name: "Rajesh Kumar", role: "ADMINISTRATOR" },
      { email: "supervisor@lumen.gov", password: "lumen123", name: "Meera Krishnan", role: "SUPERVISOR", departmentId: roads.id },
      { email: "engineer@lumen.gov", password: "lumen123", name: "Amit Sharma", role: "ENGINEER", departmentId: roads.id },
    ],
  });

  // Engineers spread across the city so the assignment optimiser has real
  // distance variation to work with.
  const engineerSpec: [string, string, string, string, number, number][] = [
    ["Amit Sharma", "RDS", "Pothole,Alligator Crack", "North Zone", 12.995, 77.58],
    ["Neha Gupta", "RDS", "Pothole,Transverse Crack", "South Zone", 12.915, 77.61],
    ["Karthik R", "RDS", "Longitudinal Crack,Transverse Crack", "East Zone", 12.96, 77.68],
    ["Farhan Ali", "RDS", "Pothole,Longitudinal Crack", "West Zone", 12.94, 77.52],
    ["Deepa Nair", "PWD", "Alligator Crack,Pothole", "Central Zone", 12.97, 77.6],
    ["Sunil Yadav", "PWD", "Transverse Crack,Alligator Crack", "North Zone", 13.01, 77.63],
  ];
  const engineers = [];
  for (let i = 0; i < engineerSpec.length; i++) {
    const [name, dept, skills, zone, lat, lng] = engineerSpec[i];
    engineers.push(
      await db.engineer.create({
        data: {
          code: `ENG-${1001 + i}`,
          name,
          phone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
          zone,
          skills,
          status: i % 4 === 3 ? "OFF_DUTY" : "AVAILABLE",
          lat,
          lng,
          resolvedJobs: Math.floor(20 + Math.random() * 120),
          departmentId: dept === "RDS" ? roads.id : pwd.id,
        },
      })
    );
  }

  const specs: [string, string, string, number, string, number][] = [
    // title, description, damage class, severity, status, hoursAgo
    ["Deep pothole outside Jayanagar 4th Block bus stop", "Large pothole in the left lane, two-wheelers swerving into traffic to avoid it.", "Pothole", 72.4, "SUBMITTED", 3],
    ["Pothole cluster near Ring Road service lane", "Several potholes forming after last week's rain, worsening daily.", "Pothole", 64.1, "ASSIGNED", 9],
    ["Alligator cracking on MG Road stretch 4", "Surface has broken into interconnected cracks across most of the lane width.", "Alligator Crack", 48.6, "IN_PROGRESS", 26],
    ["Transverse cracks near Silk Board flyover approach", "Cracks running across the carriageway, felt strongly by vehicles.", "Transverse Crack", 31.2, "PENDING_REVIEW", 40],
    ["Longitudinal crack along 9th Main", "Long crack tracking the lane marking for around thirty metres.", "Longitudinal Crack", 22.8, "CLOSED", 96],
    ["Pothole at Koramangala water tank junction", "Water collecting in the pothole making the depth hard to judge.", "Pothole", 58.3, "CLOSED", 120],
    ["Surface cracking outside government primary school", "Cracked and uneven surface where children cross every morning.", "Alligator Crack", 41.7, "ASSIGNED", 14],
    ["Minor cracking on residential cross street", "Hairline cracks, no immediate hazard but worth logging.", "Longitudinal Crack", 11.4, "SUBMITTED", 6],
  ];

  let seq = 10245;
  for (const [title, description, category, severity, status, ago] of specs) {
    const { band, priority } = bandFor(severity);
    const dept = category === "Pothole" || category === "Longitudinal Crack" ? roads : pwd;
    const eligible = engineers.filter(
      (e) => e.departmentId === dept.id && e.status !== "OFF_DUTY"
    );
    const needsEngineer = !["SUBMITTED"].includes(status);
    const eng = needsEngineer ? pick(eligible) : null;
    const createdAt = hoursAgo(ago);
    const closed = status === "CLOSED";

    const c = await db.complaint.create({
      data: {
        ref: `CMP-${seq++}`,
        title,
        description,
        zone: pick(ZONES),
        address: `${Math.floor(1 + Math.random() * 120)}th Main`,
        lat: 12.9 + Math.random() * 0.14,
        lng: 77.53 + Math.random() * 0.16,
        category,
        aiPredicted: true,
        aiConfidence: Math.round((0.72 + Math.random() * 0.25) * 100) / 100,
        aiModelMode: "TRAINED",
        detections: JSON.stringify([
          {
            label: category,
            confidence: Math.round((0.72 + Math.random() * 0.25) * 100) / 100,
            box: [120, 180, 430, 360],
            area_ratio: Math.round((severity / 100) * 0.3 * 1000) / 1000,
          },
        ]),
        severityScore: severity,
        severityBand: band,
        priority,
        slaHours: dept.slaTarget,
        status,
        createdAt,
        closedAt: closed ? new Date(createdAt.getTime() + 60 * 3600_000) : null,
        departmentId: dept.id,
        engineerId: eng?.id ?? null,
        assignMethod: eng ? "OPTIMISED" : null,
        assignDistance: eng ? Math.round(Math.random() * 60) / 10 : null,
        verifyVerdict: closed ? "VERIFIED" : null,
        verifyReason: closed ? "Damage severity reduced by 100%." : null,
        verifyReduction: closed ? 100 : null,
        verifySsim: closed ? 0.42 : null,
      },
    });

    const ev: [string, string, string, number][] = [
      ["CREATED", `Complaint submitted with photograph by citizen`, "Citizen App", 0],
      ["AI_DETECTION", `Detector identified ${category} (confidence ${(c.aiConfidence ?? 0).toFixed(2)}) — severity ${severity}/100 → ${priority} priority`, "AI Service", 0],
    ];
    if (eng) ev.push(["ASSIGNMENT", `Optimiser assigned ${eng.name} (${c.assignDistance} km away, skill match)`, "Assignment Optimiser", 1]);
    if (["IN_PROGRESS", "PENDING_REVIEW", "CLOSED"].includes(status)) ev.push(["STATUS_CHANGE", "Engineer began work on site", eng?.name ?? "Engineer", 4]);
    if (["PENDING_REVIEW", "CLOSED"].includes(status)) ev.push(["STATUS_CHANGE", "Repair complete, after-photograph uploaded", eng?.name ?? "Engineer", 10]);
    if (closed) {
      ev.push(["AI_VERIFICATION", "Repair verified — no damage detected in after-photograph", "AI Service", 11]);
      ev.push(["STATUS_CHANGE", "Closure approved by supervisor", "Meera Krishnan", 12]);
    }
    for (const [type, message, actor, off] of ev) {
      await db.timelineEvent.create({
        data: { complaintId: c.id, type, message, actor, createdAt: new Date(createdAt.getTime() + off * 3600_000) },
      });
    }
  }

  for (const [actor, actorRole, action, module, details] of [
    ["Meera Krishnan", "SUPERVISOR", "CLOSURE_APPROVED", "Complaints", "CMP-10249 closure approved after AI verification"],
    ["AI Service", "SYSTEM", "AI_DETECTION", "Complaints", "CMP-10245 classified as Pothole, severity 72.4"],
    ["Rajesh Kumar", "ADMINISTRATOR", "LOGIN_SUCCESS", "Authentication", "Administrator signed in"],
  ] as [string, string, string, string, string][]) {
    await db.auditLog.create({ data: { actor, actorRole, action, module, target: module, details } });
  }

  console.log("Seed complete — 8 complaints, 6 engineers, 2 departments, 3 users.");
}

main().finally(() => db.$disconnect());
