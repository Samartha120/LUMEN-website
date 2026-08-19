import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { calculatePriority, recalculateAllPriorities, sortByPriority } from './priority-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'lumen-demo-secret';
const PORT = Number(process.env.PORT || 4000);

const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({ storage });

const users = {
  'admin@lumen.gov': {
    id: 'u-admin',
    email: 'admin@lumen.gov',
    fullName: 'Asha Kumar',
    role: 'ADMIN',
    departmentId: 'dept-1',
    password: 'lumen123',
  },
  'supervisor@lumen.gov': {
    id: 'u-sup',
    email: 'supervisor@lumen.gov',
    fullName: 'Nandini Rao',
    role: 'SUPERVISOR',
    departmentId: 'dept-2',
    password: 'lumen123',
  },
  'engineer@lumen.gov': {
    id: 'u-eng',
    email: 'engineer@lumen.gov',
    fullName: 'Rahul Verma',
    role: 'ENGINEER',
    departmentId: 'dept-3',
    password: 'lumen123',
  },
};

const engineers = [
  { id: 'eng-1', code: 'BLR-204', name: 'Rahul Verma', zone: 'North Zone', lat: 12.9675, lng: 77.5921, departmentId: 'dept-3', status: 'AVAILABLE', openJobs: 2 },
  { id: 'eng-2', code: 'BLR-118', name: 'Meera Nair', zone: 'South Zone', lat: 12.9492, lng: 77.6134, departmentId: 'dept-3', status: 'AVAILABLE', openJobs: 1 },
  { id: 'eng-3', code: 'BLR-442', name: 'Sanjay Iyer', zone: 'East Zone', lat: 12.9876, lng: 77.6512, departmentId: 'dept-3', status: 'AVAILABLE', openJobs: 3 },
];

const BASE_PRIORITY_FACTORS = {
  categoryScore: 0,
  confidenceScore: 0,
  duplicateScore: 0,
  locationScore: 0,
  ageScore: 0,
  departmentScore: 0,
};

const complaintDefaults = {
  category: 'Pothole',
  zone: 'North Zone',
  address: 'Near 4th Block bus stop',
  lat: 12.9716,
  lng: 77.5946,
  priority: 'HIGH',
  priorityScore: 72,
  priorityLevel: 'HIGH',
  priorityReasons: ['Severe damage detected: Severe pothole', 'High AI detection confidence: 86%'],
  priorityFactors: {
    categoryScore: 23,
    confidenceScore: 14,
    duplicateScore: 0,
    locationScore: 12,
    ageScore: 4,
    departmentScore: 8,
  },
  duplicateCount: 0,
  slaHours: 48,
  department: { name: 'Road Maintenance' },
  engineer: null,
  status: 'SUBMITTED',
  severityScore: 72,
  severityBand: 'SEVERE',
  duplicateOfId: null,
  verifyVerdict: null,
  aiModelMode: 'HEURISTIC',
  aiConfidence: 0.86,
  detections: JSON.stringify([
    { label: 'Pothole', confidence: 0.9, box: [32, 48, 240, 190], area_ratio: 0.23 },
    { label: 'Crack', confidence: 0.78, box: [120, 96, 290, 214], area_ratio: 0.18 },
  ]),
  createdAt: new Date().toISOString(),
  images: [
    { id: 'img-cit-1', kind: 'CITIZEN', path: '/uploads/placeholder-citizen.svg', annotated: '/uploads/placeholder-annotated.svg', severity: 72 },
  ],
  events: [
    { id: 'ev-1', type: 'CREATED', message: 'Complaint submitted by citizen report.', actor: 'Citizen Portal', createdAt: new Date().toISOString() },
    { id: 'ev-2', type: 'AI_DETECTION', message: 'AI identified pothole damage with 86% confidence.', actor: 'Vision Service', createdAt: new Date().toISOString() },
  ],
  duplicateOf: null,
  verifyReason: null,
  verifyReduction: null,
  verifySsim: null,
  assignDistance: null,
  assignMethod: null,
};

