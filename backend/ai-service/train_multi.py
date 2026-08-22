"""Train ONE multi-category civic damage detector from several datasets.

Why one model and not one per category
--------------------------------------
A citizen's photo does not arrive pre-labelled, so there is no way to know which
category-specific model to run. A single multi-class detector does one forward
pass and returns whatever civic damage it finds — pothole, exposed wire, garbage
pile — and LUMEN routes the complaint from that class (see taxonomy.py).

Datasets
--------
Collect one or more YOLO-format datasets per category and drop them under
`data/sources/<name>/`, each in the usual layout:

    data/sources/potholes/
        data.yaml            # must list its own class names
        train/images, train/labels
        valid/images, valid/labels   (or val/)

Good public sources: RDD2022 (roads, arxiv.org/abs/2209.08538) and Roboflow
Universe for pothole / garbage / manhole / streetlight sets.

Then map every source class onto our taxonomy in SOURCE_MAP below and run:

    python train_multi.py --merge          # build the unified dataset
    python train_multi.py --train          # fine-tune YOLO on it
    python train_multi.py --report         # per-class mAP for the report

Merging rewrites each label file's class ids to a contiguous training index
(taxonomy.TRAIN_IDS — `yolo_id` tracks the existing checkpoint and may have
gaps where a class was retired, which YOLO will not accept), so all
datasets share one consistent label space.
"""
from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

import taxonomy as TAX

HERE = Path(__file__).parent
SOURCES = HERE / "data" / "sources"
MERGED = HERE / "data" / "civic"

# ---------------------------------------------------------------------------
# Map each source dataset's own class names onto our taxonomy labels.
# Left  = the class name as it appears in that dataset's data.yaml
# Right = a label from taxonomy.CLASSES (or None to drop the class)
# ---------------------------------------------------------------------------
SOURCE_MAP: dict[str, dict[str, str | None]] = {
    "roads": {
        # Roboflow "potholes-91kmb" uses the plural class name
        "potholes": "Pothole",
        "pothole": "Pothole",
        # RDD2022 codes. D00 (longitudinal) and D10 (transverse) are retired:
        # longitudinal scored 0.188 mAP50 — thin cracks are easily confused with
        # lane markings — and RDD India carries only 31 transverse boxes.
        "D00": None,
        "D10": None,
        "D20": "Alligator Crack",
        "D40": "Pothole",
    },
    "electrical": {
        # NOTE: the utility-pole dataset detects poles, it does NOT distinguish a
        # damaged pole from a healthy one. Mapping "pole" -> "Damaged Pole" would
        # teach the model that every pole is damaged, so it is deliberately
        # dropped. Replace with a damage-labelled source before enabling.
        "pole": None,
        "damaged_pole": "Damaged Pole",
        "exposed_wire": "Exposed Wire",
        "hanging_wire": "Exposed Wire",
        "transformer": "Open Transformer",
        "streetlight": "Broken Streetlight",
        "broken_streetlight": "Broken Streetlight",
    },
    "waste": {
        # Roboflow "garbage_detection-wvzwv": boxes large groupings of garbage.
        "garbage": "Garbage Pile",
        "garbage_pile": "Garbage Pile",
        # Roboflow "garbage-can-overflow": 5 classes, but only one is a
        # complaint. An intact bin — open, closed or healthy — is not damage,
        # and "Broken trash can" is a damaged bin rather than an overflowing
        # one; mapping it to Overflowing Bin would teach the wrong appearance,
        # and the taxonomy has no Broken Bin class, so it is dropped.
        "Trash over flow": "Overflowing Bin",
        "Broken trash can": None,
        "Healthy trash can": None,
        "Trash can closed": None,
        "Trash can open": None,
        "overflow_bin": "Overflowing Bin",
        "bin": "Overflowing Bin",
        "debris": "Debris",
    },
    "water": {
        # Roboflow "manhole-cover-dataset-yolo": Broken / Good / Lose / Uncovered.
        # "Good" is an intact cover — not damage — so it is dropped.
        "Uncovered": "Open Manhole",
        "Broken": "Open Manhole",
        "Lose": "Open Manhole",
        "Good": None,
        "manhole": "Open Manhole",
        "open_manhole": "Open Manhole",
        "waterlogging": "Waterlogging",
        "flood": "Waterlogging",
        "leak": "Pipe Leak",
    },
    # The sidewalk sources are kept on disk but no longer mapped. Broken
    # Footpath was trained and measured at 4/20 detected, 1/20 correctly
    # classified: the annotations label hairline paving cracks inconsistently,
    # so the class could not be learned and was removed from the taxonomy.
    # Mapping to None keeps the merge quiet about them rather than reporting
    # them as an accidental omission.
    "public": {
        "crack": None,
        "Losa-Agrietada": None,
        "footpath": None,
        "broken_footpath": None,
        "signage": None,
        "railing": None,
    },
}


