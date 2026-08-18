/**
 * Feature 6b — first-pass pothole dimensions from the photograph.
 *
 * Read this before trusting anything it returns.
 *
 * A single uncalibrated photograph does not contain absolute scale. A small
 * pothole close to the lens and a large one further away produce the same
 * image; nothing in the pixels distinguishes them. So this module does not
 * "measure" anything. It assumes a typical phone-in-hand camera geometry,
 * converts the detector's bounding box into metres under that assumption, and
 * labels every result ESTIMATED so it can never be mistaken for a site
 * measurement.
 *
 * The purpose is scheduling, not procurement: it gives the city a budget
 * figure the day a complaint is filed instead of after someone has driven to
 * all 68 sites, and every number it produces is replaced the moment an
 * engineer measures for real.
 *
 * Depth is the weakest of the three and is treated as such. Depth is barely
 * observable from a photograph taken standing over a hole — often the floor
 * of the pothole is not even visible — so it is not inferred from pixels at
 * all. It comes from the severity band, which is a stated assumption rather
 * than a disguised guess.
 *
 * Assumed camera geometry
 * -----------------------
 *   height above road      1.5 m   (phone held by a standing adult)
 *   downward tilt          60°     (framing the road a step or two ahead)
 *   horizontal field       67°     (a typical ~26 mm-equivalent phone lens)
 *
 * From those: the slant distance to the frame centre is 1.5 / sin 60° ≈ 1.73 m,
 * and the ground width across the frame centre is 2 × 1.73 × tan(33.5°) ≈ 2.3 m.
 * Ground running away from the camera is foreshortened, so a pixel spans more
 * ground vertically than horizontally; FORESHORTEN carries that.
 */

/** Ground width covered across the middle of the frame, in metres. */
const GROUND_WIDTH_M = 2.3;
/** Image aspect ratio (width / height) assumed when splitting the box. */
const IMAGE_ASPECT = 4 / 3;
/** How much more ground a vertical pixel spans than a horizontal one. */
const FORESHORTEN = 1.4;
/** Ground depth covered from top to bottom of the frame, in metres. */
const GROUND_DEPTH_M = (GROUND_WIDTH_M / IMAGE_ASPECT) * FORESHORTEN;

/**
 * Depth by severity band, in metres. Indian urban potholes typically run
 * 50-150 mm deep, with failed patches deeper. These are planning assumptions.
 */
function depthForSeverity(severity: number): number {
  if (severity < 25) return 0.04;
  if (severity < 50) return 0.07;
  if (severity < 75) return 0.11;
  return 0.15;
}

/** Keep a wild detection from producing an absurd order. */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (n: number, dp = 3) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * Merge detection boxes that overlap or nearly touch into one region.
 *
 * Repeatedly unions any two boxes whose gap is under GAP_PX until nothing
 * changes, so a chain of overlapping fragments collapses into a single hole
 * rather than a pair at a time. `area_ratio` is recomputed from the merged
 * box using the frame area implied by the originals (boxArea / area_ratio),
 * which keeps it consistent without needing the image's pixel size.
 */
