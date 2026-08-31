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

import scene_classifier
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
# The bar was first set to 0.70, tuned on the held-out slice of our own pothole
# source. That was the wrong test set: the model trained on 238 of those 261
# images, so the held-out 23 share their photographers and style and flatter it.
#
# Re-measured on an independent set — 60 labelled photos from a different
# Roboflow project, which is the honest proxy for "a photo pulled off Google":
#
#     specialist bar   shows a box   correct  precision  recall
#     off               11/60 (18%)        9      0.818   0.070
#     0.70              33/60 (55%)       31      0.775   0.242
#     0.50              37/60 (62%)       37      0.771   0.289
#     0.30              39/60 (65%)       36      0.667   0.281
#
# 0.50 wins on every axis that matters and 0.30 overshoots — it draws more boxes
# but gets fewer of them right. Note the first row: without the specialist this
# detector finds a pothole in fewer than one web photo in five.
#
# It replaces the classical fallback that used to fill this slot and put a 0.61
# confidence box on a puddle. Single-class, so it can only ever add potholes —
# it cannot invent a garbage pile or misroute a complaint to another department.
SPECIALIST_WEIGHTS = WEIGHTS_DIR / "pothole_specialist.pt"
SPECIALIST_MIN_CONF = 0.50
# Off. The specialist was a YOLOv8n-seg that existed only to outline potholes,
# and potholes are no longer outlined (see POLYGON_CLASSES), so it was never
# called and its checkpoint was deleted. The code path is left intact so the
# flag still works if a pothole tracer is ever reinstated with new weights.
USE_POTHOLE_SPECIALIST = os.environ.get("LUMEN_POTHOLE_SPECIALIST", "0") == "1"
# Whether the segmentation specialist may report potholes on its own account,
# as opposed to only drawing the outline of one the primary detector found.
# Off: it produced whole-frame false positives that the primary model correctly
# ignored. Set LUMEN_SPECIALIST_DETECTS=1 to restore the old behaviour.
SPECIALIST_CONTRIBUTES_DETECTIONS = os.environ.get("LUMEN_SPECIALIST_DETECTS", "0") == "1"
# Report the fine-tuned pothole model's boxes as it reported them, rather than
# passing them through the sky/person/road-coverage filters written for the
# older, weaker detector. Set LUMEN_RAW_POTHOLE=0 to put the filters back.
RAW_POTHOLE_PASSTHROUGH = os.environ.get("LUMEN_RAW_POTHOLE", "1") == "1"
# Union overlapping boxes into one, rather than suppressing the weaker of them.
# Off — see _merge_overlapping. Set LUMEN_UNION_MERGE=1 alongside tiling.
UNION_MERGE = os.environ.get("LUMEN_UNION_MERGE", "0") == "1"
# Let the multi-class civic model contribute detections. Off: it is the one
# model here never retrained with hard negatives and it invents low-confidence
# manholes and potholes on rubbish. Set LUMEN_MULTICLASS=1 to restore it —
# necessary for waste, water and crack detection, which nothing else covers.
USE_MULTICLASS_MODEL = os.environ.get("LUMEN_MULTICLASS", "1") == "1"
# Classes the multi-class model may report. "Open Manhole" is withheld: it is
# the one class whose training labels are contaminated, and it calls intact
# closed covers a fall hazard at 0.80 confidence (CMP-10281). The cause is in
# train_multi.SOURCE_MAP — 422 images labelled only "Lose" show a cover seated
# flush in the pavement, and they were mapped to Open Manhole as positives,
# contradicting 508 near-identical closed covers trained as background. The
# model resolved that toward the hazard.
#
# Suppressing one class keeps Garbage Pile, Overflowing Bin and Alligator
# Crack working — they are detected correctly (30/30, 10/13, 5/5) and they are
# what makes this a three-department civic platform rather than a pothole app.
# Re-add it to this set once the multi-class model is retrained with Lose
# remapped to background.
SUPPRESSED_CLASSES = {
    c.strip() for c in os.environ.get("LUMEN_SUPPRESS", "Open Manhole").split(",") if c.strip()
}

# Classes the multi-class model is not trusted to report, dropped before its
# detections join the pool. Blanket-disabling the whole model was the wrong cut:
# measured on 80 held-out images it looked like an improvement (precision 0.769
# -> 0.911), but it also silenced the model that was carrying the general web
# photographs. On a textbook asphalt pothole the fine-tune scores 0.156 and on a
# water-filled one 0.069 — both under threshold — while the multi-class model
# had them at 0.93. Those are precisely the Google-Images-style uploads this
# platform is demonstrated with, so losing them is not a win.
#
# Only one class is actually broken. "Open Manhole" was trained with its
# negative examples DISCARDED — train_multi.SOURCE_MAP maps "Good", an intact
# cover, to None — so all 508 intact covers were dropped instead of being
# learned as background, and every manhole the model has ever seen was a
# hazard. It called a closed cover an Open Manhole at 0.80 on CMP-10281 and
# invented one at 0.34 on a rubbish pile. Suppressed until retrained with those
# images as hard negatives, which is the same fix that took pothole precision
# from 0.771 to 0.816.
UNTRUSTED_MULTICLASS = {
    c.strip() for c in os.environ.get(
        "LUMEN_UNTRUSTED_CLASSES",
        "Open Manhole,Alligator Crack,Overflowing Bin",
    ).split(",")
    if c.strip()
}
# Which multi-class predictions are fit to show a supervisor. Measured against
# each source corpus's own ground truth at IoU 0.45, on held-out splits:
#
#     Garbage Pile      P 0.825   R 0.732      52/11/19    kept
#     Alligator Crack   P 0.639   R 0.225      23/13/79    withheld
#     Overflowing Bin   P 0.500   R 0.444       4/4/5      withheld
#     Open Manhole        —         —          no held-out split   withheld
#
# Alligator Crack walks past three cracks in four, and one box in three that
# it does draw is wrong. Overflowing Bin is a coin toss. Neither is worth
# putting in front of someone deciding where to send a repair crew, and a
# confident wrong class is worse than an honest silence — the complaint still
# reaches a human, it just is not pre-labelled with a guess.
#
# Garbage Pile stays: it is the one non-pothole class that measures well.
# Remove entries from this set as the multi-class model is retrained and each
# class earns its place back on evidence.

# Confidence the segmentation model must reach when it is only being asked to
# trace an outline over a pothole another model already found. Far below its
# detection bar on purpose: the overlap test is the real filter, so a weak
# trace is free and a missing one costs a rectangle instead of an outline.
SEGMENT_TRACE_CONF = float(os.environ.get("LUMEN_SEGMENT_TRACE_CONF", "0.10"))

# A local pothole detector, ahead of everything else.
#
# Found by testing eighteen published models against held-out data rather than
# trusting their advertised figures — three of which claimed 97-100% precision
# and measured 0.76 or below. This one advertises nothing and wins:
#
#     model                   v9 P/R        wide-street P/R
#     this (Samdutse)         0.75 / 0.70   0.98 / 0.71
#     hosted qwkkc/2          0.85 / 0.47   0.96 / 0.48
#     our civic_best.pt       0.73 / 0.30   —
#
# At 0.40 it reaches 0.95 precision / 0.81 recall on wide-street photographs,
# which is the class of image this platform actually receives. 11M parameters,
# 21MB, runs locally: no API key, no network round trip, and citizen
# photographs never leave the machine.
#
#   huggingface.co/Samdutse/pothole-yolov8
# SUPERSEDED by models/pothole_best.pt, the LUMEN fine-tune. Measured against
# each other on 665 held-out images from a corpus neither had trained on:
#
#                                precision   recall    F1
#     Samdutse pothole_local      0.771      0.568    0.654    (via the full pipeline)
#     LUMEN pothole_best.pt       0.816      0.686    0.745
#
# Both metrics moved together, which is what distinguishes a better model from
# a different operating point on the same curve. mAP50 0.799, mAP50-95 0.434.
# The gain is credited to 680 hard negatives — manhole covers, open voids,
# cracked and stained dashcam roads — teaching it what is *not* a pothole.
#
# The Samdutse fallback checkpoint was deleted once the fine-tune proved out,
# so this now resolves to the fine-tune or to nothing. The else branch is kept
# because it costs a line and documents where a fallback would go.
FINE_TUNED_WEIGHTS = Path(__file__).resolve().parent / "models" / "pothole_best.pt"
LOCAL_POTHOLE_WEIGHTS = (FINE_TUNED_WEIGHTS if FINE_TUNED_WEIGHTS.exists()
                         else WEIGHTS_DIR / "pothole_local.pt")

# 0.25 for the fine-tune, not 0.45. The two models are calibrated differently
# and the threshold is not portable between them: at 0.50 the fine-tune scores
# 0.988 precision but 0.182 recall — it would find fewer than one pothole in
# five. Swapping the weights without moving this number would have made the
# site substantially worse while every offline metric looked excellent.
_DEFAULT_LOCAL_CONF = "0.25" if FINE_TUNED_WEIGHTS.exists() else "0.45"
LOCAL_POTHOLE_CONF = float(os.environ.get("LUMEN_LOCAL_POTHOLE_CONF", _DEFAULT_LOCAL_CONF))
_local_pothole = None
_local_pothole_failed = False

# A dedicated Open Manhole detector, replacing the multi-class model's version
# of that class. The multi-class one was withheld because it called an intact
# closed cover a fall hazard at 0.80 (CMP-10281): 422 images labelled "Lose"
# show a cover seated flush in the pavement and were trained as the hazard,
# contradicting 508 near-identical "Good" covers trained as background.
#
# This model was trained on the same corpus with that contradiction removed —
# Broken and Uncovered are the hazard, Good and Lose are background — giving
# 314 hazard images against 590 closed-cover negatives. On its held-out split:
#
#     precision 0.772   recall 0.848   mAP50 0.854   mAP50-95 0.535
#
# That split is a random slice of one corpus, so it is a same-source figure and
# proves only that the contradiction is gone, not that the model generalises.
# The test that matters is whether it stays silent on a closed cover.
MANHOLE_WEIGHTS = Path(__file__).resolve().parent / "models" / "manhole_best.pt"
# 0.55, not 0.35. Measured over 40 genuine open manholes and 40 closed covers
# that the model still fires on:
#
#     conf 0.35   keeps 40/40 real   admits 40/40 closed covers
#     conf 0.55   keeps 39/40 real   admits 17/40
#
# At 0.35 it fires on everything round and dark, which is how a pothole came
# to be labelled Open Manhole at 37% while the pothole model called the same
# pixels a pothole at 70% (CMP-10358). One real manhole is lost; a great many
# wrong ones are not drawn.
# 0.50. First set to 0.55 from the confidence spread on the complaint set,
# then re-measured on the 92-image held-out test split, which is the honest
# test — 46 real manholes and 46 intact covers the model never trained on:
#
#     conf 0.35   recall 93%   false alarms 3/46
#     conf 0.50   recall 87%   false alarms 1/46
#     conf 0.55   recall 80%   false alarms 1/46
#
# 0.55 gave up three real manholes to remove no false alarms at all, so 0.50 is
# strictly better. It still fires on 0 of the 77 non-manhole complaint images,
# which is the regression that mattered: at the original 0.35 a pothole was
# labelled Open Manhole at 37% while the pothole model called it a pothole at
# 70% (CMP-10358).
MANHOLE_CONF = float(os.environ.get("LUMEN_MANHOLE_CONF", "0.50"))

