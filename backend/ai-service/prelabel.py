"""Pre-label a folder of new photographs so a human only has to correct them.

The remaining misses in this pipeline are not a tuning problem — the detector
already separates hazards from intact covers at 0.76 against 0.00 — they are a
data problem. Closing them needs new photographs of the specific failures: dark
covers, partially displaced slabs, distant covers, diffuse litter, and the
potholes shot from angles the model has not seen.

Drawing boxes from scratch on 100 photographs is a long evening. This does the
first pass: every detector in the pipeline is run at a LOW threshold, and what
they find is written as YOLO labels for a human to fix. Correcting a box that is
roughly right is several times faster than drawing one, and deleting a wrong box
is instant.

It runs the detectors at a deliberately generous bar. A missed box costs the
annotator a fresh drawing; a spurious one costs a keypress. Over-reporting is
the cheaper error here, which is the opposite of the production setting.

    python prelabel.py ~/Desktop/new_photos            # writes labels beside them
    python prelabel.py ~/Desktop/new_photos --review   # also writes preview JPEGs

Output is a YOLO folder ready to merge into data/sources/<category>/<name>/:

    <out>/images/*.jpg
    <out>/labels/*.txt      class cx cy w h   (normalised)
    <out>/preview/*.jpg     the same boxes drawn on, for eyeballing
    <out>/classes.txt

WHAT TO PHOTOGRAPH, based on what actually fails today:
  Open Manhole  - covers in shadow or at dusk; slabs pushed half aside; covers
                  15-20 m away; broken covers still sitting in their frame.
  Garbage Pile  - litter scattered thinly rather than heaped; waste in grass,
                  water or woodland; bulky items (mattresses, furniture) if you
                  want those counted, and then label them CONSISTENTLY.
  Pothole       - shot from standing height rather than close up; wet or
                  water-filled; in shade; at the edge of the carriageway.

Label the same thing the same way every time. The measurements in this project
show inconsistent labelling costs more accuracy than any model change recovers.
"""
import argparse, sys
from pathlib import Path

import cv2
import numpy as np

CLASSES = ["Pothole", "Garbage Pile", "Open Manhole"]
# Generous on purpose — see the docstring.
CONF = {"Pothole": 0.15, "Garbage Pile": 0.15, "Open Manhole": 0.20}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("folder", help="folder of new photographs")
    ap.add_argument("--out", default=None, help="output folder (default <folder>_labelled)")
    ap.add_argument("--review", action="store_true", help="also write preview JPEGs")
    a = ap.parse_args()

    src = Path(a.folder).expanduser()
    if not src.is_dir():
        print(f"No such folder: {src}")
        return 1
    out = Path(a.out).expanduser() if a.out else src.parent / (src.name + "_labelled")

    photos = [p for p in sorted(src.iterdir())
              if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".heic"}]
    if not photos:
        print(f"No images in {src}")
        return 1

    import model as M
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    if a.review:
        (out / "preview").mkdir(parents=True, exist_ok=True)
    (out / "classes.txt").write_text("\n".join(CLASSES) + "\n")

    counts = {c: 0 for c in CLASSES}
    empty = 0
    for i, p in enumerate(photos, 1):
        img = cv2.imread(str(p))
        if img is None:
            print(f"  skipped (unreadable): {p.name}")
            continue
        h, w = img.shape[:2]
        frame_area = float(h * w)

        found = []
        for d in M._local_potholes(img, frame_area) + M._manholes(img, frame_area):
            found.append(d)
        try:
            mdl, _ = M.get_model()
            found += [d for d in M._predict(mdl, img, 0.15, frame_area)
                      if d.label in CLASSES]
        except Exception:
            pass
        found = [d for d in M._nms(found) if d.confidence >= CONF.get(d.label, 0.2)]

        lines = []
        vis = img.copy()
        for d in found:
            if d.label not in CLASSES:
                continue
            cid = CLASSES.index(d.label)
            x1, y1, x2, y2 = d.box
            cx, cy = (x1 + x2) / 2 / w, (y1 + y2) / 2 / h
            bw, bh = abs(x2 - x1) / w, abs(y2 - y1) / h
            lines.append(f"{cid} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")
            counts[d.label] += 1
            if a.review:
                cv2.rectangle(vis, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
                cv2.putText(vis, f"{d.label} {d.confidence:.2f}", (int(x1), max(18, int(y1) - 6)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        stem = p.stem
        cv2.imwrite(str(out / "images" / (stem + ".jpg")), img)
        # An empty file is a valid YOLO label: it says "nothing here", which is
        # what makes a photograph a hard negative rather than an unlabelled one.
        (out / "labels" / (stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))
        if a.review:
            cv2.imwrite(str(out / "preview" / (stem + ".jpg")), vis)
        if not lines:
            empty += 1
        print(f"  [{i}/{len(photos)}] {p.name[:40]:42} {len(lines)} box(es)")

    print(f"\n  wrote {out}")
    for c, n in counts.items():
        print(f"    {c:14} {n} pre-labelled boxes")
    print(f"    {'(no detection)':14} {empty} photos — these are the ones worth "
          f"drawing by hand, they are what the model cannot see")
    print("\n  Next: open the folder in labelImg or Label Studio, fix the boxes,")
    print("  then merge into data/sources/<category>/<name>/{images,labels}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
