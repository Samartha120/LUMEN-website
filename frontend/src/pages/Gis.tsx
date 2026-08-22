import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Tooltip, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";

type C = {
  id: string; ref: string; title: string; lat: number; lng: number; zone: string;
  category: string; civicCategory: string | null; status: string; priority: string;
  severityScore: number | null; severityBand: string | null;
  createdAt: string; slaHours: number | null;
  engineer: { code: string; name: string } | null;
};
type E = {
  id: string; code: string; name: string; zone: string; status: string;
  lat: number; lng: number; skills: string; openJobs: number;
  department: { name: string } | null;
};
type Landmark = { name: string; lat: number; lng: number; radiusM: number };

const BAND: Record<string, string> = {
  SEVERE: "#ef4444", SIGNIFICANT: "#f59e0b", MODERATE: "#0ea5e9",
  MINOR: "#94a3b8", NONE: "#cbd5e1",
};

/** Bengaluru centre — where the map opens before it fits to the data. */
const CENTRE: [number, number] = [12.9716, 77.5946];

/**
 * Leaflet ships its marker icons as separate image files resolved by relative
 * URL, which a bundler rewrites and breaks. Engineers are drawn as an inline
 * SVG pin instead, so nothing has to be fetched.
 */
const engineerIcon = (openJobs: number) =>
  L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:6px;background:#10b981;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
      color:#fff;font:600 11px system-ui">${openJobs}</div>`,
  });

/**
 * Frame the map on the data rather than a fixed zoom.
 *
 * A hardcoded zoom is wrong the moment the complaints move — and on a narrow
 * container Leaflet can size itself before the layout settles and open far too
 * wide. Fitting to the markers' bounds is correct in both cases, and
 * invalidateSize forces a re-measure once the container has its real width.
 */
