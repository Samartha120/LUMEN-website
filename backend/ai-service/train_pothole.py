"""Fine-tune YOLO11s for pothole localisation on the LUMEN dataset.

    python build_dataset.py     # first, to assemble data/lumen_pothole
    python train_pothole.py     # then this

Starts from COCO-pretrained YOLO11s rather than random initialisation, and
selects the best validation checkpoint rather than the last epoch — YOLO
writes both, and best.pt is what evaluate_pothole.py reads.

Stop the AI service before training. Three earlier runs on this machine were
killed by the OOM reaper because uvicorn was holding the detector's own
weights resident at the same time.

AUGMENTATION
------------
Chosen to look like photographs a citizen would actually submit, which rules
out several defaults:

  fliplr      a road photographed from the other side is a real photograph
  flipud 0    nobody submits an upside-down road
  degrees 8   phones are held slightly crooked, not rotated 90 degrees
  scale 0.5   the same pothole from two paces or ten
  perspective the camera is held at an angle to the surface, always
  hsv_v/s     midday glare through to overcast and dusk
  mixup 0     two roads dissolved into each other is not a photograph
  mosaic      on for most of training and switched off for the final epochs,
              so the model finishes on whole, undistorted images

Blur and noise come from albumentations, which Ultralytics applies
automatically when it is installed.
"""
from __future__ import annotations

import argparse
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "lumen_pothole" / "data.yaml"
PROJECT = HERE / "runs" / "lumen"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="yolo11s.pt", help="pretrained starting weights")
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--patience", type=int, default=15, help="early stopping")
    ap.add_argument("--device", default="mps", help="mps, cpu or a cuda index")
    ap.add_argument("--name", default="pothole_v1")
    args = ap.parse_args()

    if not DATA.exists():
        raise SystemExit(f"{DATA} not found — run build_dataset.py first.")

    from ultralytics import YOLO

    model = YOLO(args.model)
    model.train(
        data=str(DATA),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        patience=args.patience,
        project=str(PROJECT),
        name=args.name,
        exist_ok=True,
        pretrained=True,
        val=True,
        plots=True,          # writes the confusion matrix and PR curves
        seed=20260823,

        # realistic photographic variation
        fliplr=0.5,
        flipud=0.0,
        degrees=8.0,
        translate=0.10,
        scale=0.50,
        shear=2.0,
        perspective=0.0005,
        hsv_h=0.015,
        hsv_s=0.70,
        hsv_v=0.40,
        mosaic=1.0,
        close_mosaic=10,
        mixup=0.0,
        copy_paste=0.0,
    )

    best = PROJECT / args.name / "weights" / "best.pt"
    print(f"\n  best checkpoint: {best}")
    print(f"  evaluate it on the unseen test corpus:")
    print(f"      python evaluate_pothole.py --weights {best}")


if __name__ == "__main__":
    main()
