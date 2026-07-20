import Link from "next/link";
import { LogOut, Bell } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { navForRole, ROLE_LABELS } from "@/lib/rbac";
import { Sidebar } from "@/components/sidebar";
import { db } from "@/lib/db";
import { logout } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const items = navForRole(session.role);
  const unread = await db.notification.count({
    where: { read: false, role: { in: [session.role, "ALL"] } },
  });

  return (
    <div className="min-h-screen">
      <Sidebar items={items} roleLabel={ROLE_LABELS[session.role] ?? session.role} />
      <div className="pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          <div className="text-sm text-slate-500">
            Lumen City Municipal Corporation ·{" "}
            <span className="font-medium text-slate-700">Operational Command Center</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/app/notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                {session.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-tight text-slate-800">{session.name}</div>
                <div className="text-xs text-slate-500">{ROLE_LABELS[session.role]}</div>
              </div>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Sign out"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