# Second chance for a manhole the detector nearly saw.
#
# At 0.50 the detector misses about one manhole in seven, and none of those
# misses are blanks — measured on the held-out split they score 0.31 to 0.41,
# sitting just under the bar. Simply lowering the bar to 0.35 recovers them and
# also starts calling intact covers hazards, which is the failure this class
# had in the first place.
#
# So a weak detection is admitted only when a SECOND, independently trained
# model agrees there is a manhole in the same place. models/manhole_seg.pt was
# trained on different labels (outlines, not boxes) and a different split, so
# its agreement is real evidence rather than the same model saying it twice.
# Measured on 46 held-out manholes and 46 intact covers:
#
#     detector >= 0.50 only            recall 87%   false alarms 1/46
#     + agreement (0.35 / 0.25)        recall 93%   false alarms 2/46
#     detector >= 0.35, no agreement   recall 93%   false alarms 3/46
#
# Same recall as dropping the bar, for one fewer false alarm — and on the 112
# complaint images it keeps all 33 manholes while adding 0 false ones, so the
# pothole that was labelled Open Manhole at 37% (CMP-10358) stays fixed.
# 0.30, swept 2026-08-29 over 70 real hazards and 70 intact covers:
#
#     weak 0.35  recall 89%   false alarms 1/70   (was live)
#     weak 0.30  recall 90%   false alarms 1/70
#     weak 0.25  recall 90%   false alarms 1/70   (no further gain)
#
# One extra manhole for no extra false alarm, and the curve is flat below 0.30.
# The remaining misses are NOT recoverable by threshold: the segmentation model
# does not corroborate them, so no weak-detection rule can admit them safely.
MANHOLE_WEAK_CONF = float(os.environ.get("LUMEN_MANHOLE_WEAK_CONF", "0.30"))
MANHOLE_TTA = os.environ.get("LUMEN_MANHOLE_TTA", "1") == "1"
MULTICLASS_TTA = os.environ.get("LUMEN_MULTICLASS_TTA", "1") == "1"

# How confident a specialist must be to overturn a scene-classifier rejection.
# Set at the manhole model's own confident floor, which was measured to give
# one false alarm in seventy intact covers — a bar that already survives the
# hardest negatives this class has.
SCENE_RESCUE_CONF = float(os.environ.get("LUMEN_SCENE_RESCUE_CONF", "0.50"))
PERSON_OVERLAP_MAX = float(os.environ.get("LUMEN_PERSON_OVERLAP", "0.6"))
MANHOLE_AGREE_CONF = float(os.environ.get("LUMEN_MANHOLE_AGREE_CONF", "0.25"))

# --- Manhole outlines -------------------------------------------------------
# The manhole corpus is bounding boxes only, so the detector cannot produce a
# polygon: 1,290 labels, none of them an outline. Rather than leave the class
# drawn as a rectangle, the box is handed to a PROMPTABLE segmentation model
# (MobileSAM), which is asked one question — "which pixels inside this box are
# the object?" — and answers without knowing or caring what the object is.
#
# This cannot invent, move, or relabel a detection. SAM never runs unprompted;
# it only refines an outline for a box the manhole detector already committed
# to. Detection stays the detector's job, boundary becomes SAM's.
#
# Restricted to Open Manhole on purpose. Measured over every box-only detection
# in the complaint set:
#
#     Open Manhole   29/33 outlined (88%)   the 4 refusals are correct
#     Pothole        13/110              traced the whole frame, or a blob of
#                                        clean road, on the ones it accepted
#     Garbage Pile    3/36               a pile has no single boundary
#
# A manhole is one compact, roughly convex opening, which is why the shape gate
# below is meaningful for it and meaningless for a garbage pile. Potholes keep
# the dedicated pothole segmentation model they already have.
# Which classes are allowed to carry a segmentation outline at all.
#
# Open Manhole only, by decision rather than by capability. A polygon changes
# no number anywhere — severity, priority, volume and the material estimate are
# all computed from `area_ratio` and `box`, and dimensions.ts never reads the
# outline — so this is purely what a supervisor is shown.
#
# A manhole is a discrete object with a real boundary, and it is traced well:
# 94% of complaint detections and 98% of detections on unseen uploads. A pothole
# has no crisp edge. Its tracer managed 42%, so a supervisor saw outlines on
# some potholes and rectangles on others with no visible reason for the
# difference, and a YOLO11s-seg trained on 300 annotated photos to fix that
# scored mask mAP50 0.713 and drew its extra outlines around water patches and
# pothole rims. A rectangle is the honest shape for a fuzzy depression.
#
# Enforced here rather than at each tracer so no future source can reintroduce
# a polygon on a class that is not meant to have one.
POLYGON_CLASSES = {
    c.strip() for c in os.environ.get(
        "LUMEN_POLYGON_CLASSES", "Open Manhole,Closed Manhole").split(",")
    if c.strip()
}

OUTLINE_MANHOLES = os.environ.get("LUMEN_SAM_OUTLINE", "1") == "1"
SAM_WEIGHTS = Path(__file__).parent / "mobile_sam.pt"

# The tracer of first resort is a YOLO11s-seg fine-tuned on manhole outlines
# (models/manhole_seg.pt). Its training labels did not exist either: the 467
# box-labelled hazard images were outlined by MobileSAM, filtered by the shape
# gate below, and the 311 survivors checked by eye — the semi-automatic
# annotation route the STDL streetview project takes with LiDAR and a Hough
# transform. 114 epochs, early-stopped, held-out test of 92 images:
#
#     mask   P 0.858   R 0.788   mAP50 0.881
#     box    P 0.858   R 0.788   mAP50 0.879
#
# Recall is below the 0.80 target and is NOT claimed to meet it.
#
# It is used only to TRACE, never to detect, even though it can detect. Asked
# to find manholes on the complaint set it fired on 5 of 79 images with no
# manhole in them, while the calibrated detector fires on 0 — so letting it
# detect would reintroduce the false positives that MANHOLE_CONF above was
# raised to remove. Confined to tracing boxes the detector already committed
# to, it outlines 33 of 33 against MobileSAM's 29, and runs in a fraction of
# SAM's 386 ms per box. SAM stays as the fallback for anything it cannot match.
SEG_WEIGHTS = Path(__file__).parent / "models" / "manhole_seg.pt"
SEG_TRACE_CONF = float(os.environ.get("LUMEN_SEG_TRACE_CONF", "0.15"))
_seg_model = None
_seg_failed = False


def _blobs(mask: np.ndarray) -> list:
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [c for c in cnts if cv2.contourArea(c) > 20]


def _largest(mask: np.ndarray) -> "np.ndarray | None":
    cnts = _blobs(mask)
    return max(cnts, key=cv2.contourArea) if cnts else None


def _seg_flip_mask(img: np.ndarray, box: list[float], code: int) -> "np.ndarray | None":
    """The same trace on a flipped image, flipped back into place.

    `code` is an OpenCV flip code: 1 mirrors left-right, 0 top-bottom.
    """
    try:
        h, w = img.shape[:2]
        flipped = cv2.flip(img, code)
        if code == 1:
            fbox = [w - box[2], box[1], w - box[0], box[3]]
        else:
            fbox = [box[0], h - box[3], box[2], h - box[1]]
        res = _seg_model.predict(flipped, conf=SEG_TRACE_CONF, verbose=False)[0]
        if res.masks is None or len(res.masks) == 0:
            return None
        best, best_iou = None, 0.0
        for mb, mask in zip(res.boxes.xyxy, res.masks.data):
            iou = _iou([float(v) for v in mb], fbox)
            if iou > best_iou:
                best, best_iou = mask, iou
        if best is None or best_iou < SEG_MIN_BOX_IOU:
            return None
        m = best.cpu().numpy().astype(np.uint8)
        if m.shape[:2] != img.shape[:2]:
            m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
        return cv2.flip(m, code)
    except Exception:
        return None


def _seg_outline(img: np.ndarray, box: list[float]) -> np.ndarray | None:
    """Largest contour the manhole segmentation model finds inside `box`."""
    global _seg_model, _seg_failed
    if _seg_failed:
        return None
    if _seg_model is None:
        if not SEG_WEIGHTS.exists():
            _seg_failed = True
            return None
        try:
            from ultralytics import YOLO
            _seg_model = YOLO(str(SEG_WEIGHTS))
        except Exception:
            _seg_failed = True
            return None
    try:
        # A low bar on purpose: the decision that there IS a manhole here was
        # already made by the detector, so this is only asked where to put the
        # boundary. A weak trace that overlaps nothing is discarded below.
        #
        # Traced three times -- as given, mirrored left-right, and flipped
        # top-bottom -- and the masks unioned. A segmentation model is not
        # symmetric in either axis: on a cover filling most of the frame it
        # reliably clips one side, and flipping moves the clip to the opposite
        # side, so the union recovers the whole object. Span of the detector's
        # box covered by the trace, on the complaints that were reported as
        # incompletely outlined:
        #
        #     CMP-10414   0.79 -> 0.92     (left-right)
        #     CMP-10472   0.84 -> 0.89     (left-right)
        #     CMP-10311   0.72 -> 0.88     (top-bottom)
        #     CMP-10288   0.72 -> 0.88     (top-bottom)
        #     CMP-10460   0.78 -> 1.01     (both)
        #
        # Over all 56 manholes the vertical pass improves nine outlines and
        # makes none worse. Costs two extra forward passes on a 10M-parameter
        # model, which on this image size is a few milliseconds.
        res = _seg_model.predict(img, conf=SEG_TRACE_CONF, verbose=False)[0]
        if res.masks is None or len(res.masks) == 0:
            return None
        best, best_iou = None, 0.0
        for mb, mask in zip(res.boxes.xyxy, res.masks.data):
            cand = [float(v) for v in mb]
            iou = _iou(cand, box)
            if iou > best_iou:
                best, best_iou = mask, iou
        if best is None or best_iou < SEG_MIN_BOX_IOU:
            return None
        m = best.cpu().numpy().astype(np.uint8)
        if m.shape[:2] != img.shape[:2]:
            m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)

        union = m.copy()
        for code in (1, 0):
            flipped = _seg_flip_mask(img, box, code)
            if flipped is not None:
                union = cv2.bitwise_or(union, flipped)

        # The union is kept only when it is still a single tidy object that
        # stays within the detector's box. Two ways it can go wrong, both seen:
        # the flipped pass finds a piece the original missed but does not join
        # it up, leaving fragments (CMP-10440); or it reaches past the object
        # onto the surrounding pavement (CMP-10460, whose union spilled to 101%
        # of the box). In either case the plain trace was already good, so that
        # is what is used.
        best = _largest(union)
        if best is not None:
            area = cv2.contourArea(best)
            others = sum(cv2.contourArea(c) for c in _blobs(union))
            x, y, w, h = cv2.boundingRect(best)
            box_area = max((box[2] - box[0]) * (box[3] - box[1]), 1.0)
            if (area / max(others, 1.0) >= OUTLINE_MIN_DOMINANCE
                    and (w * h) / box_area <= SEG_UNION_MAX_SPAN):
                return best
        return _largest(m)
    except Exception:
        return None

