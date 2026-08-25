"""Optional pothole detection via a Roboflow-hosted model.

Calls the Roboflow serverless inference API and returns detections in the same
shape as the local detector, so `model.py` can treat them interchangeably.

This is off unless ROBOFLOW_API_KEY is set. The key is never read from a file
in the repository and never logged — set it in the environment:

    export ROBOFLOW_API_KEY=...            # your key, not in version control
    export ROBOFLOW_MODEL=potholes-detection-qwkkc/5

The official `inference-sdk` package is deliberately not used: it publishes no
wheel for Python 3.13, which this service runs on. The endpoint is a single
POST, so the dependency buys nothing.

Two things to weigh before turning this on for real traffic:

  * Every detection becomes a network round trip. The local model answers in
    tens of milliseconds; this is subject to internet latency and to Roboflow
    being up. `detect()` returns [] on any failure rather than raising, so a
    dead network degrades to the local detector instead of a broken upload.

  * Citizen photographs leave the machine. For a municipal deployment handling
    real complaints that is a data-protection decision, not a technical one.
"""
from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request

API_URL = os.environ.get("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
# v2, not v5. Same project, and v5 advertises 99.5 mAP with 100% recall — the
# signature of a broken test set, and measured on outside data it scored 0.38
# precision because 28% of its training labels are the whole image. v2's
# advertised 66.8 mAP is the honest one: on 50 wide-street photographs it had
# never seen, it reached 0.96 precision at 0.48 recall.
MODEL_ID = os.environ.get("ROBOFLOW_MODEL", "potholes-detection-qwkkc/2")
TIMEOUT_S = float(os.environ.get("ROBOFLOW_TIMEOUT", "20"))


def is_configured() -> bool:
    return bool(os.environ.get("ROBOFLOW_API_KEY"))


def detect(image_bytes: bytes, conf: float = 0.50) -> list[dict]:
    """Detections as [{label, confidence, box:[x1,y1,x2,y2]}], or [] on failure.

    Roboflow reports each box by its centre plus width and height; this converts
    to the corner form the rest of the service uses.
    """
    key = os.environ.get("ROBOFLOW_API_KEY")
    if not key:
        return []

    url = f"{API_URL}/{MODEL_ID}?api_key={key}&confidence={int(conf * 100)}"
    body = base64.b64encode(image_bytes)
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        # Never let a remote call break an upload — the local detector stands.
        return []

    out: list[dict] = []
    for p in payload.get("predictions", []) or []:
        try:
            cx, cy = float(p["x"]), float(p["y"])
            w, h = float(p["width"]), float(p["height"])
        except (KeyError, TypeError, ValueError):
            continue
        out.append({
            "label": "Pothole",          # single-class model
            "confidence": round(float(p.get("confidence", 0.0)), 4),
            "box": [round(cx - w / 2, 1), round(cy - h / 2, 1),
                    round(cx + w / 2, 1), round(cy + h / 2, 1)],
        })
    return out
