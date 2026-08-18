import { useRef, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { Loader2, Upload, ImageIcon, Cpu, AlertTriangle, Copy, ArrowRight, ImageOff, X } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { PageHeader, Card } from "../components/ui";

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

/** Matches MAX_PHOTOS in backend/src/routes/complaints.ts. */
const MAX_PHOTOS = 5;

type DuplicateInfo = {
  of: string;
  score: number;
  imageSimilarity: number;
  distanceM: number;
  nearbyReports: number;
};

export function NewComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: health } = useApi<{ ai: { model_mode: string; note: string } | null }>("/health");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when the submitted photograph matched an existing complaint. Shown in
  // place of navigating away, so the submitter is actually told.
  const [duplicate, setDuplicate] = useState<(DuplicateInfo & { ref: string }) | null>(null);
  // The photograph was analysed and judged not to be of a road or civic area.
  // Kept separate from `error`: nothing failed, the upload was simply the wrong
  // picture, and the fix is to choose another one.
  const [rejected, setRejected] = useState<string | null>(null);

  if (user && !["SUPERVISOR", "ADMINISTRATOR"].includes(user.role)) return <Navigate to="/app/complaints" replace />;

  const input = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";
  const ai = health?.ai;

  /** Add to the selection rather than replace it, so several drops accumulate. */
  function addFiles(list: FileList | null | undefined) {
    const incoming = [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;
    setFiles((current) => {
      // De-duplicate by name+size: picking the same file twice is a slip, and
      // each extra photograph costs a detection pass.
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`));
      const merged = [...current];
      for (const f of incoming) {
        if (!seen.has(`${f.name}:${f.size}`) && merged.length < MAX_PHOTOS) merged.push(f);
      }
      return merged;
    });
  }

  const removeFile = (i: number) => setFiles((c) => c.filter((_, idx) => idx !== i));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRejected(null);
    const form = new FormData(e.currentTarget);
    if (files.length === 0) { setError("At least one photograph is required."); return; }
    if (!String(form.get("title")).trim()) { setError("A title is required."); return; }
    // The file input is not part of the form (it holds only the last pick), so
    // the accumulated selection is appended here instead.
    form.delete("photos");
    for (const f of files) form.append("photos", f);
    setBusy(true);
    try {
      const { ref, duplicate: dup } = (await api.upload("/complaints", form)) as {
        ref: string; duplicate: DuplicateInfo | null;
      };
      // A duplicate is not an error and the report is still recorded — but
      // silently sending the submitter to a fresh case number would hide the
      // one fact they most need: this has already been reported.
      if (dup) { setDuplicate({ ...dup, ref }); return; }
      navigate(`/app/complaints/${ref}`);
    } catch (err) {
      // 422 means the image was understood and rejected, not that anything broke.
      if (err instanceof ApiError && err.status === 422) setRejected(err.message);
      else setError(err instanceof Error ? err.message : "Failed to create complaint.");
    } finally {
      setBusy(false);
    }
  }

  if (duplicate) {
    return (
      <>
        <PageHeader title="Already Reported" subtitle="This photograph matches a complaint already on record" />
        <Card className="max-w-2xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Copy size={17} className="text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-slate-900">
                This damage has already been reported.
              </p>
              <p className="mt-1.5 text-sm text-slate-600">
                Your photograph matches complaint{" "}
                <Link to={`/app/complaints/${duplicate.of}`} className="font-semibold text-brand-700 hover:underline">
                  {duplicate.of}
                </Link>
                , reported {duplicate.distanceM} m away. Rather than opening a second job for the same
                damage, your report has been linked to that case — it counts as another affected
                resident and raises its priority.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Match confidence", `${duplicate.score}%`],
                  ["Image similarity", `${duplicate.imageSimilarity}%`],
                  ["Distance apart", `${duplicate.distanceM} m`],
                  ["Reports here", String(duplicate.nearbyReports || 1)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{k}</p>
                    <p className="text-sm font-semibold text-slate-900">{v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to={`/app/complaints/${duplicate.of}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">
                  Track {duplicate.of} <ArrowRight size={15} />
                </Link>
                <Link to={`/app/complaints/${duplicate.ref}`} className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
                  View my linked report ({duplicate.ref})
                </Link>
                <button onClick={() => { setDuplicate(null); setFiles([]); }}
                  className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
                  Report something else
                </button>
              </div>
            </div>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New Complaint" subtitle="The photograph drives classification, severity and duplicate detection" />

      {ai === null ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">AI service is not running</p><p className="mt-0.5">Start it: <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs">cd backend/ai-service && uvicorn main:app --port 8100</code></p></div>
        </div>
      ) : ai?.model_mode === "HEURISTIC" ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Cpu size={17} className="mt-0.5 shrink-0" />
          <div><p className="font-semibold">Running the classical-CV heuristic detector</p><p className="mt-0.5">Damage is localised with OpenCV — a real detector, but not deep learning. Train the RDD2022 model to swap in YOLO.</p></div>
        </div>
      ) : ai ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"><Cpu size={16} /> {ai.note}</div>
      ) : null}

      {rejected && (
        <div className="mb-5 max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <ImageOff size={18} className="mt-0.5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Please upload an appropriate image</p>
              <p className="mt-1 text-sm text-amber-800">{rejected}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
                <li>• Point the camera at the damage itself — the road, footpath, bin or manhole</li>
                <li>• Take the photo in daylight, close enough to see the defect clearly</li>
                <li>• Avoid selfies, screenshots and photos where a person or vehicle fills the frame</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className={label}>
              Photographs of the damage *
              <span className="ml-1.5 font-normal text-slate-400">
                {files.length > 0 ? `${files.length} of ${MAX_PHOTOS} selected` : `up to ${MAX_PHOTOS}`}
              </span>
            </label>

            {files.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {files.map((f, i) => (
                  <div key={`${f.name}:${f.size}`} className="group relative overflow-hidden rounded-lg border border-slate-200">
                    <img src={URL.createObjectURL(f)} alt={f.name} className="h-24 w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 rounded bg-brand-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Primary
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      title="Remove"
                      className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_PHOTOS && (
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 ${files.length ? "py-5" : "py-8"} transition ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"}`}
              >
                <ImageIcon size={files.length ? 20 : 28} className="mb-2 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">
                  {dragging ? "Drop the photographs here"
                    : files.length ? "Add another angle" : "Drag & drop photographs, or click to select"}
                </span>
                <span className="mt-1 text-center text-xs text-slate-400">
                  {files.length
                    ? "Several angles help — the clearest one is used for classification"
                    : "The damage class, severity and priority are derived from these images"}
                </span>
              </div>
            )}
            <input
              ref={inputRef} type="file" name="photos" accept="image/*" multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
            />
          </div>

          <div><label className={label}>Title *</label><input name="title" placeholder="e.g. Deep pothole outside the bus stop" className={input} /></div>
          <div><label className={label}>Description</label><textarea name="description" rows={3} placeholder="What was reported and any access notes…" className={input} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className={label}>Zone</label><select name="zone" className={input}>{ZONES.map((z) => <option key={z}>{z}</option>)}</select></div>
            <div><label className={label}>Address / landmark</label><input name="address" placeholder="e.g. Near 4th Block bus stop" className={input} /></div>
            <div><label className={label}>Latitude</label><input name="lat" type="number" step="0.0001" defaultValue="12.9716" className={input} /></div>
            <div><label className={label}>Longitude</label><input name="lng" type="number" step="0.0001" defaultValue="77.5946" className={input} /></div>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {busy ? (files.length > 1 ? `Analysing ${files.length} images…` : "Analysing image…") : "Analyse & Create Complaint"}
            </button>
            <span className="text-xs text-slate-400">Runs detection → severity → duplicate check</span>
          </div>
        </form>
      </Card>
    </>
  );
}