# SAM answers every prompt, including prompts where the honest answer is "not
# this box". On loose boxes around a square paving slab it outlined the SLAB
# instead of the manhole in it. Those failures are not subtle once measured:
#
#     correct outlines   solidity 0.955-0.989, one dominant blob
#     wrong object       solidity 0.893-0.941, fragmenting into 2-7 pieces
#
# So an outline is accepted only if it looks like one compact object. Solidity
# is contour area over convex-hull area: a manhole ring is nearly convex, while
# a mask that has crawled along mortar lines is not. Dominance requires the
# largest piece to be essentially the whole mask — this tolerates the specks
# SAM leaves in the slots of a cover (CMP-10288, a correct outline that a
# stricter "exactly one blob" rule rejected) while still rejecting a mask that
# has genuinely shattered.
#
# A rejected outline is not a failure. The detection keeps its rectangle, which
# is honest about where the boundary is not known. A confident polygon drawn
# around the wrong object is worse than an obvious box.
OUTLINE_MIN_SOLIDITY = 0.95
OUTLINE_MIN_DOMINANCE = 0.90

# The trained tracer is judged on agreement, not convexity.
#
# The 0.95 solidity floor above was calibrated against MobileSAM, which is
# prompted with a box and knows nothing about manholes — asked the wrong
# question it will happily outline the paving slab, and the tell was a ragged
# mask fragmenting into 2-7 pieces. models/manhole_seg.pt cannot make that
# mistake: it is trained on manholes only, so the thing it outlines is a
# manhole or it outlines nothing.
#
# For it the meaningful check is whether its mask lands where the detector said
# the manhole is. Measured over all 33 manhole detections in the complaint set:
#
#     solidity  min 0.918   median 0.984
#     IoU with the detector's own box   min 0.58   median 0.79
#
# Agreement is tightened from 0.30 to 0.50, which all 33 clear with room to
# spare. Convexity was ALSO relaxed to 0.90 to reach 33/33, and that was wrong:
# the two outlines it admitted (CMP-10254, CMP-10263) traced the whole cracked
# slab, intact paving included, instead of the opening in the middle of it.
# Solidity 0.918 with one clean blob and IoU 0.90 against the detector box all
# looked healthy, and the outline was still around the wrong thing — a class-
# constrained tracer narrows what can be outlined, it does not guarantee which
# part gets outlined. So the floor stays at 0.95 and those two keep a rectangle.
SEG_MIN_SOLIDITY = OUTLINE_MIN_SOLIDITY
# Only a trace that already reaches this much of the detector's box may be
# repaired by an ellipse fit -- see _ellipse_repair.
ELLIPSE_REPAIR_MIN_SPAN = 0.75
# ...and its convex hull must agree with its own ellipse fit this closely,
# so only genuinely round objects are reshaped.
ELLIPSE_REPAIR_MIN_IOU = 0.88
# How far short of its own ellipse an already-accepted trace must fall before
# it is treated as a circle with a slice cut off it. See _ellipse_repair.
ELLIPSE_TRUNCATED_MIN = 1.10
ELLIPSE_TRUNCATED_MAX = 1.45
# Bounds for the last-resort concave route -- see _accept_concave.
CONCAVE_MIN_FILL = 0.35
CONCAVE_MAX_FILL = 0.92
CONCAVE_MIN_CONTAINMENT = 0.95
# A flipped-pass union wider than this has left the object. See _seg_outline.
SEG_UNION_MAX_SPAN = 0.98
# A manhole box this large is the model giving up and returning the frame,
# not a close-up. See _manholes and _drop_frame_duplicates.
MANHOLE_LOOSE_FRAME = 0.80
MANHOLE_MAX_FRAME = 0.90
# Open-versus-closed judgement -- see _manhole_is_open.
MANHOLE_VOID_LEVEL = 60        # 0-255; below this is unlit, not shadowed
MANHOLE_VOID_FRACTION = 0.12   # this much of the interior must be void
MANHOLE_VOID_RELATIVE = 0.50   # ...and it must be this dark vs the pavement
MANHOLE_SURROUND_PX = 30       # width of the pavement reference ring
# The multi-class model may point at a manhole, never label one.
MULTICLASS_MANHOLE_LOCATOR = os.environ.get("LUMEN_MC_MANHOLE", "1") == "1"
MULTICLASS_MANHOLE_CONF = float(os.environ.get("LUMEN_MC_MANHOLE_CONF", "0.60"))
CLOSED_MANHOLE = "Closed Manhole"
MANHOLE_LABELS = {"Open Manhole", CLOSED_MANHOLE}
# A box drawn around an already-kept, more confident box of the same class is
# a duplicate of it at a looser scale. See _nms.
CONTAINER_DROP = 0.90
# A pothole this far inside a garbage pile is litter, not road damage.
LITTER_POTHOLE_DROP = 0.90
SEG_MIN_BOX_IOU = 0.50
OUTLINE_MIN_BOX_PX = 8

_sam_model = None
_sam_failed = False


def _seg_agreement(img: np.ndarray, box: list[float]) -> float:
    """Confidence the segmentation model puts on a manhole overlapping `box`."""
    if _seg_model is None and not _seg_failed:
        _seg_outline(img, box)          # loads the model, result unused
    if _seg_model is None:
        return 0.0
    try:
        res = _seg_model.predict(img, conf=0.01, verbose=False)[0]
        if res.boxes is None or len(res.boxes) == 0:
            return 0.0
        return max((float(c) for b, c in zip(res.boxes.xyxy, res.boxes.conf)
                    if _iou([float(v) for v in b], box) >= 0.30), default=0.0)
    except Exception:
        return 0.0


def _outline_from_point(img: np.ndarray, box: list[float]) -> list[list[float]] | None:
    """Last resort: prompt SAM with the darkest point inside the box.

    A box prompt asks "what is in this rectangle", and on a broken slab the
    honest answer is the slab — which is how CMP-10254 got outlined around the
    paving instead of the hole in it. A point prompt asks a narrower question:
    "what is THIS", aimed at the darkest pixel in the box, which on a manhole is
    the opening rather than the cover around it.

    Judged on containment, not convexity. The opening in a broken cover is
    genuinely jagged — the trace that works here scores solidity 0.695 — so the
    0.95 floor would reject a correct outline. What separates it from the slab
    failure is that the whole mask sits inside the detector's box and does not
    fill it: the slab traces spilled past the box and swallowed it.
    """
    x1, y1, x2, y2 = (int(v) for v in box)
    if x2 - x1 < OUTLINE_MIN_BOX_PX or y2 - y1 < OUTLINE_MIN_BOX_PX:
        return None
    if _sam_model is None:
        return None
    try:
        sub = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        sub = cv2.GaussianBlur(sub, (21, 21), 0)
        my, mx = np.unravel_index(int(np.argmin(sub)), sub.shape)
        res = _sam_model(img, points=[[x1 + int(mx), y1 + int(my)]], labels=[1],
                         verbose=False)[0]
        if res.masks is None or len(res.masks) == 0:
            return None
        m = res.masks.data[0].cpu().numpy().astype(np.uint8)
        if m.shape[:2] != img.shape[:2]:
            m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
        total = float(m.sum())
        if total <= 0:
            return None
        inside = float(m[y1:y2, x1:x2].sum())
        box_area = max((x2 - x1) * (y2 - y1), 1)
        # Entirely within the box the detector committed to, and a part of it
        # rather than the whole of it.
        if inside / total < 0.95 or not (0.02 <= inside / box_area <= 0.90):
            return None
        cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = [c for c in cnts if cv2.contourArea(c) > 20]
        if not cnts:
            return None
        big = max(cnts, key=cv2.contourArea)
        area = cv2.contourArea(big)
        if area <= 0 or area / max(sum(cv2.contourArea(c) for c in cnts), 1.0) < OUTLINE_MIN_DOMINANCE:
            return None
        pts = cv2.approxPolyDP(big, 0.004 * cv2.arcLength(big, True), True).reshape(-1, 2)
        if len(pts) < 3:
            return None
        return [[round(float(x), 1), round(float(y), 1)] for x, y in pts]
    except Exception:
        return None


def _mask_iou(a: np.ndarray, b: np.ndarray, box: list[float]) -> float:
    """Overlap of two contours, rasterised over the detector's box."""
    x0, y0 = int(box[0]), int(box[1])
    w, h = max(int(box[2] - box[0]), 1), max(int(box[3] - box[1]), 1)
    ma, mb = np.zeros((h, w), np.uint8), np.zeros((h, w), np.uint8)
    cv2.drawContours(ma, [a - [x0, y0]], -1, 1, -1)
    cv2.drawContours(mb, [b - [x0, y0]], -1, 1, -1)
    union = int(np.count_nonzero(ma | mb))
    return int(np.count_nonzero(ma & mb)) / union if union else 0.0


def _ellipse_repair(cnt: np.ndarray, box: list[float],
                    already_accepted: bool = False) -> list[list[int]] | None:
    """Rescue a trace that reaches the whole object but has a ragged edge.

    A manhole is a circle, so its outline in any photo is an ellipse. When the
    segmentation mask spans the detector's box but snags on something at the
    rim -- wet grass, a bystander's shoe -- the raggedness fails the solidity
    test and a far worse outline gets used instead. Fitting an ellipse through
    the mask's points recovers the real boundary: the fit is least-squares over
    the whole contour, so a local excursion pulls it only slightly while the
    hundreds of points along the true rim hold it in place.

    Deliberately narrow. It only runs on a trace that already covers most of
    the box, so a genuinely partial mask is never inflated into a full circle.
    Measured on CMP-10472, where the shoe dropped solidity to 0.882:

        ragged trace   span 0.89   solidity 0.882   (rejected)
        ellipse fit    span 0.94   solidity 1.000   (traces the rim exactly)
    """
    if len(cnt) < 5:
        return None
    bw, bh = box[2] - box[0], box[3] - box[1]
    x, y, w, h = cv2.boundingRect(cnt)
    if (w * h) / max(bw * bh, 1) < ELLIPSE_REPAIR_MIN_SPAN:
        return None
    # Fitted through the convex hull rather than the raw contour, so the notch
    # bitten out of the rim cannot drag the fit inwards.
    hull = cv2.convexHull(cnt)
    try:
        (cx, cy), (aw, ah), ang = cv2.fitEllipse(hull)
    except cv2.error:
        return None
    pts = cv2.ellipse2Poly((int(cx), int(cy)), (int(aw / 2), int(ah / 2)),
                           int(ang), 0, 360, 6)
    if len(pts) < 3:
        return None
    # Only reshape something that is genuinely round. A drain grate is a
    # rectangle and a broken slab is an irregular polygon; forcing an ellipse
    # onto either cuts its corners off. Comparing the *hull* against the
    # ellipse separates the cases cleanly, where comparing the raw contour did
    # not: a circle with a bite taken out of it still has a circular hull,
    # while a rectangle's hull is a rectangle and can never fill more than
    # about pi/4 of the ellipse drawn round it. Measured:
    #
    #     CMP-10472  round chamber, shoe at the rim   0.954  repaired
    #     CMP-10480  rectangular drain grate          0.865  left alone
    #     CMP-10254  broken slab                      0.793  left alone
    if _mask_iou(hull, pts.reshape(-1, 1, 2), box) < ELLIPSE_REPAIR_MIN_IOU:
        return None
    if already_accepted:
        # Overruling a trace that passed the shape gate needs stronger grounds
        # than rescuing one that failed it, so the shortfall must look like a
        # slice off a circle: enough missing to matter, not so much that the
        # ellipse is inventing an object. Measured over all 61 manholes, only
        # CMP-10460 qualifies -- its trace covers 1/1.29 of its own ellipse.
        # CMP-10404, a displaced rectangular cover, is turned away at 2.29,
        # and the correctly traced small openings sit at 1.06 to 1.09.
        shortfall = cv2.contourArea(pts) / max(cv2.contourArea(cnt), 1.0)
        if not ELLIPSE_TRUNCATED_MIN < shortfall <= ELLIPSE_TRUNCATED_MAX:
            return None
    # The fit may bulge a little past the detector's box; hold it inside.
    pts[:, 0] = np.clip(pts[:, 0], box[0], box[2])
    pts[:, 1] = np.clip(pts[:, 1], box[1], box[3])
    return [[int(px), int(py)] for px, py in pts]


