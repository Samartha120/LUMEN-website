"""Turn the box-labelled manhole corpus into a segmentation corpus.

The corpus is 1,290 images labelled with rectangles: Broken(0), Good(1),
Lose(2), Uncovered(3). Training a model that outputs polygons needs polygons,
and none exist. Rather than annotate 467 images by hand, each GROUND-TRUTH box
is handed to MobileSAM, which is asked only "which pixels in this box are the
object?" — the same semi-automatic annotation strategy the STDL streetview
project used, with SAM standing in for their LiDAR and Hough transform.

Prompting with ground truth rather than model output matters: the box is known
correct, so a bad outline can only be SAM's fault, and the shape gate below is
what catches it. Outlines that fail the gate drop the IMAGE from the training
set rather than the box — a manhole left unlabelled would otherwise teach the
model that manholes are background.

Positives are Broken + Uncovered (an actual opening). Good + Lose are intact
covers and are kept as empty label files: they are the hard negatives that stop
the model firing on every dark circle, which is the failure this class had.
"""
import random, shutil, sys
from pathlib import Path
import cv2, numpy as np

SRC = Path("data/sources/water/manholes")
OUT = Path("data/manhole_seg")
HAZARD = {"0", "3"}          # Broken, Uncovered
MIN_SOLIDITY, MIN_DOMINANCE = 0.95, 0.90
SEED = 42


def outline(sam, img, box_xyxy):
    x1, y1, x2, y2 = (int(v) for v in box_xyxy)
    if x2 - x1 < 8 or y2 - y1 < 8:
        return None
    r = sam(img, bboxes=[[x1, y1, x2, y2]], verbose=False)[0]
    if r.masks is None or len(r.masks) == 0:
        return None
    m = r.masks.data[0].cpu().numpy().astype(np.uint8)
    if m.shape[:2] != img.shape[:2]:
        m = cv2.resize(m, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cs = [c for c in cs if cv2.contourArea(c) > 20]
    if not cs:
        return None
    big = max(cs, key=cv2.contourArea)
    a = cv2.contourArea(big)
    if a <= 0:
        return None
    if a / max(cv2.contourArea(cv2.convexHull(big)), 1.0) < MIN_SOLIDITY:
        return None
    if a / max(sum(cv2.contourArea(c) for c in cs), 1.0) < MIN_DOMINANCE:
        return None
    pts = cv2.approxPolyDP(big, 0.004 * cv2.arcLength(big, True), True).reshape(-1, 2)
    return pts if len(pts) >= 3 else None


def main():
    from ultralytics import SAM
    sam = SAM("mobile_sam.pt")
    pos, neg, rejected = [], [], 0

    for lp in sorted(SRC.rglob("labels/*.txt")):
        ip = next((c for e in (".jpg", ".jpeg", ".png")
                   if (c := lp.parent.parent / "images" / (lp.stem + e)).exists()), None)
        if ip is None:
            continue
        rows = [l.split() for l in lp.read_text().splitlines() if l.strip()]
        haz = [r for r in rows if r[0] in HAZARD]
        if not haz:
            neg.append(ip)          # intact cover -> hard negative
            continue
        img = cv2.imread(str(ip))
        if img is None:
            continue
        H, W = img.shape[:2]
        polys = []
        for r in haz:
            cx, cy, bw, bh = (float(v) for v in r[1:5])
            box = [(cx - bw / 2) * W, (cy - bh / 2) * H, (cx + bw / 2) * W, (cy + bh / 2) * H]
            p = outline(sam, img, box)
            if p is None:
                polys = None            # drop the whole image, see docstring
                break
            polys.append(p)
        if polys is None:
            rejected += 1
            continue
        pos.append((ip, polys, W, H))

    random.Random(SEED).shuffle(pos)
    random.Random(SEED).shuffle(neg)
    # Negatives are capped so the split does not become mostly background.
    neg = neg[:len(pos)]
    n_val, n_tst = int(0.15 * len(pos)), int(0.15 * len(pos))
    parts = {"val": pos[:n_val], "test": pos[n_val:n_val + n_tst], "train": pos[n_val + n_tst:]}
    nv, nt = int(0.15 * len(neg)), int(0.15 * len(neg))
    nparts = {"val": neg[:nv], "test": neg[nv:nv + nt], "train": neg[nv + nt:]}

    if OUT.exists():
        shutil.rmtree(OUT)
    for split in parts:
        (OUT / "images" / split).mkdir(parents=True, exist_ok=True)
        (OUT / "labels" / split).mkdir(parents=True, exist_ok=True)
        for ip, polys, W, H in parts[split]:
            shutil.copy(ip, OUT / "images" / split / ip.name)
            lines = []
            for p in polys:
                flat = " ".join(f"{x/W:.6f} {y/H:.6f}" for x, y in p)
                lines.append(f"0 {flat}")
            (OUT / "labels" / split / (ip.stem + ".txt")).write_text("\n".join(lines) + "\n")
        for ip in nparts[split]:
            shutil.copy(ip, OUT / "images" / split / ip.name)
            (OUT / "labels" / split / (ip.stem + ".txt")).write_text("")

    (OUT / "data.yaml").write_text(
        f"path: {OUT.resolve()}\ntrain: images/train\nval: images/val\ntest: images/test\n"
        "names:\n  0: Open Manhole\n")
    print(f"  hazard images outlined : {len(pos)}")
    print(f"  rejected by shape gate : {rejected}  ({100*rejected/max(len(pos)+rejected,1):.0f}%)")
    print(f"  hard negatives kept    : {len(neg)}")
    for s in ("train", "val", "test"):
        print(f"    {s:5} {len(parts[s]):4} positive + {len(nparts[s]):4} negative")


if __name__ == "__main__":
    main()