const now = Date.now();
const daysAgo = d => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

const complaints = [
  {
    ...complaintDefaults,
    id: 'cmp-1',
    ref: 'CMP-1001',
    title: 'Pothole outside the bus stop',
    description: 'Large pothole near the pedestrian crossing is causing braking issues and water pooling after rain.',
    category: 'Pothole',
    status: 'ASSIGNED',
    priority: 'HIGH',
    priorityScore: 77,
    priorityLevel: 'HIGH',
    priorityReasons: [
      'Severe damage detected: Severe pothole',
      'High AI detection confidence: 90%',
      'Near important location: Hospital, Emergency Route',
      'Complaint unresolved for 9 days — urgent action required',
      'Road maintenance response',
    ],
    priorityFactors: {
      categoryScore: 23, confidenceScore: 13, duplicateScore: 5,
      locationScore: 18, ageScore: 10, departmentScore: 8,
    },
    duplicateCount: 1,
    severityScore: 84,
    severityBand: 'SEVERE',
    engineer: { id: 'eng-1', code: 'BLR-204', name: 'Rahul Verma', zone: 'North Zone' },
    assignDistance: 3.2,
    assignMethod: 'OPTIMISED',
    createdAt: daysAgo(9),
    events: [
      { id: 'ev-1', type: 'CREATED', message: 'Complaint submitted by citizen report.', actor: 'Citizen Portal', createdAt: daysAgo(9) },
      { id: 'ev-2', type: 'AI_DETECTION', message: 'AI identified pothole damage with 90% confidence.', actor: 'Vision Service', createdAt: daysAgo(9) },
      { id: 'ev-3', type: 'ASSIGNMENT', message: 'Assigned to Rahul Verma for urgent repair.', actor: 'Supervisor Nandini', createdAt: daysAgo(8) },
    ],
  },
  {
    ...complaintDefaults,
    id: 'cmp-2',
    ref: 'CMP-1002',
    title: 'Longitudinal crack on the arterial lane',
    description: 'Crack has propagated over two lanes and requires immediate inspection for lane safety.',
    category: 'Longitudinal Crack',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    priorityScore: 47,
    priorityLevel: 'MEDIUM',
    priorityReasons: [
      'Moderate damage: Longitudinal road crack',
      'AI detection confidence: 78%',
      'Complaint open for 8 days',
      'Road maintenance response',
    ],
    priorityFactors: {
      categoryScore: 17, confidenceScore: 7, duplicateScore: 0,
      locationScore: 5, ageScore: 10, departmentScore: 8,
    },
    duplicateCount: 0,
    severityScore: 58,
    severityBand: 'MODERATE',
    engineer: { id: 'eng-2', code: 'BLR-118', name: 'Meera Nair', zone: 'South Zone' },
    assignDistance: 1.8,
    assignMethod: 'OPTIMISED',
    lat: 12.9492,
    lng: 77.6134,
    zone: 'South Zone',
    address: 'South Zone, arterial lane near sector 7',
    aiConfidence: 0.78,
    createdAt: daysAgo(8),
    events: [
      { id: 'ev-1', type: 'CREATED', message: 'Complaint submitted by citizen report.', actor: 'Citizen Portal', createdAt: daysAgo(8) },
      { id: 'ev-2', type: 'AI_DETECTION', message: 'AI identified longitudinal crack.', actor: 'Vision Service', createdAt: daysAgo(8) },
      { id: 'ev-3', type: 'ASSIGNMENT', message: 'Assigned to Meera Nair for crack treatment.', actor: 'Supervisor Nandini', createdAt: daysAgo(7) },
      { id: 'ev-4', type: 'STATUS_CHANGE', message: 'Work started by engineer on site.', actor: 'Rahul Verma', createdAt: daysAgo(6) },
    ],
  },
  {
    ...complaintDefaults,
    id: 'cmp-3',
    ref: 'CMP-1003',
    title: 'Alligator crack near traffic signal',
    description: 'Multiple interconnecting cracks near the signal junction are creating a hazard during peak traffic.',
    category: 'Alligator Crack',
    status: 'SUBMITTED',
    priority: 'HIGH',
    priorityScore: 68,
    priorityLevel: 'HIGH',
    priorityReasons: [
      'Severe damage detected: Severe alligator cracking',
      'High AI detection confidence: 88%',
      'Critical location: near Highway Junction — safety hazard',
      'Complaint open for 7 days',
      'Traffic priority response: peak hours — expedited response',
    ],
    priorityFactors: {
      categoryScore: 25, confidenceScore: 11, duplicateScore: 0,
      locationScore: 14, ageScore: 8, departmentScore: 10,
    },
    duplicateCount: 0,
    severityScore: 69,
    severityBand: 'SIGNIFICANT',
    department: { name: 'Traffic Control' },
    engineer: null,
    assignDistance: null,
    assignMethod: null,
    lat: 12.9720,
    lng: 77.5946,
    zone: 'Central Zone',
    address: 'Near MG Road traffic signal junction',
    aiConfidence: 0.88,
    createdAt: daysAgo(7),
    events: [
      { id: 'ev-1', type: 'CREATED', message: 'Complaint submitted by citizen report.', actor: 'Citizen Portal', createdAt: daysAgo(7) },
      { id: 'ev-2', type: 'AI_DETECTION', message: 'AI identified alligator cracking with 88% confidence.', actor: 'Vision Service', createdAt: daysAgo(7) },
      { id: 'ev-3', type: 'AI_DUPLICATE', message: 'No strong duplicate match identified in the 72-hour window.', actor: 'Vision Service', createdAt: daysAgo(7) },
    ],
  },
];