function mergeOverlapping(dets: Detection[], GAP_PX = 12): Detection[] {
  if (dets.length <= 1) return dets;

  // Frame area in pixels, implied by any detection. Median guards against one
  // rounding-degenerate entry throwing the scale off.
  const areas = dets
    .map((d) => (Math.abs(d.box[2] - d.box[0]) * Math.abs(d.box[3] - d.box[1])) / d.area_ratio)
    .filter((a) => Number.isFinite(a) && a > 0)
    .sort((a, b) => a - b);
  const frameArea = areas.length ? areas[Math.floor(areas.length / 2)] : 0;

  let boxes = dets.map((d) => ({
    x1: Math.min(d.box[0], d.box[2]), y1: Math.min(d.box[1], d.box[3]),
    x2: Math.max(d.box[0], d.box[2]), y2: Math.max(d.box[1], d.box[3]),
    label: d.label, confidence: d.confidence,
  }));

  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const overlaps =
          a.x1 - GAP_PX < b.x2 && b.x1 - GAP_PX < a.x2 &&
          a.y1 - GAP_PX < b.y2 && b.y1 - GAP_PX < a.y2;
        if (!overlaps) continue;
        boxes[i] = {
          x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1),
          x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2),
          label: a.label,
          // Keep the stronger evidence for the combined region.
          confidence: Math.max(a.confidence, b.confidence),
        };
        boxes.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  return boxes.map((b) => {
    const area = (b.x2 - b.x1) * (b.y2 - b.y1);
    return {
      label: b.label,
      confidence: b.confidence,
      box: [b.x1, b.y1, b.x2, b.y2],
      area_ratio: frameArea > 0 ? Math.min(1, area / frameArea) : 0,
    };
  });
}

export type SuggestedPothole = {
  label: string;
  lengthM: number;
  widthM: number;
  depthM: number;
  /** Detector confidence for the region this came from. */
  confidence: number;
  source: "ESTIMATED";
};

type Detection = {
  label: string;
  confidence: number;
  /** [x1, y1, x2, y2] in pixels. */
  box: number[];
  /** Box area as a fraction of the whole frame. */
  area_ratio: number;
};

/**
 * Turn detections into first-pass dimensions.
 *
 * Only the box's own aspect ratio and its area fraction are used, so the
 * image's pixel dimensions are never needed — the detector already gives both.
 *
 * With fx and fy the box's width and height as fractions of the frame:
 *   fx · fy = area_ratio          (by definition)
 *   fx / fy = boxAspect / imageAspect
 * which solves to fx = √(area_ratio · r), fy = √(area_ratio / r).
 */
export function suggestDimensions(
  detections: Detection[],
  severityScore: number,
  /** Only these classes are fillable holes; a crack is not a volume. */
  fillableLabels: string[] = ["Pothole"],
  minConfidence = 0.35,
): SuggestedPothole[] {
  const filtered = detections
    .filter((d) => fillableLabels.includes(d.label))
    .filter((d) => d.confidence >= minConfidence)
    .filter((d) => d.area_ratio > 0 && Array.isArray(d.box) && d.box.length === 4);

  // The detector reports regions, not potholes. One large hole routinely comes
  // back as several overlapping boxes, which would be counted — and ordered
  // material for — as several separate potholes. Merge them first.
  const usable = mergeOverlapping(filtered).sort((a, b) => b.area_ratio - a.area_ratio);

  const depthM = depthForSeverity(severityScore);

  return usable.map((d, i) => {
    const [x1, y1, x2, y2] = d.box;
    const boxW = Math.abs(x2 - x1);
    const boxH = Math.abs(y2 - y1);
    // A degenerate box carries no aspect information; fall back to square.
    const boxAspect = boxH > 0 ? boxW / boxH : 1;
    const r = Math.max(0.05, boxAspect / IMAGE_ASPECT);

    const fx = Math.sqrt(d.area_ratio * r);
    const fy = Math.sqrt(d.area_ratio / r);

    return {
      label: `P${i + 1}`,
      // Width runs across the frame, length runs away from the camera.
      widthM: round(clamp(fx * GROUND_WIDTH_M, 0.1, 5)),
      lengthM: round(clamp(fy * GROUND_DEPTH_M, 0.1, 5)),
      depthM,
      confidence: Math.round(d.confidence * 1000) / 1000,
      source: "ESTIMATED" as const,
    };
  });
}

/** Shown next to any estimated figure. Deliberately blunt. */
export const ESTIMATE_NOTE =
  "Estimated from the photograph assuming a phone held at 1.5 m tilted 60° down. " +
  "A single photo carries no true scale, and depth is taken from the severity band, " +
  "not measured. Treat as a planning figure and replace it with site measurements.";
