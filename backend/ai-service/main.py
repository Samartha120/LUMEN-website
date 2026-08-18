"""LUMEN AI Service — computer-vision microservice for civic damage analysis.

Endpoints
  GET  /health          service + model mode
  POST /detect          damage detection, severity scoring, annotated image
  POST /embed           perceptual embedding for duplicate detection
  POST /compare         cosine similarity between two embeddings

Run:  uvicorn main:app --port 8100
"""
from __future__ import annotations

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import model as M
import taxonomy as TAX

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
        "TRAINED": "Trained civic-damage model in use across all categories.",
        "HEURISTIC": "Classical-CV heuristic detector in use (no trained weights). "
                     "Detects road damage with OpenCV; train_multi.py enables the "
                     "multi-category deep-learning model.",
        "FALLBACK": "Pretrained COCO model in use — generic objects, not civic damage. "
                    "Train with train_multi.py to enable the civic classes.",
    }
    return {
        "status": "ok",
        "model_mode": mode,
        "classes": TAX.YOLO_NAMES,
        "categories": {
            k: {"department": v["dept"], "department_name": v["dept_name"], "sla_hours": v["sla"],
                "classes": [c for c, e in TAX.CLASSES.items() if e["category"] == k]}
            for k, v in TAX.CATEGORIES.items()
        },
        "note": notes.get(mode, ""),
    }


@app.get("/taxonomy")
def taxonomy():
    """The civic damage taxonomy the detector and routing are built on."""
    return {
        "categories": TAX.CATEGORIES,
        "classes": {name: {**e, "category_name": TAX.CATEGORIES[e["category"]]["dept_name"]}
                    for name, e in TAX.CLASSES.items()},
        "yolo_names": TAX.YOLO_NAMES,
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

