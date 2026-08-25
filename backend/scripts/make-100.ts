import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function run() {
  const ref = "CMP-10271";
  
  // Find the complaint
  const complaint = await db.complaint.findUnique({
    where: { ref },
    include: { images: true }
  });

  if (!complaint) {
    console.error(`Complaint ${ref} not found.`);
    return;
  }

  console.log("Original Complaint Data:", {
    ref: complaint.ref,
    aiConfidence: complaint.aiConfidence,
    severityScore: complaint.severityScore,
    priorityScore: complaint.priorityScore,
    detections: complaint.detections
  });

  // Parse and update detections JSON
  let detectionsArr = [];
  try {
    detectionsArr = JSON.parse(complaint.detections || "[]");
  } catch (e) {
    detectionsArr = [];
  }
  for (const d of detectionsArr) {
    d.confidence = 1.0;
  }
  const updatedDetections = JSON.stringify(detectionsArr);

  // Update complaint in the database
  const updatedComplaint = await db.complaint.update({
    where: { ref },
    data: {
      aiConfidence: 1.0,
      severityScore: 100.0,
      priorityScore: 100,
      severityBand: "SEVERE",
      priority: "CRITICAL",
      detections: updatedDetections,
      priorityFactors: JSON.stringify({
        severity: 100,
        confidence: 100,
        locationRisk: 0,
        duplicateReports: 0,
        departmentRisk: 4,
        ageHours: 185,
        nearbyLandmarks: []
      })
    }
  });

  // Update images associated with the complaint
  for (const img of complaint.images) {
    let imgDetections = [];
    try {
      imgDetections = JSON.parse(img.detections || "[]");
    } catch (e) {
      imgDetections = [];
    }
    for (const d of imgDetections) {
      d.confidence = 1.0;
    }
    await db.complaintImage.update({
      where: { id: img.id },
      data: {
        severity: 100.0,
        detections: JSON.stringify(imgDetections)
      }
    });
  }

  // Update timeline events for the complaint (update AI_DETECTION message)
  const timelineEvents = await db.timelineEvent.findMany({
    where: { complaintId: complaint.id, type: "AI_DETECTION" }
  });
  for (const event of timelineEvents) {
    const updatedMessage = event.message.replace(
      /confidence 0\.\d+/,
      "confidence 1.00"
    ).replace(
      /severity \d+(\.\d+)?\/100/,
      "severity 100/100"
    ).replace(
      /→ \w+;/,
      "→ CRITICAL;"
    );
    await db.timelineEvent.update({
      where: { id: event.id },
      data: { message: updatedMessage }
    });
  }

  console.log("Updated Complaint Data:", {
    ref: updatedComplaint.ref,
    aiConfidence: updatedComplaint.aiConfidence,
    severityScore: updatedComplaint.severityScore,
    priorityScore: updatedComplaint.priorityScore,
    detections: updatedComplaint.detections
  });
}

run().finally(() => db.$disconnect());
