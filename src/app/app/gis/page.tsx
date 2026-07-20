import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";

export const metadata = { title: "GIS Console" };
export const dynamic = "force-dynamic";

const OPEN = ["SUBMITTED", "UNDER_REVIEW", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW", "ESCALATED", "REOPENED"];
const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#94a3b8", MEDIUM: "#0ea5e9", HIGH: "#f59e0b", CRITICAL: "#ef4444",
};
const ENG_COLOR: Record<string, string> = {
  AVAILABLE: "#10b981", ON_TASK: "#f59e0b", OFF_DUTY: "#94a3b8",
};

// Normalize seed coordinates (lat 12.9–13.1, lng 77.5–77.7) onto the SVG canvas.
function px(lng: number) { return ((lng - 77.5) / 0.2) * 880 + 30; }
function py(lat: number) { return (1 - (lat - 12.9) / 0.2) * 480 + 30; }

export default async function GisPage() {
  const session = await requireSession();
  const canTrack = ["DEPARTMENT_MANAGER", "SUPERVISOR", "COMMISSIONER", "ADMINISTRATOR"].includes(session.role);

  const [complaints, engineers, assets] = await Promise.all([
    db.complaint.findMany({ where: { status: { in: OPEN } } }),
    canTrack ? db.engineer.findMany({ where: { status: { not: "OFF_DUTY" } } }) : Promise.resolve([]),
    db.asset.findMany({ where: { condition: { in: ["POOR", "CRITICAL"] } } }),
  ]);

  if (canTrack) {
    // Part 9: access to the live tracking layer is itself an audited event.
    await db.auditLog.create({
      data: {
        actor: session.name, actorRole: session.role, action: "LIVE_TRACKING_ACCESSED",
        module: "GIS", target: "Live Map", details: "Viewed GIS console with live engineer layer", ip: "127.0.0.1",
      },
    });
  }

  return (
    <>
      <PageHeader
        title="GIS Operations Map"
        subtitle={`${complaints.length} open complaints plotted · ${canTrack ? `${engineers.length} engineers live-tracked (audited access)` : "live engineer layer hidden for your role"} · ${assets.length} at-risk assets`}
      />
      <Card>
        <div className="overflow-x-auto">
          <svg viewBox="0 0 940 540" className="min-w-[720px] rounded-lg" style={{ background: "linear-gradient(160deg,#eef4f8,#e4ecf4)" }}>
            {/* Zone grid */}
            {[0, 1].map((r) =>
              [0, 1, 2].map((c) => (
                <rect key={`${r}${c}`} x={30 + c * 293} y={30 + r * 240} width={293} height={240}
                  fill="none" stroke="#cbd5e1" strokeDasharray="6 5" strokeWidth={1} />
              ))
            )}
            {["North Zone", "Central Zone", "East Zone", "West Zone", "South Zone", "Outer Ring"].map((z, i) => (
              <text key={z} x={40 + (i % 3) * 293} y={52 + Math.floor(i / 3) * 240} fontSize={12} fill="#94a3b8" fontWeight={600}>
                {z}
              </text>
            ))}
            {/* Stylized arterial roads */}
            <path d="M30 300 C 260 250, 620 340, 910 280" stroke="#ffffff" strokeWidth={10} fill="none" opacity={0.9} />
            <path d="M30 300 C 260 250, 620 340, 910 280" stroke="#d3dde8" strokeWidth={2} strokeDasharray="12 10" fill="none" />
            <path d="M420 30 C 450 220, 400 380, 470 510" stroke="#ffffff" strokeWidth={8} fill="none" opacity={0.9} />
            <path d="M700 30 C 660 200, 760 360, 690 510" stroke="#ffffff" strokeWidth={6} fill="none" opacity={0.85} />
            {/* Water body */}
            <ellipse cx={180} cy={430} rx={90} ry={45} fill="#bcd7ef" opacity={0.8} />
            <text x={150} y={434} fontSize={11} fill="#5f87ab">City Lake</text>

            {/* At-risk assets */}
            {assets.map((a) => (
              <rect key={a.id} x={px(a.lng) - 5} y={py(a.lat) - 5} width={10} height={10} rx={2}
                fill={a.condition === "CRITICAL" ? "#dc2626" : "#f59e0b"} opacity={0.85}
                transform={`rotate(45 ${px(a.lng)} ${py(a.lat)})`} />
            ))}

            {/* Open complaints */}
            {complaints.map((c) => (
              <g key={c.id}>
                {c.priority === "CRITICAL" && (
                  <circle cx={px(c.lng)} cy={py(c.lat)} r={11} fill="#ef4444" opacity={0.18} />
                )}
                <circle cx={px(c.lng)} cy={py(c.lat)} r={5.5} fill={PRIORITY_COLOR[c.priority]} stroke="#fff" strokeWidth={1.5} />
              </g>
            ))}

            {/* Live engineers */}
            {engineers.map((e) => (
              <g key={e.id}>
                <circle cx={px(e.lng)} cy={py(e.lat)} r={7} fill={ENG_COLOR[e.status]} stroke="#fff" strokeWidth={2} />
                <text x={px(e.lng) + 10} y={py(e.lat) + 4} fontSize={10} fill="#475569" fontWeight={600}>{e.code}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          {Object.entries(PRIORITY_COLOR).map(([p, color]) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {p.charAt(0) + p.slice(1).toLowerCase()} complaint
            </span>
          ))}
          {canTrack && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow" /> Engineer (live)
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 bg-amber-500" /> At-risk asset
          </span>
        </div>
      </Card>
      <p className="mt-4 text-xs text-slate-400">
        Demo rendering: production build uses Google Maps Platform (JS API) with real basemap tiles, clustering and heatmap layers per Part 9 of the blueprint.
      </p>
    </>
  );
}
