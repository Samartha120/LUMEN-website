import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'lumen-super-secret-key-for-jwt';

const prisma = new PrismaClient();
// Wait, the client might require passing the url, but let's check. 
// We will just patch this when running if needed.

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

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
app.post('/api/complaints', async (req, res) => {
  // Mobile app simulation
  const { title, description, category, severity, confidence, latitude, longitude, address, ward, zone, city } = req.body;
  
  const count = await prisma.complaint.count();
  const trackingId = `LUM-${10000 + count + 1}`;
  
  // Basic priority logic based on severity
  let priority = 'LOW';
  if (severity) {
    if (severity > 80) priority = 'CRITICAL';
    else if (severity > 50) priority = 'HIGH';
    else if (severity > 20) priority = 'MEDIUM';
  }

  const complaint = await prisma.complaint.create({
    data: {
      trackingId,
      title,
      description,
      category,
      severity,
      confidence,
      priority,
      status: 'NEW',
      latitude,
      longitude,
      address,
      ward,
      zone,
      city
    }
  });
  
  res.status(201).json(complaint);
});

app.get('/api/complaints', requireAuth, async (req: any, res) => {
  const complaints = await prisma.complaint.findMany({
    include: {
      department: true,
      dispatchRecords: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Format for frontend
  const formatted = complaints.map(c => ({
    ...c,
    reporter: null // Citizen mapping later
  }));
  
  res.json({ complaints: formatted });
});

app.get('/api/complaints/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { department: true, dispatchRecords: true }
  });
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  res.json({ complaint });
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
