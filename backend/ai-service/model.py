"""Model loading and inference for the LUMEN civic damage CV service.

Two operating modes:
  TRAINED  - ai-service/weights/rdd_best.pt exists (fine-tuned on RDD2022)
  FALLBACK - no fine-tuned weights; a pretrained COCO YOLO is loaded so the
             pipeline is exercisable end-to-end before the dataset is trained.

Every response carries `model_mode` so the UI can state plainly which is in use.
"""
from __future__ import annotations

import hashlib
import io
import os
from dataclasses import dataclass, asdict
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

WEIGHTS_DIR = Path(__file__).parent / "weights"
TRAINED_WEIGHTS = WEIGHTS_DIR / "rdd_best.pt"
FALLBACK_WEIGHTS = "yolov8n.pt"

# RDD2022 damage classes.
RDD_CLASSES = {
    "D00": "Longitudinal Crack",
    "D10": "Transverse Crack",
    "D20": "Alligator Crack",
    "D40": "Pothole",
}

# Severity weight per class - potholes and alligator cracking are the most
# structurally serious, so they contribute more to the severity score.
CLASS_SEVERITY_WEIGHT = {
    "Pothole": 1.0,
    "Alligator Crack": 0.85,
    "Transverse Crack": 0.55,
    "Longitudinal Crack": 0.45,
}
DEFAULT_WEIGHT = 0.5

_model = None
_mode = None

# Detector selection when no fine-tuned weights are present:
#   heuristic (default) - classical-CV road-damage localisation (see below)
#   coco                - pretrained COCO YOLO (generic objects, demo only)
_FALLBACK_DETECTOR = os.environ.get("LUMEN_DETECTOR", "heuristic").lower()


def get_mode() -> str:
    """Resolve the active detection mode without forcing a YOLO load."""
    global _mode
    if _mode is not None:
        return _mode
    if TRAINED_WEIGHTS.exists():
        _mode = "TRAINED"
    elif _FALLBACK_DETECTOR == "coco":
        _mode = "FALLBACK"
    else:
        _mode = "HEURISTIC"
    return _mode


def get_model():
    """Load YOLO once (only needed for TRAINED / COCO modes)."""
    global _model, _mode
    mode = get_mode()
    if mode == "HEURISTIC":
        return None, mode
    if _model is not None:
        return _model, _mode

    from ultralytics import YOLO

    _model = YOLO(str(TRAINED_WEIGHTS)) if mode == "TRAINED" else YOLO(FALLBACK_WEIGHTS)
    return _model, _mode


@dataclass
class Detection:
    label: str
    confidence: float
    box: list[float]      # [x1, y1, x2, y2] in pixels
    area_ratio: float     # box area / image area


def _read_image(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def detect(data: bytes, conf: float = 0.25) -> dict:
    """Run detection and return structured results plus an annotated image."""
    img = _read_image(data)
    h, w = img.shape[:2]
    frame_area = float(h * w)
    mode = get_mode()

    if mode == "HEURISTIC":
        dets = heuristic_detect(img)
    else:
        model, _ = get_model()
        results = model.predict(img, conf=conf, verbose=False)[0]
        names = results.names
        dets = []
        for b in results.boxes:
            raw = names.get(int(b.cls.item()), str(int(b.cls.item())))
            label = RDD_CLASSES.get(raw, raw)
            x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
            area = max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))
            dets.append(Detection(
                label=label,
                confidence=round(float(b.conf.item()), 4),
                box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
            ))

    annotated = _annotate(img, dets)
    severity = score_severity(dets)

    return {
        "model_mode": mode,
        "image_size": {"width": w, "height": h},
        "detections": [asdict(d) for d in dets],
        "severity": severity,
        "annotated_png_b64": _to_b64_png(annotated),
    }


# ------------------------------------------------ classical-CV detector
# A deterministic OpenCV heuristic that localises road damage without any
# trained weights, so the pipeline is fully demonstrable. It is NOT deep
# learning and the service labels its output HEURISTIC so it is never mistaken
# for the RDD2022 model. Two cues:
#   * potholes  - dark, compact blobs (surface voids read darker than the road)
#   * cracks    - thin, high-edge-density regions; orientation of the region
#                 picks longitudinal vs transverse, a dense edge network picks
#                 alligator cracking.

