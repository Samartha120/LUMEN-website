"""Is this photograph the kind of place a civic complaint comes from?

The pothole detector answers "where are the potholes"; it cannot answer "is
this a road". Treating "no boxes" as "not a road" conflates two things a
citizen needs kept apart: an intact road with nothing to report, and an upload
that was never a road to begin with. So relevance is decided here, by a
separate model, before any damage model runs.

This is Places365 ResNet18 (MIT CSAIL), a 365-way scene classifier.

The design is asymmetric, and the reason is measured rather than assumed. The
obvious approach — accept when the scene looks like `street` or `highway` —
fails badly on exactly the photographs that matter most. Places365 is a
*scene* classifier and citizen pothole photos are *texture* close-ups, so:

    asphalt pothole, cracked surface      -> zen_garden 0.96
    water-filled pothole on a wet road    -> swimming_hole 0.30, river 0.11
    dry pothole close-ups (median of 28)  -> trench / archaelogical_excavation

Road-scene probability on real road photographs ran 0.017 to 0.72, median
0.12 — below several genuine non-road images. Any threshold demanding positive
road evidence throws away correct complaints. So this never requires road
evidence; it only rejects on confident evidence of somewhere a road cannot be.

That evidence is interiors and retail, which Places365 identifies confidently
and which no outdoor complaint photograph can be:

    a screenshot of a marking rubric     -> server_room 0.44, archive 0.24
    a scanned certificate                -> drugstore 0.41, pharmacy 0.15

Everything outdoors is left alone — including water, sand, gravel, fields and
excavations — because waterlogging, mud and unpaved roads are all real
complaints. Selfies, animals, food and held objects are caught by the COCO
subject check in `model.assess_scene`, which reads the subject of the frame
rather than the place; the two signals cover different halves of the problem.

The checkpoint is the official Places365 release, a PyTorch tar pickle, so it
is loaded with weights_only=False; that is acceptable only because of where it
comes from. It lives in weights/, which is gitignored.

Everything degrades open: if torch is missing or the weights are absent,
`classify()` returns None and the caller skips this check rather than
rejecting every upload.
"""
from __future__ import annotations

import functools
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_WEIGHTS = _HERE / "weights" / "places365.pth.tar"
_CATEGORIES = _HERE / "weights" / "categories_places365.txt"

# Interiors and retail floors. A pothole, a burst pipe or a rubbish pile is
# never photographed in one of these, so mass landing here is evidence the
# upload is not a complaint at all. Places365 marks most interiors with an
# "/indoor" suffix, which is picked up automatically; these are the ones whose
# names carry no such marker.
_INTERIOR_SCENES = {
    "archive", "attic", "auditorium", "ball_pit", "ballroom", "banquet_hall",
    "bar", "basement", "bathroom", "beauty_salon", "bedchamber", "bedroom",
    "biology_laboratory", "bookstore", "bowling_alley", "childs_room",
    "classroom", "clean_room", "closet", "clothing_store", "cockpit",
    "computer_room", "conference_center", "conference_room", "corridor",
    "dining_hall", "dining_room", "dorm_room", "dressing_room", "drugstore",
    "elevator_lobby", "elevator_shaft", "engine_room", "entrance_hall",
    "fastfood_restaurant", "galley", "gift_shop", "hardware_store",
    "home_office", "home_theater", "hospital_room", "hotel_room",
    "ice_cream_parlor", "jacuzzi/indoor", "jewelry_shop", "kindergarden_classroom",
    "kitchen", "laundromat", "lecture_room", "legislative_chamber",
    "living_room", "lobby", "locker_room", "mezzanine", "nursery",
    "nursing_home", "office", "office_cubicles", "operating_room",
    "pantry", "pharmacy", "physics_laboratory", "playroom", "reception",
    "recreation_room", "repair_shop", "restaurant", "restaurant_kitchen",
    "sauna", "server_room", "shoe_shop", "shopfront", "shower",
    "staircase", "storage_room", "supermarket", "sushi_bar", "television_room",
    "television_studio", "throne_room", "toyshop", "utility_room",
    "veterinarians_office", "waiting_room", "wet_bar", "youth_hostel",
}

# How much belief must sit on interiors before an upload is refused. Set high
# because the cost is asymmetric: wrongly rejecting a real complaint loses a
# citizen's report, while wrongly accepting one merely runs a detector that
# will find nothing.
#
# Measured over 100 road and waste photographs the median was 0.001 and the
# upper quartile 0.02, against 0.85 for scanned documents — so the two
# populations are three orders of magnitude apart and the exact cutoff barely
# matters. It sits at 0.70 because four cluttered rubbish-pile photographs
# from the live complaint queue reached 0.45-0.69: heaped objects at close
# range genuinely resemble a shop interior, and those are real complaints.
MAX_INTERIOR_MASS = 0.70


@functools.lru_cache(maxsize=1)
def _load():
    """(model, categories) or (None, None) if unavailable. Loaded once."""
    if not _WEIGHTS.exists() or not _CATEGORIES.exists():
        return None, None
    try:
        import torch
        from torchvision import models

        names: list[str] = []
        for line in _CATEGORIES.read_text().splitlines():
            if not line.strip():
                continue
            # "/a/alley 4" -> "alley";  "/b/bus_station/indoor 63" -> "bus_station/indoor"
            path = line.rsplit(" ", 1)[0]
            names.append(path[3:] if path.startswith("/") else path)

        net = models.resnet18(num_classes=365)
        ckpt = torch.load(_WEIGHTS, map_location="cpu", weights_only=False)
        state = {k.replace("module.", ""): v for k, v in ckpt["state_dict"].items()}
        net.load_state_dict(state)
        net.eval()
        return net, names
    except Exception:
        # A missing optional dependency must not take the detector down.
        return None, None


def available() -> bool:
    return _load()[0] is not None


def _is_interior(name: str) -> bool:
    return name.endswith("/indoor") or name in _INTERIOR_SCENES


def classify(img) -> dict | None:
    """Scene reading for a BGR image, or None if the classifier is unavailable.

    `interior_mass` is the share of belief on indoor and retail scenes;
    `looks_interior` is the verdict the caller acts on.
    """
    net, names = _load()
    if net is None:
        return None

    import cv2
    import torch
    from torchvision import transforms

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    tf = transforms.Compose([
        transforms.ToTensor(),
        transforms.Resize((256, 256), antialias=True),
        transforms.CenterCrop(224),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    with torch.no_grad():
        probs = torch.softmax(net(tf(rgb).unsqueeze(0))[0], dim=0)

    interior = float(sum(probs[i] for i, n in enumerate(names) if _is_interior(n)))
    top_p, top_i = probs.topk(5)
    top = [(names[int(i)], round(float(p), 4)) for p, i in zip(top_p, top_i)]
    return {
        "interior_mass": round(interior, 4),
        "top": top,
        "top_scene": top[0][0],
        # Both conditions, not either: diffuse mass spread thinly across many
        # interiors is what a cluttered outdoor photograph produces, whereas a
        # real interior also names one confidently at the top.
        "looks_interior": interior >= MAX_INTERIOR_MASS and _is_interior(top[0][0]),
    }