def _outline(img: np.ndarray, box: list[float]) -> list[list[float]] | None:
    """Trace the object inside `box`. None when the trace is not trustworthy."""
    global _sam_model, _sam_failed
    if not OUTLINE_MANHOLES or _sam_failed:
        return None
    x1, y1, x2, y2 = (int(v) for v in box)
    if x2 - x1 < OUTLINE_MIN_BOX_PX or y2 - y1 < OUTLINE_MIN_BOX_PX:
        return None
    trained = _seg_outline(img, [x1, y1, x2, y2])
    if trained is not None:
        poly = _accept_outline([trained], SEG_MIN_SOLIDITY)
        # Not attempted when the box is most of the photograph: there is no
        # background left for the rim to sit against, and the fit lands on
        # whatever fills the frame. CMP-10387 is a cable chamber shot at 98%
        # of the frame, where this drew an arc across the whole image.
        frame_frac = ((x2 - x1) * (y2 - y1)) / max(img.shape[0] * img.shape[1], 1)
        if frame_frac < MANHOLE_MAX_FRAME:
            # Tried even when the trace passed the gate above. A mask sliced
            # off flat down one side is still convex, so it satisfies every
            # test and ships looking like a letter D. CMP-10460 is a round
            # cover whose trace is cut straight down the left edge at solidity
            # 0.986 -- nothing in the shape gate objects to it.
            repaired = _ellipse_repair(trained, [x1, y1, x2, y2],
                                       already_accepted=poly is not None)
            if repaired:
                return repaired
        if poly:
            return poly
    if _sam_model is None:
        if not SAM_WEIGHTS.exists():
            _sam_failed = True
            return None
        try:
            from ultralytics import SAM
            _sam_model = SAM(str(SAM_WEIGHTS))
        except Exception:
            _sam_failed = True
            return None
    try:
        res = _sam_model(img, bboxes=[[x1, y1, x2, y2]], verbose=False)[0]
        if res.masks is None or len(res.masks) == 0:
            return None
        mask = res.masks.data[0].cpu().numpy().astype(np.uint8)
        # SAM returns the mask at its own working resolution.
        if mask.shape[:2] != img.shape[:2]:
            mask = cv2.resize(mask, (img.shape[1], img.shape[0]),
                              interpolation=cv2.INTER_NEAREST)
        cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = [c for c in cnts if cv2.contourArea(c) > 20]
        poly = _accept_outline(cnts)
        if poly:
            return poly
        poly = _outline_from_point(img, [x1, y1, x2, y2])
        if poly:
            return poly
        # Last resort, reached only when every route above has declined and the
        # alternative is shipping no outline at all. A displaced cover is a
        # slab with a bite out of one edge -- the gap it has slipped to expose,
        # which is the hazard itself -- so it can never satisfy a convexity
        # test. Judged here the way the point-prompt route is judged: one blob,
        # sitting inside the detector's box, filling a believable share of it.
        # On CMP-10404 SAM traces the tilted cover exactly and is turned away
        # only for solidity 0.907.
        return _accept_concave(cnts, [x1, y1, x2, y2])
    except Exception:
        return None


def _accept_concave(cnts: list, box: list[float]) -> list[list[float]] | None:
    """Accept a single well-placed blob without asking it to be convex."""
    if not cnts:
        return None
    big = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(big)
    if area <= 0:
        return None
    if area / max(sum(cv2.contourArea(c) for c in cnts), 1.0) < OUTLINE_MIN_DOMINANCE:
        return None
    box_area = max((box[2] - box[0]) * (box[3] - box[1]), 1.0)
    if not CONCAVE_MIN_FILL <= area / box_area <= CONCAVE_MAX_FILL:
        return None
    pts = big.reshape(-1, 2)
    inside = np.count_nonzero(
        (pts[:, 0] >= box[0] - 2) & (pts[:, 0] <= box[2] + 2)
        & (pts[:, 1] >= box[1] - 2) & (pts[:, 1] <= box[3] + 2))
    if inside / max(len(pts), 1) < CONCAVE_MIN_CONTAINMENT:
        return None
    pts = cv2.approxPolyDP(big, 0.004 * cv2.arcLength(big, True), True).reshape(-1, 2)
    if len(pts) < 3:
        return None
    return [[round(float(x), 1), round(float(y), 1)] for x, y in pts]


def _accept_outline(cnts: list, min_solidity: float = OUTLINE_MIN_SOLIDITY) -> list[list[float]] | None:
    """Apply the shape gate and simplify. None when the trace is not trusted."""
    if not cnts:
        return None
    big = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(big)
    if area <= 0:
        return None
    solidity = area / max(cv2.contourArea(cv2.convexHull(big)), 1.0)
    dominance = area / max(sum(cv2.contourArea(c) for c in cnts), 1.0)
    if solidity < min_solidity or dominance < OUTLINE_MIN_DOMINANCE:
        return None
    # Simplified so the polygon travels as a few dozen points rather than
    # several hundred; the tolerance is well under a pixel of visible drift.
    pts = cv2.approxPolyDP(big, 0.004 * cv2.arcLength(big, True), True).reshape(-1, 2)
    if len(pts) < 3:
        return None
    return [[round(float(x), 1), round(float(y), 1)] for x, y in pts]
_manhole_model = None
_manhole_failed = False


def _manhole_is_open(img: np.ndarray, box: list[float],
                    polygon: "list | None") -> bool:
    """Is the shaft exposed, or is the cover seated in it?

    The detectors answer "there is a manhole here" and are unreliable on this
    second question -- the multi-class model was trained with intact covers as
    positives, so it calls a seated cover a fall hazard at 0.88. The picture
    answers it directly instead: an open shaft contains a void, a few hundred
    millimetres of unlit space that no amount of daylight reaches, while a
    seated cover is a lit surface roughly as bright as the pavement it sits in.

    Two measurements inside the traced outline, both relative to the pavement
    immediately around it so that shade, exposure and time of day cancel:

        void      how much of the interior is genuinely near-black
        rel_dark  the interior's dark quartile against the surrounding median

    Measured over every manhole in the corpus these do not overlap. Open shafts
    run from 0.01 to 0.37 relative darkness with 12-90% void; seated covers run
    from 0.49 to 1.08 with 0.4-8% void. CMP-10311 -- an intact cover shipped as
    an Open Manhole -- sits at 0.94 with 0.8% void. The open shaft the user
    photographed sits at 0.01 with 74%.
    """
    try:
        grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        x1, y1, x2, y2 = (int(v) for v in box)
        inside_mask = np.zeros(grey.shape, np.uint8)
        if polygon:
            cv2.fillPoly(inside_mask, [np.array(polygon, np.int32)], 1)
        else:
            cv2.rectangle(inside_mask, (x1, y1), (x2, y2), 1, -1)
        # The pavement: a margin around the object, excluding the object.
        pad = MANHOLE_SURROUND_PX
        ring = np.zeros(grey.shape, np.uint8)
        cv2.rectangle(ring, (max(0, x1 - pad), max(0, y1 - pad)),
                      (x2 + pad, y2 + pad), 1, -1)
        ring = cv2.bitwise_and(ring, 1 - inside_mask)
        inside, outside = grey[inside_mask == 1], grey[ring == 1]
        if inside.size < 50 or outside.size < 50:
            return True     # cannot tell; the hazard reading is the safe one
        void = float((inside < MANHOLE_VOID_LEVEL).mean())
        rel_dark = float(np.percentile(inside, 15)) / max(float(np.median(outside)), 1.0)
        return void >= MANHOLE_VOID_FRACTION and rel_dark <= MANHOLE_VOID_RELATIVE
    except Exception:
        return True


def _manholes(img: np.ndarray, frame_area: float) -> list["Detection"]:
    """Open Manhole detections from the dedicated model. [] on any failure."""
    global _manhole_model, _manhole_failed
    if _manhole_model is None and not _manhole_failed:
        if not MANHOLE_WEIGHTS.exists():
            _manhole_failed = True
        else:
            try:
                from ultralytics import YOLO
                _manhole_model = YOLO(str(MANHOLE_WEIGHTS))
            except Exception:
                _manhole_failed = True
    if _manhole_model is None:
        return []
    try:
        # augment=True runs the image at several scales and flipped, then fuses
        # the results. Measured over 70 real hazards and 70 intact covers, with
        # the agreement rule in place:
        #
        #     plain   recall 90%   false alarms 1/70
        #     TTA     recall 96%   false alarms 2/70
        #
        # Six points of recall for one extra false alarm, and it costs about
        # 5 ms — the manhole model is small enough that the extra passes barely
        # register. The misses it recovers are the dark and distant covers that
        # a single forward pass at one scale simply does not resolve.
        res = _manhole_model.predict(
            img, conf=min(MANHOLE_WEAK_CONF, MANHOLE_CONF),
            augment=MANHOLE_TTA, verbose=False)[0]
    except Exception:
        return []
    out: list[Detection] = []
    for b in getattr(res, "boxes", []) or []:
        x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        conf = round(float(b.conf[0]), 4)
        box = [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)]
        frame_frac = area / frame_area if frame_area else 0.0
        if conf < MANHOLE_CONF:
            # Below the confident bar: only survives if the other model agrees.
            # Except when the box is most of the photograph, which is not a
            # localisation at all -- the model has failed to find anything and
            # fallen back on the whole frame, so there is nothing for the
            # second model to corroborate. CMP-10443 is a road covered in
            # potholes and no manhole; it entered here at 0.43 with a box over
            # 85% of the frame. Genuine close-ups clear the confident bar
            # (CMP-10451 is 85% of its frame at 0.58) and are unaffected.
            if frame_frac >= MANHOLE_LOOSE_FRAME:
                continue
            if _seg_agreement(img, box) < MANHOLE_AGREE_CONF:
                continue
        out.append(Detection(
            label="Open Manhole", confidence=conf, box=box,
            area_ratio=round(frame_frac, 5),
        ))
    return _drop_frame_duplicates(out)


def _drop_frame_duplicates(dets: list["Detection"]) -> list["Detection"]:
    """Discard a frame-sized box that merely swallows a real detection.

    Where the model has already localised a manhole properly, a second box
    spanning the whole photograph adds nothing -- it is the same object found
    twice, once precisely and once by giving up. On CMP-10480 the drain grate
    is found at 9% of the frame and again at 95%, and the second one traces
    the pavement around it. The precise detection is always kept; only the
    frame-sized one that contains it is dropped.
    """
    if len(dets) < 2:
        return dets
    keep = []
    for d in dets:
        if d.area_ratio < MANHOLE_MAX_FRAME:
            keep.append(d)
            continue
        swallows_another = any(
            o is not d and o.area_ratio < MANHOLE_MAX_FRAME
            and _iou(o.box, d.box) > 0 and _contains(d.box, o.box)
            for o in dets)
        if not swallows_another:
            keep.append(d)
    return keep


def _contains(outer: list[float], inner: list[float]) -> bool:
    """True when `inner` sits almost entirely inside `outer`."""
    ix = max(0.0, min(outer[2], inner[2]) - max(outer[0], inner[0]))
    iy = max(0.0, min(outer[3], inner[3]) - max(outer[1], inner[1]))
    inner_area = max((inner[2] - inner[0]) * (inner[3] - inner[1]), 1.0)
    return (ix * iy) / inner_area >= 0.90


