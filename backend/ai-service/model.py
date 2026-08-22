"""Model loading and inference for the LUMEN civic damage CV service.

Detects civic infrastructure damage across five categories (roads, electrical,
waste, water, public property) — see taxonomy.py for the class list. The
detected class determines the severity weighting and which department the
complaint is routed to.

Operating modes:
  TRAINED   - weights/civic_best.pt exists (multi-category model, see train_multi.py)
  HEURISTIC - no trained weights; classical OpenCV detection (roads only)
  FALLBACK  - pretrained COCO YOLO, for pipeline smoke-testing only

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

import taxonomy as TAX

WEIGHTS_DIR = Path(__file__).parent / "weights"
# Prefer the multi-category model; fall back to a roads-only RDD model if that
# is what has been trained so far.
TRAINED_WEIGHTS = WEIGHTS_DIR / "civic_best.pt"
LEGACY_WEIGHTS = WEIGHTS_DIR / "rdd_best.pt"
FALLBACK_WEIGHTS = "yolo11n.pt"

# A pothole-only second opinion, asked only when the multi-class model finds
# nothing at all.
#
# YOLOv8n-seg trained on the Pothole Image Segmentation dataset by Farzad
# Nekouei, MIT licensed:
#   https://github.com/FarzadNekouee/YOLOv8_Pothole_Segmentation_Road_Damage_Assessment
#
# It exists because our model, trained across five civic classes, has to spend
# its capacity broadly and misses potholes shot from unusual angles. A citizen's
# photograph of a flooded, crumbling road edge scored 0.012 with ours and 0.885
# with this one. On the held-out close-up photos, consulting it only where ours
# is silent improves both numbers at once, which a threshold change never does:
#
#     configuration                  shows  correct  precision  recall
#     ours alone                        13       15      0.938   0.300
#     ours, else specialist @0.70       17       21      0.955   0.420
#
# The bar is 0.70 rather than 0.50 because this runs precisely when the primary
# model saw nothing, so the prior is already against there being damage.
#
# It replaces the classical fallback that used to fill this slot and put a 0.61
# confidence box on a puddle. Single-class, so it can only ever add potholes —
# it cannot invent a garbage pile or misroute a complaint to another department.
SPECIALIST_WEIGHTS = WEIGHTS_DIR / "pothole_specialist.pt"
SPECIALIST_MIN_CONF = 0.70
USE_POTHOLE_SPECIALIST = os.environ.get("LUMEN_POTHOLE_SPECIALIST", "1") == "1"

# Raw model label -> taxonomy label (RDD2022 codes etc.)
RDD_CLASSES = TAX.RDD_ALIASES
CLASS_SEVERITY_WEIGHT = {name: e["weight"] for name, e in TAX.CLASSES.items()}
DEFAULT_WEIGHT = TAX.DEFAULT_WEIGHT

_model = None
_mode = None
_occluder_model = None
_occluder_failed = False

# COCO ids for things that sit ON the carriageway but are not damage.
# A parked car is dark, textured and edge-dense, so the classical detector reads
# it as alligator cracking unless it is removed from the road surface first.
_OCCLUDER_COCO_IDS = {
    0: "person", 1: "bicycle", 2: "car", 3: "motorcycle",
    5: "bus", 6: "train", 7: "truck",
}

# Below this share of the frame segmenting as road surface, the photograph is
# treated as not being of a road or civic area at all.
MIN_ROAD_FRACTION = 0.08

# A photograph of a real surface always carries texture. Measured across 98
# genuine civic photographs the lowest edge density was 0.026; a cartoon face
# scores 0.005 and a drawn robot 0.007. Flat synthetic images otherwise slip
# past the colour rule, because a grey figure on a pale background looks
# exactly like asphalt to a saturation test.
MIN_EDGE_DENSITY = 0.015

# COCO classes whose presence, at size, means the photograph is of a subject
# rather than of a place. Vehicles are excluded here on purpose — a car in
# frame is normal on a street, and _occluder_boxes already masks it out of the
# road surface.
_NON_CIVIC_COCO_IDS = {
    0: "person", 15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow",
    62: "tv", 63: "laptop", 67: "cell phone", 56: "chair", 57: "couch",
    59: "bed", 60: "dining table", 39: "bottle", 41: "cup", 73: "book",
}

# Confidence a detection must reach to be shown at all.
#
# Chosen by measurement, not by feel. Swept against the held-out close-up road
# photos — the kind of image a citizen actually uploads — on the current
# civic_best.pt weights:
#
#     conf   boxes drawn   correct   precision   recall
#     0.25        --          --       ~0.83       ~0.50      (previous default)
#     0.30        30          25        0.833       0.500
#     0.40        27          22        0.815       0.440
#     0.50        20          18        0.900       0.360
#     0.60        15          15        1.000       0.300
#
# End-to-end through detect(), which also merges overlapping boxes, 0.50 gives
# 21 boxes / 20 correct — precision 0.952 at recall 0.400.
#
# 0.50 is the point where nine in ten drawn boxes are real. The trade is recall:
# roughly a third of potholes are found rather than half. For a complaint
# system that is the right way round — a false detection dispatches an engineer
# to a road that is fine, while a missed pothole is reported by the next person
# who walks past it.
#
# Sample was 23 images / 50 potholes, so 0.900 is 18 of 20 boxes and the true
# figure could sit anywhere from roughly 0.77 to 0.97. Re-measure once there is
# a larger held-out set of app-domain photos.
DEFAULT_CONF = 0.50

# Detections recovered from the tiled fallback must clear this to be reported.
# Higher than the normal threshold on purpose: see the note where it is used.
# A tile is a crop with no surrounding context, so it is the likelier source of
# a false box and has to clear a correspondingly higher bar.
#
# Swept end-to-end: recall is flat at 0.400 from 0.55 through 0.75, so the bar
# can be raised without giving anything up. 0.70 removes one false box and 0.75
# removes none, hence 0.70. Be clear-eyed that "removes one false box" on a
# 23-image sample is not a demonstrated gain — it is the reason this number is
# not tuned any finer.
TILED_MIN_CONF = 0.70

# The two recall-recovery paths, both off by default because both cost more
# precision than they return. Measured end-to-end through detect() on the
# held-out close-up photos (23 images, 50 real potholes):
#
#     configuration                        boxes  correct  precision  recall
#     both on (previous behaviour)            38       24      0.632   0.480
#     tiles on, classical off                 27       23      0.852   0.460
#     both off                                21       20      0.952   0.400
#
# The classical fallback is the clear defect: it contributed 11 boxes for 1
# real pothole. The augmenting tiled pass is a genuine trade — it buys 0.10
# recall for 0.05 precision, which is worth having in a triage queue but not
# where a drawn box must be trustworthy.
#
# Set either to "1" to re-enable. Turn tiles back on first if recall matters
# more than the ninth correct box in ten.
USE_AUGMENTING_TILES = os.environ.get("LUMEN_AUGMENTING_TILES", "0") == "1"
USE_CLASSICAL_FALLBACK = os.environ.get("LUMEN_CLASSICAL_FALLBACK", "0") == "1"

# Detector selection when no fine-tuned weights are present:
#   heuristic (default) - classical-CV road-damage localisation (see below)
#   coco                - pretrained COCO YOLO (generic objects, demo only)
_FALLBACK_DETECTOR = os.environ.get("LUMEN_DETECTOR", "heuristic").lower()


def _trained_weights_path() -> Path | None:
    """Multi-category weights if present, else legacy roads-only weights."""
    if TRAINED_WEIGHTS.exists():
        return TRAINED_WEIGHTS
    if LEGACY_WEIGHTS.exists():
        return LEGACY_WEIGHTS
    return None


def get_mode() -> str:
    """Resolve the active detection mode without forcing a YOLO load."""
    global _mode
    if _mode is not None:
        return _mode
    if _trained_weights_path() is not None:
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

    weights = _trained_weights_path()
    _model = YOLO(str(weights)) if mode == "TRAINED" and weights else YOLO(FALLBACK_WEIGHTS)
    return _model, _mode


_specialist = None
_specialist_failed = False


def _get_specialist():
    """The pothole-only model, loaded lazily and never fatal if missing."""
    global _specialist, _specialist_failed
    if _specialist is not None or _specialist_failed:
        return _specialist
    if not (USE_POTHOLE_SPECIALIST and SPECIALIST_WEIGHTS.exists()):
        _specialist_failed = True
        return None
    try:
        from ultralytics import YOLO
        _specialist = YOLO(str(SPECIALIST_WEIGHTS))
    except Exception:
        _specialist_failed = True
    return _specialist


def _specialist_potholes(img: np.ndarray, frame_area: float) -> list["Detection"]:
    """Ask the specialist for potholes. Returns [] on any failure."""
    m = _get_specialist()
    if m is None:
        return []
    try:
        res = m.predict(img, conf=SPECIALIST_MIN_CONF, verbose=False)[0]
    except Exception:
        return []
    out: list[Detection] = []
    for b in getattr(res, "boxes", []) or []:
        name = res.names.get(int(b.cls[0]), "")
        # Single-class by construction, but check rather than assume: a swapped
        # checkpoint must not be able to inject some other label.
        if "pothole" not in name.lower():
            continue
        x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        out.append(Detection(
            label="Pothole",
            confidence=round(float(b.conf[0]), 4),
            box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
        ))
    return _merge_overlapping(out, frame_area)


def _get_occluder_model():
    """Pretrained COCO detector, used only to find vehicles and pedestrians.

    This is not the damage detector and never contributes a detection. It is a
    filter: whatever it finds is cut out of the road surface so the damage
    heuristic cannot analyse it. If ultralytics or the weights are unavailable
    the pipeline still runs, just without vehicle exclusion.
    """
    global _occluder_model, _occluder_failed
    if _occluder_model is not None or _occluder_failed:
        return _occluder_model
    try:
        from ultralytics import YOLO

        _occluder_model = YOLO(FALLBACK_WEIGHTS)
    except Exception:
        _occluder_failed = True
        _occluder_model = None
    return _occluder_model


def _occluder_boxes(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Boxes of vehicles/pedestrians in the frame, slightly dilated.

    The margin matters: a car's shadow and the dark gap under the body sit just
    outside the detected box and are exactly the kind of dark blob the pothole
    rule keys on.
    """
    m = _get_occluder_model()
    if m is None:
        return []
    try:
        res = m.predict(img, verbose=False, conf=0.30)[0]
    except Exception:
        return []
    h, w = img.shape[:2]
    out: list[tuple[int, int, int, int]] = []
    for box in getattr(res, "boxes", []) or []:
        cid = int(box.cls[0])
        if cid not in _OCCLUDER_COCO_IDS:
            continue
        x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
        mx, my = 0.04 * (x2 - x1), 0.06 * (y2 - y1)
        out.append((
            max(0, int(x1 - mx)), max(0, int(y1 - my)),
            min(w, int(x2 + mx)), min(h, int(y2 + my)),
        ))
    return out


