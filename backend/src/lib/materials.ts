/**
 * Feature 6 — repair material estimation (BOQ).
 *
 * Detection tells a supervisor a pothole exists. It does not tell an engineer
 * what to put in the truck. This turns measured pothole geometry into a bill
 * of quantities: cement, sand, aggregate, bitumen, water, admixture.
 *
 * Two things are worth stating plainly, because a municipal estimate that
 * overstates its own authority is worse than no estimate at all.
 *
 * 1. The concrete figures rest on the nominal 1:2:4 (M20) proportions that
 *    appear in government specifications — roughly 320 kg cement, 0.47 m3
 *    sand and 0.94 m3 coarse aggregate per cubic metre. That is a documented
 *    basis and it is reproducible.
 *
 * 2. The bituminous figures do not have the same standing. A real bituminous
 *    pothole repair is specified by the road authority against MoRTH-style
 *    aggregate gradation, binder content, temperature and compaction — not by
 *    mixing brick pieces, sand and tar in fixed ratios. The numbers below are
 *    an estimating assumption for planning only.
 *
 * Every line the estimator returns therefore carries its own `basis`, and the
 * bituminous ones are flagged `provisional` so the interface can mark them and
 * nobody mistakes a planning figure for an approved BOQ.
 */

export type RoadType = "BITUMINOUS" | "CONCRETE";

export const ROAD_TYPES: Record<RoadType, { label: string; note: string }> = {
  BITUMINOUS: {
    label: "Bituminous (normal road)",
    note: "Filled with brick aggregate, sand, bitumen and an additive, finished with sand and tar.",
  },
  CONCRETE: {
    label: "Concrete road",
    note: "Repaired with M20 nominal concrete — cement, sand, coarse aggregate and admixture.",
  },
};

/** One material, expressed per cubic metre of compacted fill. */
type Rate = {
  material: string;
  perM3: number;
  unit: string;
  /** Indicative market rate in rupees per `unit`. See INR_RATE_NOTE. */
  inrPerUnit: number;
  /** Where the number comes from — shown to the user, not decoration. */
  basis: string;
  /** True when the figure is a planning assumption rather than a specification. */
  provisional: boolean;
};

/**
 * Money is the part of an estimate people trust most and question least, so
 * it needs the loudest caveat.
 *
 * A government estimate is not priced from market hearsay — it is priced from
 * the Schedule of Rates (DSR / State PWD SoR) current for that district and
 * year, which already bakes in lead, carriage and local conditions. The rates
 * below are indicative figures for planning only. They will not match a
 * sanctioned estimate and must be replaced with the applicable SoR before
 * anything is submitted.
 */
export const INR_RATE_NOTE =
  "Indicative rates for planning only. A sanctioned government estimate must be priced " +
  "from the Schedule of Rates (DSR / State PWD SoR) current for the district and year.";

/** Labour and machinery, as a share of material cost. An assumption. */
const LABOUR_PCT = 25;
/** Contractor's overhead and profit, as a share of material + labour. */
const OVERHEAD_PCT = 15;

const RATES: Record<RoadType, Rate[]> = {
  BITUMINOUS: [
    { material: "Brick aggregate (small brick pieces)", perM3: 0.90, unit: "m³", inrPerUnit: 1200, provisional: true,
      basis: "Estimating assumption — approved graded aggregate should replace this in a submitted BOQ." },
    { material: "Sand (rethi)", perM3: 0.30, unit: "m³", inrPerUnit: 1800, provisional: true,
      basis: "Estimating assumption." },
    { material: "Bitumen / tar", perM3: 50, unit: "kg", inrPerUnit: 60, provisional: true,
      basis: "Estimating assumption — binder content is normally set by the road authority's specification." },
    { material: "Water", perM3: 20, unit: "L", inrPerUnit: 0.3, provisional: true,
      basis: "Estimating assumption." },
    { material: "Chemical additive", perM3: 2, unit: "kg", inrPerUnit: 150, provisional: true,
      basis: "Estimating assumption — use the manufacturer's dosage." },
  ],
  CONCRETE: [
    { material: "Cement", perM3: 320, unit: "kg", inrPerUnit: 8, provisional: false,
      basis: "Nominal 1:2:4 (M20) mix, per government specification." },
    { material: "Sand (rethi)", perM3: 0.47, unit: "m³", inrPerUnit: 1800, provisional: false,
      basis: "Nominal 1:2:4 (M20) mix." },
    { material: "Coarse aggregate", perM3: 0.94, unit: "m³", inrPerUnit: 1600, provisional: false,
      basis: "Nominal 1:2:4 (M20) mix. Brick aggregate in a road pavement needs authority approval." },
    { material: "Water", perM3: 205, unit: "L", inrPerUnit: 0.3, provisional: false,
      basis: "Nominal 1:2:4 (M20) mix." },
  ],
};

