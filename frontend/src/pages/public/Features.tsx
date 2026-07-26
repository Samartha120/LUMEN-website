const F: [string, string[]][] = [
  ["Computer-Vision Detection", ["YOLO object detection localises and classifies road damage", "Four classes: pothole, longitudinal / transverse / alligator crack", "Annotated image with bounding boxes returned per complaint"]],
  ["Severity & Priority", ["Score 0–100 from damage area, count and confidence", "Automatically sets complaint priority and SLA deadline"]],
  ["Duplicate Detection", ["512-D CNN image embeddings compared by cosine similarity", "Constrained by Haversine distance and a 72-hour window", "Merges the same defect reported by different citizens"]],
  ["AI-Verified Closure", ["Engineer's after-photo re-analysed and compared to the before", "Severity reduction + SSIM decide the verdict", "Closure blocked automatically if damage remains"]],
  ["Assignment Optimiser", ["Hungarian algorithm, O(n³), across all open complaints", "Minimises travel + workload with skill constraints", "Benchmarked against a greedy baseline"]],
  ["Security & Audit", ["Role-based access enforced on the server", "Immutable audit log of every state-changing action", "Four-eyes closure approval by a supervisor"]],
];
export function Features() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Capabilities</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Five AI-driven stages plus enterprise security, on a three-tier stack.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {F.map(([title, items]) => (
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
