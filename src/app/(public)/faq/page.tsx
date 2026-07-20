export const metadata = { title: "FAQ" };

const FAQS: [string, string][] = [
  ["Who uses LUMEN?", "LUMEN is the internal operational command center for government staff — commissioners, administrators, department managers, supervisors, field engineers, analysts and auditors. Citizens interact through a separate mobile application that feeds complaints into LUMEN via API."],
  ["How do complaints reach the platform?", "Complaints are ingested from the citizen mobile app automatically, or created manually by department staff for phone-in and walk-in reports. Every complaint receives an immutable CMP reference number."],
  ["How is access controlled?", "Through role-based access control with eight system roles and organizational scoping. Menu items and data a role cannot access are hidden entirely, and every permission is enforced server-side."],
  ["Is the platform auditable?", "Yes — every state-changing action is captured in an immutable audit log with the actor, timestamp, and details. Closure of complaints requires supervisor approval (four-eyes principle)."],
  ["Can LUMEN scale beyond one city?", "Yes. Each government client receives an isolated deployment, and within a deployment LUMEN supports a full hierarchy of organization, departments, offices, zones and regions."],
  ["What about data security?", "LUMEN follows a zero-trust model: encryption in transit and at rest, MFA for privileged roles, session management, device tracking, and region-locked hosting where mandated."],
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frequently Asked Questions</h1>
      <div className="mt-8 divide-y divide-slate-200">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold text-slate-800 marker:hidden group-open:text-brand-700">
              {q}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
