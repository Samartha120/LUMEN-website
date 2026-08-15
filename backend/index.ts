import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = 4000;
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
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
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
  const { title, description, category, severity, confidence, latitude, longitude, address, ward, zone, city } = req.body;
  const file = req.file;
  
  if (!file) return res.status(400).json({ error: 'Photo is required' });

  // 1. Call AI service
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
    const aiData = aiRes.data;
    
    damageClass = aiData.damageClass;
    aiSeverity = aiData.severity;
    aiConfidence = aiData.confidenceScore;
    boundingBoxes = JSON.stringify(aiData.boundingBoxes);
    metadata = JSON.stringify(aiData.metadata);
  } catch (err) {
    console.error('AI Service Error:', err);
  }
  
  const count = await prisma.complaint.count();
  const trackingId = `LUM-${10000 + count + 1}`;
  
  // Basic priority logic based on severity
  let priority = 'LOW';
  if (aiSeverity) {
    if (aiSeverity > 80) priority = 'CRITICAL';
    else if (aiSeverity > 50) priority = 'HIGH';
    else if (aiSeverity > 20) priority = 'MEDIUM';
  }

  const imageUrl = `/uploads/${file.filename}`;

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
      latitude: parseFloat(latitude) || null,
      longitude: parseFloat(longitude) || null,
      address,
      ward,
      zone,
      city,
      imageUrl,
      reporterId: req.user?.sub || null, // from optionalAuth
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
          notes: 'Complaint submitted'
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

  // Audit log
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
    where: { 
      status: { not: 'CLOSED' },
      latitude: { not: null },
      longitude: { not: null }
    }
  });

  const complaints = complaintsData.map(c => {
    const sev = c.severity || 0;
    let band = 'NONE';
    if (sev >= 60) band = 'SEVERE';
    else if (sev >= 40) band = 'SIGNIFICANT';
    else if (sev >= 20) band = 'MODERATE';
    else if (sev > 0) band = 'MINOR';
    
    return {
      id: c.id,
      lat: c.latitude,
      lng: c.longitude,
      severityScore: c.severity,
      severityBand: band
    };
  });

  const engineersData = await prisma.user.findMany({
    where: {
      role: 'ENGINEER',
      latitude: { not: null },
      longitude: { not: null }
    }
  });

  const engineers = engineersData.map(e => ({
    id: e.id,
    code: e.employeeCode || `E-${e.id.substring(0, 4)}`,
    lat: e.latitude,
    lng: e.longitude
  }));

  res.json({ complaints, engineers });
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

app.listen(PORT, () => {
  console.log(`Backend Express server running on port ${PORT}`);
});