@dataclass
class Detection:
    label: str
    confidence: float
    box: list[float]      # [x1, y1, x2, y2] in pixels
    area_ratio: float     # box area / image area


def _read_image(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _predict(model, img: np.ndarray, conf: float, frame_area: float,
             ox: int = 0, oy: int = 0) -> list["Detection"]:
    """One YOLO pass. `ox`/`oy` shift boxes back into full-frame coordinates."""
    out: list[Detection] = []
    results = model.predict(img, conf=conf, verbose=False)[0]
    names = results.names
    for b in results.boxes:
        raw = names.get(int(b.cls.item()), str(int(b.cls.item())))
        label = TAX.normalise(raw)
        # A trained checkpoint keeps every output head it was built with, so it
        # can still predict a class that has since been retired from the
        # taxonomy. Reporting one would route a complaint to a department that
        # no longer exists, so unknown labels are dropped here rather than
        # forcing a retrain every time a class is removed.
        if label not in TAX.CLASSES:
            continue
        x1, y1, x2, y2 = [float(v) for v in b.xyxy[0].tolist()]
        x1, y1, x2, y2 = x1 + ox, y1 + oy, x2 + ox, y2 + oy
        area = max(0.0, (x2 - x1)) * max(0.0, (y2 - y1))
        out.append(Detection(
            label=label,
            confidence=round(float(b.conf.item()), 4),
            box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
        ))
    return out


def _iou(a: list[float], b: list[float]) -> float:
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def _contained(inner: list[float], outer: list[float]) -> float:
    """How much of `inner` lies inside `outer`, 0-1."""
    ix1, iy1 = max(inner[0], outer[0]), max(inner[1], outer[1])
    ix2, iy2 = min(inner[2], outer[2]), min(inner[3], outer[3])
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    area = (inner[2] - inner[0]) * (inner[3] - inner[1])
    return (iw * ih) / area if area > 0 else 0.0


def _merge_overlapping(dets: list["Detection"], frame_area: float,
                       iou_thresh: float = 0.30, contain_thresh: float = 0.55,
                       gap_px: float = 8.0) -> list["Detection"]:
    """Collapse every box covering one defect into a single box.

    The detector reports regions, not defects. A large pothole straddling the
    seams of the tile grid comes back as several boxes — some overlapping, some
    nested inside a bigger one, some merely touching. Suppression alone leaves
    the survivors sitting on top of each other, which reads to anyone looking
    at it as a dozen potholes where there is one, and makes the annotated image
    unusable as evidence.

    So rather than discarding the extras, they are unioned. Boxes of the same
    class merge when they overlap by IoU, when one is largely contained in the
    other, or when they are within a few pixels of touching. Merging repeats
    until nothing changes, so a chain of fragments collapses to one box rather
    than a pair at a time. The merged box keeps the highest confidence of its
    parts — the best evidence for the defect, not an average diluted by the
    weak fragments that overlapped it.
    """
    boxes = [
        {"label": d.label, "conf": d.confidence,
         "x1": min(d.box[0], d.box[2]), "y1": min(d.box[1], d.box[3]),
         "x2": max(d.box[0], d.box[2]), "y2": max(d.box[1], d.box[3])}
        for d in dets
    ]

    changed = True
    while changed:
        changed = False
        out: list[dict] = []
        for b in sorted(boxes, key=lambda z: -((z["x2"] - z["x1"]) * (z["y2"] - z["y1"]))):
            for k in out:
                if k["label"] != b["label"]:
                    continue
                ix1, iy1 = max(b["x1"], k["x1"]), max(b["y1"], k["y1"])
                ix2, iy2 = min(b["x2"], k["x2"]), min(b["y2"], k["y2"])
                inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
                ab = (b["x2"] - b["x1"]) * (b["y2"] - b["y1"])
                ak = (k["x2"] - k["x1"]) * (k["y2"] - k["y1"])
                iou = inter / (ab + ak - inter + 1e-6)
                contained = inter / (min(ab, ak) + 1e-6)
                touching = (
                    b["x1"] - gap_px < k["x2"] and k["x1"] - gap_px < b["x2"] and
                    b["y1"] - gap_px < k["y2"] and k["y1"] - gap_px < b["y2"]
                )
                if iou > iou_thresh or contained > contain_thresh or touching:
                    k["x1"], k["y1"] = min(k["x1"], b["x1"]), min(k["y1"], b["y1"])
                    k["x2"], k["y2"] = max(k["x2"], b["x2"]), max(k["y2"], b["y2"])
                    k["conf"] = max(k["conf"], b["conf"])
                    changed = True
                    break
            else:
                out.append(b)
        boxes = out

    merged = [
        Detection(
            label=b["label"], confidence=round(b["conf"], 3),
            box=[b["x1"], b["y1"], b["x2"], b["y2"]],
            area_ratio=round(((b["x2"] - b["x1"]) * (b["y2"] - b["y1"])) / max(frame_area, 1.0), 4),
        )
        for b in boxes
    ]
    return sorted(merged, key=lambda d: -d.confidence)


def _nms(dets: list["Detection"], thresh: float = 0.45) -> list["Detection"]:
    """Kept for callers that want suppression without merging."""
    kept: list[Detection] = []
    for d in sorted(dets, key=lambda x: -x.confidence):
        duplicate = any(
            k.label == d.label and (_iou(k.box, d.box) > thresh or _contained(d.box, k.box) > 0.7)
            for k in kept
        )
        if not duplicate:
            kept.append(d)
    return kept


def _predict_tiled(model, img: np.ndarray, conf: float, frame_area: float,
                   grid: tuple[int, int] = (3, 2), overlap: float = 0.2) -> list["Detection"]:
    """Detect over an overlapping grid of tiles, then merge.

    Each tile is a crop, so the defects inside it are large relative to the
    tile and survive the resize to the network input. Tiles overlap by 20% so a
    defect on a seam is not cut in half, and the duplicates that creates are
    removed by NMS afterwards.
    """
    h, w = img.shape[:2]
    cols, rows = grid
    tw, th = int(w / cols * (1 + overlap)), int(h / rows * (1 + overlap))
    dets: list[Detection] = []
    for r in range(rows):
        for c in range(cols):
            x0 = min(max(0, int(c * w / cols)), max(0, w - tw))
            y0 = min(max(0, int(r * h / rows)), max(0, h - th))
            tile = img[y0:y0 + th, x0:x0 + tw]
            if tile.size == 0:
                continue
            dets.extend(_predict(model, tile, conf, frame_area, ox=x0, oy=y0))
    return _merge_overlapping(dets, frame_area)


def assess_scene(img: np.ndarray) -> dict:
    """Is this photograph plausibly of a road or civic area at all?

    A citizen (or a bored tester) can upload a selfie, a screenshot or a cat.
    Analysing that and returning "no damage found" is misleading — the honest
    answer is that the photograph is not of the right thing. The road mask
    already answers this: if almost none of the frame segments as road surface,
    there is nothing civic to assess.
    """
    h, w = img.shape[:2]
    road = _road_mask(img)
    road_fraction = float((road > 0).sum()) / float(h * w)

    # Objects that, when they dominate the frame, mean the photo is of a thing
    # rather than of a place — a pet, a person, a laptop on a desk.
    subjects: list[str] = []
    m = _get_occluder_model()
    if m is not None:
        try:
            res = m.predict(img, verbose=False, conf=0.35)[0]
            for box in getattr(res, "boxes", []) or []:
                name = _NON_CIVIC_COCO_IDS.get(int(box.cls[0]))
                if not name:
                    continue
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
                if (x2 - x1) * (y2 - y1) > 0.25 * h * w:
                    subjects.append(name)
        except Exception:
            pass

    # Grey and unsaturated is not sufficient: static, noise and many synthetic
    # images satisfy the asphalt rule too. A photographed surface has coherent
    # texture — edges concentrated along features. Edges everywhere at once
    # means there is no scene, just high-frequency content.
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edge_density = float((cv2.Canny(gray, 70, 180) > 0).sum()) / float(h * w)
    incoherent = edge_density > 0.30   # static or noise, not a scene
    featureless = edge_density < MIN_EDGE_DENSITY  # drawing, screenshot, flat fill

    ok = (
        road_fraction >= MIN_ROAD_FRACTION
        and not subjects
        and not incoherent
        and not featureless
    )
    return {
        "road_fraction": round(road_fraction, 4),
        "edge_density": round(edge_density, 4),
        "looks_civic": ok,
        "reason": (
            f"the photograph is mostly of a {subjects[0]}, not a place" if subjects
            else "not a photograph of a surface — no coherent texture" if incoherent
            else "too flat to be a photograph of a real surface" if featureless
            else "no road or ground surface could be segmented" if road_fraction < MIN_ROAD_FRACTION
            else "road surface detected"
        ),
    }


def detect(data: bytes, conf: float = DEFAULT_CONF) -> dict:
    """Run detection and return structured results plus an annotated image."""
    img = _read_image(data)
    h, w = img.shape[:2]
    frame_area = float(h * w)
    mode = get_mode()

    detector = mode
    if mode == "HEURISTIC":
        dets = heuristic_detect(img)
    else:
        model, _ = get_model()
        # _predict returns raw YOLO boxes. A single large pothole routinely
        # comes back as two or three stacked boxes, which reads as several
        # potholes and makes the annotated image useless as evidence. Merge
        # before anything else looks at them — this used to happen only inside
        # the tiled branch below, so the plain whole-frame path never got it.
        dets = _merge_overlapping(_predict(model, img, conf, frame_area), frame_area)

        # A whole-frame pass reliably finds the nearest, largest defect and
        # routinely misses the smaller ones further up the road — they occupy
        # too few pixels once the frame is squeezed to the network input. So
        # the tiled pass runs even when the frame found something, and the
        # results are merged.
        #
        # The catch is that a tile is a crop with no context, and a close crop
        # of cracked asphalt reads as a garbage pile: at a 6x4 grid this image
        # returned eleven detections, most of them "Garbage Pile" above 0.5, on
        # a road with no garbage in it. So tiled results are admitted only for
        # the civic category the whole-frame pass already established — a tile
        # may add another pothole to a road scene, never a new category.
        if dets and USE_AUGMENTING_TILES:
            established = TAX.category_of(
                max(dets, key=lambda d: d.confidence).label
            )
            extra = [
                d for d in _predict_tiled(model, img, conf, frame_area, grid=(4, 3))
                if TAX.category_of(d.label) == established
                and d.confidence >= TILED_MIN_CONF
            ]
            if extra:
                merged = _merge_overlapping(dets + extra, frame_area)
                if len(merged) > len(dets):
                    dets = merged
                    detector = "TRAINED+TILED"
        # A wide street photograph puts each defect in a handful of pixels once
        # the frame is squeezed to the network's input size, and the detector
        # then reports nothing at all — the training photographs are close
        # range. Re-running over overlapping tiles restores the scale the model
        # was trained at. Only done when the whole-frame pass came back empty,
        # so the common case still costs a single inference.
        if not dets:
            # A lower threshold is defensible here precisely because the normal
            # pass found nothing: the alternative is reporting "no damage" on a
            # photograph that plainly shows some. These come back with genuinely
            # low confidence, which the severity score already accounts for —
            # confidence is a multiplier in it — so a marginal detection lands
            # as a low-severity complaint for human triage rather than a
            # confident claim.
            # The threshold here is deliberately NOT lowered below the normal
            # one. Tiles are small crops, and a crop of ordinary asphalt looks
            # enough like several classes that a permissive threshold invents
            # detections — a cracked road came back as "Open Manhole" at 0.27
            # and was routed to Water Supply. Sending a complaint to the wrong
            # department is worse than sending it to a human: "no damage
            # detected — manual triage required" is a correct answer, a
            # confident wrong class is not.
            dets = [d for d in _predict_tiled(model, img, conf, frame_area)
                    if d.confidence >= TILED_MIN_CONF]
            if dets:
                detector = "TRAINED+TILED"

        # Nothing found across the whole frame or the tiles. Before giving up,
        # ask the pothole specialist — see SPECIALIST_WEIGHTS above for why this
        # is worth a second inference and why its bar is higher.
        if not dets:
            special = _specialist_potholes(img, frame_area)
            if special:
                dets = special
                detector = "TRAINED+SPECIALIST"

        # Last resort: the classical detector, only when explicitly enabled.
        #
        # The argument for it was that reporting a lower-confidence region beats
        # reporting nothing on a photograph that plainly shows damage. Measured
        # on the held-out close-up photos, that argument does not survive: the
        # fallback contributed 11 boxes and 1 of them was a real pothole. It
        # fires precisely when the model is least sure there is anything there,
        # and a dark patch of shadow or a wet tarmac stain reads to it exactly
        # like a pothole.
        #
        # "No damage detected — manual triage required" is a correct answer.
        # A confident box on a shadow is not, and it costs an engineer a trip.
        if not dets and USE_CLASSICAL_FALLBACK:
            fallback = heuristic_detect(img)
            if fallback:
                dets = fallback
                detector = "CLASSICAL_FALLBACK"

    # Is this a photograph of a place at all?
    #
    # Only worth asking when nothing was found. If the detector located civic
    # damage then the photograph is self-evidently of the right subject, and
    # running the check anyway would reject legitimate close-ups — a photo
    # filled by a garbage pile has almost no road surface in it.
    #
    # When nothing was found there are two very different explanations, and the
    # user needs to be told which: a road with no damage on it, or a photograph
    # that is not of a road. "No damage detected" is useless advice to someone
    # who uploaded a picture of a robot.
    scene = (
        {"road_fraction": None, "edge_density": None, "looks_civic": True,
         "reason": "civic damage detected in the photograph"}
        if dets else assess_scene(img)
    )

    annotated = _annotate(img, dets)
    severity = score_severity(dets)

    # Which civic category dominates this photo? The class with the largest
    # weighted contribution decides the category, and therefore the department.
    routing = route_from_detections(dets)

    payload = []
    for d in dets:
        item = asdict(d)
        item["category"] = TAX.category_of(d.label)
        payload.append(item)

    return {
        "model_mode": mode,
        # Which stage actually produced these boxes: the trained model, the
        # tiled re-run, or the classical detector. Surfaced so a low-confidence
        # fallback result is never mistaken for a confident model prediction.
        "detector": detector,
        "image_size": {"width": w, "height": h},
        "detections": payload,
        "severity": severity,
        "routing": routing,
        "scene": scene,
        "annotated_png_b64": _to_b64_png(annotated),
    }


def route_from_detections(dets: list["Detection"]) -> dict:
    """Pick the dominant category (and hence department) from the detections.

    Each detection contributes class_weight x sqrt(area) x confidence, so a
    single large critical hazard outranks several small nuisances.
    """
    if not dets:
        return {"category": None, "department": None, "department_name": None, "sla_hours": None}

    scores: dict[str, float] = {}
    for d in dets:
        cat = TAX.category_of(d.label)
        if not cat:
            continue
        contrib = TAX.weight_of(d.label) * (d.area_ratio ** 0.5) * d.confidence
        scores[cat] = scores.get(cat, 0.0) + contrib

    if not scores:
        return {"category": None, "department": None, "department_name": None, "sla_hours": None}

    top = max(scores, key=scores.get)
    meta = TAX.CATEGORIES[top]
    return {
        "category": top,
        "department": meta["dept"],
        "department_name": meta["dept_name"],
        "sla_hours": meta["sla"],
        "category_scores": {k: round(v, 4) for k, v in sorted(scores.items(), key=lambda kv: -kv[1])},
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

    # Only SMALL holes are damage. Filling every enclosed region also swallows
    # whatever the carriageway happens to wrap around — buildings, shopfronts,
    # the far background — and their dark windows and shadows then read as
    # potholes. A pothole is small relative to the road it sits in; a building
    # is not, so holes above a fraction of the road area are carved back out.
    road_area = float((road > 0).sum())
    added = cv2.subtract(filled, road)
    if road_area > 0 and added.any():
        n_add, add_labels, add_stats, _ = cv2.connectedComponentsWithStats(added, 8)
        for i in range(1, n_add):
            if add_stats[i, cv2.CC_STAT_AREA] > 0.12 * road_area:
                filled[add_labels == i] = 0

    # ...but hole-filling is indiscriminate: a car parked on the carriageway is
    # also a hole in the grey mask, and filling puts it back. Vehicles and
    # pedestrians are therefore cut out here, AFTER the fill, so they cannot be
    # analysed as road surface. Without this a car reads as alligator cracking —
    # it is dark, textured and highly edge-dense.
    for x1, y1, x2, y2 in _occluder_boxes(img):
        filled[y1:y2, x1:x2] = 0

    return filled


def _structure_mask(gray: np.ndarray) -> np.ndarray:
    """Regions belonging to built structure rather than the ground plane.

    Buildings, poles, railings and hoardings are made of long straight edges,
    and near-vertical ones especially: a facade, a pillar, a lamp post. Road
    damage has no such geometry — a pothole outline is irregular and closed,
    a crack wanders. So long straight near-vertical lines are strong evidence
    that a region is upright structure seen side-on, not surface underfoot.

    This matters because a building facade is grey and low-saturation, which is
    exactly what the asphalt rule looks for, so segmentation alone lets dark
    windows and doorways through as potholes.
    """
    h, w = gray.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    edges = cv2.Canny(gray, 60, 170)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=60,
        minLineLength=int(0.14 * h), maxLineGap=8,
    )
    if lines is None:
        return mask
    for x1, y1, x2, y2 in lines[:, 0]:
        dx, dy = abs(int(x2) - int(x1)), abs(int(y2) - int(y1))
        # near-vertical: rises much faster than it runs
        if dy > 2.0 * dx:
            cv2.line(mask, (int(x1), int(y1)), (int(x2), int(y2)), 255, 9)
    return cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))


