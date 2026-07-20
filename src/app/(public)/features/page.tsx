export const metadata = { title: "Features" };

const FEATURES: [string, string[]][] = [
  ["Complaint Management", ["CMP-referenced tickets with a formal 9-state lifecycle", "Automatic + manual assignment with workload balancing", "SLA tracking with at-risk and breach escalation", "Four-eyes closure approval and citizen feedback capture"]],
  ["GIS Console", ["City-wide operational map with complaint and asset layers", "Live engineer tracking (permission-gated and audited)", "Complaint density heatmaps and zone management"]],
  ["Departments & Workforce", ["Department budgets, KPIs and SLA performance", "Engineer directory with skills, ratings and workload", "Zone-scoped access for managers, supervisors and engineers"]],
  ["Asset Registry", ["Roads, pipes, streetlights, buildings, signals, vehicles, bridges", "Condition tracking and maintenance lifecycle", "Geolocated inventory linked to responsible departments"]],
  ["Analytics, Reports & AI", ["Role-adaptive executive dashboards", "MTTR, volume and department analytics with forecasting", "AI duplicate detection, priority recommendation and risk analysis"]],
  ["Security & Compliance", ["8-role RBAC with per-user permission overrides", "Immutable audit log for every state-changing action", "MFA enforcement for privileged roles, session and device management"]],
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Capabilities</h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Twenty-three operational modules, organized into the capability domains below.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {FEATURES.map(([title, items]) => (
          <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
              {items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
