"""Civic damage taxonomy — the single source of truth for the AI service.

Five damage classes across three civic categories. The detector's class list,
the severity weighting, and the department a complaint is routed to all derive
from this table, so adding a class is a one-line change here.

Every class listed here is one the trained model can actually detect. Classes
were previously declared for damage types we had no training data for —
electrical faults, waterlogging, pipe leaks, signage, railings, debris — and
they were dead weight: declared in the taxonomy, offered in the UI, never
returned by the detector. A category the system cannot detect is worse than an
absent one, because it implies a capability that does not exist. They are
removed until a labelled dataset exists for them; re-adding one is this table
plus a source in train_multi.SOURCE_MAP, then a retrain.

The `yolo_id` values are the class indices used when training the multi-category
YOLO model (see train_multi.py). They MUST stay stable once a model is trained —
renumbering them silently relabels every detection the model makes.

Classes are removed when measurement shows they cannot be learned, rather than
left in to pad the feature list. Broken Footpath (4 of 20 detected, 1 correctly
classified) and Longitudinal Crack (0.188 mAP50) both went that way — the
sidewalk annotations label hairline paving cracks inconsistently, and RDD's
longitudinal cracks are thin and easily confused with lane markings.

`yolo_id` is the output index of the CURRENT checkpoint, so the ids here are
deliberately NOT contiguous — 1 and 6 are absent because those heads belong to
removed classes. That is what lets a class be dropped without retraining:
detect() discards any prediction whose label is missing from this table, so the
orphaned heads are simply never reported. Training needs contiguous indices, so
TRAIN_IDS below renumbers for that purpose only.
"""
from __future__ import annotations

# category -> (department code, department name, resolution SLA hours)
CATEGORIES: dict[str, dict] = {
    "ROADS":  {"dept": "RDS", "dept_name": "Roads & Infrastructure", "sla": 48, "colour": (0, 0, 220)},
    "WASTE":  {"dept": "SAN", "dept_name": "Sanitation",             "sla": 24, "colour": (60, 180, 75)},
    "WATER":  {"dept": "WTR", "dept_name": "Water Supply",           "sla": 24, "colour": (220, 120, 0)},
}

# label -> (category, severity weight 0-1, yolo class id)
# Severity weight reflects public-safety impact: an open manhole is a fall
# hazard into a sewer; a garbage pile is a nuisance.
CLASSES: dict[str, dict] = {
    # --- Roads
    "Pothole":             {"category": "ROADS",  "weight": 1.00, "yolo_id": 0},
    "Alligator Crack":     {"category": "ROADS",  "weight": 0.85, "yolo_id": 2},
    # --- Waste
    "Garbage Pile":        {"category": "WASTE",  "weight": 0.50, "yolo_id": 3},
    "Overflowing Bin":     {"category": "WASTE",  "weight": 0.45, "yolo_id": 4},
    # --- Water
    "Open Manhole":        {"category": "WATER",  "weight": 1.00, "yolo_id": 5},
}

# RDD2022 raw codes -> our labels. Only the codes we still model are listed.
RDD_ALIASES = {
    "D20": "Alligator Crack",
    "D40": "Pothole",
}

DEFAULT_WEIGHT = 0.5

# Class list in checkpoint order.
YOLO_NAMES: list[str] = [
    name for name, _ in sorted(CLASSES.items(), key=lambda kv: kv[1]["yolo_id"])
]

# Contiguous 0..n-1 indices for TRAINING a fresh model. `yolo_id` tracks the
# existing checkpoint and may have gaps; a new model must be built with a dense
# range, so train_multi.py writes labels using this map instead.
TRAIN_IDS: dict[str, int] = {name: i for i, name in enumerate(YOLO_NAMES)}


def normalise(label: str) -> str:
    """Map a raw model label (RDD code or class name) to a taxonomy label."""
    if label in CLASSES:
        return label
    return RDD_ALIASES.get(label, label)


def category_of(label: str) -> str | None:
    entry = CLASSES.get(normalise(label))
    return entry["category"] if entry else None


def weight_of(label: str) -> float:
    entry = CLASSES.get(normalise(label))
    return entry["weight"] if entry else DEFAULT_WEIGHT


def department_of(label: str) -> dict | None:
    cat = category_of(label)
    return CATEGORIES.get(cat) if cat else None


def colour_of(label: str) -> tuple[int, int, int]:
    """BGR annotation colour, by category."""
    cat = category_of(label)
    if cat and cat in CATEGORIES:
        return CATEGORIES[cat]["colour"]
    return (0, 165, 255)
