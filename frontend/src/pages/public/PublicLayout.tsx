import { Link, Outlet } from "react-router-dom";
import { Landmark } from "lucide-react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Features" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Landmark size={18} />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              LUMEN
              <span className="ml-2 hidden text-xs font-medium text-slate-500 sm:inline">
                Civic Damage Intelligence
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} to={n.href} className="text-sm font-medium text-slate-600 hover:text-brand-700">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link to="/auth/login" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">
            Staff Login
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <p>© 2026 LUMEN Civic Systems · Vite + Express + FastAPI</p>
          <div className="flex gap-5">
            <Link to="/faq" className="hover:text-brand-700">FAQ</Link>
            <Link to="/contact" className="hover:text-brand-700">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