export type EstimateLine = {
  material: string;
  perM3: number;
  unit: string;
  /** Volume x rate, before wastage. */
  quantity: number;
  /** Quantity x (1 + wastage). What you actually procure. */
  procurement: number;
  /** The arithmetic, written out, so the number can be checked by hand. */
  formula: string;
  /** Indicative rupees per `unit`. */
  inrPerUnit: number;
  /** procurement x inrPerUnit — the money for this line. */
  costInr: number;
  basis: string;
  provisional: boolean;
};

export type Estimate = {
  roadType: RoadType;
  roadTypeLabel: string;
  totalVolumeM3: number;
  potholeCount: number;
  wastagePct: number;
  lines: EstimateLine[];
  /** Cement expressed in 50 kg bags — how it is actually ordered. */
  cementBags: number | null;
  /** True when any line rests on a planning assumption rather than a spec. */
  hasProvisional: boolean;
  /** Costed on procurement quantity, so wastage is paid for — as it is in life. */
  cost: {
    materialInr: number;
    labourInr: number;
    labourPct: number;
    overheadInr: number;
    overheadPct: number;
    totalInr: number;
    /** Cost of filling one cubic metre, useful for comparing jobs. */
    perM3Inr: number;
    note: string;
  };
};

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Volume of one pothole, treated as a rectangular prism. */
export const potholeVolume = (lengthM: number, widthM: number, depthM: number) =>
  round(lengthM * widthM * depthM, 4);

/** Perimeter of one pothole at the road surface. */
export const potholePerimeter = (lengthM: number, widthM: number) =>
  round(2 * (lengthM + widthM), 3);

/**
 * Build the bill of quantities.
 *
 * @param totalVolumeM3 summed volume of every pothole to be filled
 * @param potholeCount  how many, carried through for the header
 * @param wastagePct    procurement allowance, e.g. 5 for 5%
 */
export function estimateMaterials(
  totalVolumeM3: number,
  potholeCount: number,
  roadType: RoadType,
  wastagePct = 5,
): Estimate {
  const v = Math.max(0, totalVolumeM3);
  const factor = 1 + Math.max(0, wastagePct) / 100;

  const lines: EstimateLine[] = RATES[roadType].map((r) => {
    const quantity = round(r.perM3 * v, 2);
    return {
      material: r.material,
      perM3: r.perM3,
      unit: r.unit,
      quantity,
      procurement: round(quantity * factor, 2),
      formula: `${r.perM3} ${r.unit}/m³ × ${round(v, 3)} m³ = ${quantity} ${r.unit}`,
      inrPerUnit: r.inrPerUnit,
      costInr: round(round(quantity * factor, 2) * r.inrPerUnit, 2),
      basis: r.basis,
      provisional: r.provisional,
    };
  });

  // Cement is ordered in 50 kg bags, and you cannot buy a fraction of one.
  const cement = lines.find((l) => l.material === "Cement");
  const cementBags = cement ? Math.ceil(cement.procurement / 50) : null;

  // Materials are only part of the bill. Labour, machinery and the
  // contractor's margin are the rest, and an estimate that omits them reads
  // far cheaper than the work will actually cost.
  const materialInr = round(lines.reduce((t, l) => t + l.costInr, 0), 2);
  const labourInr = round((materialInr * LABOUR_PCT) / 100, 2);
  const overheadInr = round(((materialInr + labourInr) * OVERHEAD_PCT) / 100, 2);
  const totalInr = round(materialInr + labourInr + overheadInr, 2);

  return {
    roadType,
    roadTypeLabel: ROAD_TYPES[roadType].label,
    totalVolumeM3: round(v, 3),
    potholeCount,
    wastagePct,
    lines,
    cementBags,
    hasProvisional: lines.some((l) => l.provisional),
    cost: {
      materialInr,
      labourInr,
      labourPct: LABOUR_PCT,
      overheadInr,
      overheadPct: OVERHEAD_PCT,
      totalInr,
      perM3Inr: v > 0 ? round(totalInr / v, 2) : 0,
      note: INR_RATE_NOTE,
    },
  };
}
