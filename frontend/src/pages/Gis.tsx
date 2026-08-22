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
type Landmark = { name: string; lat: number; lng: number; radiusM: number; risk?: number };

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

const LANDMARK_GLYPH: Record<string, string> = {
  Hospital: "H", School: "S", "Major highway": "M",
};

/**
 * A landmark needs a permanent, readable label, not a hover tooltip.
 *
 * When a complaint's priority breakdown says "Near School +9", the reviewer's
 * next move is to look for that school on the map. A faint dashed ring with the
 * name hidden behind a hover reads as decoration, so the claim looks unverified.
 * The name and the exact number of points it contributes are drawn on the map.
 */
const landmarkIcon = (name: string, risk?: number) =>
  L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    // The "+N" is dropped rather than rendered as "+undefined" when an older
    // backend is still serving landmarks without their risk weighting.
    html: `<div style="position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;
      gap:5px;white-space:nowrap;background:#fff;border:1.5px solid #4f46e5;border-radius:999px;
      padding:2px 8px 2px 3px;box-shadow:0 1px 5px rgba(0,0,0,.28)">
      <span style="width:17px;height:17px;border-radius:50%;background:#4f46e5;color:#fff;
        display:flex;align-items:center;justify-content:center;font:700 10px system-ui">${
          LANDMARK_GLYPH[name] ?? "•"
        }</span>
      <span style="font:600 11px system-ui;color:#312e81">${name}</span>
      ${typeof risk === "number"
        ? `<span style="font:700 10px system-ui;color:#4f46e5">+${risk}</span>`
        : ""}
    </div>`,
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
    const fit = () => {
      map.invalidateSize();
      if (points.length === 0) return;

      // A little slack around the data so edge markers are not flush against
      // the frame, then lock the map inside it.
      const bounds = L.latLngBounds(points).pad(0.12);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });

      // Confine panning to the city the complaints are actually in. Without
      // this the map is the whole world: pan far enough and you are looking at
      // an empty continent with no way back except reloading.
      map.setMaxBounds(bounds);

      // And stop the zoom-out at the framed view. The floor is taken from the
      // zoom fitBounds just chose, so it always tracks the data rather than a
      // hardcoded level that would be wrong the moment the complaints move.
      map.setMinZoom(map.getZoom());
    };

    // A single invalidateSize on mount is not enough. Leaflet builds its tile
    // grid from the container's measured width, and inside a flex card that
    // width is not final on the first paint — so it requested tiles for a
    // narrow strip and left the rest of the map grey and empty, which is
    // exactly where the landmarks happened to be. Re-measuring on the next
    // frame, once layout has settled, fills the whole viewport.
    fit();
    const raf = requestAnimationFrame(fit);

    // And keep it correct afterwards: collapsing the sidebar or resizing the
    // window changes the container without remounting the map.
    const box = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [map, points]);

  return null;
}

const hoursOld = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

/** Same haversine the backend scores with, so the counts shown agree with it. */
function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

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

  // Frame on everything that has a position — complaints, engineers and the
  // landmarks. Landmarks are included so a priority-raising place can never end
  // up outside the framed area, which would leave "Near School +9" pointing at
  // something off screen.
  const fitPoints = useMemo<[number, number][]>(
    () => [
      ...(data?.complaints ?? []).map((c) => [c.lat, c.lng] as [number, number]),
      ...(data?.engineers ?? []).map((e) => [e.lat, e.lng] as [number, number]),
      ...(data?.landmarks ?? []).map((l) => [l.lat, l.lng] as [number, number]),
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
          {/* No +/- control: the map opens framed on the data and is locked to
              it, so the buttons only offered ways to end up somewhere useless.
              Scroll and pinch still zoom, between the fitted floor and 18.
              maxBoundsViscosity 1 makes the edge solid rather than springy. */}
          <MapContainer
            center={CENTRE}
            zoom={12}
            scrollWheelZoom
            zoomControl={false}
            maxBoundsViscosity={1}
            maxZoom={18}
            style={{ height: 560, width: "100%" }}
          >
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

            {/* The landmark radii the priority rule actually scores against.
                Drawn solidly enough to read over street tiles — at city zoom a
                500 m ring is barely 60 px across, and the previous 1 px dashed
                outline at 6% fill was invisible against the map. */}
            {landmarks.map((l) => (
              <Circle
                key={l.name}
                center={[l.lat, l.lng]}
                radius={l.radiusM}
                pathOptions={{ color: "#4f46e5", weight: 2.5, fillColor: "#6366f1", fillOpacity: 0.16, dashArray: "6 4" }}
              >
                <Tooltip>
                  {l.name} · a complaint within {l.radiusM} m scores
                  {typeof l.risk === "number" ? ` +${l.risk}` : " higher"} on priority
                </Tooltip>
              </Circle>
            ))}

            {/* Named on the map rather than on hover, so "Near School +9" in a
                complaint's priority breakdown can be checked by eye. */}
            {landmarks.map((l) => (
              <Marker
                key={`${l.name}-label`}
                position={[l.lat, l.lng]}
                icon={landmarkIcon(l.name, l.risk)}
                zIndexOffset={500}
              >
                <Popup>
                  <div className="min-w-[190px] text-xs">
                    <p className="font-semibold text-slate-900">{l.name}</p>
                    <p className="mt-1 text-slate-600">
                      Any open complaint within <b>{l.radiusM} m</b> of here
                      {typeof l.risk === "number" ? <> gains <b>+{l.risk}</b> on</> : " gains a boost to"}{" "}
                      its priority score.
                    </p>
                    <p className="mt-1.5 text-slate-500">
                      {shown.filter((c) => metresBetween(c.lat, c.lng, l.lat, l.lng) <= l.radiusM).length}{" "}
                      of the complaints shown are inside this radius.
                    </p>
                  </div>
                </Popup>
              </Marker>
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
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-bold text-white">S</span>
            Landmark · complaints within 500 m score higher
          </span>
          <span className="text-slate-400">Marker radius ∝ severity score</span>
        </div>
      </Card>
    </>
  );
}
