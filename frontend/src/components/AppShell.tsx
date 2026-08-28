import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth";
import { navForRole, ROLE_LABELS } from "../lib/rbac";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";

export function AppShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth/login" replace />;

  const items = navForRole(user.role);

  async function onLogout() {
    await logout();
    navigate("/auth/login");
  }

  return (
    <div className="min-h-screen">
      <Sidebar items={items} roleLabel={ROLE_LABELS[user.role] ?? user.role} />
      <div className="pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-6 backdrop-blur">
          <div className="text-sm text-slate-500">
            Lumen City Municipal Corporation ·{" "}
            <span className="font-medium text-slate-700">
              {/* A resident is not looking at an operational command centre.
                  Naming the surface for who is using it. */}
              {user.role === "CITIZEN" ? "Citizen Reporting Portal" : "Operational Command Center"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">
                {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-tight text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
            <button onClick={onLogout} title="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
