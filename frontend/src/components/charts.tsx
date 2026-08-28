/**
 * Charts, drawn directly as SVG.
 *
 * These were previously Recharts components. Under React 19 that library
 * builds the chart skeleton — axes, legend, grid — but emits empty shape
 * groups, so every bar and pie sector rendered at zero size: the dashboard
 * showed labelled axes with nothing plotted. Rather than pin versions around
 * a third-party rendering bug, the two charts the dashboard actually uses are
 * drawn here. They are simple enough that owning them is cheaper than
 * debugging someone else's internals, and it removes a dependency that could
 * break again on the next React release.
 */

const AXIS_TEXT = "fill-slate-500 text-[11px]";

/** Horizontal bar chart. Values are labelled, so no y-axis scale is needed. */
export function SimpleBarChart({ data, color = "#3d63ec", horizontal = false }: {
  data: { label: string; value: number }[];
  color?: string;
  name?: string;
  horizontal?: boolean;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No data to plot.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <div className="space-y-2.5">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-right text-xs text-slate-600" title={d.label}>
              {d.label}
            </span>
            {/* The track is recessed — an inset shadow reads as a groove cut
                into the card — and the bar sits in it with a light-to-dark
                gradient and its own drop shadow, so it reads as a solid filling
                a channel rather than two flat rectangles. */}
            <div
              className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100/90"
              style={{ boxShadow: "inset 0 1px 2px rgba(23,29,80,0.09)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(2, (d.value / max) * 100)}%`,
                  background: `linear-gradient(180deg, ${color} 0%, color-mix(in srgb, ${color} 82%, #0b1220) 100%)`,
                  boxShadow: "0 1px 2px rgba(23,29,80,0.22), inset 0 1px 0 rgba(255,255,255,0.28)",
                }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700 tabular-nums">
              {d.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Vertical bars, sized from a fixed viewBox so they scale with the card.
  const W = 600, H = 240, PAD_B = 28, PAD_T = 10;
  const slot = W / data.length;
  const barW = Math.min(38, slot * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 240 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD_T + (H - PAD_T - PAD_B) * (1 - f);
        return <line key={f} x1={0} x2={W} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />;
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * (H - PAD_T - PAD_B);
        const x = i * slot + (slot - barW) / 2;
        const y = H - PAD_B - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={Math.max(1, h)} rx={4} fill={color} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-slate-700 text-[11px] font-semibold">
              {d.value}
            </text>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" className={AXIS_TEXT}>
              {d.label.length > 12 ? `${d.label.slice(0, 11)}…` : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Polar point on a circle, with 0° at 12 o'clock. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Annular sector path from `start` to `end` degrees. */
function arc(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number) {
  const large = end - start > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, start), o2 = polar(cx, cy, rOuter, end);
  const i2 = polar(cx, cy, rInner, end), i1 = polar(cx, cy, rInner, start);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const shown = data.filter((d) => d.value > 0);
  const total = shown.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No data to plot.</p>;
  }

  const SIZE = 200, CX = SIZE / 2, CY = SIZE / 2, R_OUT = 92, R_IN = 62;
  const GAP = shown.length > 1 ? 2 : 0; // degrees between segments

  let cursor = 0;
  const segments = shown.map((d) => {
    const sweep = (d.value / total) * 360;
    const start = cursor + GAP / 2;
    const end = cursor + sweep - GAP / 2;
    cursor += sweep;
    return { ...d, start, end: Math.max(start + 0.5, end), pct: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" style={{ maxWidth: 200, height: 200 }}>
        {/* A single full-circle segment cannot be drawn as an arc — its start
            and end points coincide — so draw it as a ring instead. */}
        {segments.length === 1 ? (
          <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none"
                  stroke={segments[0].color} strokeWidth={R_OUT - R_IN} />
        ) : (
          segments.map((s) => (
            <path key={s.name} d={arc(CX, CY, R_OUT, R_IN, s.start, s.end)} fill={s.color}>
              <title>{`${s.name}: ${s.value} (${s.pct}%)`}</title>
            </path>
          ))
        )}
        <text x={CX} y={CY - 2} textAnchor="middle" className="fill-slate-900 text-[22px] font-semibold">
          {total}
        </text>
        <text x={CX} y={CY + 15} textAnchor="middle" className="fill-slate-500 text-[10px] uppercase tracking-wide">
          total
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
            {s.name}
            <span className="font-semibold text-slate-800 tabular-nums">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