def _local_potholes(img: np.ndarray, frame_area: float) -> list["Detection"]:
    """Pothole detections from the dedicated local model. [] on any failure."""
    global _local_pothole, _local_pothole_failed
    if _local_pothole is None and not _local_pothole_failed:
        if not LOCAL_POTHOLE_WEIGHTS.exists():
            _local_pothole_failed = True
        else:
            try:
                from ultralytics import YOLO
                _local_pothole = YOLO(str(LOCAL_POTHOLE_WEIGHTS))
            except Exception:
                _local_pothole_failed = True
    if _local_pothole is None:
        return []
    try:
        res = _local_pothole.predict(img, conf=LOCAL_POTHOLE_CONF, verbose=False)[0]
    except Exception:
        return []
    out: list[Detection] = []
    for b in getattr(res, "boxes", []) or []:
        if "pothole" not in res.names.get(int(b.cls[0]), "").lower():
            continue
        x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        out.append(Detection(
            label="Pothole", confidence=round(float(b.conf[0]), 4),
            box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
        ))
    return out

# A Roboflow-hosted pothole model, used only when ROBOFLOW_API_KEY is set.
# Off by default and never fatal: every failure path in roboflow_detect returns
# [], so a missing key, a dead network or a slow API degrades to the local
# models rather than breaking an upload.
#
# Two things to weigh before enabling for real complaints. Each detection
# becomes a network round trip, so uploads are subject to internet latency. And
# citizen photographs leave the machine, which for a municipal deployment is a
# data-protection decision rather than a technical one.
ROBOFLOW_MIN_CONF = float(os.environ.get("ROBOFLOW_MIN_CONF", "0.50"))
_roboflow = None


def _roboflow_enabled() -> bool:
    """Import lazily so the service still starts if the module is absent."""
    global _roboflow
    if _roboflow is None:
        try:
            import roboflow_detect as rf
            _roboflow = rf
        except Exception:
            return False
    return _roboflow.is_configured()

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

