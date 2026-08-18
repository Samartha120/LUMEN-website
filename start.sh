#!/bin/bash
# Start all three LUMEN tiers. AI service and backend run in the background;
# the frontend (what you open in the browser) runs in the foreground.
#
#   frontend  http://localhost:5173   (Vite + React)
#   backend   http://localhost:4000   (Express + Prisma)
#   ai        http://localhost:8100   (FastAPI + OpenCV/YOLO)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "→ starting AI service (backend/ai-service) on :8100"
( cd "$ROOT/backend/ai-service" && .venv/bin/python3 -m uvicorn main:app --port 8100 ) > /tmp/lumen-ai.log 2>&1 &

echo "→ starting backend (Express) on :4000"
( cd "$ROOT/backend" && npm run start ) > /tmp/lumen-backend.log 2>&1 &

echo "→ waiting for backend…"
for i in $(seq 1 30); do
  curl -s http://localhost:4000/api/ping >/dev/null 2>&1 && break
  sleep 1
done

echo "→ starting frontend (Vite) on :5173  —  open http://localhost:5173"
cd "$ROOT/frontend" && npm run dev
