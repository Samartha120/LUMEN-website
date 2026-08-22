import { Fragment, useEffect, useMemo, useState } from "react";
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
type Landmark = {
  name: string; type?: string; lat: number; lng: number;
  radiusM: number; risk?: number;
};

const BAND: Record<string, string> = {
  SEVERE: "#ef4444", SIGNIFICANT: "#f59e0b", MODERATE: "#0ea5e9",
  MINOR: "#94a3b8", NONE: "#cbd5e1",
};

/** Bengaluru centre — where the map opens before it fits to the data. */
const CENTRE: [number, number] = [12.9716, 77.5946];

/**
 * How long a complaint counts as new, and the colour that says so.
 *
 * Magenta because nothing else on the map uses it — severity owns red through
 * slate, engineers own emerald, and the landmark badges own the rest.
 */
const NEW_FOR_HOURS = 24;
const NEW_COLOUR = "#db2777";

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
 * Landmark kinds, matching lib/landmarks.ts on the backend.
 *
 * Colour carries the kind and the glyph repeats it, so the map stays readable
 * for anyone who cannot separate the hues.
 */
const LANDMARK_KIND: Record<string, { glyph: string; colour: string; label: string }> = {
  HOSPITAL:  { glyph: "H", colour: "#dc2626", label: "Hospital" },
  TRANSPORT: { glyph: "T", colour: "#7c3aed", label: "Transport hub" },
  SCHOOL:    { glyph: "S", colour: "#2563eb", label: "School" },
  MARKET:    { glyph: "M", colour: "#a16207", label: "Market" },
};
const kindOf = (t?: string) => LANDMARK_KIND[t ?? ""] ?? { glyph: "•", colour: "#4f46e5", label: "Landmark" };

/**
 * A landmark needs a permanent, readable label, not a hover tooltip.
 *
 * When a complaint's priority breakdown says "Near School +9", the reviewer's
 * next move is to look for that school on the map. A faint dashed ring with the
 * name hidden behind a hover reads as decoration, so the claim looks unverified.
 * The name and the exact number of points it contributes are drawn on the map.
 */
const landmarkIcon = (name: string, type?: string, risk?: number, withName = true) => {
  const k = kindOf(type);
  const badge = `<span style="width:19px;height:19px;flex:none;border-radius:50%;background:${k.colour};
      color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px system-ui;
      box-shadow:0 1px 4px rgba(0,0,0,.3);border:1.5px solid #fff">${k.glyph}</span>`;

  // Below a useful zoom the names of twenty-two landmarks overlap into an
  // unreadable mess, so only the coloured badge is drawn and the name moves to
  // the tooltip. The full label returns once there is room for it.
  if (!withName) {
    return L.divIcon({
      className: "", iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<div style="position:absolute;transform:translate(-50%,-50%)">${badge}</div>`,
    });
  }

  // The "+N" is dropped rather than rendered as "+undefined" when an older
  // backend is still serving landmarks without their risk weighting.
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;
      gap:5px;white-space:nowrap;background:#fff;border:1.5px solid ${k.colour};border-radius:999px;
      padding:2px 8px 2px 3px;box-shadow:0 1px 5px rgba(0,0,0,.28)">
      ${badge}
      <span style="font:600 11px system-ui;color:#0f172a">${name}</span>
      ${typeof risk === "number"
        ? `<span style="font:700 10px system-ui;color:${k.colour}">+${risk}</span>`
        : ""}
    </div>`,
  });
};

/** Current zoom, so labels can be shown only when there is room for them. */
function useZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const on = () => setZoom(map.getZoom());
    map.on("zoomend", on);
    return () => { map.off("zoomend", on); };
  }, [map]);
  return zoom;
}

/**
 * The civic context that drives priority: hospitals, transport interchanges,
 * highway junctions, schools, government offices, markets and lakes.
 *
 * Every one of these is a place `lib/priority.ts` scores against — the map and
 * the rule read the same list — so a complaint's "+12 near a hospital" can be
 * traced to the exact ring it falls inside.
 */
