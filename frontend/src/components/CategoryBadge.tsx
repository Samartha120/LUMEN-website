import { CATEGORIES, type CategoryKey } from "../lib/taxonomy";

/** Per-category colours — kept in step with the AI service's annotation colours. */
export const CATEGORY_STYLE: Record<CategoryKey, { chip: string; dot: string; hex: string }> = {
  ROADS:  { chip: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500",     hex: "#dc2626" },
  WASTE:  { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", hex: "#10b981" },
  WATER:  { chip: "bg-sky-50 text-sky-700 ring-sky-200",             dot: "bg-sky-500",     hex: "#0ea5e9" },
};

export function CategoryBadge({ category, compact = false }: { category: string | null; compact?: boolean }) {
  if (!category || !(category in CATEGORIES)) {
    return <span className="text-xs text-slate-400">Unclassified</span>;
  }
  const key = category as CategoryKey;
  const s = CATEGORY_STYLE[key];
  return (
    <span
      title={`${CATEGORIES[key].label} — routed to ${CATEGORIES[key].deptName}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {compact ? CATEGORIES[key].label : CATEGORIES[key].label}
    </span>
  );
}

export function categoryHex(category: string | null): string {
  if (category && category in CATEGORY_STYLE) return CATEGORY_STYLE[category as CategoryKey].hex;
  return "#94a3b8";
}
