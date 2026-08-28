import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Landmark, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../auth";

const DEMO: [string, string][] = [
  ["Administrator", "admin@lumen.gov"],
  ["Supervisor", "supervisor@lumen.gov"],
  ["Field Engineer", "engineer@lumen.gov"],
];

/** Where a signed-in user belongs. Residents have no dashboard. */
const homeFor = (role: string) => (role === "CITIZEN" ? "/app/complaints" : "/app/dashboard");

export function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("supervisor@lumen.gov");
  const [password, setPassword] = useState("lumen123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={homeFor(user.role)} replace />;

  function switchMode(next: "signin" | "signup") {
    setMode(next);
    setError(null);
    // Clear the form either way. The staff demo credentials are prefilled on
    // first load only: a resident who taps "Already have an account?" is
    // signing into their own account, and handing them supervisor@lumen.gov
    // to delete is both confusing and a nudge toward the wrong door.
    setEmail("");
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await register(name, email, password);
        navigate("/app/complaints/new");
      } else {
        await login(email, password);
        // The session comes back from the server, so read the role from there
        // rather than guessing — a resident sent to the dashboard would only
        // be bounced straight back out by the route guard.
        const me = await fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json());
        navigate(homeFor(me?.user?.role ?? ""));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === "signup" ? "Could not create account." : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Landmark size={18} /></span>
          <span className="text-lg font-bold">LUMEN</span>
        </Link>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-tight">AI-assisted civic damage operations</h1>
          <p className="mt-4 max-w-md text-brand-200/80">Sign in to detect road damage from photos, dispatch engineers, and track repairs — all from one screen.</p>
        </div>
        <p className="flex items-center gap-2 text-sm text-brand-300/70"><ShieldCheck size={16} /> Zero-trust access · Every action is audit-logged</p>
      </div>

      <div className="flex w-full items-center justify-center bg-slate-50 px-6 lg:w-1/2">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* One form serves both audiences, so it cannot claim to be staff-only.
              Saying "access is limited to authorized government personnel" to a
              resident who just created an account reads as a rejection. */}
          <h2 className="text-xl font-bold text-slate-900">
            {mode === "signup" ? "Create a Resident Account" : "Sign In"}
          </h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            {mode === "signup"
              ? "Report problems in your area and follow what happens to them."
              : "For residents and municipal staff."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email Address</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {mode === "signup" && (
              <p className="text-xs text-slate-500">At least 8 characters. You will stay signed in on this device.</p>
            )}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "signup" ? "Create account & report an issue" : "Sign in"}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4">
            {mode === "signin" ? (
              <p className="text-sm text-slate-600">
                Reporting a problem in your area?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="font-semibold text-brand-700 hover:underline">
                  Create a resident account
                </button>
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="font-semibold text-brand-700 hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </div>

          {mode === "signin" && (
            <div className="pt-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Demo accounts — password <span className="font-mono text-slate-500">lumen123</span></p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO.map(([label, mail]) => (
                  <button key={mail} type="button" onClick={() => { setEmail(mail); setPassword("lumen123"); }}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${email === mail ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