def _read_source_classes(src: Path) -> list[str]:
    """Class names in a source dataset's data.yaml, in class-id order."""
    y = src / "data.yaml"
    if not y.exists():
        raise SystemExit(f"{y} not found — each source needs its own data.yaml")
    text = y.read_text()
    # names can be a YAML list or a dict; handle the common list form
    import re
    m = re.search(r"names\s*:\s*\[(.*?)\]", text, re.S)
    if m:
        return [n.strip().strip("'\"") for n in m.group(1).split(",") if n.strip()]
    names, in_names = [], False
    for line in text.splitlines():
        if line.strip().startswith("names:"):
            in_names = True
            continue
        if in_names:
            s = line.strip()
            if s.startswith("-"):
                names.append(s[1:].strip().strip("'\""))
            elif s and not s.startswith("#") and ":" in s and not s[0].isdigit():
                break
            elif s and s[0].isdigit() and ":" in s:      # "0: pothole"
                names.append(s.split(":", 1)[1].strip().strip("'\""))
    if not names:
        raise SystemExit(f"Could not parse class names from {y}")
    return names


def merge(cap: int = 0) -> None:
    """Unify the source datasets into one label space.

    `cap` limits how many TRAINING images are taken from each source. The
    sources are wildly different sizes — the two sidewalk sets contribute 7,572
    boxes against 951 for manholes — and left unbalanced the model spends most
    of its time re-learning the class it has already mastered while the rare
    classes stay weak. Capping equalises the contribution and, as a side
    effect, cuts training time roughly in half. Validation images are never
    capped: the evaluation set should stay as broad as possible.
    """
    if not SOURCES.exists():
        raise SystemExit(f"No sources found. Create {SOURCES} and add datasets (see docstring).")

    for split in ("train", "val"):
        (MERGED / "images" / split).mkdir(parents=True, exist_ok=True)
        (MERGED / "labels" / split).mkdir(parents=True, exist_ok=True)

    kept = dropped = images = 0
    per_class: dict[str, int] = {}
    # Source class names that had no SOURCE_MAP entry, so their boxes were
    # discarded. Reported at the end — a silent drop looks identical to a
    # dataset that simply contains nothing.
    unmapped: dict[str, int] = {}

    # A category folder may hold the dataset directly, or one sub-folder per
    # dataset (which is how the Roboflow downloader lays them out).
    datasets: list[tuple[str, Path]] = []
    for cat_dir in sorted(p for p in SOURCES.iterdir() if p.is_dir()):
        if (cat_dir / "data.yaml").exists():
            datasets.append((cat_dir.name, cat_dir))
        else:
            for sub in sorted(p for p in cat_dir.iterdir() if p.is_dir()):
                if (sub / "data.yaml").exists():
                    datasets.append((cat_dir.name, sub))
    if not datasets:
        raise SystemExit(f"No datasets with a data.yaml found under {SOURCES}")

    for category, src in datasets:
        mapping = SOURCE_MAP.get(category)
        if mapping is None:
            print(f"!  {src.name}: category '{category}' not in SOURCE_MAP — skipping")
            continue
        names = _read_source_classes(src)
        print(f"→  {category}/{src.name}: {len(names)} source classes {names}")

        # A source uses either `valid/` or `val/` for validation — never both.
        # Processing both would copy the same images twice and inflate the counts.
        val_dir = "valid" if (src / "valid" / "images").exists() else "val"
        for split_in, split_out in (("train", "train"), (val_dir, "val")):
            img_dir, lbl_dir = src / split_in / "images", src / split_in / "labels"
            if not img_dir.exists():
                continue
            taken = 0
            candidates = sorted(img_dir.iterdir())
            if cap and split_out == "train" and len(candidates) > cap:
                # Even stride rather than the first N, so the sample spans the
                # whole dataset instead of one contiguous block of near-duplicates.
                stride = len(candidates) / cap
                candidates = [candidates[int(i * stride)] for i in range(cap)]
                print(f"     capped train split to {cap} of {len(sorted(img_dir.iterdir()))} images")
            for img in candidates:
                if img.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                    continue
                taken += 1
                lbl = lbl_dir / (img.stem + ".txt")
                lines_out: list[str] = []
                if lbl.exists():
                    for line in lbl.read_text().splitlines():
                        parts = line.split()
                        if len(parts) < 5:
                            continue
                        cid = int(parts[0])
                        src_name = names[cid] if cid < len(names) else str(cid)
                        target = mapping.get(src_name)
                        if not target or target not in TAX.CLASSES:
                            dropped += 1
                            # Absent from the map entirely = probably a mistake.
                            # Explicitly mapped to None = a deliberate drop.
                            if src_name not in mapping:
                                key = f"{category}/{src.name}:{src_name}"
                                unmapped[key] = unmapped.get(key, 0) + 1
                            continue
                        new_id = TAX.TRAIN_IDS[target]
                        lines_out.append(" ".join([str(new_id), *parts[1:]]))
                        per_class[target] = per_class.get(target, 0) + 1
                        kept += 1
                # prefix the filename so sources can't collide
                stem = f"{category}_{src.name}__{img.stem}"
                dest = MERGED / "images" / split_out / f"{stem}{img.suffix}"
                # Hard-link rather than copy: the merged set is a relabelling of
                # the sources, not new imagery, so a second physical copy of
                # every image would roughly double the dataset on disk for
                # nothing. Falls back to a real copy across filesystems.
                if dest.exists():
                    dest.unlink()
                try:
                    os.link(img, dest)
                except OSError:
                    shutil.copy2(img, dest)
                (MERGED / "labels" / split_out / f"{stem}.txt").write_text("\n".join(lines_out))
                images += 1

    yaml = MERGED / "civic.yaml"
    yaml.write_text(
        f"path: {MERGED.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"nc: {len(TAX.YOLO_NAMES)}\n"
        f"names: {TAX.YOLO_NAMES}\n"
    )

    # Count from the files actually written — the counters above can drift, and
    # an overstated dataset size would be misleading in the project report.
    actual: dict[str, int] = {}
    labelled_images = 0
    for split in ("train", "val"):
        for f in (MERGED / "labels" / split).glob("*.txt"):
            rows = [r for r in f.read_text().splitlines() if len(r.split()) >= 5]
            if rows:
                labelled_images += 1
            for r in rows:
                try:
                    name = TAX.YOLO_NAMES[int(r.split()[0])]
                except (ValueError, IndexError):
                    continue
                actual[name] = actual.get(name, 0) + 1

    total = sum(actual.values())
    print(f"\nMerged {images} images ({labelled_images} with at least one box) — "
          f"{total} boxes, {dropped} unmapped/dropped")
    print("Per-class box counts (from the written labels):")
    for name in TAX.YOLO_NAMES:
        n = actual.get(name, 0)
        flag = "  <-- NO DATA — cannot be trained" if n == 0 else ("  <-- too few to train" if n < 50 else "")
        print(f"   {name:20s} {n:6d}{flag}")
    trainable = [n for n, c in actual.items() if c >= 50]
    print(f"\nTrainable classes ({len(trainable)}/{len(TAX.YOLO_NAMES)}): {trainable or 'none'}")

    if unmapped:
        print("\n!  These source classes are missing from SOURCE_MAP, so their "
              "boxes were discarded:")
        for key, n in sorted(unmapped.items(), key=lambda kv: -kv[1]):
            print(f"   {key:50s} {n:6d} boxes")
        print("   Add them to SOURCE_MAP in this file (or map to None to drop "
              "them on purpose).")

    print(f"\nWrote {yaml}")


