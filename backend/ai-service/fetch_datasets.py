"""Download real, public civic-damage datasets into data/sources/.

Nothing here is synthetic — every source is a published dataset with a licence.
After downloading, run `python train_multi.py --merge` to unify them into one
label space, then `--train`.

    python fetch_datasets.py --list            # show sources, sizes, licences
    python fetch_datasets.py --get taco        # download one source
    python fetch_datasets.py --get-open        # everything that needs no account
    python fetch_datasets.py --get-roboflow    # needs ROBOFLOW_API_KEY (free)

Two kinds of source
-------------------
OPEN      direct download, no account         (RDD2022, TACO)
ROBOFLOW  free account -> API key required    (potholes, manholes, poles, bins)

Roboflow hosts the best small datasets for the electrical / water / waste
classes, but its download API needs a key. Create a free account at
https://roboflow.com, copy the key from Settings, then:

    export ROBOFLOW_API_KEY=xxxxxxxx
    python fetch_datasets.py --get-roboflow
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

HERE = Path(__file__).parent
SOURCES = HERE / "data" / "sources"

# --------------------------------------------------------------------------
# OPEN SOURCES — direct download, no account needed
# --------------------------------------------------------------------------
OPEN = {
    "rdd2022": {
        "category": "roads",
        "licence": "CC BY 4.0",
        "size": "13.3 GB",
        "classes": "D00 longitudinal / D10 transverse / D20 alligator / D40 pothole",
        "paper": "https://arxiv.org/abs/2209.08538",
        # figshare public file (article 21431547)
        "url": "https://ndownloader.figshare.com/files/38030910",
        "note": "Large. Contains per-country folders (India, Japan, Czech, Norway, US, China); "
                "you can keep just India to train faster.",
    },
    "taco": {
        "category": "waste",
        "licence": "MIT (annotations) / images CC via Flickr",
        "size": "~1.500 images",
        "classes": "60 litter classes (map to Garbage Pile / Debris / Overflowing Bin)",
        "paper": "https://arxiv.org/abs/2003.06975",
        "repo": "https://github.com/pedropro/TACO",
        "note": "Cloned, then its own download.py pulls the images from Flickr. COCO format.",
    },
}

# --------------------------------------------------------------------------
# ROBOFLOW SOURCES — free account -> API key
# workspace / project / version, taken from universe.roboflow.com URLs
# --------------------------------------------------------------------------
ROBOFLOW = {
    "potholes": {
        "category": "roads", "workspace": "yolo-ex0t3", "project": "potholes-91kmb", "version": 1,
        "classes": "pothole", "url": "https://universe.roboflow.com/yolo-ex0t3/potholes-91kmb",
    },
    "manholes": {
        "category": "water", "workspace": "create-dataset-for-yolo",
        "project": "manhole-cover-dataset-yolo", "version": 1,
        "classes": "Broken / Loose / Uncovered / Good — 'Uncovered' maps to Open Manhole",
        "url": "https://universe.roboflow.com/create-dataset-for-yolo/manhole-cover-dataset-yolo",
    },
    "poles": {
        "category": "electrical", "workspace": "unstructured",
        "project": "utility-pole-detection-birhf", "version": 1,
        "classes": "pole (1,310 images)",
        "url": "https://universe.roboflow.com/unstructured/utility-pole-detection-birhf",
    },
    # --- ROADS: the crack classes -----------------------------------------
    # Uses the RDD2022 label scheme (D00/D10/D20/D40) but hosted on Roboflow,
    # so it is a few hundred MB rather than the 13.3 GB original archive.
    # SOURCE_MAP already maps those codes, so no mapping work is needed.
    "cracks": {
        "category": "roads", "workspace": "new-workspace-kj87b",
        "project": "road-damage-detection-iicdh", "version": None,
        "classes": "D00 longitudinal / D10 transverse / D20 alligator / D40 pothole",
        "url": "https://universe.roboflow.com/new-workspace-kj87b/road-damage-detection-iicdh",
    },
    # --- WASTE -----------------------------------------------------------
    "garbage": {
        "category": "waste", "workspace": "garbage-detection-czeg5",
        "project": "garbage_detection-wvzwv", "version": None,
        "classes": "garbage (annotated as large groupings -> Garbage Pile)",
        "url": "https://universe.roboflow.com/garbage-detection-czeg5/garbage_detection-wvzwv",
    },
    "binoverflow": {
        "category": "waste", "workspace": "mariswary-deepak-4ajr0",
        "project": "garbage-can-overflow", "version": None,
        "classes": "overflowing / not-overflowing bins -> Overflowing Bin",
        "url": "https://universe.roboflow.com/mariswary-deepak-4ajr0/garbage-can-overflow",
    },
    # --- PUBLIC PROPERTY -------------------------------------------------
    "sidewalk": {
        "category": "public", "workspace": "sidewalk-defects",
        "project": "sidewalk-defects-yv0ob", "version": None,
        "classes": "sidewalk defects (~416 images) -> Broken Footpath",
        "url": "https://universe.roboflow.com/sidewalk-defects/sidewalk-defects-yv0ob",
    },
    "sidewalkdamage": {
        "category": "public", "workspace": "daos",
        "project": "sidewalk-damage", "version": None,
        "classes": "Losa-Agrietada / cracked slab (~454 images) -> Broken Footpath",
        "url": "https://universe.roboflow.com/daos/sidewalk-damage",
    },
}


def _dl(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"   downloading -> {dest.name}")

    def hook(blocks, bs, total):
        if total > 0:
            pct = min(100, blocks * bs * 100 // total)
            sys.stdout.write(f"\r   {pct:3d}%  ({blocks * bs / 1e9:.2f} / {total / 1e9:.2f} GB)")
            sys.stdout.flush()

    urllib.request.urlretrieve(url, dest, reporthook=hook)
    print()


def get_open(name: str) -> None:
    spec = OPEN[name]
    out = SOURCES / spec["category"]
    out.mkdir(parents=True, exist_ok=True)

    if name == "taco":
        repo = HERE / "data" / "_taco_repo"
        if not repo.exists():
            print("   cloning TACO…")
            subprocess.run(["git", "clone", "--depth", "1", spec["repo"], str(repo)], check=True)
        print("   fetching images via TACO's own download.py (this takes a while)…")
        subprocess.run([sys.executable, "download.py"], cwd=repo, check=False)
        # TACO ships COCO annotations; copy what we have into the source folder
        ann = repo / "data" / "annotations.json"
        if ann.exists():
            shutil.copy2(ann, out / "annotations.coco.json")
        imgs = repo / "data"
        if imgs.exists():
            print(f"   TACO data at {imgs}")
        print("   NOTE: TACO is COCO-format. Convert to YOLO before merging "
              "(see 'Converting COCO -> YOLO' in the README).")
        return

    zip_path = HERE / "data" / f"{name}.zip"
    if not zip_path.exists():
        _dl(spec["url"], zip_path)
    print(f"   extracting into {out} …")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(out)
    print(f"   done: {out}")


def get_roboflow(only: str | None = None) -> None:
    key = os.environ.get("ROBOFLOW_API_KEY")
    if not key:
        print("ROBOFLOW_API_KEY is not set.\n"
              "  1. Create a free account at https://roboflow.com\n"
              "  2. Settings -> copy your Private API key\n"
              "  3. export ROBOFLOW_API_KEY=xxxxxxxx\n"
              "  4. re-run: python fetch_datasets.py --get-roboflow")
        return
    try:
        from roboflow import Roboflow
    except ImportError:
        print("The roboflow package is missing.  pip install roboflow")
        return

    rf = Roboflow(api_key=key)
    for name, s in ROBOFLOW.items():
        if only and name != only:
            continue
        out = SOURCES / s["category"]
        out.mkdir(parents=True, exist_ok=True)
        dest = out / name
        if (dest / "data.yaml").exists():
            print(f"→ {name} ({s['category']}) — already downloaded, skipping")
            continue
        out.mkdir(parents=True, exist_ok=True)
        print(f"→ {name} ({s['category']}) …")
        try:
            proj = rf.workspace(s["workspace"]).project(s["project"])
            version = s.get("version") or _latest_version(proj)
            proj.version(version).download("yolov8", location=str(dest))
            print(f"   saved to {dest}  (version {version})")
        except Exception as e:
            print(f"   FAILED: {e}\n   open {s['url']} and download 'YOLOv8' manually into {dest}")


def _latest_version(proj) -> int:
    """Newest published version. Roboflow version ids look like 'ws/project/3'."""
    nums = []
    for v in proj.versions():
        try:
            nums.append(int(str(v.version).rstrip("/").rsplit("/", 1)[-1]))
        except (ValueError, AttributeError):
            continue
    if not nums:
        raise RuntimeError("no published versions found")
    return max(nums)


def inspect() -> None:
    """Print the real class names of every downloaded dataset.

    SOURCE_MAP in train_multi.py must be keyed on these exact strings, so read
    them from disk rather than guessing them from the dataset's web page.
    """
    import yaml  # ships with ultralytics

    found = sorted(SOURCES.glob("*/*/data.yaml"))
    if not found:
        print(f"No datasets under {SOURCES}. Download some first.")
        return
    for y in found:
        rel = y.relative_to(SOURCES).parent
        try:
            names = yaml.safe_load(y.read_text()).get("names", [])
        except Exception as e:
            print(f"{rel}: could not read data.yaml ({e})")
            continue
        if isinstance(names, dict):
            names = [names[k] for k in sorted(names)]
        counts = {
            split: len(list((y.parent / split / "images").glob("*")))
            for split in ("train", "valid", "val", "test")
            if (y.parent / split / "images").exists()
        }
        print(f"\n{rel}")
        print(f"   images : {counts}")
        print(f"   classes: {names}")
    print("\nMap these exact names in train_multi.py SOURCE_MAP "
          "(use None to drop a class rather than mislabel it).")


def listing() -> None:
    print("OPEN — no account needed\n" + "-" * 60)
    for n, s in OPEN.items():
        print(f"{n:10s} {s['category']:11s} {s['size']:>12s}  {s['licence']}")
        print(f"           {s['classes']}")
    print("\nROBOFLOW — free account, then export ROBOFLOW_API_KEY\n" + "-" * 60)
    for n, s in ROBOFLOW.items():
        print(f"{n:10s} {s['category']:11s}  {s['classes']}")
        print(f"           {s['url']}")
    print(f"\nDatasets land in: {SOURCES}")
    print("Then:  python train_multi.py --merge  &&  python train_multi.py --train")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--get", metavar="NAME", help="one source name (rdd2022, taco, potholes, …)")
    ap.add_argument("--get-open", action="store_true", help="all no-account sources")
    ap.add_argument("--get-roboflow", action="store_true", help="all Roboflow sources (needs key)")
    ap.add_argument("--inspect", action="store_true", help="print real class names of downloaded datasets")
    a = ap.parse_args()

    if a.inspect:
        inspect()
        raise SystemExit(0)
    if a.list or not (a.get or a.get_open or a.get_roboflow):
        listing()
    if a.get_open:
        for n in OPEN:
            print(f"→ {n} …")
            get_open(n)
    if a.get_roboflow:
        get_roboflow()
    if a.get:
        if a.get in OPEN:
            get_open(a.get)
        elif a.get in ROBOFLOW:
            get_roboflow(a.get)
        else:
            print(f"Unknown source '{a.get}'. Run --list to see the options.")
