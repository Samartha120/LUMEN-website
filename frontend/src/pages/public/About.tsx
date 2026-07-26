export function About() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">About LUMEN</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-slate-600">
        <p>LUMEN is an AI-assisted civic infrastructure platform. A citizen photographs road
        damage; the platform detects and classifies it with computer vision, scores its
        severity, checks it against existing reports, dispatches the right field engineer, and
        verifies the repair from an after-photo before the case can be closed.</p>
        <p>It replaces the disconnected spreadsheets and paper registers municipal departments
        use today with one accountable pipeline — where every action is logged and closure
        requires both a supervisor's approval and passing AI verification.</p>
      </div>
      <h2 className="mt-12 text-xl font-bold text-slate-900">The five pipeline stages</h2>
      <ol className="mt-4 list-inside list-decimal space-y-2 text-slate-600">
        <li>Damage detection &amp; classification (YOLO / OpenCV)</li>
        <li>Severity scoring from detection geometry</li>
        <li>Duplicate detection (image embeddings + geolocation)</li>
        <li>Optimised engineer assignment (Hungarian algorithm)</li>
        <li>AI-verified repair closure (before/after comparison)</li>
      </ol>
    </div>
  );
}