def train(epochs: int, imgsz: int, batch: int, base: str) -> None:
    from ultralytics import YOLO
    import torch

    yaml = MERGED / "civic.yaml"
    if not yaml.exists():
        raise SystemExit("Run --merge first (civic.yaml not found).")

    device = "mps" if torch.backends.mps.is_available() else ("0" if torch.cuda.is_available() else "cpu")
    print(f"Training {len(TAX.YOLO_NAMES)} civic classes on device: {device}")

    m = YOLO(base)
    m.train(data=str(yaml), epochs=epochs, imgsz=imgsz, batch=batch, device=device,
            project=str(HERE / "runs"), name="civic", exist_ok=True)

    best = HERE / "runs" / "civic" / "weights" / "best.pt"
    if best.exists():
        (HERE / "weights").mkdir(exist_ok=True)
        shutil.copy2(best, HERE / "weights" / "civic_best.pt")
        print(f"\nInstalled weights -> weights/civic_best.pt")
        print("Restart the AI service; /health will report model_mode=TRAINED.")


def report() -> None:
    """Per-class metrics for the project report."""
    from ultralytics import YOLO
    w = HERE / "weights" / "civic_best.pt"
    if not w.exists():
        raise SystemExit("weights/civic_best.pt not found — train first.")
    metrics = YOLO(str(w)).val(data=str(MERGED / "civic.yaml"))
    print("\n=== Overall ===")
    print(f"mAP50-95 {metrics.box.map:.4f} | mAP50 {metrics.box.map50:.4f} | "
          f"P {metrics.box.mp:.4f} | R {metrics.box.mr:.4f}")
    print("\n=== Per class ===")
    try:
        for i, name in enumerate(TAX.YOLO_NAMES):
            print(f"  {name:20s} mAP50 {metrics.box.ap50[i]:.4f}")
    except Exception:
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--merge", action="store_true", help="merge source datasets into one label space")
    ap.add_argument("--cap", type=int, default=0,
                    help="max TRAIN images per source dataset (0 = no cap). Balances "
                         "over-represented classes and shortens training.")
    ap.add_argument("--train", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--base", default="yolo11n.pt", help="Ultralytics YOLO11 Nano base checkpoint")
    a = ap.parse_args()

    if a.merge:
        merge(a.cap)
    if a.train:
        train(a.epochs, a.imgsz, a.batch, a.base)
    if a.report:
        report()
    if not (a.merge or a.train or a.report):
        ap.print_help()
        print(f"\nTaxonomy: {len(TAX.YOLO_NAMES)} classes across {len(TAX.CATEGORIES)} categories")
        for cat, meta in TAX.CATEGORIES.items():
            cls = [c for c, e in TAX.CLASSES.items() if e["category"] == cat]
            print(f"  {cat:11s} -> {meta['dept_name']:24s} {cls}")