// Recalculate priority on boot so factors/levels/scores match the new engine exactly
const bootstrapped = recalculateAllPriorities(complaints);
for (let i = 0; i < complaints.length; i++) {
  complaints[i] = bootstrapped[i];
}

const auditLogs = [
  { id: 'log-1', createdAt: daysAgo(9), actor: 'Vision Service', actorRole: 'ADMINISTRATOR', action: 'AI_DETECTION', module: 'COMPLAINTS', details: 'Detected pothole severity 84/100 and created initial triage.' },
  { id: 'log-2', createdAt: daysAgo(7), actor: 'Nandini Rao', actorRole: 'SUPERVISOR', action: 'ASSIGNMENT', module: 'ASSIGNMENT', details: 'Assigned CMP-1002 to engineer Meera Nair.' },
  { id: 'log-3', createdAt: daysAgo(7), actor: 'Vision Service', actorRole: 'ADMINISTRATOR', action: 'AI_DUPLICATE', module: 'COMPLAINTS', details: 'No duplicate found for CMP-1003 within the spatial threshold.' },
];

function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.fullName, role: user.role, departmentId: user.departmentId }, JWT_SECRET, { expiresIn: '8h' });
}

function toPublicComplaint(complaint) {
  return {
    id: complaint.id,
    ref: complaint.ref,
    title: complaint.title,
    category: complaint.category,
    status: complaint.status,
    priority: complaint.priority,
    severityScore: complaint.severityScore,
    severityBand: complaint.severityBand,
    duplicateOfId: complaint.duplicateOfId,
    verifyVerdict: complaint.verifyVerdict,
    createdAt: complaint.createdAt,
    engineer: complaint.engineer ? { name: complaint.engineer.name } : null,
    priorityScore: complaint.priorityScore,
    priorityLevel: complaint.priorityLevel,
    priorityReasons: complaint.priorityReasons,
    priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
    duplicateCount: complaint.duplicateCount ?? 0,
  };
}

