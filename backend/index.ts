import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
// Samartha's legacy backend. It is built against its own schema
// (trackingId / latitude / DispatchRecord), so it uses its own generated
// client and its own database file — the main API in src/ is untouched.
import { PrismaClient } from './node_modules/.prisma/client-legacy/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// @ts-ignore
import computeMunkres from 'munkres-js';

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = Number(process.env.LEGACY_PORT ?? 4001);
const JWT_SECRET = process.env.JWT_SECRET || 'lumen-super-secret-key-for-jwt';

const prisma = new PrismaClient();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Auth middleware
const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = (req: any, res: any, next: any) => {
  const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {}
  }
  next();
};

// --- HEALTH / AI PROXY ---
app.get('/api/health', async (req, res) => {
  try {
    const response = await axios.get('http://localhost:8100/health');
    res.json({ ai: response.data });
  } catch (err) {
    res.json({ ai: null });
  }
});

// --- AUTH ROUTES ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.fullName,
    role: user.role,
    departmentId: user.departmentId
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
  res.cookie('access_token', token, { httpOnly: true, sameSite: 'strict' });
  res.json({ access_token: token, user: payload });
});

app.get('/api/auth/me', requireAuth, async (req: any, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ message: 'Logged out' });
});

// --- COMPLAINTS API ---
app.post('/api/complaints', optionalAuth, upload.single('photo'), async (req: any, res) => {
  const { title, description, category, severity, confidence, lat, lng, address, ward, zone, city } = req.body;
  const file = req.file;
  
  if (!file) return res.status(400).json({ error: 'Photo is required' });

  let damageClass = category || 'Unclassified';
  let aiSeverity = severity ? parseInt(severity) : null;
  let aiConfidence = confidence ? parseFloat(confidence) : null;
  let boundingBoxes = '[]';
  let metadata = null;
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path), file.originalname);
    const aiRes = await axios.post('http://localhost:8100/detect', formData, {
      headers: formData.getHeaders()
    });
    
    damageClass = aiRes.data.damageClass;
    aiSeverity = aiRes.data.severity;
    aiConfidence = aiRes.data.confidenceScore;
    boundingBoxes = JSON.stringify(aiRes.data.boundingBoxes);
    metadata = JSON.stringify(aiRes.data.metadata);
  } catch (err) {
    console.error('AI Service Error:', err);
  }
  
  const count = await prisma.complaint.count();
  const trackingId = `LUM-${10000 + count + 1}`;
  
  let priority = 'LOW';
  if (aiSeverity) {
    if (aiSeverity > 80) priority = 'CRITICAL';
    else if (aiSeverity > 50) priority = 'HIGH';
    else if (aiSeverity > 20) priority = 'MEDIUM';
  }

  // Automatic Routing to Department
  let assignedDeptName = 'Public Works';
  const lowerClass = damageClass.toLowerCase();
  if (lowerClass.includes('light') || lowerClass.includes('electric')) assignedDeptName = 'Electrical';
  else if (lowerClass.includes('water') || lowerClass.includes('pipe') || lowerClass.includes('leak') || lowerClass.includes('flood')) assignedDeptName = 'Water Supply';
  
  const dept = await prisma.department.findUnique({ where: { name: assignedDeptName } });

  const complaint = await prisma.complaint.create({
    data: {
      trackingId,
      title,
      description,
      category: damageClass,
      severity: aiSeverity,
      confidence: aiConfidence,
      priority,
      status: 'NEW',
      latitude: parseFloat(lat) || null,
      longitude: parseFloat(lng) || null,
      address,
      ward,
      zone,
      city,
      imageUrl: `/uploads/${file.filename}`,
      departmentId: dept?.id,
      reporterId: req.user?.sub || null,
      aiPrediction: {
        create: {
          damageClass,
          confidenceScore: aiConfidence || 0,
          boundingBoxes,
          metadata
        }
      },
      timeline: {
        create: {
          status: 'NEW',
          notes: 'Complaint submitted and routed to ' + assignedDeptName
        }
      }
    }
  });
  
  res.status(201).json({ ref: complaint.id });
});

app.get('/api/complaints', requireAuth, async (req: any, res) => {
  const complaints = await prisma.complaint.findMany({
    include: {
      department: true,
      dispatchRecords: true,
      reporter: { select: { fullName: true, email: true } },
      timeline: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ complaints });
});

app.get('/api/complaints/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { 
      department: true, 
      dispatchRecords: true,
      aiPrediction: true,
      reporter: { select: { fullName: true, email: true } },
      timeline: { orderBy: { createdAt: 'asc' } }
    }
  });
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  
  if (complaint.aiPrediction) {
    try {
      complaint.aiPrediction.boundingBoxes = JSON.parse(complaint.aiPrediction.boundingBoxes);
      complaint.aiPrediction.metadata = JSON.parse(complaint.aiPrediction.metadata || '{}');
    } catch (e) {}
  }
  res.json(complaint);
});

