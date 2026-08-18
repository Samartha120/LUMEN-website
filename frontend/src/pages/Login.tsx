import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Landmark, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../auth";

const DEMO: [string, string][] = [
  ["Administrator", "admin@lumen.gov"],
  ["Supervisor", "supervisor@lumen.gov"],
  ["Field Engineer", "engineer@lumen.gov"],
];

export function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("supervisor@lumen.gov");
  const [password, setPassword] = useState("lumen123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
          <h2 className="text-xl font-bold text-slate-900">Staff Sign In</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Access is limited to authorized government personnel.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Official Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />} Sign in to Command Center
            </button>
          </form>
          <div className="pt-4">
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
        </div>
      </div>
    </div>
  );
}
