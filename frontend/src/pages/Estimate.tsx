import { useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, Layers, Info } from "lucide-react";
import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";
import { PriorityBadge } from "../components/badges";

type EstLine = {
  material: string; perM3: number; unit: string; quantity: number;
  procurement: number; formula: string; basis: string; provisional: boolean;
  inrPerUnit: number; costInr: number;
};
type Cost = {
  materialInr: number; labourInr: number; labourPct: number;
  overheadInr: number; overheadPct: number; totalInr: number; perM3Inr: number; note: string;
};
type Est = {
  roadType: string; roadTypeLabel: string; totalVolumeM3: number; potholeCount: number;
  wastagePct: number; lines: EstLine[]; cementBags: number | null; hasProvisional: boolean;
  cost: Cost;
};

/** Rupees, grouped the Indian way — 3,50,516 rather than 350,516. */
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
type Group = {
  roadType: string;
  complaints: { ref: string; title: string; zone: string; priority: string; potholeCount: number; volumeM3: number; estimated: boolean }[];
  estimate: Est;
};
type Payload = { wastagePct: number; complaintsMeasured: number; groups: Group[] };

/**
 * Feature 6 — city-wide bill of quantities.
 *
 * Every open road complaint that has been measured on site, summed into one
 * material order. Bituminous and concrete are kept apart deliberately: they
 * need entirely different materials, so a combined total would be a number
 * nobody could act on.
 */
export function Estimate() {
  const [wastage, setWastage] = useState(5);
  const { data, loading } = useApi<Payload>(`/estimate?wastage=${wastage}`);

  return (
    <>
      <PageHeader
        title="Repair Material Estimate"
        subtitle="Bill of quantities for every measured road complaint · quantities follow from site-measured pothole volume, grouped by road type"
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Wastage allowance %
          <input
            type="number" min="0" max="50" value={wastage}
            onChange={(e) => setWastage(Number(e.target.value))}
            className="mt-1 block w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          Procurement quantity = calculated quantity x (1 + wastage).
        </p>
      </div>

      {loading && <p className="text-slate-400">Loading…</p>}

      {!loading && data && data.groups.length > 0 && (
        <Card className="mb-6 border-brand-200 bg-brand-50/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">Total estimated cost to repair</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-brand-800">
                {inr(data.groups.reduce((t, g) => t + g.estimate.cost.totalInr, 0))}
              </p>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>
                <strong className="text-slate-900">
                  {data.groups.reduce((t, g) => t + g.estimate.totalVolumeM3, 0).toFixed(3)} m³
                </strong>{" "}
                across{" "}
                <strong className="text-slate-900">
                  {data.groups.reduce((t, g) => t + g.estimate.potholeCount, 0)}
                </strong>{" "}
                potholes
              </p>
              <p className="text-xs text-slate-500">
                {data.complaintsMeasured} measured complaint{data.complaintsMeasured === 1 ? "" : "s"} ·
                materials, labour and overhead included
              </p>
            </div>
          </div>
          <p className="mt-3 border-t border-brand-200 pt-2 text-[11px] text-slate-600">
            {data.groups[0].estimate.cost.note}
          </p>
        </Card>
      )}

      {!loading && data && data.groups.length === 0 && (
        <Card>
          <div className="py-8 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
              <Calculator size={20} className="text-slate-400" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-800">No site measurements recorded yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
              An estimate needs measured pothole geometry. Open a road complaint, record each
              pothole's length, width and depth on site, and it will appear here.
            </p>
            <Link to="/app/complaints" className="mt-4 inline-block rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-800">
              Go to the complaint queue
            </Link>
          </div>
        </Card>
      )}

      {!loading && data && data.groups.map((g) => {
        const e = g.estimate;
        return (
          <Card key={g.roadType} className="mb-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Layers size={17} className="text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">{e.roadTypeLabel}</h2>
              <span className="text-sm text-slate-500">
                {e.totalVolumeM3} m³ · {e.potholeCount} potholes · {g.complaints.length} complaint{g.complaints.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Material</th>
                    <th className="px-3 py-2">Rate per m³</th>
                    <th className="px-3 py-2">Quantity</th>
                    <th className="px-3 py-2">Procure (+{e.wastagePct}%)</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {e.lines.map((l) => (
                    <tr key={l.material}>
                      <td className="px-3 py-2 text-slate-800">
                        {l.material}
                        {l.provisional && <span className="ml-1 font-bold text-amber-600" title={l.basis}>*</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{l.perM3} {l.unit}</td>
                      <td className="px-3 py-2 text-slate-700">{l.quantity} {l.unit}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{l.procurement} {l.unit}</td>
                      <td className="px-3 py-2 text-slate-500">₹{l.inrPerUnit}/{l.unit}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{inr(l.costInr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {e.cementBags !== null && (
              <p className="mt-3 text-sm text-slate-700">
                Cement to order: <strong className="text-slate-900">{e.cementBags} bags</strong> of 50 kg.
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["Materials", inr(e.cost.materialInr)],
                [`Labour & machinery (${e.cost.labourPct}%)`, inr(e.cost.labourInr)],
                [`Overhead & profit (${e.cost.overheadPct}%)`, inr(e.cost.overheadInr)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="text-sm font-semibold text-slate-900">{value}</p>
                </div>
              ))}
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-brand-700">Estimated cost</p>
                <p className="text-base font-bold text-brand-800">{inr(e.cost.totalInr)}</p>
                <p className="text-[10px] text-brand-700">{inr(e.cost.perM3Inr)} per m³</p>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Complaints in this estimate</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="px-2.5 py-1.5">Ref</th>
                      <th className="px-2.5 py-1.5">Complaint</th>
                      <th className="px-2.5 py-1.5">Zone</th>
                      <th className="px-2.5 py-1.5">Priority</th>
                      <th className="px-2.5 py-1.5">Potholes</th>
                      <th className="px-2.5 py-1.5">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {g.complaints.map((c) => (
                      <tr key={c.ref}>
                        <td className="px-2.5 py-1.5">
                          <Link to={`/app/complaints/${c.ref}`} className="font-medium text-brand-700 hover:underline">{c.ref}</Link>
                        </td>
                        <td className="max-w-[280px] truncate px-2.5 py-1.5 text-slate-700">{c.title}</td>
                        <td className="px-2.5 py-1.5 text-slate-500">{c.zone}</td>
                        <td className="px-2.5 py-1.5"><PriorityBadge priority={c.priority} /></td>
                        <td className="px-2.5 py-1.5 text-slate-700">{c.potholeCount}</td>
                        <td className="px-2.5 py-1.5 font-medium text-slate-800">
                          {c.volumeM3} m³
                          {c.estimated && (
                            <span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-700" title="From the photograph, not site-measured">est</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {e.hasProvisional && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3">
                <Info size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">
                  <strong>* Preliminary figures.</strong> The bituminous quantities are estimating
                  assumptions, not an approved mix design. A real bituminous pothole repair is
                  specified by the road authority against aggregate gradation, binder content,
                  temperature and compaction — not fixed proportions of brick pieces, sand and tar.
                  Replace them with the project specification before this is submitted as a
                  government BOQ. The concrete figures rest on the nominal 1:2:4 (M20) mix documented
                  in government specifications and are on firmer ground.
                </p>
              </div>
            )}
          </Card>
        );
      })}
    </>
  );
}