app.patch('/api/v1/admin/complaints/:id/status', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  const complaint = await prisma.complaint.findUnique({ where: { id } });
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  
  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      status,
      timeline: {
        create: {
          status,
          notes: notes || `Status updated to ${status}`
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      action: `Changed status to ${status}`,
      entityType: `Complaint (${updated.trackingId})`,
      userId: req.user.sub
    }
  });

  res.json(updated);
});

// --- GIS ---
app.get('/api/gis', requireAuth, async (req: any, res) => {
  const complaintsData = await prisma.complaint.findMany({
    where: { status: { not: 'CLOSED' }, latitude: { not: null }, longitude: { not: null } }
  });

  const complaints = complaintsData.map(c => {
    const sev = c.severity || 0;
    let band = 'NONE';
    if (sev >= 60) band = 'SEVERE';
    else if (sev >= 40) band = 'SIGNIFICANT';
    else if (sev >= 20) band = 'MODERATE';
    else if (sev > 0) band = 'MINOR';
    return { id: c.id, lat: c.latitude, lng: c.longitude, severityScore: c.severity, severityBand: band };
  });

  const engineersData = await prisma.user.findMany({
    where: { role: 'ENGINEER', latitude: { not: null }, longitude: { not: null } }
  });

  const engineers = engineersData.map(e => ({
    id: e.id,
    code: e.employeeCode || `E-${e.id.substring(0, 4)}`,
    lat: e.latitude,
    lng: e.longitude
  }));

  res.json({ complaints, engineers });
});

// --- ENGINEERS ---
app.get('/api/engineers', requireAuth, async (req, res) => {
  const engineersData = await prisma.user.findMany({
    where: { role: 'ENGINEER' },
    include: { 
      department: true,
      assignedComplaints: { where: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } }
    }
  });

  const engineers = engineersData.map(e => ({
    id: e.id,
    code: e.employeeCode || `E-${e.id.substring(0, 4)}`,
    name: e.fullName,
    status: e.status,
    skills: e.skills || '',
    lat: e.latitude || 12.9,
    lng: e.longitude || 77.5,
    resolvedJobs: e.resolvedJobs,
    department: e.department ? { name: e.department.name } : { name: 'Unassigned' },
    complaints: e.assignedComplaints.map(c => ({ id: c.id }))
  }));

  res.json({ engineers });
});

// --- ASSIGNMENT ENGINE (HUNGARIAN ALG) ---
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function computeAssignmentPlan(complaints: any[], engineers: any[]) {
  if (complaints.length === 0 || engineers.length === 0) {
    return { assignments: [], unassigned: complaints, totalCost: 0, naiveTotalCost: 0, costImprovementPct: 0, totalDistanceKm: 0, naiveTotalDistanceKm: 0 };
  }

  const costMatrix: number[][] = [];
  const naiveAssignments: any[] = [];
  const assignments: any[] = [];
  
  let naiveCost = 0;
  let naiveDist = 0;
  let optCost = 0;
  let optDist = 0;

  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    const row = [];
    let bestEngIdx = -1;
    let minNaiveCost = Infinity;

    for (let j = 0; j < engineers.length; j++) {
      const e = engineers[j];
      let cost = 1000000;
      
      if (e.departmentId === c.departmentId && e.status !== 'OFF_DUTY') {
        const dist = getDistance(c.latitude || 0, c.longitude || 0, e.latitude || 0, e.longitude || 0);
        
        let isMatch = false;
        if (e.skills && c.category) {
          const cat = c.category.toLowerCase();
          const sk = e.skills.toLowerCase();
          if ((cat.includes('road') || cat.includes('pothole')) && (sk.includes('road') || sk.includes('pothole'))) isMatch = true;
          else if (cat.includes('light') && sk.includes('light')) isMatch = true;
          else if ((cat.includes('water') || cat.includes('pipe')) && (sk.includes('pipe') || sk.includes('water'))) isMatch = true;
        }
        
        let skillPenalty = isMatch ? 0 : 8;
        const severityRebate = 12 * ((c.severity || 0) / 100);
        const workloadPenalty = 3 * (e.assignedComplaints?.length || 0); // Active jobs penalty

        cost = dist + skillPenalty + workloadPenalty - severityRebate;
        cost = Math.max(0, cost);
        
        // Naive assignment (Greedy nearest/cheapest)
        // Ensure naive assignment does not reuse engineers if possible, but for naive cost we just sum best matches
        if (cost < minNaiveCost) {
          minNaiveCost = cost;
          bestEngIdx = j;
        }
      }
      row.push(cost);
    }
    costMatrix.push(row);
    
    if (bestEngIdx !== -1) {
      const e = engineers[bestEngIdx];
      const dist = getDistance(c.latitude || 0, c.longitude || 0, e.latitude || 0, e.longitude || 0);
      naiveCost += minNaiveCost;
      naiveDist += dist;
    }
  }

  // computeMunkres solves minimum weight matching
  const indices = computeMunkres(costMatrix);
  
  for (let i = 0; i < indices.length; i++) {
    const cIdx = indices[i][0];
    const eIdx = indices[i][1];
    const cost = costMatrix[cIdx][eIdx];
    
    if (cost < 1000000) {
      const c = complaints[cIdx];
      const e = engineers[eIdx];
      const dist = getDistance(c.latitude || 0, c.longitude || 0, e.latitude || 0, e.longitude || 0);
      
      let isMatch = false;
      if (e.skills && c.category) {
        const cat = c.category.toLowerCase();
        const sk = e.skills.toLowerCase();
        if ((cat.includes('road') || cat.includes('pothole')) && (sk.includes('road') || sk.includes('pothole'))) isMatch = true;
        else if (cat.includes('light') && sk.includes('light')) isMatch = true;
        else if ((cat.includes('water') || cat.includes('pipe')) && (sk.includes('pipe') || sk.includes('water'))) isMatch = true;
      }
      
      optCost += cost;
      optDist += dist;
      assignments.push({
        complaint: { id: c.id, ref: c.trackingId, category: c.category, severityScore: c.severity || 0 },
        engineer: { code: e.employeeCode || e.fullName, name: e.fullName, openJobs: e.assignedComplaints?.length || 0, id: e.id },
        distanceKm: Number(dist.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        skillMatch: isMatch
      });
    }
  }

  const unassigned = complaints.filter(c => !assignments.find(a => a.complaint.id === c.id));
  
  let costImprovementPct = 0;
  if (naiveCost > 0) {
    costImprovementPct = ((naiveCost - optCost) / naiveCost) * 100;
  }

  return {
    assignments,
    unassigned,
    totalCost: optCost,
    naiveTotalCost: naiveCost,
    costImprovementPct: Number(costImprovementPct.toFixed(1)),
    totalDistanceKm: Number(optDist.toFixed(1)),
    naiveTotalDistanceKm: Number(naiveDist.toFixed(1))
  };
}