def _nms(dets: list["Detection"], iou_thresh: float = 0.4) -> list["Detection"]:
    """Greedy non-max suppression, highest confidence first."""
    kept: list[Detection] = []
    for d in sorted(dets, key=lambda x: x.confidence, reverse=True):
        x1, y1, x2, y2 = d.box
        overlap = False
        for k in kept:
            kx1, ky1, kx2, ky2 = k.box
            ix1, iy1 = max(x1, kx1), max(y1, ky1)
            ix2, iy2 = min(x2, kx2), min(y2, ky2)
            iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
            inter = iw * ih
            a1 = (x2 - x1) * (y2 - y1)
            a2 = (kx2 - kx1) * (ky2 - ky1)
            if inter / (a1 + a2 - inter + 1e-6) > iou_thresh:
                overlap = True
                break
        if not overlap:
            kept.append(d)
    return kept


def _road_mask(img: np.ndarray) -> np.ndarray:
    """Segment the drivable road surface so detection ignores sky and greenery.

    Road asphalt is low-saturation grey; vegetation is green with saturation;
    sky is bright and low-saturation but sits at the top. We keep grey, mid-tone
    pixels, drop green and bright-sky pixels, bias toward the lower frame, then
    keep the largest connected region. This is what stops the detector boxing
    trees and the horizon.
    """
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)

    grey = ((S < 70) & (V > 45) & (V < 205)).astype(np.uint8)       # asphalt
    veg = ((H > 30) & (H < 95) & (S > 55)).astype(np.uint8)          # vegetation
    sky = ((V > 175) & (S < 55)).astype(np.uint8)                    # bright sky

    road = grey.copy()
    road[veg > 0] = 0
    road[sky > 0] = 0
    road[: int(0.18 * h), :] = 0                                     # drop top band

    road = cv2.morphologyEx(road * 255, cv2.MORPH_CLOSE,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    road = cv2.morphologyEx(road, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))

    # keep only the largest connected component (the main carriageway)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(road, 8)
    if n > 1:
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        road = np.where(labels == largest, 255, 0).astype(np.uint8)

    # Fill interior holes: potholes are dark and were excluded above, but they
    # sit INSIDE the carriageway, so the filled region must contain them or they
    # can never be detected as "on road".
    contours, _ = cv2.findContours(road, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(road)
    cv2.drawContours(filled, contours, -1, 255, thickness=cv2.FILLED)
    return filled


def _road_coverage(mask: np.ndarray, x: int, y: int, bw: int, bh: int) -> float:
    sub = mask[y:y + bh, x:x + bw]
    return float((sub > 0).mean()) if sub.size else 0.0


def heuristic_detect(img: np.ndarray) -> list["Detection"]:
    h, w = img.shape[:2]
    frame_area = float(h * w)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    dets: list[Detection] = []

    road = _road_mask(img)
    road_px = road > 0
    if road_px.sum() < frame_area * 0.03:
        return []  # no usable road surface — refuse rather than box noise
    road_mean = float(gray[road_px].mean())
    road_std = float(gray[road_px].std())

    MIN_ROAD_COVER = 0.6      # a box must be mostly ON the road
    MAX_AREA = 0.45           # reject frame-spanning boxes

    # --- potholes: dark blobs on the road, below local road brightness
    dark_thresh = max(0, road_mean - 0.6 * road_std)
    dark = ((gray < dark_thresh) & road_px).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, kernel)
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, kernel)

    for c, _ in [(c, None) for c in cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]]:
        area = cv2.contourArea(c)
        if area < frame_area * 0.0015 or area > frame_area * MAX_AREA:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        rect_area = float(bw * bh)
        fill = area / rect_area if rect_area else 0.0
        aspect = bw / bh if bh else 0.0
        if fill < 0.4 or aspect < 0.3 or aspect > 3.3:
            continue
        if _road_coverage(road, x, y, bw, bh) < MIN_ROAD_COVER:
            continue
        darkness = 1.0 - (float(gray[y:y + bh, x:x + bw].mean()) / 255.0)
        conf = max(0.4, min(0.93, 0.4 * fill + 0.6 * darkness))
        dets.append(Detection("Pothole", round(conf, 4),
                              [float(x), float(y), float(x + bw), float(y + bh)],
                              round(rect_area / frame_area, 5)))

    # --- cracks: thin high-edge-density regions, on the road only
    edges = cv2.Canny(gray, 70, 180)
    edges[~road_px] = 0
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    for c in cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]:
        area = cv2.contourArea(c)
        if area < frame_area * 0.002:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        rect_area = float(bw * bh)
        if rect_area < frame_area * 0.003 or rect_area > frame_area * MAX_AREA:
            continue
        if _road_coverage(road, x, y, bw, bh) < MIN_ROAD_COVER:
            continue
        fill = area / rect_area if rect_area else 0.0
        aspect = bw / bh if bh else 999.0
        edge_density = float(edges[y:y + bh, x:x + bw].mean()) / 255.0
        if edge_density < 0.12:
            continue

        if fill > 0.45 and edge_density > 0.22 and 0.5 < aspect < 2.0:
            label = "Alligator Crack"
        elif aspect >= 3.0:
            label = "Transverse Crack"
        elif aspect <= 0.33:
            label = "Longitudinal Crack"
        else:
            continue
        conf = max(0.4, min(0.9, 0.4 + edge_density))
        dets.append(Detection(label, round(conf, 4),
                              [float(x), float(y), float(x + bw), float(y + bh)],
                              round(rect_area / frame_area, 5)))

    dets = _nms(dets, 0.35)
    # potholes are the headline defect — rank them first, then by size
    dets.sort(key=lambda d: (d.label != "Pothole", -d.area_ratio))
    return dets[:6]