function LandmarkLayer({ landmarks, shown }: { landmarks: Landmark[]; shown: C[] }) {
  const zoom = useZoom();
  // Twenty-two name pills collide at city zoom; badges alone stay legible.
  const withNames = zoom >= 13;

  return (
    <>
      {landmarks.map((l) => {
        const k = kindOf(l.type);
        const inside = shown.filter(
          (c) => metresBetween(c.lat, c.lng, l.lat, l.lng) <= l.radiusM,
        ).length;
        return (
          <Fragment key={l.name}>
            <Circle
              center={[l.lat, l.lng]}
              radius={l.radiusM}
              pathOptions={{
                color: k.colour, weight: 2, fillColor: k.colour,
                fillOpacity: 0.12, dashArray: "6 4",
              }}
            >
              <Tooltip>
                {l.name} · a complaint within {l.radiusM} m scores
                {typeof l.risk === "number" ? ` +${l.risk}` : " higher"} on priority
              </Tooltip>
            </Circle>

            <Marker
              position={[l.lat, l.lng]}
              icon={landmarkIcon(l.name, l.type, l.risk, withNames)}
              zIndexOffset={500}
            >
              {!withNames && <Tooltip>{l.name}</Tooltip>}
              <Popup>
                <div className="min-w-[210px] text-xs">
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <p className="font-medium" style={{ color: k.colour }}>{k.label}</p>
                  <p className="mt-1.5 text-slate-600">
                    Any open complaint within <b>{l.radiusM} m</b> of here
                    {typeof l.risk === "number" ? <> gains <b>+{l.risk}</b> on</> : " gains a boost to"}{" "}
                    its priority score.
                  </p>
                  <p className="mt-1.5 text-slate-500">
                    <b>{inside}</b> of the complaints shown {inside === 1 ? "is" : "are"} inside this radius.
                  </p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}

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
              {/* Satellite imagery: at close zoom the actual buildings around a
                  complaint are visible, which the drawn basemaps only outline. */}
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            <LandmarkLayer landmarks={landmarks} shown={shown} />

            {shown.map((c) => {
              const sev = c.severityScore ?? 0;
              const colour = BAND[c.severityBand ?? "NONE"];
              const age = hoursOld(c.createdAt);
              const overdue = age > (c.slaHours ?? 48);
              const isNew = age < NEW_FOR_HOURS;
              return (
                <Fragment key={c.id}>
                  {/* Anything reported in the last 24 hours wears a magenta halo
                      so it stands out of a queue of seventy, then drops back to
                      looking like every other complaint once the day is out.
                      The halo sits outside the marker rather than replacing its
                      fill, because the fill is the severity and that is the more
                      important thing to keep readable. */}
                  {isNew && !overdue && (
                    <CircleMarker
                      center={[c.lat, c.lng]}
                      radius={5 + (sev / 100) * 9 + 5}
                      interactive={false}
                      pathOptions={{
                        color: NEW_COLOUR, weight: 2,
                        fillColor: NEW_COLOUR, fillOpacity: 0.15,
                      }}
                    />
                  )}
                <CircleMarker
                  center={[c.lat, c.lng]}
                  radius={5 + (sev / 100) * 9}
                  pathOptions={{
                    // Past its SLA outranks new: a complaint that is both is
                    // already late, and late is the thing to act on.
                    color: overdue ? "#7f1d1d" : isNew ? NEW_COLOUR : "#ffffff",
                    weight: overdue || isNew ? 2.5 : 1.5,
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
                      {isNew && !overdue && (
                        <p className="mt-1.5 font-semibold" style={{ color: NEW_COLOUR }}>
                          New · reported {age < 1 ? "under an hour" : `${Math.floor(age)} h`} ago
                        </p>
                      )}
                      {overdue && <p className="mt-1.5 font-semibold text-red-700">Past its {c.slaHours ?? 48} h SLA</p>}
                    </div>
                  </Popup>
                </CircleMarker>
                </Fragment>
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
            <span
              className="h-3 w-3 rounded-full border-2"
              style={{ borderColor: NEW_COLOUR, background: `${NEW_COLOUR}26` }}
            />
            New · last {NEW_FOR_HOURS} h
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-red-900" /> Past SLA
          </span>
          <span className="text-slate-400">Marker radius ∝ severity score</span>
        </div>

        {/* The civic context the priority rule scores against. Each badge is a
            real place, and the number is the points a complaint inside its
            radius gains — so the legend doubles as the scoring table. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            Priority landmarks
          </span>
          {Object.entries(LANDMARK_KIND).map(([key, k]) => {
            const points = landmarks.find((l) => l.type === key)?.risk;
            return (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-white text-[8px] font-bold text-white shadow"
                  style={{ background: k.colour }}
                >
                  {k.glyph}
                </span>
                {k.label}
                {typeof points === "number" && (
                  <b style={{ color: k.colour }}>+{points}</b>
                )}
              </span>
            );
          })}
          <span className="text-slate-400">
            Names appear as you zoom in · location risk is capped at +18
          </span>
        </div>
      </Card>
    </>
  );
}
