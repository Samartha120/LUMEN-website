"""LUMEN AI Service — computer-vision microservice for civic damage analysis.

Endpoints
  GET  /health          service + model mode
  POST /detect          damage detection, severity scoring, annotated image
  POST /embed           perceptual embedding for duplicate detection
  POST /compare         cosine similarity between two embeddings
  POST /verify          before/after repair verification

Run:  uvicorn main:app --port 8100
"""
from __future__ import annotations

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import model as M

app = FastAPI(title="LUMEN AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_BYTES = 12 * 1024 * 1024


async def _read(f: UploadFile) -> bytes:
    data = await f.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image exceeds 12 MB limit.")
    return data


@app.get("/health")
def health():
    mode = M.get_mode()
    notes = {
        "TRAINED": "Fine-tuned RDD2022 model in use.",
        "HEURISTIC": "Classical-CV heuristic detector in use (no trained weights). "
                     "Localises damage with OpenCV; train.py enables the deep-learning model.",
        "FALLBACK": "Pretrained COCO model in use — generic objects, not road damage. "
                    "Train with train.py to enable road-damage classes.",
    }
    return {
        "status": "ok",
        "model_mode": mode,
        "classes": list(M.RDD_CLASSES.values()),
        "note": notes.get(mode, ""),
    }


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    data = await _read(file)
    try:
        return M.detect(data)
    except Exception as e:
        raise HTTPException(500, f"Detection failed: {e}")


@app.post("/embed")
async def embed(file: UploadFile = File(...)):
    data = await _read(file)
    try:
        return {"embedding": M.embed(data), "sha": M.file_sha(data)}
    except Exception as e:
        raise HTTPException(500, f"Embedding failed: {e}")


class ComparePayload(BaseModel):
    a: list[float]
    b: list[float]


@app.post("/compare")
def compare(p: ComparePayload):
    return {"cosine": round(M.cosine(p.a, p.b), 6)}


@app.post("/verify")
async def verify(before: UploadFile = File(...), after: UploadFile = File(...)):
    b, a = await _read(before), await _read(after)
    try:
        return M.verify_repair(b, a)
    except Exception as e:
        raise HTTPException(500, f"Verification failed: {e}")