function FitToData({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

const hoursOld = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

/**
 * GIS Map — every open complaint on the real street map.
 *
 * The previous version projected latitude and longitude onto a hand-drawn SVG
 * with decorative curves standing in for roads. The positions were right
 * relative to each other, but there was no way to tell which street a pothole
 * was on, and the "near a hospital" priority rule could not be checked by eye.
 * OpenStreetMap tiles fix both: the markers now sit on the actual roads, and
 * the landmark radii that drive priority are drawn where they really are.
 */
export function Gis() {
  const { data, loading } = useApi<{ complaints: C[]; engineers: E[]; landmarks: Landmark[] }>("/gis");
  const [band, setBand] = useState<string | null>(null);

  const shown = useMemo(
    () => (data?.complaints ?? []).filter((c) => !band || (c.severityBand ?? "NONE") === band),
    [data, band],
  );

  // Frame on everything that has a position, complaints and engineers alike.
  const fitPoints = useMemo<[number, number][]>(
    () => [
      ...(data?.complaints ?? []).map((c) => [c.lat, c.lng] as [number, number]),
      ...(data?.engineers ?? []).map((e) => [e.lat, e.lng] as [number, number]),
    ],
    [data],
  );

  if (loading || !data) return <p className="text-slate-400">Loading map…</p>;
  const { engineers, landmarks } = data;
  const breached = shown.filter((c) => hoursOld(c.createdAt) > (c.slaHours ?? 48)).length;

  return (
    <>
      <PageHeader
        title="GIS Map"
        subtitle={`${shown.length} open complaints on the live street map · marker size by CV severity · ${engineers.length} engineers on duty`}
      />

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Filter</span>
          {["SEVERE", "SIGNIFICANT", "MODERATE", "MINOR"].map((b) => (
            <button
              key={b}
              onClick={() => setBand(band === b ? null : b)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                band === b ? "border-slate-400 bg-slate-100 font-semibold text-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND[b] }} />
              {b.charAt(0) + b.slice(1).toLowerCase()}
            </button>
          ))}
          {band && (
            <button onClick={() => setBand(null)} className="text-xs text-brand-700 underline">clear</button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {breached} past SLA · click a marker for the complaint
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <MapContainer center={CENTRE} zoom={12} scrollWheelZoom style={{ height: 560, width: "100%" }}>
            <FitToData points={fitPoints} />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Street">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Muted">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {/* The landmark radii the priority rule actually scores against. */}
            {landmarks.map((l) => (
              <Circle
                key={l.name}
                center={[l.lat, l.lng]}
                radius={l.radiusM}
                pathOptions={{ color: "#6366f1", weight: 1, fillColor: "#6366f1", fillOpacity: 0.06, dashArray: "4 4" }}
              >
                <Tooltip>{l.name} · complaints within {l.radiusM} m score higher</Tooltip>
              </Circle>
            ))}

            {shown.map((c) => {
              const sev = c.severityScore ?? 0;
              const colour = BAND[c.severityBand ?? "NONE"];
              const overdue = hoursOld(c.createdAt) > (c.slaHours ?? 48);
              return (
                <CircleMarker
                  key={c.id}
                  center={[c.lat, c.lng]}
                  radius={5 + (sev / 100) * 9}
                  pathOptions={{
                    color: overdue ? "#7f1d1d" : "#ffffff",
                    weight: overdue ? 2.5 : 1.5,
                    fillColor: colour,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="min-w-[210px] text-xs">
                      <Link to={`/app/complaints/${c.ref}`} className="font-mono font-bold text-brand-700 hover:underline">
                        {c.ref}
                      </Link>
                      <p className="mt-1 font-medium text-slate-800">{c.title}</p>
                      <table className="mt-2 w-full">
                        <tbody className="text-slate-600">
                          <tr><td className="pr-2">Damage</td><td className="font-medium text-slate-800">{c.category}</td></tr>
                          <tr><td className="pr-2">Priority</td><td className="font-medium text-slate-800">{c.priority}</td></tr>
                          <tr><td className="pr-2">Severity</td><td className="font-medium text-slate-800">{sev.toFixed(1)} / 100</td></tr>
                          <tr><td className="pr-2">Status</td><td className="font-medium text-slate-800">{c.status}</td></tr>
                          <tr><td className="pr-2">Zone</td><td className="font-medium text-slate-800">{c.zone}</td></tr>
                          <tr><td className="pr-2">Engineer</td><td className="font-medium text-slate-800">{c.engineer ? `${c.engineer.name} (${c.engineer.code})` : "Unassigned"}</td></tr>
                        </tbody>
                      </table>
                      {overdue && <p className="mt-1.5 font-semibold text-red-700">Past its {c.slaHours ?? 48} h SLA</p>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {engineers.map((e) => (
              <Marker key={e.id} position={[e.lat, e.lng]} icon={engineerIcon(e.openJobs)}>
                <Popup>
                  <div className="min-w-[190px] text-xs">
                    <p className="font-semibold text-slate-900">{e.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{e.code}</p>
                    <table className="mt-2 w-full">
                      <tbody className="text-slate-600">
                        <tr><td className="pr-2">Department</td><td className="font-medium text-slate-800">{e.department?.name ?? "—"}</td></tr>
                        <tr><td className="pr-2">Zone</td><td className="font-medium text-slate-800">{e.zone}</td></tr>
                        <tr><td className="pr-2">Open jobs</td><td className="font-medium text-slate-800">{e.openJobs}</td></tr>
                        <tr><td className="pr-2">Skills</td><td className="font-medium text-slate-800">{e.skills}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          {["SEVERE", "SIGNIFICANT", "MODERATE", "MINOR"].map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND[b] }} />
              {b.charAt(0) + b.slice(1).toLowerCase()}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-white bg-emerald-500 text-[8px] font-bold text-white shadow">n</span>
            Engineer, showing open jobs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-red-900" /> Past SLA
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-indigo-400 bg-indigo-50" /> Landmark radius
          </span>
          <span className="text-slate-400">Marker radius ∝ severity score</span>
        </div>
      </Card>
    </>
  );
}
