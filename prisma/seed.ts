import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

function daysAgo(n: number, hourJitter = true) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  if (hourJitter) d.setHours(Math.floor(Math.random() * 12) + 7, Math.floor(Math.random() * 60));
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  await db.timelineEvent.deleteMany();
  await db.complaint.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.asset.deleteMany();
  await db.citizen.deleteMany();
  await db.engineer.deleteMany();
  await db.user.deleteMany();
  await db.department.deleteMany();

  const deptData = [
    { code: "WTR", name: "Water Supply", description: "Water distribution, pipelines, and drainage infrastructure.", headName: "Meera Krishnan", budget: 48000000, budgetUsed: 31200000, slaTarget: 24 },
    { code: "RDS", name: "Roads & Infrastructure", description: "Road maintenance, potholes, footpaths, and bridges.", headName: "Arjun Mehta", budget: 92000000, budgetUsed: 61500000, slaTarget: 72 },
    { code: "ELC", name: "Electricity", description: "Street lighting, transformers, and electrical safety.", headName: "Sana Qureshi", budget: 55000000, budgetUsed: 27400000, slaTarget: 12 },
    { code: "SAN", name: "Sanitation", description: "Waste collection, public toilets, and cleanliness drives.", headName: "Ravi Shankar", budget: 38000000, budgetUsed: 29900000, slaTarget: 24 },
    { code: "PRK", name: "Parks & Recreation", description: "Public parks, playgrounds, and green cover maintenance.", headName: "Anita Desai", budget: 21000000, budgetUsed: 9800000, slaTarget: 96 },
    { code: "PWD", name: "Public Works", description: "Government buildings, signals, and civic construction.", headName: "Vikram Rao", budget: 67000000, budgetUsed: 44100000, slaTarget: 48 },
  ];
  const depts: Record<string, { id: string; name: string; slaTarget: number }> = {};
  for (const d of deptData) {
    const created = await db.department.create({ data: d });
    depts[d.code] = { id: created.id, name: d.name, slaTarget: d.slaTarget };
  }

  const users = [
    { email: "superadmin@lumen.gov", name: "Priya Nair", role: "SUPER_ADMIN" },
    { email: "admin@lumen.gov", name: "Rajesh Kumar", role: "ADMINISTRATOR" },
    { email: "commissioner@lumen.gov", name: "Dr. Kavitha Iyer", role: "COMMISSIONER" },
    { email: "manager@lumen.gov", name: "Meera Krishnan", role: "DEPARTMENT_MANAGER", departmentId: depts.WTR.id },
    { email: "supervisor@lumen.gov", name: "Suresh Pillai", role: "SUPERVISOR", departmentId: depts.WTR.id },
    { email: "engineer@lumen.gov", name: "Amit Sharma", role: "ENGINEER", departmentId: depts.WTR.id },
    { email: "analyst@lumen.gov", name: "Divya Menon", role: "ANALYST" },
    { email: "auditor@lumen.gov", name: "Joseph Thomas", role: "AUDITOR" },
  ];
  for (const u of users) {
    await db.user.create({ data: { ...u, password: "lumen123" } });
  }

  const engineerNames = [
    ["Amit Sharma", "WTR", "Pipelines,Valves"], ["Neha Gupta", "WTR", "Drainage,Pumps"],
    ["Karthik R", "RDS", "Asphalt,Potholes"], ["Farhan Ali", "RDS", "Bridges,Footpaths"],
    ["Lakshmi V", "ELC", "Streetlights,Wiring"], ["Rohit Verma", "ELC", "Transformers,Signals"],
    ["Deepa Nair", "SAN", "Waste,Drains"], ["Manoj Kumar", "SAN", "Toilets,Collection"],
    ["Asha Patel", "PRK", "Landscaping,Irrigation"], ["Sunil Yadav", "PWD", "Masonry,Signals"],
    ["Rekha Singh", "PWD", "Buildings,Painting"], ["Ibrahim K", "RDS", "Potholes,Marking"],
  ];
  const engineers: { id: string; name: string; dept: string }[] = [];
  for (let i = 0; i < engineerNames.length; i++) {
    const [name, deptCode, skills] = engineerNames[i];
    const e = await db.engineer.create({
      data: {
        code: `ENG-${1001 + i}`,
        name,
        email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@lumen.gov`,
        phone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
        zone: ZONES[i % ZONES.length],
        skills,
        status: pick(["AVAILABLE", "AVAILABLE", "ON_TASK", "OFF_DUTY"]),
        lat: 12.9 + Math.random() * 0.2,
        lng: 77.5 + Math.random() * 0.2,
        rating: Math.round((3.4 + Math.random() * 1.6) * 10) / 10,
        resolvedJobs: Math.floor(20 + Math.random() * 180),
        departmentId: depts[deptCode].id,
      },
    });
    engineers.push({ id: e.id, name, dept: deptCode });
  }

  const citizenNames = ["Ananya Rao", "Bharat Joshi", "Chitra Devi", "David Fernandes", "Esha Kapoor", "Ganesh Murthy", "Hina Sheikh", "Irfan Pasha", "Jaya Lakshmi", "Kiran Kumar", "Latha Reddy", "Mohan Das"];
  const citizens: { id: string; name: string }[] = [];
  for (let i = 0; i < citizenNames.length; i++) {
    const c = await db.citizen.create({
      data: {
        code: `CTZ-${2001 + i}`,
        name: citizenNames[i],
        email: `${citizenNames[i].toLowerCase().replace(/[^a-z]/g, ".")}@gmail.com`,
        phone: `+91 97${Math.floor(10000000 + Math.random() * 89999999)}`,
        zone: ZONES[i % ZONES.length],
        verified: i % 5 !== 4,
        status: i === 11 ? "SUSPENDED" : "ACTIVE",
        joinedAt: daysAgo(100 + i * 15),
      },
    });
    citizens.push({ id: c.id, name: citizenNames[i] });
  }

  const assetDefs: [string, string, string][] = [
    ["MG Road Stretch 4", "ROADS", "RDS"], ["Ring Road Junction 12", "ROADS", "RDS"],
    ["Main Feeder Pipe NZ-3", "PIPES", "WTR"], ["Drainage Line SZ-7", "PIPES", "WTR"],
    ["Streetlight Cluster E-44", "STREETLIGHTS", "ELC"], ["Streetlight Cluster W-12", "STREETLIGHTS", "ELC"],
    ["Ward Office Building 9", "BUILDINGS", "PWD"], ["Community Hall Central", "BUILDINGS", "PWD"],
    ["Traffic Signal TS-118", "SIGNALS", "PWD"], ["Traffic Signal TS-042", "SIGNALS", "PWD"],
    ["Garbage Compactor GC-7", "VEHICLES", "SAN"], ["Water Tanker WT-3", "VEHICLES", "WTR"],
    ["Silver Jubilee Bridge", "BRIDGES", "RDS"], ["Canal Crossing Bridge", "BRIDGES", "RDS"],
    ["City Park Irrigation Grid", "PIPES", "PRK"], ["Lake View Park Lighting", "STREETLIGHTS", "PRK"],
  ];
  for (let i = 0; i < assetDefs.length; i++) {
    const [name, category, deptCode] = assetDefs[i];
    await db.asset.create({
      data: {
        code: `AST-${88001 + i}`,
        name,
        category,
        zone: ZONES[i % ZONES.length],
        condition: pick(["GOOD", "GOOD", "FAIR", "FAIR", "POOR", "CRITICAL"]),
        lat: 12.9 + Math.random() * 0.2,
        lng: 77.5 + Math.random() * 0.2,
        installedAt: daysAgo(400 + Math.floor(Math.random() * 2000)),
        lastMaintenance: daysAgo(Math.floor(Math.random() * 180)),
        departmentId: depts[deptCode].id,
      },
    });
  }

  const complaintDefs: [string, string, string, string][] = [
    // title, category, subcategory, deptCode
    ["Large pothole causing accidents near MG Road signal", "Roads", "Pothole", "RDS"],
    ["Burst water pipe flooding 4th Cross street", "Water Supply", "Pipe Burst", "WTR"],
    ["Street lights out for 3 days on Lake View Road", "Electricity", "Street Light Outage", "ELC"],
    ["Garbage not collected for a week in Jayanagar block", "Sanitation", "Missed Collection", "SAN"],
    ["Broken swing and unsafe equipment in City Park", "Parks", "Damaged Equipment", "PRK"],
    ["Traffic signal stuck on red at Ring Road junction", "Public Works", "Signal Malfunction", "PWD"],
    ["Sewage overflow near primary school", "Water Supply", "Drainage Overflow", "WTR"],
    ["Road caved in after heavy rain on 9th Main", "Roads", "Road Collapse", "RDS"],
    ["Sparking transformer near residential block", "Electricity", "Transformer Fault", "ELC"],
    ["Public toilet unusable at Central Market", "Sanitation", "Facility Damage", "SAN"],
    ["Low water pressure across North Zone mornings", "Water Supply", "Low Pressure", "WTR"],
    ["Footpath tiles broken outside metro station", "Roads", "Footpath Damage", "RDS"],
    ["Streetlight pole leaning dangerously", "Electricity", "Pole Damage", "ELC"],
    ["Illegal dumping on vacant plot, foul smell", "Sanitation", "Illegal Dumping", "SAN"],
    ["Park gate lock broken, cattle entering", "Parks", "Security Issue", "PRK"],
    ["Water meter reading incorrect, billing dispute", "Water Supply", "Metering", "WTR"],
    ["Zebra crossing paint completely faded", "Roads", "Road Marking", "RDS"],
    ["Frequent power fluctuation in East Zone", "Electricity", "Supply Fluctuation", "ELC"],
    ["Open manhole without cover on service road", "Water Supply", "Open Manhole", "WTR"],
    ["Storm drain clogged before monsoon", "Sanitation", "Clogged Drain", "SAN"],
  ];

  const statuses = [
    "SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "ASSIGNED", "IN_PROGRESS", "IN_PROGRESS",
    "PENDING_REVIEW", "ESCALATED", "CLOSED", "CLOSED", "CLOSED", "CLOSED",
    "CLOSED", "REOPENED", "REJECTED", "CLOSED", "IN_PROGRESS", "CLOSED", "ESCALATED", "UNDER_REVIEW",
  ];
  const priorities = ["MEDIUM", "CRITICAL", "HIGH", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL", "CRITICAL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "HIGH", "MEDIUM", "LOW", "LOW", "LOW", "MEDIUM", "CRITICAL", "HIGH"];

  let seq = 10245;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < complaintDefs.length; i++) {
      const [title, category, subcategory, deptCode] = complaintDefs[i];
      const status = round === 0 ? statuses[i] : pick(["CLOSED", "CLOSED", "CLOSED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED"]);
      const priority = round === 0 ? priorities[i] : pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "CRITICAL"]);
      const createdAt = daysAgo(round === 0 ? Math.floor(Math.random() * 14) : 14 + Math.floor(Math.random() * 46));
      const needsEngineer = !["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(status);
      const eligible = engineers.filter((e) => e.dept === deptCode);
      const eng = needsEngineer ? pick(eligible) : null;
      const citizen = pick(citizens);
      const closed = status === "CLOSED";
      const zone = pick(ZONES);

      const c = await db.complaint.create({
        data: {
          ref: `CMP-${seq++}`,
          title: round === 0 ? title : `${title.split(" ").slice(0, 4).join(" ")} — ${zone}`,
          description: `Reported via citizen mobile app: ${title}. Location verified by field inspection. ${priority === "CRITICAL" ? "Immediate attention required — public safety risk." : "Standard processing per department SLA."}`,
          category,
          subcategory,
          priority,
          status,
          zone,
          address: `${Math.floor(1 + Math.random() * 120)}th Main, ${zone}`,
          lat: 12.9 + Math.random() * 0.2,
          lng: 77.5 + Math.random() * 0.2,
          slaHours: depts[deptCode].slaTarget,
          source: Math.random() > 0.25 ? "CITIZEN_APP" : "MANUAL",
          rating: closed ? Math.floor(2 + Math.random() * 4) : null,
          createdAt,
          closedAt: closed ? new Date(createdAt.getTime() + (4 + Math.random() * 90) * 3600 * 1000) : null,
          departmentId: depts[deptCode].id,
          engineerId: eng?.id ?? null,
          citizenId: citizen.id,
        },
      });

      const events: { type: string; message: string; actor: string; offset: number }[] = [
        { type: "CREATED", message: `Complaint submitted via ${Math.random() > 0.25 ? "Citizen Mobile App" : "manual intake"} by ${citizen.name}`, actor: "System", offset: 0 },
      ];
      if (status !== "SUBMITTED") events.push({ type: "STATUS_CHANGE", message: "AI classification complete — moved to Under Review", actor: "AI Classifier", offset: 1 });
      if (eng) events.push({ type: "ASSIGNMENT", message: `Assigned to ${eng.name} (auto-assignment: lowest workload in zone)`, actor: "Meera Krishnan", offset: 3 });
      if (["IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "REOPENED"].includes(status)) events.push({ type: "STATUS_CHANGE", message: "Engineer on site — work started", actor: eng?.name ?? "Engineer", offset: 8 });
      if (status === "ESCALATED") events.push({ type: "ESCALATION", message: "SLA breached — auto-escalated, priority raised", actor: "SLA Monitor", offset: 10 });
      if (["PENDING_REVIEW", "CLOSED", "REOPENED"].includes(status)) events.push({ type: "STATUS_CHANGE", message: "Work complete, after-photos uploaded — pending supervisor review", actor: eng?.name ?? "Engineer", offset: 20 });
      if (closed || status === "REOPENED") events.push({ type: "STATUS_CHANGE", message: "Closure approved by supervisor after evidence review", actor: "Suresh Pillai", offset: 26 });
      if (status === "REOPENED") events.push({ type: "STATUS_CHANGE", message: "Citizen disputed resolution within reopen window — reopened", actor: "System", offset: 40 });
      if (status === "REJECTED") events.push({ type: "STATUS_CHANGE", message: "Rejected: duplicate of an existing complaint (AI duplicate detection, 94% match)", actor: "Suresh Pillai", offset: 5 });

      for (const ev of events) {
        await db.timelineEvent.create({
          data: {
            complaintId: c.id,
            type: ev.type,
            message: ev.message,
            actor: ev.actor,
            createdAt: new Date(createdAt.getTime() + ev.offset * 3600 * 1000),
          },
        });
      }
    }
  }

  const auditSamples: [string, string, string, string, string][] = [
    ["Rajesh Kumar", "ADMINISTRATOR", "USER_INVITED", "Settings", "Invited supervisor2@lumen.gov as Supervisor (Water Supply)"],
    ["Meera Krishnan", "DEPARTMENT_MANAGER", "COMPLAINT_ASSIGNED", "Complaints", "CMP-10246 assigned to Neha Gupta"],
    ["Suresh Pillai", "SUPERVISOR", "CLOSURE_APPROVED", "Complaints", "CMP-10253 closure approved after evidence review"],
    ["Rajesh Kumar", "ADMINISTRATOR", "ROLE_PERMISSION_OVERRIDE", "Settings", "Granted reports:export to Suresh Pillai for Q2 audit"],
    ["Priya Nair", "SUPER_ADMIN", "BREAK_GLASS_ELEVATION", "Security", "Support elevation approved for org: lumen-city (2h window)"],
    ["Joseph Thomas", "AUDITOR", "AUDIT_EXPORT", "Audit Logs", "Exported Q2 complaint closure audit trail (CSV)"],
    ["Dr. Kavitha Iyer", "COMMISSIONER", "REPORT_VIEWED", "Reports", "Viewed city-wide SLA compliance report"],
    ["System", "SYSTEM", "SLA_AUTO_ESCALATION", "Complaints", "CMP-10263 auto-escalated: resolution SLA breached"],
    ["Meera Krishnan", "DEPARTMENT_MANAGER", "LIVE_TRACKING_ACCESSED", "GIS", "Accessed live engineer tracking layer (audited access)"],
    ["Rajesh Kumar", "ADMINISTRATOR", "SETTINGS_UPDATED", "Settings", "Complaint reopen window changed 7d → 10d"],
  ];
  for (let i = 0; i < auditSamples.length; i++) {
    const [actor, actorRole, action, module, details] = auditSamples[i];
    await db.auditLog.create({
      data: { actor, actorRole, action, module, target: module, details, ip: `10.14.2.${20 + i}`, createdAt: daysAgo(Math.floor(i * 1.5)) },
    });
  }

  const notifs: [string, string, string, string][] = [
    ["ALL", "Scheduled maintenance window", "Platform maintenance on Sunday 02:00–04:00 IST. No downtime expected.", "INFO"],
    ["DEPARTMENT_MANAGER", "SLA breach: CMP-10263", "Open manhole complaint breached its 24h resolution SLA and was auto-escalated.", "CRITICAL"],
    ["SUPERVISOR", "3 complaints pending review", "Three completed jobs are waiting for closure approval in Water Supply.", "WARNING"],
    ["ENGINEER", "New assignment: CMP-10246", "Burst water pipe on 4th Cross — Critical priority, 24h SLA.", "WARNING"],
    ["ALL", "Monsoon preparedness drive", "Commissioner has mandated drain-clearing inspections across all zones before June 30.", "INFO"],
    ["ANALYST", "Weekly analytics digest ready", "City-wide MTTR improved 12% week-over-week. Full report available.", "SUCCESS"],
  ];
  for (const [role, title, body, kind] of notifs) {
    await db.notification.create({ data: { role, title, body, kind } });
  }

  console.log("Seed complete.");
}

main().finally(() => db.$disconnect());