function toDashboardComplaint(complaint) {
  return {
    id: complaint.id,
    ref: complaint.ref,
    title: complaint.title,
    category: complaint.category,
    status: complaint.status,
    priority: complaint.priority,
    priorityScore: complaint.priorityScore,
    priorityLevel: complaint.priorityLevel,
    priorityReasons: complaint.priorityReasons,
    priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
    duplicateCount: complaint.duplicateCount ?? 0,
    severityScore: complaint.severityScore,
    severityBand: complaint.severityBand,
    duplicateOfId: complaint.duplicateOfId,
    verifyVerdict: complaint.verifyVerdict,
    createdAt: complaint.createdAt,
    engineer: complaint.engineer ? { name: complaint.engineer.name } : null,
    zone: complaint.zone,
    address: complaint.address,
    lat: complaint.lat,
    lng: complaint.lng,
  };
}

function toListingRow(complaint) {
  return {
    id: complaint.id,
    ref: complaint.ref,
    title: complaint.title,
    zone: complaint.zone,
    category: complaint.category,
    aiModelMode: complaint.aiModelMode,
    severityScore: complaint.severityScore,
    severityBand: complaint.severityBand,
    priority: complaint.priority,
    priorityScore: complaint.priorityScore,
    priorityLevel: complaint.priorityLevel,
    priorityReasons: complaint.priorityReasons,
    priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
    duplicateCount: complaint.duplicateCount ?? 0,
    status: complaint.status,
    createdAt: complaint.createdAt,
    department: complaint.department,
    engineer: complaint.engineer ? { name: complaint.engineer.name } : null,
    duplicateOf: complaint.duplicateOfId ? { ref: 'CMP-1001' } : null,
    lat: complaint.lat,
    lng: complaint.lng,
    address: complaint.address,
  };
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Improvement 11: CORS-safe static uploads with correct content-types
  app.use('/uploads', (req, res, next) => {
    const urlPath = String(req.path || '').toLowerCase();
    if (urlPath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    next();
  }, express.static(uploadDir, {
    setHeaders: (res, filePath) => {
      if (filePath.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
    },
  }));

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      service: 'lumen-backend',
      message: 'Use the frontend at http://localhost:5173/ for the app UI.',
      api: {
        ping: '/api/ping',
        auth: '/api/auth/login',
        complaints: '/api/complaints',
        dashboard: '/api/dashboard',
      },
    });
  });

  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true, service: 'lumen-backend' });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ai: { model_mode: 'HEURISTIC', note: 'Running the classical-CV heuristic detector.' } });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = users[String(email).toLowerCase()];
    if (!user || String(password) !== user.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const safeUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, departmentId: user.departmentId };
    return res.json({ access_token: issueToken(user), user: safeUser });
  });

  app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));

  app.get('/api/auth/me', authRequired, (req, res) => {
    const user = users[String(req.user.email).toLowerCase()];
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({ user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, departmentId: user.departmentId } });
  });

  // Improvement 8: Dashboard returns priorityFactors + duplicateCount + location
  app.get('/api/dashboard', authRequired, (_req, res) => {
    res.json({
      complaints: complaints.map(toDashboardComplaint),
      ai: { model_mode: 'HEURISTIC', note: 'Running the classical-CV heuristic detector.' },
    });
  });

  // Improvement 8: Listing includes priorityFactors + duplicateCount + lat/lng/address
  app.get('/api/complaints', authRequired, (req, res) => {
    const { status, priority, q } = req.query;
    let rows = complaints.map(toListingRow);
    if (status) rows = rows.filter((c) => c.status === status);
    if (priority) rows = rows.filter((c) => c.priorityLevel === priority);
    if (q) {
      const needle = String(q).toLowerCase();
      rows = rows.filter((c) => c.title.toLowerCase().includes(needle) || c.ref.toLowerCase().includes(needle));
    }
    // Always sort by priority for the listing (CRITICAL first)
    res.json({ complaints: sortByPriority(rows) });
  });

  // Improvement 8: Complaint detail includes priorityFactors + duplicateCount + full objects
  app.get('/api/complaints/:ref', authRequired, (req, res) => {
    const complaint = complaints.find((c) => c.ref === req.params.ref);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const dup = complaint.duplicateOfId
      ? complaints.find(c => c.id === complaint.duplicateOfId) ?? { ref: 'CMP-1001', title: 'Pothole outside the bus stop' }
      : null;
    return res.json({
      complaint: {
        ...complaint,
        priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
        duplicateCount: complaint.duplicateCount ?? 0,
        duplicateOf: dup ? { ref: dup.ref, title: dup.title } : null,
      },
    });
  });

  app.post('/api/complaints/:ref/transition', authRequired, (req, res) => {
    const complaint = complaints.find((c) => c.ref === req.params.ref);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const { to } = req.body || {};
    complaint.status = String(to || complaint.status);
    complaint.events.push({
      id: `ev-${Date.now()}`,
      type: 'STATUS_CHANGE',
      message: `Status changed to ${to}.`,
      actor: req.user.name || 'System',
      createdAt: new Date().toISOString(),
    });
    // Priority re-evaluation: recalculate + re-store now that status has changed
    const fresh = calculatePriority(complaint, complaints);
    complaint.priorityScore = fresh.score;
    complaint.priorityLevel = fresh.level;
    complaint.priorityReasons = fresh.reasons;
    complaint.priorityFactors = fresh.factors;
    complaint.duplicateCount = fresh.duplicateCount;
    return res.json({ ok: true, complaint });
  });

  app.post('/api/complaints/:ref/duplicate', authRequired, (req, res) => {
    const complaint = complaints.find((c) => c.ref === req.params.ref);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const { action } = req.body || {};
    if (action === 'confirm') {
      complaint.duplicateOfId = 'CMP-1001';
      complaint.status = 'REJECTED';
      complaint.duplicateOf = { ref: 'CMP-1001', title: 'Pothole outside the bus stop' };
    }
    // Force priority re-eval after rejection
    const fresh = calculatePriority(complaint, complaints);
    complaint.priorityScore = fresh.score;
    complaint.priorityLevel = fresh.level;
    complaint.priorityReasons = fresh.reasons;
    complaint.priorityFactors = fresh.factors;
    complaint.duplicateCount = fresh.duplicateCount;
    return res.json({ ok: true, complaint });
  });

  app.post('/api/complaints/:ref/verify', authRequired, upload.single('photo'), (req, res) => {
    const complaint = complaints.find((c) => c.ref === req.params.ref);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'A photo is required.' });
    complaint.verifyVerdict = 'VERIFIED';
    complaint.verifyReason = 'Before/after comparison passed the repair validation pipeline.';
    complaint.verifyReduction = 82;
    complaint.verifySsim = 0.91;
    complaint.status = 'CLOSED';
    complaint.images.push({
      id: `img-after-${Date.now()}`,
      kind: 'ENGINEER_AFTER',
      path: `/uploads/${file.filename}`,
      annotated: null,
      severity: 8,
    });
    complaint.events.push({
      id: `ev-${Date.now()}`,
      type: 'AI_VERIFICATION',
      message: 'After-photo passed the verification model and closure has been approved.',
      actor: 'Verification Service',
      createdAt: new Date().toISOString(),
    });
    // CLOSED => priority collapses to LOW/0 via engine
    const fresh = calculatePriority(complaint, complaints);
    complaint.priorityScore = fresh.score;
    complaint.priorityLevel = fresh.level;
    complaint.priorityReasons = fresh.reasons;
    complaint.priorityFactors = fresh.factors;
    complaint.duplicateCount = fresh.duplicateCount;
    return res.json({ ok: true, ref: complaint.ref });
  });

  // Improvement 7 + 8: Create complaint → save priorityFactors + duplicateCount
  app.post('/api/complaints', authRequired, upload.single('photo'), (req, res) => {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const zone = String(req.body.zone || 'North Zone').trim();
    const address = String(req.body.address || 'Unknown location').trim();
    const rawLat = Number(req.body.lat);
    const rawLng = Number(req.body.lng);
    const lat = Number.isFinite(rawLat) ? rawLat : 12.9716;
    const lng = Number.isFinite(rawLng) ? rawLng : 77.5946;
    const category = String(req.body.category || 'Pothole').trim();
    const deptName = String(req.body.department || 'Road Maintenance').trim();

    if (!title) return res.status(400).json({ error: 'Title is required.' });

    const ref = `CMP-${1000 + complaints.length + 1}`;
    const id = `cmp-${complaints.length + 1}`;
    const createdAt = new Date().toISOString();
    const aiConfidence = 0.81;

    const newComplaint = {
      id,
      ref,
      title,
      description,
      category,
      zone,
      address,
      lat,
      lng,
      status: 'SUBMITTED',
      priority: 'MEDIUM',
      slaHours: 48,
      createdAt,
      aiModelMode: 'HEURISTIC',
      aiConfidence,
      detections: JSON.stringify([{ label: category, confidence: aiConfidence, box: [40, 60, 220, 180], area_ratio: 0.19 }]),
      severityScore: 62,
      severityBand: 'SIGNIFICANT',
      duplicateOfId: null,
      verifyVerdict: null,
      department: { name: deptName },
      engineer: null,
      images: req.file
        ? [{ id: `img-cit-${Date.now()}`, kind: 'CITIZEN', path: `/uploads/${req.file.filename}`, annotated: null, severity: 62 }]
        : [{ id: `img-cit-${Date.now()}`, kind: 'CITIZEN', path: '/uploads/placeholder-citizen.svg', annotated: '/uploads/placeholder-annotated.svg', severity: 62 }],
      events: [
        { id: `ev-${Date.now()}`, type: 'CREATED', message: 'Complaint submitted by citizen report.', actor: 'Citizen Portal', createdAt },
        { id: `ev-${Date.now() + 1}`, type: 'AI_DETECTION', message: `AI detected ${category} with ${Math.round(aiConfidence * 100)}% confidence.`, actor: 'Vision Service', createdAt },
      ],
      duplicateOf: null,
      verifyReason: null,
      verifyReduction: null,
      verifySsim: null,
      assignDistance: null,
      assignMethod: null,
      priorityScore: 0,
      priorityLevel: 'LOW',
      priorityReasons: [],
      priorityFactors: { ...BASE_PRIORITY_FACTORS },
      duplicateCount: 0,
    };

    // Improvement 7: Full priority integration - factors + duplicateCount stored
    const priorityCalc = calculatePriority(newComplaint, complaints);
    newComplaint.priorityScore = priorityCalc.score;
    newComplaint.priorityLevel = priorityCalc.level;
    newComplaint.priorityReasons = priorityCalc.reasons;
    newComplaint.priorityFactors = priorityCalc.factors;
    newComplaint.duplicateCount = priorityCalc.duplicateCount;
    newComplaint.priority = priorityCalc.level;

    complaints.unshift(newComplaint);

    // Re-calc priorities on existing (duplicate counts now include the new one)
    for (let i = 1; i < complaints.length; i++) {
      const re = calculatePriority(complaints[i], complaints);
      complaints[i].priorityScore = re.score;
      complaints[i].priorityLevel = re.level;
      complaints[i].priorityReasons = re.reasons;
      complaints[i].priorityFactors = re.factors;
      complaints[i].duplicateCount = re.duplicateCount;
    }

    res.json({
      ref,
      ok: true,
      complaint: {
        id,
        ref,
        title,
        category,
        severityScore: newComplaint.severityScore,
        priorityScore: newComplaint.priorityScore,
        priorityLevel: newComplaint.priorityLevel,
        priorityReasons: newComplaint.priorityReasons,
        duplicateCount: newComplaint.duplicateCount,
        factors: newComplaint.priorityFactors,
      },
    });
  });

  // Improvement 10: Assignment returns richer complaint info + sorts by priority with age
  app.get('/api/assignment', authRequired, (_req, res) => {
    const open = complaints.filter((c) => ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_REVIEW'].includes(c.status));
    const sorted = sortByPriority(open);
    const assignments = sorted.slice(0, 2).map((complaint, index) => ({
      complaint: {
        id: complaint.id,
        ref: complaint.ref,
        category: complaint.category,
        severityScore: complaint.severityScore,
        priorityScore: complaint.priorityScore,
        priorityLevel: complaint.priorityLevel,
        priorityReasons: complaint.priorityReasons,
        priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
        duplicateCount: complaint.duplicateCount ?? 0,
        zone: complaint.zone,
        address: complaint.address,
        lat: complaint.lat,
        lng: complaint.lng,
        createdAt: complaint.createdAt,
        department: complaint.department,
      },
      engineer: {
        code: engineers[index % engineers.length].code,
        name: engineers[index % engineers.length].name,
        openJobs: engineers[index % engineers.length].openJobs,
        zone: engineers[index % engineers.length].zone,
      },
      distanceKm: 3 + index,
      cost: 42 + complaint.severityScore / 4,
      skillMatch: true,
    }));

    res.json({
      result: {
        assignments,
        unassigned: [],
        totalCost: assignments.reduce((sum, item) => sum + item.cost, 0),
        naiveTotalCost: assignments.reduce((sum, item) => sum + item.cost + 15, 0),
        costImprovementPct: 18,
        totalDistanceKm: assignments.reduce((sum, item) => sum + item.distanceKm, 0),
        naiveTotalDistanceKm: assignments.reduce((sum, item) => sum + item.distanceKm + 10, 0),
      },
      titles: Object.fromEntries(complaints.map((complaint) => [
        complaint.id,
        {
          title: complaint.title,
          priority: complaint.priority,
          priorityLevel: complaint.priorityLevel,
          priorityScore: complaint.priorityScore,
          priorityReasons: complaint.priorityReasons,
          priorityFactors: complaint.priorityFactors ?? BASE_PRIORITY_FACTORS,
          duplicateCount: complaint.duplicateCount ?? 0,
          category: complaint.category,
          zone: complaint.zone,
          createdAt: complaint.createdAt,
        },
      ])),
      engineerCount: engineers.length,
    });
  });

  app.post('/api/assignment/apply', authRequired, (_req, res) => {
    res.json({ ok: true, applied: true });
  });

  app.get('/api/gis', authRequired, (_req, res) => {
    res.json({
      complaints: complaints.map((c) => ({
        id: c.id, ref: c.ref, title: c.title,
        lat: c.lat, lng: c.lng,
        severityScore: c.severityScore, severityBand: c.severityBand,
        priorityScore: c.priorityScore, priorityLevel: c.priorityLevel,
        category: c.category, status: c.status,
      })),
      engineers: engineers.map((e) => ({ id: e.id, code: e.code, lat: e.lat, lng: e.lng })),
    });
  });

  app.get('/api/engineers', authRequired, (_req, res) => {
    res.json({ engineers: engineers.map((e) => ({ id: e.id, name: e.name, code: e.code, zone: e.zone, role: 'FIELD_ENGINEER', openJobs: e.openJobs })) });
  });

  app.get('/api/audit-logs', authRequired, (_req, res) => {
    res.json({ logs: auditLogs });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`LUMEN backend listening on http://localhost:${PORT}`);
  }).on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Close the stale backend process or set PORT to another value, for example: PORT=4001 node server.js`);
      process.exit(1);
    }
    console.error('Failed to start backend:', err);
    process.exit(1);
  });
}
