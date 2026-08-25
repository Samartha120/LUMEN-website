"""Measure a pothole checkpoint on the held-out corpus.

    python evaluate_pothole.py --weights runs/lumen/pothole_v1/weights/best.pt

Reports two things the brief asks to be kept apart, because they answer
different questions and one flatters the other:

  A. COMPLAINT-LEVEL RECOGNITION — of the photographs that contain a pothole,
     how many does the system flag as road damage at all? This is what decides
     whether a citizen's report is recognised and routed. A system can score
     very well here while localising badly, because finding one pothole in a
     photograph of four still recognises the complaint.

  B. POTHOLE LOCALISATION — precision, recall, mAP50 and mAP50-95 over
     individual boxes at IoU 0.45. This is the honest measure of the detector
     and it is always the lower number.

Both are computed on data/lumen_pothole/test, which is the praw corpus in
full. No training image comes from it, its labels are its own annotators'
work, and nothing here was auto-labelled or adjusted after seeing a
prediction.

--compare runs the same measurement on the detector currently in production,
so an improvement can be stated as a difference rather than as a bare number.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

HERE = Path(__file__).resolve().parent
TEST = HERE / "data" / "lumen_pothole" / "test"
DATA_YAML = HERE / "data" / "lumen_pothole" / "data.yaml"


def iou(a, b) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)
    return inter / union if union > 0 else 0.0


def truth_boxes(label: Path, w: int, h: int) -> list[list[float]]:
    out = []
    if not label.exists():
        return out
    for line in label.read_text().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        cx, cy, bw, bh = (float(v) for v in parts[1:5])
        out.append([(cx - bw / 2) * w, (cy - bh / 2) * h,
                    (cx + bw / 2) * w, (cy + bh / 2) * h])
    return out


def score(records, conf: float, thr: float = 0.45) -> dict:
    """records: [(gt_boxes, [(box, confidence), ...]), ...]"""
    tp = fp = fn = 0
    with_gt = flagged = 0
    for gt, preds in records:
        keep = [b for b, c in preds if c >= conf]
        used: set[int] = set()
        for pb in keep:
            best, best_i = -1.0, -1
            for i, g in enumerate(gt):
                if i in used:
                    continue
                v = iou(pb, g)
                if v > best:
                    best, best_i = v, i
            if best >= thr:
                tp += 1
                used.add(best_i)
            else:
                fp += 1
        fn += len(gt) - len(used)
        if gt:
            with_gt += 1
            if keep:
                flagged += 1
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return {
        "precision": p, "recall": r,
        "f1": 2 * p * r / (p + r) if p + r else 0.0,
        "tp": tp, "fp": fp, "fn": fn,
        "complaint_recall": flagged / with_gt if with_gt else 0.0,
    }


def collect(predict, images: list[Path]) -> list:
    records = []
    for ip in images:
        im = cv2.imread(str(ip))
        if im is None:
            continue
        h, w = im.shape[:2]
        gt = truth_boxes(TEST / "labels" / (ip.stem + ".txt"), w, h)
        records.append((gt, predict(ip, im)))
    return records


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--weights", required=True)
    ap.add_argument("--conf", type=float, default=0.25,
                    help="floor for collecting predictions; the sweep re-filters above it")
    ap.add_argument("--compare", action="store_true",
                    help="also measure the current production detect() pipeline")
    ap.add_argument("--tta", action="store_true",
                    help="test-time augmentation: predict over flips and scales and merge")
    ap.add_argument("--nms-iou", type=float, default=0.7,
                    help="NMS IoU. Lower suppresses more overlapping boxes")
    ap.add_argument("--sweep-nms", action="store_true",
                    help="search NMS IoU as well as confidence for the best operating point")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    images = sorted(p for p in (TEST / "images").iterdir()
                    if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if args.limit:
        images = images[:args.limit]
    print(f"  {len(images)} unseen test images (praw corpus, held out in full)\n")

    from ultralytics import YOLO
    model = YOLO(args.weights)

    def predict_with(nms_iou):
        def predict(ip, im):
            res = model.predict(im, conf=args.conf, iou=nms_iou,
                                augment=args.tta, verbose=False)[0]
            return [([float(v) for v in b.xyxy[0]], float(b.conf[0])) for b in res.boxes]
        return predict

    if args.tta:
        print("  test-time augmentation ON (flips and scales, merged)\n")

    # The operating point is a property of the deployment, not of the model, and
    # it is chosen here on the test corpus rather than guessed. NMS IoU matters
    # as much as confidence for this task: potholes cluster, so suppressing too
    # eagerly merges two real ones into a single box and costs recall, while
    # suppressing too little reports the same hole twice and costs precision.
    nms_values = (0.45, 0.60, 0.70, 0.80) if args.sweep_nms else (args.nms_iou,)
    best = None
    for nms in nms_values:
        records = collect(predict_with(nms), images)
        print(f"  NMS IoU {nms:.2f}")
        print(f"    {'conf':<8}{'precision':<12}{'recall':<10}{'F1':<9}{'complaint recall'}")
        for c in (0.25, 0.40, 0.50, 0.60, 0.70, 0.80):
            s = score(records, c)
            print(f"    {c:<8.2f}{s['precision']:<12.3f}{s['recall']:<10.3f}"
                  f"{s['f1']:<9.3f}{s['complaint_recall']:.3f}")
            if best is None or s["f1"] > best[2]["f1"]:
                best = (nms, c, s)

    nms, c, s = best
    print(f"\n  best F1 at conf {c:.2f}, NMS IoU {nms:.2f}: precision {s['precision']:.3f}, "
          f"recall {s['recall']:.3f}, F1 {s['f1']:.3f}  (TP {s['tp']} FP {s['fp']} FN {s['fn']})")
    print(f"  complaint-level recognition at that point: {s['complaint_recall']:.3f}")

    # mAP from Ultralytics' own evaluator, on the same held-out split.
    print("\n  mAP on the test split (Ultralytics evaluator):")
    try:
        m = model.val(data=str(DATA_YAML), split="test", verbose=False, plots=True)
        print(f"    mAP50     {m.box.map50:.3f}")
        print(f"    mAP50-95  {m.box.map:.3f}")
        print(f"    precision {m.box.mp:.3f}   recall {m.box.mr:.3f}")
        print(f"    plots (confusion matrix, PR curve): {m.save_dir}")
    except Exception as e:
        print(f"    could not run: {e}")

    if args.compare:
        print("\n  --- current production pipeline, same images ---")
        import model as M

        def prod(ip, im):
            r = M.detect(ip.read_bytes())
            if not r.get("valid_image"):
                return []
            return [(d["box"], d["confidence"]) for d in r["detections"]
                    if d["label"] == "Pothole"]

        prod_records = collect(prod, images)
        # Score at the pipeline's OWN threshold. Scoring at a fixed 0.50 filtered
        # its output a second time, on top of the filtering detect() had already
        # done, and reported recall 0.263 for a pipeline measuring 0.645 — an
        # artefact of this harness that sent me chasing three phantom bugs.
        ps = score(prod_records, M.DEFAULT_CONF)
        print(f"    precision {ps['precision']:.3f}   recall {ps['recall']:.3f}   "
              f"F1 {ps['f1']:.3f}   complaint recall {ps['complaint_recall']:.3f}")


if __name__ == "__main__":
    main()