def _structure_overlap(mask: np.ndarray, x: int, y: int, bw: int, bh: int) -> float:
    if mask is None or bw <= 0 or bh <= 0:
        return 0.0
    win = mask[y:y + bh, x:x + bw]
    return float((win > 0).sum()) / float(bw * bh) if win.size else 0.0


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
    MAX_STRUCTURE = 0.18      # reject boxes sitting on built structure

    structure = _structure_mask(gray)

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
        if _structure_overlap(structure, x, y, bw, bh) > MAX_STRUCTURE:
            continue  # a dark window or doorway, not a hole in the ground
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
        if _structure_overlap(structure, x, y, bw, bh) > MAX_STRUCTURE:
            continue  # facade or railing edges, not surface cracking
        fill = area / rect_area if rect_area else 0.0
        aspect = bw / bh if bh else 999.0
        edge_density = float(edges[y:y + bh, x:x + bw].mean()) / 255.0
        if edge_density < 0.12:
            continue

        # Only the crack class the taxonomy still carries. Directional cracking
        # (transverse / longitudinal) was retired, so a region that looks like
        # one is reported as nothing rather than under a label the rest of the
        # system would fail to route.
        if fill > 0.45 and edge_density > 0.22 and 0.5 < aspect < 2.0:
            label = "Alligator Crack"
        else:
            continue
        conf = max(0.4, min(0.9, 0.4 + edge_density))
        dets.append(Detection(label, round(conf, 4),
                              [float(x), float(y), float(x + bw), float(y + bh)],
                              round(rect_area / frame_area, 5)))

    dets = _merge_overlapping(dets, float(img.shape[0] * img.shape[1]))
    # potholes are the headline defect — rank them first, then by size
    dets.sort(key=lambda d: (d.label != "Pothole", -d.area_ratio))
    return dets[:6]


def _annotate(img: np.ndarray, dets: list[Detection]) -> np.ndarray:
    out = img.copy()
    for d in dets:
        x1, y1, x2, y2 = [int(v) for v in d.box]
        colour = TAX.colour_of(d.label)          # one colour per civic category
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
        w = TAX.weight_of(d.label)
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


def file_sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()[:16]
