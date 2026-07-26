const FAQS: [string, string][] = [
  ["How does detection work?", "A citizen's photo is sent to the AI service, which runs a computer-vision model to localise and classify road damage and return an annotated image with bounding boxes and confidences."],
  ["What is the severity score?", "A number from 0 to 100 computed from the detected damage — its area, how many regions, the class and confidence. It automatically sets the complaint's priority and SLA."],
  ["How are duplicates caught?", "Each photo is turned into a CNN embedding; two complaints are merged only if the images are visually similar AND within 150 m and 72 hours of each other."],
  ["Can an engineer fake a repair?", "No. The after-photo is re-analysed and compared to the original; if damage is still present, or the same photo is resubmitted, closure is blocked automatically."],
  ["How are engineers assigned?", "The Hungarian algorithm assigns all open complaints at once, minimising total cost (travel, workload, skill match) — provably better than a greedy nearest-engineer rule."],
  ["What is the tech stack?", "A Vite + React frontend, an Express + Prisma backend, and a Python FastAPI computer-vision service — three tiers, each in its own folder."],
];
export function Faq() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Frequently Asked Questions</h1>
      <div className="mt-8 divide-y divide-slate-200">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold text-slate-800 group-open:text-brand-700">{q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
