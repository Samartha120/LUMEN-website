import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Route, Map, HardHat, ScrollText, Landmark,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "../lib/rbac";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ClipboardList, Route, Map, HardHat, ScrollText,
};

export function Sidebar({ items, roleLabel }: { items: NavItem[]; roleLabel: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-brand-950 text-white">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
          <Landmark size={16} />
        </span>
        <div>
          <div className="text-sm font-bold leading-tight">LUMEN</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-300">{roleLabel}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          return (
            <NavLink
              key={item.key}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-600 text-white shadow-sm" : "text-brand-100/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-brand-300/60">
        LUMEN Platform v1.0 · Vite + Express
      </div>
    </aside>
  );
}