def _annotate(img: np.ndarray, dets: list[Detection]) -> np.ndarray:
    out = img.copy()
    for d in dets:
        x1, y1, x2, y2 = [int(v) for v in d.box]
        colour = (0, 0, 220) if d.label == "Pothole" else (0, 165, 255)
        cv2.rectangle(out, (x1, y1), (x2, y2), colour, 3)
        tag = f"{d.label} {d.confidence:.2f}"
        (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(out, (x1, max(0, y1 - th - 10)), (x1 + tw + 8, y1), colour, -1)
        cv2.putText(out, tag, (x1 + 4, max(12, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    return out


def _to_b64_png(img: np.ndarray) -> str:
    import base64
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        return ""
    return base64.b64encode(buf.tobytes()).decode("ascii")


# ---------------------------------------------------------------- severity

def score_severity(dets: list[Detection]) -> dict:
    """Feature 2 - severity from detection geometry.

    score = 100 * sum(class_weight * sqrt(area_ratio) * confidence), capped,
    with a small bonus for multiple distinct damage instances. Square-rooting
    the area keeps a single large pothole from saturating the scale while still
    ranking it above a hairline crack.
    """
    if not dets:
        return {"score": 0, "priority": "LOW", "band": "NONE", "instances": 0,
                "total_area_ratio": 0.0}

    raw = 0.0
    for d in dets:
        w = CLASS_SEVERITY_WEIGHT.get(d.label, DEFAULT_WEIGHT)
        raw += w * (d.area_ratio ** 0.5) * d.confidence

    multi_bonus = min(0.15, 0.05 * (len(dets) - 1))
    score = min(100.0, (raw + multi_bonus) * 100.0)

    if score >= 60:
        priority, band = "CRITICAL", "SEVERE"
    elif score >= 35:
        priority, band = "HIGH", "SIGNIFICANT"
    elif score >= 15:
        priority, band = "MEDIUM", "MODERATE"
    else:
        priority, band = "LOW", "MINOR"

    return {
        "score": round(score, 1),
        "priority": priority,
        "band": band,
        "instances": len(dets),
        "total_area_ratio": round(sum(d.area_ratio for d in dets), 5),
    }


# ------------------------------------------------------------- embeddings

_embedder = None
_embed_tf = None


def _get_embedder():
    """ResNet-18 truncated at global average pooling -> 512-D feature extractor.

    Hand-crafted descriptors (perceptual hash + colour histogram) were tried
    first and rejected: on low-texture, desaturated civic photographs -- which
    is most road imagery -- unrelated scenes collapsed to cosine > 0.98.
    ImageNet-pretrained CNN features separate them reliably.
    """
    global _embedder, _embed_tf
    if _embedder is not None:
        return _embedder, _embed_tf

    import torch
    import torchvision.transforms as T
    from torchvision.models import resnet18, ResNet18_Weights

    weights = ResNet18_Weights.DEFAULT
    net = resnet18(weights=weights)
    net.fc = torch.nn.Identity()   # keep the 512-D pooled features
    net.eval()

    _embedder = net
    _embed_tf = T.Compose([
        T.ToPILImage(),
        T.Resize(256),
        T.CenterCrop(224),
        T.ToTensor(),
        T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    return _embedder, _embed_tf


def embed(data: bytes) -> list[float]:
    """CNN feature embedding for duplicate detection (Feature 3).

    512-D ImageNet-pretrained ResNet-18 pooled features, L2 normalised, so that
    cosine similarity is a direct measure of visual-semantic closeness. Robust
    to the resolution, exposure and viewpoint differences you get when two
    citizens photograph the same defect from different positions.
    """
    import torch

    net, tf = _get_embedder()
    img = _read_image(data)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    with torch.no_grad():
        vec = net(tf(rgb).unsqueeze(0)).squeeze(0).numpy()

    n = np.linalg.norm(vec)
    if n:
        vec = vec / n
    return [round(float(v), 6) for v in vec]


def cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a, dtype=np.float32), np.array(b, dtype=np.float32)
    if va.shape != vb.shape or not va.size:
        return 0.0
    na, nb = np.linalg.norm(va), np.linalg.norm(vb)
    if not na or not nb:
        return 0.0
    return float(np.dot(va, vb) / (na * nb))


# ---------------------------------------------------- repair verification

def verify_repair(before: bytes, after: bytes) -> dict:
    """Feature 4 - decide whether the 'after' photo shows the damage repaired.

    Combines two independent signals:
      1. Damage reduction  - severity score before vs after (primary)
      2. Structural change - SSIM between the two frames (sanity check that the
         engineer actually photographed a changed scene, not resubmitted the
         same image)
    """
    b = detect(before)
    a = detect(after)

    s_before = b["severity"]["score"]
    s_after = a["severity"]["score"]
    reduction = 0.0 if s_before <= 0 else max(0.0, (s_before - s_after) / s_before)

    ssim = _ssim(_read_image(before), _read_image(after))

    # Identical resubmission: high SSIM and effectively no severity change.
    resubmitted = ssim > 0.97 and abs(s_before - s_after) < 1.0

    if resubmitted:
        verdict, reason = "REJECTED", "The after-photo is effectively identical to the before-photo."
    elif s_before <= 0:
        # No damage was detected in the before-photo, so there is no baseline to
        # measure a repair against. Never treat this as proof of failure.
        verdict, reason = (
            "INCONCLUSIVE",
            "No damage was detected in the before-photo, so the repair cannot be "
            "measured automatically. Manual supervisor review required.",
        )
    elif s_after <= 0:
        verdict, reason = "VERIFIED", "No damage detected in the after-photo."
    elif reduction >= 0.6:
        verdict, reason = "VERIFIED", f"Damage severity reduced by {reduction * 100:.0f}%."
    elif reduction >= 0.25:
        verdict, reason = "INCONCLUSIVE", f"Only a partial reduction of {reduction * 100:.0f}% was measured."
    else:
        verdict, reason = "REJECTED", "Damage is still present at comparable severity."

    return {
        "verdict": verdict,
        "reason": reason,
        "severity_before": s_before,
        "severity_after": s_after,
        "reduction_pct": round(reduction * 100, 1),
        "ssim": round(ssim, 4),
        "detections_before": b["detections"],
        "detections_after": a["detections"],
        "annotated_after_b64": a["annotated_png_b64"],
        "model_mode": b["model_mode"],
    }


def _ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """Structural similarity on grayscale, global (single-window) formulation."""
    g1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY).astype(np.float64)
    g2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    g2 = cv2.resize(g2, (g1.shape[1], g1.shape[0]), interpolation=cv2.INTER_AREA).astype(np.float64)

    k1, k2, L = 0.01, 0.03, 255.0
    c1, c2 = (k1 * L) ** 2, (k2 * L) ** 2

    mu1, mu2 = g1.mean(), g2.mean()
    var1, var2 = g1.var(), g2.var()
    cov = ((g1 - mu1) * (g2 - mu2)).mean()

    num = (2 * mu1 * mu2 + c1) * (2 * cov + c2)
    den = (mu1**2 + mu2**2 + c1) * (var1 + var2 + c2)
    return float(num / den) if den else 0.0


def file_sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]
