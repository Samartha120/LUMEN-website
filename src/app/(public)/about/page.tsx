export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">About LUMEN</h1>
      <div className="prose-slate mt-6 space-y-4 leading-relaxed text-slate-600">
        <p>
          LUMEN is an enterprise Software-as-a-Service platform that functions as the digital
          nervous system of a government organization&apos;s civic operations. It replaces
          fragmented, paper-based and siloed municipal workflows with a single, intelligent,
          transparent and accountable digital platform.
        </p>
        <p>
          Departments like Water Supply, Roads, Electricity, Sanitation and Parks typically
          operate on disconnected systems — spreadsheets, paper registers and informal phone
          coordination. LUMEN gives them a single source of truth: every open issue, every
          field engineer&apos;s location and workload, and every physical asset&apos;s condition,
          across every department, in real time.
        </p>
        <p>
          The platform is built on five architectural pillars: a modular service-ready backend,
          a server-rendered component-driven frontend, a zero-trust security model,
          auditability by default, and horizontal scalability from a single municipality to a
          nationwide multi-tenant deployment.
        </p>
      </div>
      <h2 className="mt-12 text-xl font-bold text-slate-900">Our Mission</h2>
      <ul className="mt-4 space-y-3 text-slate-600">
        {[
          "Total operational visibility across every department",
          "Accountability infrastructure — an immutable record of who did what, when, and why",
          "Data-driven decision-making through analytics and AI-assisted forecasting",
          "Faster citizen service delivery through automated routing and SLA enforcement",
          "A secure, compliant, future-proof technical foundation",
        ].map((m, i) => (
          <li key={m} className="flex gap-3">
            <span className="font-bold text-brand-700">{i + 1}.</span> {m}
          </li>
        ))}
      </ul>
    </div>
  );
}
