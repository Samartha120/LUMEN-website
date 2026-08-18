"""Convert the RDD2022 India subset into the YOLO layout the merge expects.

RDD2022 ships Pascal VOC XML, one file per image, with the damage-type codes
D00/D10/D20/D40 that train_multi.SOURCE_MAP already understands. This unpacks
the country archive straight from the zip, rewrites the boxes as YOLO
normalised txt, and splits into train/valid.

    python convert_rdd.py data/rdd_india.zip

Codes outside the taxonomy (crosswalk blur, damaged paint, manhole covers) are
dropped rather than guessed at — see KEEP below.
"""
from __future__ import annotations

import argparse
import random
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "data" / "sources" / "roads" / "cracks"

# RDD damage codes we carry through. The rest are real annotations but describe
# things outside the LUMEN taxonomy, and inventing a mapping for them would put
# wrong labels into training:
#   D01/D11  wheel-mark and construction-joint cracks (no equivalent class)
#   D43/D44  crosswalk blur and faded paint (markings, not structural damage)
#   D50      manhole COVER — an intact cover, not the Open Manhole hazard
KEEP = ["D00", "D10", "D20", "D40"]


def convert(zip_path: Path, val_split: float = 0.15, seed: int = 0) -> None:
    if not zip_path.exists():
        sys.exit(f"Archive not found: {zip_path}")

    for split in ("train", "valid"):
        for kind in ("images", "labels"):
            (OUT / split / kind).mkdir(parents=True, exist_ok=True)

    z = zipfile.ZipFile(zip_path)
    names = z.namelist()
    xmls = [p for p in names if p.endswith(".xml") and "/train/" in p]
    images = {Path(p).stem: p for p in names if p.lower().endswith(".jpg") and "/train/" in p}

    rng = random.Random(seed)
    kept_boxes = dropped_boxes = 0
    per_class: dict[str, int] = {}
    written = skipped = 0

    for xml_path in sorted(xmls):
        stem = Path(xml_path).stem
        img_entry = images.get(stem)
        if img_entry is None:
            skipped += 1
            continue

        root = ET.fromstring(z.read(xml_path))
        size = root.find("size")
        W = float(size.find("width").text)
        H = float(size.find("height").text)
        if W <= 0 or H <= 0:
            skipped += 1
            continue

        lines: list[str] = []
        for obj in root.findall("object"):
            code = (obj.find("name").text or "").strip()
            if code not in KEEP:
                dropped_boxes += 1
                continue
            b = obj.find("bndbox")
            x1, y1 = float(b.find("xmin").text), float(b.find("ymin").text)
            x2, y2 = float(b.find("xmax").text), float(b.find("ymax").text)
            # Clamp: a few RDD boxes run a pixel or two past the frame edge.
            x1, x2 = max(0.0, min(x1, W)), max(0.0, min(x2, W))
            y1, y2 = max(0.0, min(y1, H)), max(0.0, min(y2, H))
            if x2 - x1 < 2 or y2 - y1 < 2:
                dropped_boxes += 1
                continue
            cx, cy = (x1 + x2) / 2 / W, (y1 + y2) / 2 / H
            bw, bh = (x2 - x1) / W, (y2 - y1) / H
            lines.append(f"{KEEP.index(code)} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
            per_class[code] = per_class.get(code, 0) + 1
            kept_boxes += 1

        # Images with no box of interest are of no use here — the merge counts
        # them as images and they would dilute the per-source cap.
        if not lines:
            skipped += 1
            continue

        split = "valid" if rng.random() < val_split else "train"
        with z.open(img_entry) as src, open(OUT / split / "images" / f"{stem}.jpg", "wb") as dst:
            shutil.copyfileobj(src, dst)
        (OUT / split / "labels" / f"{stem}.txt").write_text("\n".join(lines))
        written += 1

    (OUT / "data.yaml").write_text(
        f"path: {OUT.resolve()}\ntrain: train/images\nval: valid/images\n"
        f"nc: {len(KEEP)}\nnames: {KEEP}\n"
    )

    print(f"wrote {written} images ({skipped} skipped: no image, or no box in {KEEP})")
    print(f"boxes kept {kept_boxes}, dropped {dropped_boxes} (codes outside the taxonomy)")
    for code in KEEP:
        print(f"   {code}: {per_class.get(code, 0)}")
    print(f"\n-> {OUT}")
    print("Now:  python train_multi.py --merge --cap <N>")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("zip", nargs="?", default=str(HERE / "data" / "rdd_india.zip"))
    ap.add_argument("--val-split", type=float, default=0.15)
    a = ap.parse_args()
    convert(Path(a.zip), a.val_split)