app.get('/api/assignment', requireAuth, async (req: any, res) => {
  const complaints = await prisma.complaint.findMany({
    where: { status: 'NEW' }, // Unassigned complaints
    include: { department: true }
  });
  
  const engineers = await prisma.user.findMany({
    where: { role: 'ENGINEER' },
    include: { assignedComplaints: { where: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } } }
  });

  const result = computeAssignmentPlan(complaints, engineers);
  
  const titles: Record<string, { title: string, priority: string }> = {};
  complaints.forEach(c => { titles[c.id] = { title: c.title, priority: c.priority }; });
  
  res.json({ result, titles, engineerCount: engineers.length });
});

app.post('/api/assignment/apply', requireAuth, async (req: any, res) => {
  const complaints = await prisma.complaint.findMany({ where: { status: 'NEW' } });
  const engineers = await prisma.user.findMany({
    where: { role: 'ENGINEER' },
    include: { assignedComplaints: { where: { status: { notIn: ['RESOLVED', 'CLOSED', 'REJECTED'] } } } }
  });
  
  const plan = computeAssignmentPlan(complaints, engineers);
  
  for (const a of plan.assignments) {
    const c = await prisma.complaint.update({
      where: { id: a.complaint.id },
      data: {
        status: 'ASSIGNED',
        assignedToId: a.engineer.id,
        timeline: {
          create: {
            status: 'ASSIGNED',
            notes: `Auto-Assigned to Engineer ${a.engineer.code}`
          }
        },
        dispatchRecords: {
          create: {
            department: 'System Auto-Router'
          }
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        action: `System Optimiser Assigned to ${a.engineer.name}`,
        entityType: `Complaint (${c.trackingId})`,
        userId: req.user.sub
      }
    });
  }
  
  res.json({ success: true, applied: plan.assignments.length });
});

// Admin Dashboard stats
app.get('/api/v1/admin/dashboard', requireAuth, async (req, res) => {
  const [
    totalUsers,
    totalComplaints,
    usersByRoleRaw,
    complaintsByStatusRaw,
    recentAuditLogs
  ] = await Promise.all([
    prisma.user.count(),
    prisma.complaint.count(),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.complaint.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    })
  ]);

  res.json({
    totalUsers,
    totalComplaints,
    usersByRole: usersByRoleRaw,
    complaintsByStatus: complaintsByStatusRaw,
    recentAuditLogs
  });
});

app.get('/api/audit-logs', requireAuth, async (req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true }
  });
  
  const formattedLogs = logs.map(l => ({
    id: l.id,
    createdAt: l.createdAt,
    actor: l.user.fullName,
    actorRole: l.user.role,
    action: l.action,
    module: l.entityType,
    details: 'System generated compliant audit record.'
  }));

  res.json({ logs: formattedLogs });
});

app.listen(PORT, () => {
  console.log(`Legacy (Samartha) backend running on port ${PORT}`);
});
