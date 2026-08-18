import { Link } from "react-router-dom";
import {
  ScanSearch, Gauge, Copy, Route, ArrowRight, CheckCircle2,
} from "lucide-react";

const FEATURES = [
  { icon: ScanSearch, title: "Damage Detection", desc: "A citizen's photo is analysed by a computer-vision model that localises and classifies road damage — potholes and crack types — with bounding boxes." },
  { icon: Gauge, title: "Severity Scoring", desc: "Each detection is scored 0–100 from its geometry, automatically setting the complaint's priority and SLA." },
  { icon: Copy, title: "Duplicate Detection", desc: "CNN image embeddings plus geospatial proximity catch two citizens reporting the same defect, and merge them." },
  { icon: Route, title: "Optimised Assignment", desc: "The Hungarian algorithm assigns every open complaint to the best engineer, minimising total travel and workload." },
];

const STATS = [
  ["5", "AI-driven pipeline stages"],
  ["4", "road-damage classes detected"],
  ["100%", "state-changing actions audit-logged"],
  ["O(n³)", "optimal assignment algorithm"],
];

export function Landing() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(600px 300px at 80% 20%, rgba(61,99,236,.5), transparent), radial-gradient(500px 260px at 10% 90%, rgba(32,44,167,.6), transparent)" }} />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <p className="mb-4 inline-flex items-center rounded-full border border-brand-400/40 bg-brand-800/40 px-3 py-1 text-xs font-medium tracking-wide text-brand-200">
            AI-Assisted Civic Infrastructure · Computer Vision + Optimisation
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Detect road damage from a photo, <span className="text-brand-300">fix it accountably</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-100/80">
            LUMEN turns a citizen's photograph into a fully-tracked repair: computer-vision
            damage detection, automatic severity and priority, duplicate consolidation,
            optimised engineer dispatch, and budget-aware repair planning.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/auth/login" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-900 shadow-lg hover:bg-brand-50">
              Open the Command Center <ArrowRight size={16} />
            </Link>
            <Link to="/features" className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Explore the Pipeline
            </Link>
          </div>
          <div className="mt-14 grid grid-cols-2 gap-6 border-t border-white/10 pt-10 sm:grid-cols-4">
            {STATS.map(([n, label]) => (
              <div key={label}>
                <div className="text-3xl font-bold text-white">{n}</div>
                <div className="mt-1 text-sm text-brand-200/80">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">One intelligent pipeline</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Photo in → detected → scored → de-duplicated → optimally assigned → dispatched.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <f.icon size={20} />
              </span>
              <div className="text-xs font-bold text-brand-600">Step {i + 1}</div>
              <h3 className="mt-1 font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Accountable by architecture</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Every state-changing action is captured in an immutable audit trail. Closure needs
              a supervisor's approval first. Role-based access is
              enforced on the server, not just hidden in the UI.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Computer-vision detection on every complaint photo",
                "Severity-driven priority and SLA, no manual guessing",
                "Immutable audit log of every action",
                "Optimised, benchmarked engineer assignment",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Three-tier stack</h3>
            <ol className="mt-5 space-y-4 text-sm">
              {[
                ["Frontend", "Vite + React SPA (React Router, Tailwind)"],
                ["Backend", "Express + Prisma REST API, JWT auth"],
                ["AI Service", "FastAPI + YOLO / OpenCV computer vision"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center gap-3">
                  <span className="flex h-7 w-16 shrink-0 items-center justify-center rounded bg-brand-700 text-[11px] font-bold text-white">{k}</span>
                  <span className="text-slate-700">{v}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">See it detect a pothole</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">Sign in and upload a road photo — the model draws the box, scores it, and routes it.</p>
        <Link to="/auth/login" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-800">
          Staff Login <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
