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

## Civic damage taxonomy

LUMEN covers five civic categories, seventeen damage classes — the detected class
determines the severity weighting **and the department the complaint is routed to**.

| Category | Classes | Department | SLA |
|---|---|---|---|
| Roads | pothole, longitudinal / transverse / alligator crack | Roads & Infrastructure | 48 h |
| Electrical | exposed wire, damaged pole, open transformer, broken streetlight | Electricity | 12 h |
| Waste | garbage pile, overflowing bin, debris | Sanitation | 24 h |
| Water | open manhole, waterlogging, pipe leak | Water Supply | 24 h |
| Public property | broken footpath, damaged signage, broken railing | Public Works | 72 h |

Severity weights are safety-driven: an exposed live wire or open manhole outranks a
pothole, which outranks a garbage pile. Single source of truth:
`backend/ai-service/taxonomy.py` and `backend/src/lib/taxonomy.ts`.

## The AI features

1. **YOLO11 Nano damage detection & classification** — computer vision localises and
   classifies civic damage across all five categories, and **auto-routes the complaint
   to the owning department**.
2. **Explainable duplicate detection** — image embeddings, GPS radius, AI category and description overlap become a stored composite duplicate score.
3. **Smart complaint prioritisation** — combines AI severity and confidence with department safety rules, nearby hospitals/schools/highways, nearby report pressure and complaint age into an explainable 0–100 priority score.
4. **AI-verified closure** — before/after image comparison blocks unverified repairs.
5. **Optimised assignment** — Hungarian algorithm (O(n³)) minimises total dispatch cost.

## How the tiers talk

- The **frontend** calls the **backend** REST API at `/api/*` (same-origin via the Vite
  dev proxy; the auth cookie flows automatically).
- The **backend** owns the database (Prisma) and orchestrates the **AI service** over HTTP
  for detection, embeddings and repair verification.
- The **AI service** reports a `model_mode` — `TRAINED` (multi-category model), `HEURISTIC`
  (classical OpenCV, the default, roads only), or `FALLBACK` (pretrained COCO). The UI
  badges it so a demo detection is never mistaken for a trained model.

## Datasets

Real, published datasets — nothing synthetic. `fetch_datasets.py` downloads them
into `backend/ai-service/data/sources/`:

```bash
cd backend/ai-service
python fetch_datasets.py --list          # sources, sizes, licences
python fetch_datasets.py --get-open      # RDD2022 + TACO (no account needed)
python fetch_datasets.py --get-roboflow  # needs a free ROBOFLOW_API_KEY
```

| Source | Category | Licence | Access |
|---|---|---|---|
| [RDD2022](https://arxiv.org/abs/2209.08538) (13.3 GB) | Roads | CC BY 4.0 | open, direct |
| [TACO](https://github.com/pedropro/TACO) (~1,500 imgs) | Waste | MIT | open, direct |
| Roboflow: potholes / manhole covers / utility poles | Roads, Water, Electrical | varies | free account → API key |

Roboflow hosts the best small sets for the electrical/water classes but its
download API needs a key: sign up at <https://roboflow.com>, then
`export ROBOFLOW_API_KEY=…`.

## Training the multi-category model

Map each source's class names onto the taxonomy in `SOURCE_MAP` (train_multi.py), then:

```bash
cd backend/ai-service
python train_multi.py --merge     # unify all datasets into one label space
python train_multi.py --train     # fine-tune YOLO on all 17 classes
python train_multi.py --report    # per-class mAP for the project report
```

One model is trained across every category — a citizen's photo is not pre-labelled, so a
single multi-class detector is what makes automatic routing possible.

## Architecture note

This is a conventional three-tier separation: a presentation tier (Vite SPA), an
application tier (Express REST API with role-based access control and the optimisation
algorithm), and a data tier (Prisma + SQLite), plus a dedicated computer-vision
microservice. Auth is a JWT in an httpOnly cookie; every state-changing action is written
to an immutable audit log.