# A photograph of a real surface always carries texture. Flat synthetic images
# otherwise slip past the colour rule, because a grey figure on a pale
# background looks exactly like asphalt to a saturation test.
#
# 0.003, down from 0.015. The old figure came from a sample whose lowest civic
# photograph scored 0.026, and it was safe while this was advisory. It stopped
# being safe when the scene check became a gate that refuses an upload outright:
# across 120 pothole photographs the fifth percentile is 0.038 but the minimum
# is 0.0069 — smooth concrete in flat, shadowless light — and five real roads
# with real potholes were being turned away as "too flat". A blank fill scores
# exactly 0.0000, so the floor only has to clear zero to do its job.
MIN_EDGE_DENSITY = 0.003

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
# 0.25, because the weights changed underneath this number. Everything above
# was swept on civic_best.pt; models/pothole_best.pt is calibrated lower, and a
# threshold is a property of a particular model's score distribution, not a
# portable setting. Swept on the 665 held-out images it has never seen:
#
#     conf   precision   recall    F1
#     0.25     0.816      0.686    0.745   <- best F1
#     0.40     0.965      0.417    0.582
#     0.50     0.988      0.182    0.307
#
# At 0.50 it is right about almost everything it reports and reports almost
# nothing — four potholes in five go unfound, and a third of pothole
# photographs come back "no potholes detected". That is a worse failure for a
# complaints queue than the occasional wrong box, because a missed defect is
# never triaged at all. Overridable per request, as the brief requires.
DEFAULT_CONF = float(os.environ.get("LUMEN_DEFAULT_CONF", "0.25"))

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
# Off. It runs only when every trained model has found nothing, and "nothing"
# is usually the right answer — an intact road. What it does instead is
# threshold the dark pixels and call the blobs potholes, which is how a clear
# stretch of Brigade Road acquired two potholes at 0.667 and 0.604 confidence
# (CMP-10361) after all four models correctly stayed silent. Measured earlier:
# 11 boxes on a held-out set, 1 of them correct, including a 0.61 box on a
# puddle. A confident wrong answer is worse than an honest empty one, and the
# three-state validation now has an honest empty answer to give.
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
    # Ultralytics returns masks already scaled to the original frame, so the
    # polygons need no remapping — but only a segmentation checkpoint has them.
    masks = getattr(res, "masks", None)
    polys = list(masks.xy) if masks is not None else []

    out: list[Detection] = []
    for i, b in enumerate(getattr(res, "boxes", []) or []):
        name = res.names.get(int(b.cls[0]), "")
        # Single-class by construction, but check rather than assume: a swapped
        # checkpoint must not be able to inject some other label.
        if "pothole" not in name.lower():
            continue
        x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
        area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        poly = None
        if i < len(polys) and len(polys[i]) >= 3:
            poly = [[round(float(x), 1), round(float(y), 1)] for x, y in polys[i]]
        out.append(Detection(
            label="Pothole",
            confidence=round(float(b.conf[0]), 4),
            box=[round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
            area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
            polygon=poly,
        ))
    # Merging unions boxes and cannot union polygons, so it would silently drop
    # the outlines. The specialist is single-class and already NMS'd, so its
    # boxes rarely overlap — keep the masks instead.
    return out


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
    # Segmentation outline in full-frame pixels, [[x, y], ...], when a tracer
    # could vouch for the boundary. Detections without one are drawn as boxes.
    #
    # PRESENTATION ONLY. Every downstream number — severity, priority, volume,
    # the material estimate — is computed from `area_ratio` and `box`, and
    # backend/src/lib/dimensions.ts never reads this field. An earlier version
    # of this comment claimed the polygon corrected the plan area a rectangle
    # overstates, and that propagation was never implemented. Two detections of
    # the same defect, one outlined and one not, cost exactly the same.
    #
    # It earns its place on Open Manhole, which is a discrete object with a real
    # boundary a supervisor can judge. A pothole has no crisp edge, so a
    # rectangle there is not merely acceptable, it is arguably the honest shape.
    polygon: list[list[float]] | None = None


def _read_image(data: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def _predict(model, img: np.ndarray, conf: float, frame_area: float,
             ox: int = 0, oy: int = 0) -> list["Detection"]:
    """One YOLO pass. `ox`/`oy` shift boxes back into full-frame coordinates."""
    out: list[Detection] = []
    # Test-time augmentation: several scales and a flip, fused. Measured on the
    # class this model actually supplies, Garbage Pile, over 70 labelled piles
    # and 120 road/manhole images with no garbage in them:
    #
    #     plain   found 64/70   false garbage 1/120
    #     TTA     found 67/70   false garbage 1/120
    #
    # Five points of recall for no extra false alarm. The recovered images are
    # scattered litter and distant dumps, which a single pass at one scale is
    # poor at. Off for tiled passes, where the crop is already a zoom and the
    # cost would be paid once per tile.
    results = model.predict(img, conf=conf,
                            augment=MULTICLASS_TTA and ox == 0 and oy == 0,
                            verbose=False)[0]
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
                       iou_thresh: float = 0.75, contain_thresh: float = 0.90,
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

    The thresholds are 0.75 IoU and 0.90 containment — "the same box twice",
    not "two boxes near each other". They were 0.30 and 0.55, which is a
    neighbour rule, and it was written when the tiled pass was on and a single
    pothole genuinely arrived as several fragments from adjacent tiles. Tiles
    are off by default now, so what those thresholds actually did was fuse
    distinct potholes lying next to each other on the same stretch of road.
    That loses a real defect twice over: the union box matches one ground-truth
    pothole and its neighbour is scored a miss, and the display shows one large
    region where a supervisor should see two. Measured over 40 held-out images
    the pipeline emitted 58 boxes where the model produced 83.
    """
    if not UNION_MERGE:
        # Suppression instead of union. Unioning existed to reassemble one
        # pothole that arrived as several fragments from adjacent tiles, and
        # the tiled pass is off by default now, so what remained was a rule
        # that fused genuinely separate potholes into one region — which the
        # brief forbids outright. Measured over 80 held-out images:
        #
        #     union merge     precision 0.741   recall 0.678
        #     NMS only        precision 0.769   recall 0.724
        #
        # Better on both axes, and two adjacent potholes stay two.
        return _nms(dets)

    boxes = [
        {"label": d.label, "conf": d.confidence,
         "x1": min(d.box[0], d.box[2]), "y1": min(d.box[1], d.box[3]),
         "x2": max(d.box[0], d.box[2]), "y2": max(d.box[1], d.box[3]),
         "polygon": d.polygon}
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
                # "Near enough to touch" is deliberately NOT a merge rule.
                #
                # It was added for tiled inference, where one pothole split
                # across a tile seam comes back as two abutting boxes. But the
                # test chains: A touches B, B touches C, and a road with many
                # potholes close together collapses into a single box. On one
                # test photograph a detector found fifteen potholes correctly
                # and this rule merged all fifteen into one.
                #
                # Real overlap — IoU or containment — is the honest signal that
                # two boxes describe one defect. Adjacency is not: two potholes
                # a hand's width apart are two potholes.
                if iou > iou_thresh or contained > contain_thresh:
                    k["x1"], k["y1"] = min(k["x1"], b["x1"]), min(k["y1"], b["y1"])
                    k["x2"], k["y2"] = max(k["x2"], b["x2"]), max(k["y2"], b["y2"])
                    if b["conf"] > k["conf"]:
                        k["conf"] = b["conf"]
                        if b["polygon"] is not None:
                            k["polygon"] = b["polygon"]
                    else:
                        if k["polygon"] is None and b["polygon"] is not None:
                            k["polygon"] = b["polygon"]
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
            polygon=b["polygon"],
        )
        for b in boxes
    ]
    return sorted(merged, key=lambda d: -d.confidence)


def _drop_litter_potholes(dets: list["Detection"]) -> list["Detection"]:
    """Discard a pothole found entirely inside a heap of refuse.

    Road damage is damage to the road surface. A pothole box sitting wholly
    within a garbage pile is not on the road at all -- it is a dark gap between
    bags, or a flattened box, whose texture reads like broken tarmac. The two
    classes are not in competition here, which is why class arbitration leaves
    it alone: the models are describing different things in the same place, and
    only one of them can be standing on the ground.

    Deliberately requires near-total containment. A real pothole beside a heap
    overlaps it partially and is kept -- CMP-10258 sits 29% inside the pile and
    survives. Across the 200 complaints this fires exactly twice, on CMP-10264
    and CMP-10282, both fully enclosed.
    """
    piles = [d for d in dets if d.label == "Garbage Pile"]
    if not piles:
        return dets
    return [d for d in dets
            if d.label != "Pothole"
            or max(_contained(d.box, p.box) for p in piles) < LITTER_POTHOLE_DROP]


def _arbitrate_classes(dets: list["Detection"],
                       thresh: float = 0.30) -> list["Detection"]:
    """Resolve two different classes claiming the same pixels.

    Three specialists now run on every image — the pothole model, the manhole
    model and the multi-class civic model — and none of them knows the others
    exist. Each is confident within its own world, so a dark circular patch of
    tarmac is a pothole to one and an open manhole to the other, and both
    report it. The result is a complaint showing "POTHOLE 1" and "Open Manhole"
    stacked on the same hole.

    They cannot both be right about one object, so the more confident reading
    wins and the other is dropped. Suppression is deliberately limited to boxes
    that genuinely overlap: two different defects in different parts of a
    photograph are ordinary — a street can have a pothole near an open manhole,
    and a rubbish pile beside a broken kerb — and dropping one of those would
    lose a real complaint to tidy up a display.

    Measured on the live queue: 21 of 111 complaints showed more than one
    class, but only 9 box pairs actually overlapped. This touches those 9.
    """
    if len(dets) < 2:
        return dets

    # Confidence alone decides most conflicts, but not this one. Two models
    # trained separately do not share a confidence scale, and for potholes
    # against open manholes the louder model is reliably the wrong one.
    #
    # Sampled every complaint where both models fired on the same object and
    # looked at the photographs: all six were genuine manholes — round road
    # openings, a broken cover, drain grates, a displaced slab — and in every
    # one the pothole model was the more confident of the two:
    #
    #     manhole model   0.57  0.60  0.60  0.70  0.78  0.78
    #     pothole model   0.70  0.80  0.80  0.80  0.85  0.85
    #
    # So confidence ranks this pair backwards. The pothole model was trained
    # with manhole covers as hard negatives — taught to ignore them, never to
    # recognise them — so when it fires on one anyway it is a known failure of
    # that training, not evidence. The manhole model is the only one that has
    # ever been shown a cover and asked whether it is open. On this pair it
    # wins on standing rather than on volume.
    # How far behind the pothole model the manhole model may be and still win.
    # Standing is not a blank cheque: the six conflicts that justified this rule
    # had the two models within about 0.15 of each other, and a manhole call
    # that trails a pothole call by more than that is not a close disagreement
    # between specialists — it is one model being unsure while the other is not.
    SPECIALIST_MARGIN = 0.20
    specialist_wins = {("Pothole", "Open Manhole")}
    for i, a in enumerate(dets):
        for j, b in enumerate(dets):
            if i == j or (a.label, b.label) not in specialist_wins:
                continue
            if a.confidence - b.confidence > SPECIALIST_MARGIN:
                continue
            if _iou(a.box, b.box) > thresh or _contained(a.box, b.box) > 0.70 \
               or _contained(b.box, a.box) > 0.70:
                return _arbitrate_classes(
                    [d for k, d in enumerate(dets) if k != i], thresh)

    order = sorted(range(len(dets)), key=lambda i: -dets[i].confidence)
    dropped: set[int] = set()
    for rank, i in enumerate(order):
        if i in dropped:
            continue
        for j in order[rank + 1:]:
            if j in dropped or dets[j].label == dets[i].label:
                continue
            # Containment counts as well as IoU: a small box sitting inside a
            # much larger one of another class is the same object read twice,
            # and their IoU is low precisely because the sizes differ.
            if _iou(dets[i].box, dets[j].box) > thresh or \
               _contained(dets[j].box, dets[i].box) > 0.70:
                dropped.add(j)
    return [d for k, d in enumerate(dets) if k not in dropped]


def _nms(dets: list["Detection"], thresh: float = 0.45) -> list["Detection"]:
    """Kept for callers that want suppression without merging."""
    kept: list[Detection] = []
    for d in sorted(dets, key=lambda x: -x.confidence):
        duplicate = any(
            k.label == d.label and (
                _iou(k.box, d.box) > thresh
                # d sits inside something already kept...
                or _contained(d.box, k.box) > 0.7
                # ...or d is a loose box drawn around something already kept.
                # One pothole was being boxed two and three times over: a tight
                # confident box, and around it a larger vague one from another
                # scale or another model. Suppression only ever looked for the
                # first case, so the loose box always survived. Across the 200
                # complaints this fires 36 times, in 17 photographs, and every
                # single time the box being dropped is the less confident of
                # the pair -- 0.57 drawn around 0.86, 0.28 around 0.84. It
                # never fires on a garbage pile or a manhole.
                or _contained(k.box, d.box) > CONTAINER_DROP
            )
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


# COCO classes that say "this is an outdoor street scene". Their presence is
# evidence *for* relevance even when little road segments — a photograph framed
# on a bus is still a street.
_STREET_COCO_IDS = {
    1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 6: "train", 7: "truck",
    9: "traffic light", 10: "fire hydrant", 11: "stop sign", 12: "parking meter",
    13: "bench", 0: "person",
}

# COCO classes that say "this is a photograph of a thing, indoors or held".
# Nothing here belongs in a road photograph, so area covered by these counts
# against relevance.
_OFF_TOPIC_COCO_IDS = {
    # animals
    15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow", 20: "elephant",
    21: "bear", 22: "zebra", 23: "giraffe", 14: "bird",
    # food
    46: "banana", 47: "apple", 48: "sandwich", 49: "orange", 50: "broccoli",
    51: "carrot", 52: "hot dog", 53: "pizza", 54: "donut", 55: "cake",
    # indoors / held objects
    56: "chair", 57: "couch", 59: "bed", 60: "dining table", 61: "toilet",
    62: "tv", 63: "laptop", 64: "mouse", 66: "keyboard", 67: "cell phone",
    39: "bottle", 41: "cup", 43: "knife", 44: "spoon", 45: "bowl", 73: "book",
    68: "microwave", 69: "oven", 71: "sink", 72: "refrigerator",
}


def assess_scene(img: np.ndarray, *, want: str = "road") -> dict:
    """Is this photograph plausibly of the right kind of place?

    A citizen — or a bored examiner — can upload a selfie, a screenshot, a plate
    of food or a cat. Running damage detection on that and reporting "no damage
    found" is misleading: the honest answer is that the photograph is not of the
    right thing at all.

    This deliberately does not consult the damage model. A detector asked
    "are there potholes here" cannot answer "is this even a road" — silence from
    it is ambiguous between an intact road and a photograph of lunch. The
    evidence used here is independent: an HSV road-surface segmentation, a
    pretrained COCO detector reading the *subject* of the photograph, and edge
    statistics that catch screenshots and synthetic images.

    `want` selects the criterion:
      "road"  — a road, pavement or parking surface must be present.
      "urban" — any street scene qualifies, so street furniture and vehicles
                count as evidence even where little ground is visible.

    Thresholds come from measurement, not instinct. Across 125 sampled images
    the median road fraction was 0.82 for overhead pothole shots, 0.63 for web
    road photos and 0.41 for animal photographs, and edge density on genuine
    gravel road surfaces reached 0.364 — which is why the old "incoherent"
    cutoff of 0.30 was rejecting one valid road photo in four.
    """
    h, w = img.shape[:2]
    frame = float(h * w)
    road = _road_mask(img)
    road_fraction = float((road > 0).sum()) / frame

    # A road is underfoot. Measuring the lower half separates a photograph
    # taken standing on a street from one where a desaturated background —
    # sand, stone, a stable wall — happens to satisfy the asphalt colour rule.
    # Measured medians: overhead pothole 1.00, web road 0.94, intact road 0.99,
    # against 0.41 for a set of miscellaneous non-street photographs.
    bottom = road[h // 2:, :]
    ground_fraction = float((bottom > 0).sum()) / float(bottom.size)

    # What is the photograph *of*? Areas are summed rather than counted: one cat
    # filling the frame matters, a cat on a distant pavement does not.
    street_area = 0.0
    off_topic_area = 0.0
    subjects: list[str] = []
    m = _get_occluder_model()
    if m is not None:
        try:
            res = m.predict(img, verbose=False, conf=0.35)[0]
            for box in getattr(res, "boxes", []) or []:
                cid = int(box.cls[0])
                x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
                area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
                if cid in _STREET_COCO_IDS:
                    # A pedestrian is ordinary on a street; a person filling the
                    # frame is a portrait or a selfie, and the photograph is of
                    # them rather than of anywhere.
                    if cid == 0 and area > 0.25 * frame:
                        off_topic_area += area
                        subjects.append("person")
                    else:
                        street_area += area
                elif cid in _OFF_TOPIC_COCO_IDS:
                    off_topic_area += area
                    if area > 0.10 * frame:
                        subjects.append(_OFF_TOPIC_COCO_IDS[cid])
        except Exception:
            pass
    street_share = street_area / frame
    off_topic_share = off_topic_area / frame

    # Where is this, as a place? A 365-way scene classifier answers what colour
    # and texture cannot: a document scan and a strip of asphalt have almost
    # identical road-mask fractions, and random noise scores higher than most
    # real roads. This only ever rejects — see scene_classifier for why asking
    # it to confirm a road instead would throw away correct complaints.
    interior = False
    interior_scene = ""
    try:
        reading = scene_classifier.classify(img)
        if reading is not None:
            interior = bool(reading["looks_interior"])
            interior_scene = reading["top_scene"].replace("_", " ").split("/")[0]
    except Exception:
        pass

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edge_density = float((cv2.Canny(gray, 70, 180) > 0).sum()) / frame
    # 0.45, not 0.30: coarse gravel is a real surface and reaches 0.364.
    incoherent = edge_density > 0.45
    featureless = edge_density < MIN_EDGE_DENSITY   # screenshot, drawing, flat fill

    # The subject of the photograph is something off-topic, and it dominates
    # what is in frame more than any street content does.
    dominated = off_topic_share > 0.18 and off_topic_share > street_share

    if want == "urban":
        # Failing to find a place is not evidence of an irrelevant photograph.
        # A skip full of rubbish bags photographed from two feet away shows no
        # ground and no street furniture, and it is a real complaint — refusing
        # those was the largest single source of wrong rejections in the live
        # queue. So an urban verdict rests on positive evidence of irrelevance
        # — an interior, an off-topic subject, a flat or incoherent image —
        # rather than on failure to prove a road is present.
        has_place = True
    else:
        # Pothole analysis needs a surface to analyse, so the bar is the ground
        # itself — or unambiguous street furniture, because a photograph framed
        # on a bus or a queue of traffic is still taken on a road even when the
        # vehicles leave little tarmac visible. Measured: 60 road and complaint
        # photographs all clear the ground bar with a median of 1.00, while a
        # street scene with a bus filling the frame reaches only 0.42 and was
        # being refused. The ground bar alone rejects nothing that matters —
        # both scanned documents cleared it at 0.64 and 0.77, and it is the
        # scene classifier that catches those.
        has_place = ground_fraction >= 0.45 or street_share >= 0.08

    ok = has_place and not dominated and not incoherent and not featureless and not interior

    return {
        "road_fraction": round(road_fraction, 4),
        "ground_fraction": round(ground_fraction, 4),
        "edge_density": round(edge_density, 4),
        "street_share": round(street_share, 4),
        "off_topic_share": round(off_topic_share, 4),
        "interior_scene": interior_scene if interior else "",
        "looks_civic": ok,
        "reason": (
            f"this looks like a {interior_scene}, which is indoors" if interior
            else f"the photograph is mostly of a {subjects[0]}, not a place" if dominated and subjects
            else "the photograph is of an object, not a place" if dominated
            else "not a photograph of a surface — no coherent texture" if incoherent
            else "too flat to be a photograph of a real surface" if featureless
            else "no road, pavement or street scene could be found" if not has_place
            else "road surface detected"
        ),
    }


def detect(data: bytes, conf: float = DEFAULT_CONF) -> dict:
    """Run detection and return structured results plus an annotated image.

    Three outcomes, and the caller needs to tell them apart:

      INVALID_IMAGE          not a road scene. Nothing is detected, nothing is
                             drawn, and no count is reported — "0 potholes" on a
                             photograph of lunch is a wrong answer, not an empty
                             one.
      VALID_ROAD_NO_POTHOLE  a road, with no damage above the threshold.
      VALID_ROAD             a road, with damage.
    """
    img = _read_image(data)
    h, w = img.shape[:2]
    frame_area = float(h * w)
    mode = get_mode()

    # Relevance first, before any damage model runs.
    #
    # assess_scene decides this on evidence independent of the pothole
    # detector: an HSV road-surface segmentation weighted to the lower half of
    # the frame, a pretrained COCO detector reading the subject of the
    # photograph, and edge statistics that catch screenshots and flat synthetic
    # images. It has to be independent — a detector asked "are there potholes
    # here" cannot answer "is this even a road", because silence from it is
    # ambiguous between an intact road and a picture of a cat.
    # "urban", not "road": LUMEN files rubbish piles and open manholes as well
    # as potholes, and those are photographed close up with little tarmac in
    # frame. Measured over 400 queue photographs the road bar refused 55 and
    # the urban bar 45, while both refused every document, portrait and
    # interior — so the stricter setting was costing real complaints and
    # catching nothing extra. What rejects an irrelevant upload is the scene
    # classifier and the COCO subject check, neither of which this affects.
    scene = assess_scene(img, want="urban")
    if not scene["looks_civic"]:
        # Before refusing, ask the calibrated specialists whether they can see
        # something. The reasoning above is right that SILENCE from a damage
        # model cannot establish relevance — quiet is ambiguous between an
        # intact road and a picture of a cat. A confident detection is not
        # ambiguous. If the manhole model, held at a floor measured to give one
        # false alarm in seventy intact covers, says there is an open manhole
        # here, the photograph is of civic infrastructure whatever the scene
        # classifier made of it.
        #
        # This is not hypothetical: well1_0083 is a close-up of an open manhole
        # that the manhole model reads at 0.67 and the scene classifier rejects
        # as "unrelated", so the detection was discarded and the citizen told to
        # upload a road image. Close-ups are exactly where a scene classifier
        # struggles, and exactly how manholes and rubbish are photographed.
        rescue = _manholes(img, frame_area) + _local_potholes(img, frame_area)
        rescue = [d for d in rescue if d.confidence >= SCENE_RESCUE_CONF]
        if not rescue:
            return {
                "model_mode": mode,
                "detector": "REJECTED",
                "image_size": {"width": w, "height": h},
                "valid_image": False,
                "image_type": "unrelated",
                "potholes_detected": False,
                "count": 0,
                "message": "Please upload an appropriate road image for pothole detection.",
                "hint": ("Upload a clear image of a road, street, pavement, parking area, "
                         "or other road surface."),
                "detections": [],
                "severity": score_severity([]),
                "routing": route_from_detections([]),
                "scene": scene,
                # The photograph is returned untouched: no box, no mask, no label.
                "annotated_png_b64": _to_b64_png(img),
            }

    detector = mode
    if mode == "HEURISTIC":
        dets = heuristic_detect(img)
    else:
        model, _ = get_model()
        # The multi-class civic model. It is the only detector here that has
        # never been retrained with hard negatives, and it shows: on CMP-10272,
        # a photograph of a rubbish pile, it reported "Open Manhole" at 0.34 and
        # a "Pothole" covering 0.4% of the frame, and on CMP-10281 it called an
        # intact closed manhole cover an Open Manhole at 0.80. The cause is
        # known — train_multi.SOURCE_MAP maps "Good" (an intact cover) to None,
        # which drops those 508 images instead of training on them as
        # background, so every manhole it has ever seen was a positive example.
        #
        # Off for new complaints until it is retrained. THE COST IS REAL: with
        # it off nothing detects garbage piles, overflowing bins, open manholes
        # or alligator cracks, so those complaints record zero detections and
        # route as Unclassified. Potholes are unaffected — they come from
        # models/pothole_best.pt, which was retrained.
        multiclass_raw = _predict(model, img, conf, frame_area) if USE_MULTICLASS_MODEL else []
        main_dets = [d for d in multiclass_raw if d.label not in UNTRUSTED_MULTICLASS]

        # The multi-class model's "Open Manhole" is withheld above because it
        # cannot tell an open shaft from a seated cover -- it was trained with
        # intact covers as positives. But it is a good finder: it puts a box on
        # a cover the dedicated detector misses entirely, at 0.88 on the closed
        # cover in CMP-10490, where the dedicated model manages only a
        # frame-filling 0.32. Now that open-versus-closed is decided from the
        # picture, that weakness no longer matters and the find is worth having.
        #
        # Admitted as a location only, and only on strong evidence: high
        # confidence, corroborated by the segmentation model, and not a
        # frame-filling box. The failure that got the class withheld -- a
        # manhole invented at 0.34 on a rubbish pile -- is well under the bar.
        mc_manholes: list[Detection] = []
        if MULTICLASS_MANHOLE_LOCATOR:
            for d in multiclass_raw:
                if d.label != "Open Manhole" or d.confidence < MULTICLASS_MANHOLE_CONF:
                    continue
                if frame_area and (d.area_ratio or 0) >= MANHOLE_LOOSE_FRAME:
                    continue
                if _seg_agreement(img, d.box) < MANHOLE_AGREE_CONF:
                    continue
                mc_manholes.append(d)

        # The segmentation specialist no longer contributes detections of its
        # own — it only traces an outline over a pothole another model already
        # found (that pass runs further down).
        #
        # It used to lead, and that was right when the primary detector found
        # 18% of potholes and the specialist raised it to 62%. It is wrong now.
        # Audited on CMP-10361, a clear road with no pothole in it:
        #
        #     pothole_best.pt (primary)   no detection — correct
        #     specialist                  one "pothole", conf 0.506,
        #                                 711x440 px, 56% of the frame,
        #                                 covering road, trees, sky and traffic
        #
        # The mask was not mis-scaled: its polygon spans x 7-717 against its own
        # box at 6-717, it fills 93% of that box, and Ultralytics' own
        # result.plot() draws the identical blob. The prediction itself is
        # simply wrong, and at 0.506 it cleared the 0.50 bar by six thousandths.
        # A second opinion that invents whole-frame potholes is worse than no
        # second opinion, so it is demoted to what it is good at: outlining.
        specialist_active = False
        special_dets = []
        if USE_POTHOLE_SPECIALIST and SPECIALIST_CONTRIBUTES_DETECTIONS:
            special_dets = _specialist_potholes(img, frame_area)
            if special_dets:
                specialist_active = True
                detector = "TRAINED+SPECIALIST"

        # A hosted pothole model, when one is configured. Measured on 50
        # wide-street photographs that none of these models were trained on:
        #
        #     detector                     precision  recall
        #     local pipeline                   0.72    0.31
        #     hosted qwkkc/2 @0.50             0.96    0.48
        #     hosted qwkkc/2 @0.30             0.88    0.71
        #
        # Better on both axes, so it leads and the local models fill in behind
        # it. Its box sizes are sane too — median 5-8% of the frame against a
        # ground truth of 2%, where the same project's v5 model returned the
        # entire image every time and still advertised 100% precision.
        remote_dets: list[Detection] = []
        if _roboflow_enabled():
            for r in _roboflow.detect(data, conf=ROBOFLOW_MIN_CONF):
                x1, y1, x2, y2 = r["box"]
                area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
                remote_dets.append(Detection(
                    label="Pothole", confidence=r["confidence"],
                    box=[x1, y1, x2, y2],
                    area_ratio=round(area / frame_area, 5) if frame_area else 0.0,
                ))
            if remote_dets:
                detector = "HOSTED+TRAINED" if main_dets else "HOSTED"

        local_pot = _local_potholes(img, frame_area)
        if local_pot:
            detector = "LOCAL-POTHOLE" if not main_dets else "TRAINED+LOCAL-POTHOLE"

        # Open Manhole comes from its own model now. The class is withheld from
        # the multi-class detector (see UNTRUSTED_MULTICLASS), so this is the
        # only source of it, and it is the retrained one that treats a closed
        # cover as background rather than as a hazard.
        manholes = _manholes(img, frame_area)
        # Locations the multi-class model found and the dedicated one did not.
        for d in mc_manholes:
            if not any(_iou(d.box, m.box) > 0.30 for m in manholes):
                manholes.append(d)
        if manholes:
            detector = detector + "+MANHOLE" if detector else "MANHOLE"

        dets = _merge_overlapping(
            local_pot + manholes + remote_dets + main_dets + special_dets, frame_area)
        dets = _arbitrate_classes(dets)
        dets = _drop_litter_potholes(dets)

        # Give every pothole its true outline.
        #
        # A pothole is an irregular blob. A rectangle around one looks crude and
        # overstates its plan area, which then propagates into the volume and
        # the cost estimate, since both are derived from it.
        #
        # Detection and shape are separate jobs here, deliberately. Whichever
        # model found the pothole keeps the credit — its confidence, and the
        # decision that there is a pothole at all — and the segmentation model
        # is asked only for geometry over the region already found. So the
        # quality of the outline does not depend on the segmentation model's
        # recall: it never has to find anything, only trace what is handed to
        # it. That matters because the hosted detector is the stronger finder
        # (0.79 precision / 0.47 recall) but returns boxes only, while the
        # segmentation model traces well and finds poorly (0.70 / 0.20).
        #
        # Anything the segmentation model has no opinion on keeps its box,
        # rather than being given an outline it has not earned.
        # Potholes only. Open Manhole was offered to the tracer briefly and the
        # result was inconsistent — the tracer is a pothole segmentation model
        # and recognised barely one manhole in three, so the class would have
        # shown an outline sometimes and a box otherwise for no reason a viewer
        # could see.
        #
        # Deriving the cavity by image processing instead was tried and
        # rejected: "the hole is the dark part" is not true often enough. A
        # displaced concrete cover is brighter than the wet stone around it, so
        # a darkness threshold outlines the cover; shadows under a raised slab
        # are as dark as the opening; and where a broken cover sits inside the
        # hole there is no single dark blob to find. It outlined the wrong
        # object on four of six manholes. A confident boundary drawn around the
        # wrong thing is worse than an honest rectangle.
        #
        # A tight outline here needs a manhole segmentation model trained on
        # polygons around openings, and that data does not exist — the corpus
        # is bounding boxes only.
        _TRACEABLE = {"Pothole"} & POLYGON_CLASSES
        if any(d.label in _TRACEABLE and not d.polygon for d in dets):
            # Asked at a much lower threshold than when it is used to detect.
            # A shape that overlaps nothing already found is discarded below,
            # so a weak trace costs nothing and a missing one costs an outline.
            # At its detection bar of 0.50 it traces only 3 potholes in 5.
            _prev = globals()["SPECIALIST_MIN_CONF"]
            globals()["SPECIALIST_MIN_CONF"] = SEGMENT_TRACE_CONF
            try:
                outlines = _specialist_potholes(img, frame_area)
            finally:
                globals()["SPECIALIST_MIN_CONF"] = _prev
            traced = 0
            for i, d in enumerate(dets):
                if d.label not in _TRACEABLE or d.polygon:
                    continue
                match = max(
                    (s for s in outlines
                     if _iou(s.box, d.box) > 0.30 or _contained(d.box, s.box) > 0.55),
                    key=lambda s: _iou(s.box, d.box), default=None,
                )
                if match is not None and match.polygon:
                    # An outline is accepted only if it is plausibly the shape
                    # of THIS pothole. The overlap test above is not enough on
                    # its own: a blob covering half the frame contains the real
                    # pothole, passes containment, and would then replace a
                    # tight box with itself. CMP-10361 is that case — a 711x440
                    # region at 56% of the frame swallowing road, trees and
                    # traffic.
                    #
                    # So the outline must not be dramatically larger than the
                    # detection it claims to describe. Ground truth says a
                    # pothole occupies a median 2.8% of the frame and 96% sit
                    # under 40%, so a trace 2.5x the area of its own detection
                    # is not that pothole's boundary — it is a different, larger
                    # thing, and the detection keeps its box.
                    d_area = max(1.0, (d.box[2] - d.box[0]) * (d.box[3] - d.box[1]))
                    m_area = max(0.0, (match.box[2] - match.box[0]) * (match.box[3] - match.box[1]))
                    if m_area > 2.5 * d_area or m_area / frame_area > 0.40:
                        continue
                    # The detection keeps its OWN box. Only the outline is
                    # borrowed. Taking match.box as well handed localisation
                    # back to the model that is worse at it: the segmentation
                    # specialist traces well but localises loosely, and
                    # overwriting a tight box with its looser one moved the
                    # box off the pothole just enough to miss at IoU 0.45.
                    # Position is the detector's job, shape is the tracer's.
                    dets[i] = Detection(
                        # d.label, not a hardcoded "Pothole" — the tracer only
                        # supplies geometry, and now that Open Manhole is also
                        # offered to it, hardcoding would silently relabel a
                        # traced manhole as a pothole.
                        label=d.label, confidence=d.confidence,
                        box=d.box, area_ratio=d.area_ratio,
                        polygon=match.polygon,
                    )
                    traced += 1
            if traced:
                detector += "+SEGMENTED"

        # Manholes are outlined last, once the class is settled, so that a box
        # relabelled by arbitration is never traced under its old identity.
        if OUTLINE_MANHOLES:
            outlined = 0
            for d in dets:
                if d.label not in MANHOLE_LABELS or d.polygon:
                    continue
                poly = _outline(img, d.box)
                if poly:
                    d.polygon = poly
                    outlined += 1
            if outlined and "+SEGMENTED" not in detector:
                detector += "+SEGMENTED"

        # Open or closed, decided from the picture rather than from the
        # detector. Done here, after outlining, because the judgement is made
        # inside the traced boundary -- the box includes pavement, and pavement
        # is bright, which is exactly what the measurement is comparing against.
        for d in dets:
            if d.label in MANHOLE_LABELS:
                d.label = ("Open Manhole"
                           if _manhole_is_open(img, d.box, d.polygon)
                           else CLOSED_MANHOLE)

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
                    detector = "TRAINED+SPECIALIST+TILED" if specialist_active else "TRAINED+TILED"
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
            # Gated on the same switch as the whole-frame pass: this re-runs the
            # multi-class model, so leaving it open would have let the model in
            # through the back door on exactly the images where the front door
            # found nothing. That is how an intact manhole cover was still being
            # called an Open Manhole at 0.80 with the multi-class detector
            # supposedly disabled.
            if USE_MULTICLASS_MODEL:
                dets = [d for d in _predict_tiled(model, img, conf, frame_area)
                        if d.confidence >= TILED_MIN_CONF
                        and d.label not in UNTRUSTED_MULTICLASS]
                if dets:
                    detector = "TRAINED+TILED"

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

        # Filter out road-damage false positives (sky/leaves/people)
        if dets:
            road = _road_mask(img)
            road_fraction = float((road > 0).sum()) / frame_area
            people_boxes = _person_boxes(img)
            
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 70, 180)
            
            filtered_dets = []
            for d in dets:
                x1, y1, x2, y2 = [int(v) for v in d.box]

                # Potholes come through as the fine-tuned model reported them.
                # Measured on 80 held-out images, these filters cost more than
                # they save now that the detector is the one deciding:
                #
                #     pothole_best.pt raw      precision 0.779   recall 0.763
                #     after these filters      precision 0.748   recall 0.645
                #
                # They were written when the pothole detections came from a
                # weaker model that genuinely did box sky and foliage. This one
                # does not: on CMP-10361, the clear road that everything else
                # got wrong, it reported nothing at all. Suppressing a correct
                # detector to catch mistakes it no longer makes loses one real
                # pothole in eight and buys three points of precision.
                #
                # The other classes keep the filters — the multi-class model
                # has not been retrained and still needs them.
                if RAW_POTHOLE_PASSTHROUGH and d.label == "Pothole":
                    # Two plausibility checks survive the passthrough, because
                    # neither is a guess about texture — both are checkable.
                    #
                    # 1. Size. Across 2,590 ground-truth potholes the largest
                    #    covered 85.2% of its frame, the 99th percentile 66%
                    #    and the median 2.8%. A "pothole" filling 91% of the
                    #    image is outside anything a pothole has ever looked
                    #    like in this data, so it is not one.
                    if d.area_ratio > 0.85:
                        continue
                    # 2. A more confident reading of the same pixels. On
                    #    CMP-10357 the multi-class model called the frame a
                    #    Garbage Pile at 0.816 and the pothole model called the
                    #    same region a pothole at 0.723. Both cannot be right,
                    #    and the stronger, more specific reading wins. This
                    #    fires only on near-total overlap with a higher
                    #    confidence non-road class — not on a pothole that
                    #    merely happens to sit near a bin.
                    if any(o.label != "Pothole" and o.confidence > d.confidence
                           and TAX.category_of(o.label) != "ROADS"
                           and _iou(d.box, o.box) > 0.60
                           for o in dets):
                        continue
                    filtered_dets.append(d)
                    continue

                # Person constraint to avoid classifying people as damage.
                #
                # 0.4 was too strict for rubbish. A pile in a street scene is
                # routinely photographed with passers-by in frame, and one
                # COCO person box overlapping it by 0.55 was enough to delete a
                # Garbage Pile the model read at 0.63. Swept over 76 labelled
                # piles: a 0.4 bar discards 2 of them, 0.5 discards 1, and 0.6
                # discards none — so the detections being lost were sitting
                # beside people, not on them. Raised to 0.6, which still drops
                # anything mostly ON a person.
                overlaps_person = False
                for p_box in people_boxes:
                    if _box_intersection_ratio(d.box, p_box) > PERSON_OVERLAP_MAX:
                        overlaps_person = True
                        break
                if overlaps_person:
                    continue
                    
                # Road surface constraint for road damages
                if d.label in ["Pothole", "Alligator Crack"]:
                    coverage = _road_coverage(road, x1, y1, x2 - x1, y2 - y1)
                    if road_fraction >= 0.05 and coverage < 0.15:
                        continue
                        
                # A polygon edge-density rule used to sit here, rejecting any
                # pothole whose outline contained more than 20% edge pixels, to
                # filter leaves and textured noise. Measured on 29 traced
                # detections it does not discriminate:
                #
                #     real potholes     median edge density 0.307
                #     false positives   median edge density 0.294
                #
                # Broken asphalt IS high-frequency texture, so the rule deleted
                # 16 of 22 correct detections to remove 6 of 7 wrong ones. It
                # only fired once an outline existed, so tracing a pothole made
                # it likelier to be discarded. Removed rather than retuned:
                # the distributions overlap almost exactly, so no threshold
                # separates them.
                            
                filtered_dets.append(d)
            dets = filtered_dets

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
    annotated = _annotate(img, dets)
    severity = score_severity(dets)

    # Which civic category dominates this photo? The class with the largest
    # weighted contribution decides the category, and therefore the department.
    routing = route_from_detections(dets)

    # A class not permitted an outline is drawn as a rectangle. The detection,
    # its box, its confidence and every derived number are untouched — only the
    # outline is dropped, and _annotate falls through to cv2.rectangle.
    for d in dets:
        if d.polygon and d.label not in POLYGON_CLASSES:
            d.polygon = None

    payload = []
    for d in dets:
        item = asdict(d)
        item["category"] = TAX.category_of(d.label)
        payload.append(item)

    potholes = [d for d in dets if d.label == "Pothole"]
    return {
        "model_mode": mode,
        # The scene passed the relevance gate above, so the image is a road
        # either way. What separates the two valid states is only whether the
        # detector found damage — which is a finding, not a rejection.
        "valid_image": True,
        "image_type": "road",
        "potholes_detected": bool(potholes),
        "count": len(potholes),
        # Per-class tally, matching the numbering drawn on the image: three
        # potholes and a bin read {"Pothole": 3, "Overflowing Bin": 1}. `count`
        # stays pothole-only because that is what the pothole flow reports.
        "counts": {label: sum(1 for d in dets if d.label == label)
                   for label in sorted({d.label for d in dets})},
        "message": (None if potholes else "No potholes detected in this image."),
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

    grey = ((S < 70) & (V > 45) & (V < 256)).astype(np.uint8)       # asphalt
    veg = ((H > 30) & (H < 95) & (S > 55)).astype(np.uint8)          # vegetation
    sky = ((V > 200) & (S < 35)).astype(np.uint8)                    # bright sky
    sky[int(0.65 * h):, :] = 0                                       # sky can never be at the bottom

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


def _person_boxes(img: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Get bounding boxes of all detected people in the image."""
    m = _get_occluder_model()
    if m is None:
        return []
    try:
        res = m.predict(img, verbose=False, conf=0.25)[0]
    except Exception:
        return []
    out: list[tuple[int, int, int, int]] = []
    for box in getattr(res, "boxes", []) or []:
        cid = int(box.cls[0])
        if cid == 0:  # person
            x1, y1, x2, y2 = (float(v) for v in box.xyxy[0])
            out.append((int(x1), int(y1), int(x2), int(y2)))
    return out


def _box_intersection_ratio(box_a: list[float], box_b: tuple[int, int, int, int]) -> float:
    """Calculate what fraction of box_a is covered by box_b."""
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter_area = iw * ih
    if inter_area <= 0:
        return 0.0
        
    a_area = (ax2 - ax1) * (ay2 - ay1)
    return inter_area / a_area if a_area > 0 else 0.0



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
    """Overlay detections on a copy of the uploaded image.

    The original pixels are never altered — everything is drawn onto a copy, so
    the photograph the citizen submitted stays the evidence of record and the
    overlay is only a reading of it.

    Where a segmentation mask exists the outline follows the damage; otherwise
    a box is drawn. Potholes are numbered POTHOLE 1, 2, 3 in the order they are
    reported, which is by size, so the numbering matches the table beneath.
    """
    out = img.copy()
    # Numbered per class, not across the frame: two potholes and an open
    # manhole read as "Pothole 1", "Pothole 2", "Open Manhole 1" rather than
    # 1, 2, 3. A supervisor counting potholes should not have to subtract the
    # manhole from the numbering to get the count.
    seen: dict[str, int] = {}
    for d in dets:
        x1, y1, x2, y2 = [int(v) for v in d.box]
        colour = TAX.colour_of(d.label)          # one colour per civic category

        seen[d.label] = seen.get(d.label, 0) + 1
        # Percent, not a 0-1 decimal: "72%" is read correctly by someone who
        # has never seen a confidence score, "0.72" invites being read as a
        # measurement of the pothole.
        tag = f"{d.label.upper()} {seen[d.label]}  {d.confidence:.0%}"

        if d.polygon and len(d.polygon) >= 3:
            pts = np.array(d.polygon, dtype=np.int32).reshape(-1, 1, 2)
            # A translucent wash makes the extent readable without hiding the
            # road surface underneath, which is what a supervisor is judging.
            wash = out.copy()
            cv2.fillPoly(wash, [pts], colour)
            cv2.addWeighted(wash, 0.25, out, 0.75, 0, out)
            cv2.polylines(out, [pts], True, colour, 4, lineType=cv2.LINE_AA)
        else:
            cv2.rectangle(out, (x1, y1), (x2, y2), colour, 3)

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
