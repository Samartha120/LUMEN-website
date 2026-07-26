"""Fine-tune YOLO on RDD2022 for civic road-damage detection.

Dataset
-------
RDD2022 — multi-national road damage dataset (47,420 images, 55,000+ annotated
instances, 6 countries including India), released through CRDDC'2022.
  Paper:    https://arxiv.org/abs/2209.08538
  Download: https://figshare.com/articles/dataset/RDD2022_-_The_multi-national_Road_Damage_Dataset_released_through_CRDDC_2022/21431547

Setup
-----
1. Download RDD2022 and extract it (e.g. to ai-service/data/RDD2022/).
2. RDD ships PASCAL-VOC XML annotations; convert to YOLO format:
       python train.py --convert --root data/RDD2022/India
3. Train:
       python train.py --train --epochs 50

Only the four damage classes are kept: D00, D10, D20, D40.
"""
from __future__ import annotations

import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

CLASSES = ["D00", "D10", "D20", "D40"]  # long. crack, trans. crack, alligator, pothole
CLASS_IDX = {c: i for i, c in enumerate(CLASSES)}

HERE = Path(__file__).parent
OUT = HERE / "data" / "yolo"


def convert(root: Path, val_split: float = 0.2, seed: int = 42):
    """Convert RDD VOC annotations to YOLO txt labels with a train/val split."""
    imgs_dir = root / "images"
    anns_dir = root / "annotations" / "xmls"
    if not imgs_dir.exists() or not anns_dir.exists():
        raise SystemExit(f"Expected {imgs_dir} and {anns_dir} to exist. Check --root.")

    pairs = []
    for xml in sorted(anns_dir.glob("*.xml")):
        img = imgs_dir / (xml.stem + ".jpg")
        if img.exists():
            pairs.append((img, xml))
    if not pairs:
        raise SystemExit("No image/annotation pairs found.")

    random.seed(seed)
    random.shuffle(pairs)
    cut = int(len(pairs) * (1 - val_split))
    splits = {"train": pairs[:cut], "val": pairs[cut:]}

    kept = dropped = 0
    for split, items in splits.items():
        (OUT / "images" / split).mkdir(parents=True, exist_ok=True)
        (OUT / "labels" / split).mkdir(parents=True, exist_ok=True)
        for img, xml in items:
            lines = []
            tree = ET.parse(xml)
            r = tree.getroot()
            size = r.find("size")
            W, H = int(size.find("width").text), int(size.find("height").text)
            if not W or not H:
                continue
            for obj in r.findall("object"):
                name = (obj.find("name").text or "").strip()
                if name not in CLASS_IDX:
                    dropped += 1
                    continue
                bb = obj.find("bndbox")
                x1, y1 = float(bb.find("xmin").text), float(bb.find("ymin").text)
                x2, y2 = float(bb.find("xmax").text), float(bb.find("ymax").text)
                cx, cy = ((x1 + x2) / 2) / W, ((y1 + y2) / 2) / H
                bw, bh = (x2 - x1) / W, (y2 - y1) / H
                if bw <= 0 or bh <= 0:
                    continue
                lines.append(f"{CLASS_IDX[name]} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
                kept += 1
            shutil.copy2(img, OUT / "images" / split / img.name)
            (OUT / "labels" / split / f"{img.stem}.txt").write_text("\n".join(lines))

    yaml = OUT / "rdd.yaml"
    yaml.write_text(
        f"path: {OUT.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"nc: {len(CLASSES)}\n"
        f"names: {CLASSES}\n"
    )
    print(f"Converted {len(pairs)} images  |  {kept} boxes kept, {dropped} out-of-class dropped")
    print(f"train={len(splits['train'])}  val={len(splits['val'])}")
    print(f"Wrote {yaml}")


def train(epochs: int, imgsz: int, batch: int, base: str):
    from ultralytics import YOLO
    import torch

    yaml = OUT / "rdd.yaml"
    if not yaml.exists():
        raise SystemExit("Run --convert first (rdd.yaml not found).")

    device = "mps" if torch.backends.mps.is_available() else ("0" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")

    m = YOLO(base)
    m.train(
        data=str(yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=str(HERE / "runs"),
        name="rdd",
        exist_ok=True,
    )
    metrics = m.val()
    print("\n=== Validation metrics ===")
    try:
        print(f"mAP50-95: {metrics.box.map:.4f}")
        print(f"mAP50:    {metrics.box.map50:.4f}")
        print(f"Precision:{metrics.box.mp:.4f}")
        print(f"Recall:   {metrics.box.mr:.4f}")
    except Exception:
        print(metrics)

    best = HERE / "runs" / "rdd" / "weights" / "best.pt"
    if best.exists():
        (HERE / "weights").mkdir(exist_ok=True)
        shutil.copy2(best, HERE / "weights" / "rdd_best.pt")
        print(f"\nInstalled fine-tuned weights -> {HERE / 'weights' / 'rdd_best.pt'}")
        print("Restart the AI service; /health will report model_mode=TRAINED.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--convert", action="store_true")
    ap.add_argument("--train", action="store_true")
    ap.add_argument("--root", type=Path, default=HERE / "data" / "RDD2022" / "India")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--base", default="yolov8n.pt")
    a = ap.parse_args()

    if a.convert:
        convert(a.root)
    if a.train:
        train(a.epochs, a.imgsz, a.batch, a.base)
    if not (a.convert or a.train):
        ap.print_help()
