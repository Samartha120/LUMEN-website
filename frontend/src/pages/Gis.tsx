import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";

type C = { id: string; lat: number; lng: number; severityScore: number | null; severityBand: string | null };
type E = { id: string; code: string; lat: number; lng: number };

const BAND: Record<string, string> = { SEVERE: "#ef4444", SIGNIFICANT: "#f59e0b", MODERATE: "#0ea5e9", MINOR: "#94a3b8", NONE: "#cbd5e1" };
const LAT0 = 12.9, LAT1 = 13.04, LNG0 = 77.53, LNG1 = 77.69;
const px = (lng: number) => ((lng - LNG0) / (LNG1 - LNG0)) * 880 + 30;
const py = (lat: number) => (1 - (lat - LAT0) / (LAT1 - LAT0)) * 480 + 30;

export function Gis() {
  const { data, loading } = useApi<{ complaints: C[]; engineers: E[] }>("/gis");
  if (loading || !data) return <p className="text-slate-400">Loading…</p>;
  const { complaints, engineers } = data;

  return (
    <>
      <PageHeader title="GIS Map" subtitle={`${complaints.length} open complaints sized by CV severity · ${engineers.length} engineers on duty`} />
      <Card>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 940 540" className="min-w-[720px] rounded-lg" style={{ background: "linear-gradient(160deg,#eef4f8,#e4ecf4)" }}>
            {[0, 1].map((r) => [0, 1, 2].map((c) => (
              <rect key={`${r}${c}`} x={30 + c * 293} y={30 + r * 240} width={293} height={240} fill="none" stroke="#cbd5e1" strokeDasharray="6 5" strokeWidth={1} />
            )))}
            <path d="M30 300 C 260 250, 620 340, 910 280" stroke="#ffffff" strokeWidth={10} fill="none" />
            <path d="M420 30 C 450 220, 400 380, 470 510" stroke="#ffffff" strokeWidth={8} fill="none" />
            {complaints.map((c) => {
              const sev = c.severityScore ?? 0; const r = 4 + (sev / 100) * 9; const color = BAND[c.severityBand ?? "NONE"];
              return (
                <g key={c.id}>
                  {sev >= 60 && <circle cx={px(c.lng)} cy={py(c.lat)} r={r + 7} fill={color} opacity={0.16} />}
                  <circle cx={px(c.lng)} cy={py(c.lat)} r={r} fill={color} stroke="#fff" strokeWidth={1.5} />
                </g>
              );
            })}
            {engineers.map((e) => (
              <g key={e.id}>
                <rect x={px(e.lng) - 6} y={py(e.lat) - 6} width={12} height={12} rx={2} fill="#10b981" stroke="#fff" strokeWidth={2} />
                <text x={px(e.lng) + 11} y={py(e.lat) + 4} fontSize={10} fill="#475569" fontWeight={600}>{e.code}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          {["SEVERE", "SIGNIFICANT", "MODERATE", "MINOR"].map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND[b] }} />{b.charAt(0) + b.slice(1).toLowerCase()}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border-2 border-white bg-emerald-500 shadow" /> Engineer</span>
          <span className="text-slate-400">Marker radius ∝ severity score</span>
        </div>
      </Card>
    </>
  );
}
