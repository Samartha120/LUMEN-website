# LUMEN — Intelligent Civic Infrastructure Platform

Detect road damage from a citizen's photo, dispatch the right engineer, and verify
the repair — an AI-assisted civic operations platform in a clean three-tier layout.

```
lumen-platform/
├── frontend/     Vite + React SPA (React Router, Tailwind)      → :5173
├── backend/      Express + Prisma REST API (JWT auth)           → :4000
│   └── ai-service/   FastAPI computer-vision service (YOLO/OpenCV) → :8100
└── database/     Prisma schema, seed, and SQLite database file
```

## Run everything

One command (starts all three tiers):

```bash
./start.sh          # opens http://localhost:5173
```

…or start each tier in its own terminal:

```bash
# 1) AI service
cd backend/ai-service && pip install -r requirements.txt && uvicorn main:app --port 8100

# 2) backend
cd backend && npm install && npm run db:generate && npm run start

# 3) frontend
cd frontend && npm install && npm run dev
```

First-time database setup (creates + seeds `database/lumen.db`):

```bash
cd backend && npm run db:push && npm run db:seed
```

Open **http://localhost:5173** and sign in (password `lumen123`):

| Email | Role |
|---|---|
| admin@lumen.gov | Administrator |
| supervisor@lumen.gov | Supervisor |
| engineer@lumen.gov | Field Engineer |

## The five AI features

1. **Damage detection & classification** — computer vision localises and classifies road
   damage (pothole, longitudinal/transverse/alligator crack) with bounding boxes.
2. **Severity scoring** — a 0–100 score from detection geometry sets priority and SLA.
3. **Duplicate detection** — CNN image embeddings + Haversine distance + time window.
4. **AI-verified closure** — before/after image comparison blocks unverified repairs.
5. **Optimised assignment** — Hungarian algorithm (O(n³)) minimises total dispatch cost.

## How the tiers talk

- The **frontend** calls the **backend** REST API at `/api/*` (same-origin via the Vite
  dev proxy; the auth cookie flows automatically).
- The **backend** owns the database (Prisma) and orchestrates the **AI service** over HTTP
  for detection, embeddings and repair verification.
- The **AI service** reports a `model_mode` — `TRAINED` (fine-tuned RDD2022), `HEURISTIC`
  (classical OpenCV, the default), or `FALLBACK` (pretrained COCO). The UI badges it so a
  demo detection is never mistaken for a trained model.

## Architecture note

This is a conventional three-tier separation: a presentation tier (Vite SPA), an
application tier (Express REST API with role-based access control and the optimisation
algorithm), and a data tier (Prisma + SQLite), plus a dedicated computer-vision
microservice. Auth is a JWT in an httpOnly cookie; every state-changing action is written
to an immutable audit log.
