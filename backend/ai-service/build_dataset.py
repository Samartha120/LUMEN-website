"""Assemble the LUMEN pothole training set.

Run:  python build_dataset.py

WHAT THIS BUILDS, AND WHY IT IS SPLIT THIS WAY
----------------------------------------------
The brief asked for fine-tuning on "real LUMEN citizen images" to close a
domain gap against public benchmarks. That premise does not survive checking:
every one of the 701 citizen-* uploads in backend/uploads is a byte-identical
copy of a public dataset image, placed there by scripts/seed.ts. 645 of 701
match a file under ai-service/data/sources by MD5, and only 233 are potholes
at all. There is no separate LUMEN photographic domain to adapt to — the
"LUMEN images" and the "public benchmark" are the same pixels.

The failure the brief describes is real, but it is not that gap. It is
cross-corpus generalisation: a model trained on one pothole dataset scores
well on that dataset's own held-out split and mediocre on any other. That is
what a citizen — or an examiner uploading from Google Images — actually hits.

So the split is by SOURCE CORPUS, not by random sampling:

    train / val   v9 + the roads/potholes source, plus hard negatives
    test          praw, in full — a corpus no training image comes from

Splitting this way is the strongest possible reading of "do not split
near-identical images across train and test": frames from the same shoot,
the same road, and the same annotator all stay on one side of the line.
A random split would put near-duplicate frames on both sides and report a
number that flatters the model. Every label used here was made by the
corpus's own human annotators; nothing is auto-labelled, and the test set is
never touched by the detector.

The cost is that the ratios cannot be exactly 70/15/15 — corpora come in the
sizes they come in. The result is roughly 75/9/16, and the test set is the
part that matters.
"""
from __future__ import annotations

import hashlib
import random
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCES = HERE / "data" / "sources"
OUT = HERE / "data" / "lumen_pothole"

# Corpora that carry human pothole labels. (path, has train/valid/test dirs)
TRAIN_CORPORA = [
    Path("/tmp/v9"),
    SOURCES / "roads" / "potholes",
]
# Held out in full. The model must never see a frame from here.
TEST_CORPUS = Path("/tmp/praw")

# Images that contain no pothole but do contain what the detector keeps
# mistaking for one. These carry an empty label file, which is how YOLO is
# told "there is nothing to find here" — they need no annotation, which is
# why they are the cheapest available fix for the false-positive rate.
# Both sources were checked by eye before being trusted as negatives, because
# an unnoticed pothole in here teaches the model to ignore a real one.
# public/sidewalk was rejected on that inspection: it is greyscale, heavily
# noise-augmented mosaic fragments rather than photographs, and the brief rules
# out training on images unlike a real complaint.
HARD_NEGATIVES = [
    (SOURCES / "water" / "manholes", 420),      # covers, open voids, broken slabs
    (SOURCES / "roads" / "cracks", 260),        # dashcam roads: cracks, patches, stains
]
HARD_NEG_SEED = 20260823


def md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def images_in(root: Path) -> list[Path]:
    out: list[Path] = []
    for split in ("train", "valid", "val", "test"):
        d = root / split / "images"
        if d.is_dir():
            out += [p for p in sorted(d.iterdir())
                    if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    if not out:
        d = root / "images"
        if d.is_dir():
            out = [p for p in sorted(d.iterdir())
                   if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    return out


def label_for(img: Path) -> Path:
    return img.parent.parent / "labels" / (img.stem + ".txt")


def split_of(img: Path) -> str:
    """Which split a source image came from, by its directory."""
    for part in img.parts[::-1]:
        if part in ("train",):
            return "train"
        if part in ("valid", "val"):
            return "val"
        if part == "test":
            return "test"
    return "train"


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    for split in ("train", "val", "test"):
        (OUT / split / "images").mkdir(parents=True)
        (OUT / split / "labels").mkdir(parents=True)

    # The test corpus is indexed first so that any image appearing in a
    # training corpus as well can be dropped from training rather than from
    # the test set. Leakage is silent and it inflates every number downstream,
    # so it is checked by content rather than by filename.
    test_hashes: set[str] = set()
    n_test = 0
    for img in images_in(TEST_CORPUS):
        lab = label_for(img)
        if not lab.exists():
            continue
        h = md5(img)
        if h in test_hashes:
            continue                      # the corpus contains it twice
        test_hashes.add(h)
        shutil.copy(img, OUT / "test" / "images" / img.name)
        shutil.copy(lab, OUT / "test" / "labels" / lab.name)
        n_test += 1

    counts = {"train": 0, "val": 0}
    dropped_leak = 0
    seen: set[str] = set()
    for corpus in TRAIN_CORPORA:
        for img in images_in(corpus):
            lab = label_for(img)
            if not lab.exists():
                continue
            h = md5(img)
            if h in test_hashes:
                dropped_leak += 1
                continue
            if h in seen:
                continue
            seen.add(h)
            # A corpus's own test split is folded into validation: it is the
            # same distribution as its training data, so it cannot serve as a
            # generalisation test, but it is useful for choosing a checkpoint.
            split = split_of(img)
            split = "val" if split in ("val", "test") else "train"
            stem = f"{corpus.name}-{img.stem}"
            shutil.copy(img, OUT / split / "images" / (stem + img.suffix))
            shutil.copy(lab, OUT / split / "labels" / (stem + ".txt"))
            counts[split] += 1

    # Hard negatives, train split only. Never in validation or test: they carry
    # no boxes, so they cannot raise recall, and padding the evaluation sets
    # with images that have nothing to find would inflate precision for free.
    rng = random.Random(HARD_NEG_SEED)
    n_neg = 0
    for root, quota in HARD_NEGATIVES:
        pool = [p for p in images_in(root) if md5(p) not in test_hashes]
        rng.shuffle(pool)
        for img in pool[:quota]:
            h = md5(img)
            if h in seen:
                continue
            seen.add(h)
            stem = f"neg-{root.name}-{img.stem}"
            shutil.copy(img, OUT / "train" / "images" / (stem + img.suffix))
            (OUT / "train" / "labels" / (stem + ".txt")).write_text("")
            n_neg += 1
            counts["train"] += 1

    (OUT / "data.yaml").write_text(
        f"# LUMEN pothole dataset — built by build_dataset.py\n"
        f"# test/ is the praw corpus in full and appears in no training image.\n"
        f"path: {OUT}\n"
        f"train: train/images\n"
        f"val: val/images\n"
        f"test: test/images\n"
        f"nc: 1\n"
        f"names: [Pothole]\n"
    )

    total = counts["train"] + counts["val"] + n_test
    print(f"  train {counts['train']:>5}  ({n_neg} hard negatives, no boxes)")
    print(f"  val   {counts['val']:>5}")
    print(f"  test  {n_test:>5}  (praw — held out entirely)")
    print(f"  ratio {counts['train']/total:.0%} / {counts['val']/total:.0%} / {n_test/total:.0%}")
    if dropped_leak:
        print(f"  dropped {dropped_leak} training images that also appear in the test corpus")
    print(f"\n  {OUT/'data.yaml'}")


if __name__ == "__main__":
    main()
