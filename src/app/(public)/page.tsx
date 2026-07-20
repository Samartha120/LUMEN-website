import Link from "next/link";
import {
  ClipboardList, Map, Building2, HardHat, Users, Boxes, BarChart3, ShieldCheck,
  ArrowRight, CheckCircle2,
} from "lucide-react";

const DOMAINS = [
  { icon: ClipboardList, title: "Complaint & Case Operations", desc: "Full lifecycle from citizen intake to audited closure — SLA tracking, auto-assignment, escalation." },
  { icon: Map, title: "GIS & Spatial Intelligence", desc: "Live engineer tracking, complaint heatmaps, asset mapping and zone management on one map." },
  { icon: Building2, title: "Department Management", desc: "Org hierarchy, budgets, KPIs and SLA performance for every civic department." },
  { icon: HardHat, title: "Workforce Management", desc: "Engineer profiles, workload-balanced assignment, performance and field navigation." },
  { icon: Users, title: "Citizen Relationship", desc: "Verified citizen identities, activity history, feedback and moderation tooling." },
  { icon: Boxes, title: "Asset Management", desc: "Roads, pipes, lights, signals, vehicles and bridges — condition, QR tagging, maintenance lifecycle." },
  { icon: BarChart3, title: "Analytics & AI", desc: "Forecasting, duplicate detection, priority recommendation and infrastructure risk analysis." },
  { icon: ShieldCheck, title: "Enterprise Security", desc: "Zero-trust RBAC, immutable audit logs, MFA, monitoring and a dedicated security center." },
];

const STATS = [
  ["68%", "faster average complaint resolution"],
  ["100%", "of state-changing actions audit-logged"],
  ["23", "operational modules on one platform"],
  ["8", "purpose-built staff roles with scoped access"],
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(600px 300px at 80% 20%, rgba(61,99,236,.5), transparent), radial-gradient(500px 260px at 10% 90%, rgba(32,44,167,.6), transparent)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-24 lg:py-32">
          <p className="mb-4 inline-flex items-center rounded-full border border-brand-400/40 bg-brand-800/40 px-3 py-1 text-xs font-medium tracking-wide text-brand-200">
            Enterprise Civic Operations · Trusted by municipal governments
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            The digital nervous system for{" "}
            <span className="text-brand-300">government civic operations</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-brand-100/80">
            LUMEN unifies complaint management, GIS intelligence, asset lifecycle, workforce
            coordination and AI-assisted analytics into a single, secure, fully audited
            operational command center for your city.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-900 shadow-lg hover:bg-brand-50"
            >
              Open the Command Center <ArrowRight size={16} />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Explore Capabilities
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
        <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
          Eight capability domains. One platform.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Comparable to ServiceNow, ArcGIS Enterprise and IBM Maximo — purpose-built for
          civic infrastructure and unified under a single role-driven interface.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {DOMAINS.map((d) => (
            <div key={d.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <d.icon size={20} />
              </span>
              <h3 className="font-semibold text-slate-900">{d.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Accountability is the architecture
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Every state-changing action — every assignment, escalation and closure — is
              captured in an immutable audit trail with actor, timestamp and justification.
              Closure requires four-eyes supervisor approval. SLAs are monitored continuously
              and breaches escalate automatically.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Zero-trust security — every request authenticated and authorized",
                "Role-based least-privilege access for 8 staff roles",
                "Immutable audit logs satisfying government compliance",
                "WCAG 2.1 AA accessibility and data-sovereignty ready",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Complaint lifecycle
            </h3>
            <ol className="mt-5 space-y-0">
              {["Submitted via citizen app", "AI classification & duplicate check", "Auto-assigned to field engineer", "Work executed with photo evidence", "Supervisor closure approval", "Citizen feedback captured"].map((s, i, arr) => (
                <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute left-[13px] top-7 h-full w-px bg-brand-200" />}
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-sm font-medium text-slate-700">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Ready to see the command center?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Sign in with any of the eight demo staff roles to experience role-adaptive
          dashboards, complaint operations and city-wide analytics.
        </p>
        <Link
          href="/auth/login"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-800"
        >
          Staff Login <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
