import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, Upload, ImageIcon, Cpu, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useAuth } from "../auth";
import { PageHeader, Card } from "../components/ui";

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

export function NewComplaint() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: health } = useApi<{ ai: { model_mode: string; note: string } | null }>("/health");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user && !["SUPERVISOR", "ADMINISTRATOR"].includes(user.role)) return <Navigate to="/app/complaints" replace />;

  const input = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";
  const ai = health?.ai;

  function useFile(f: File | undefined | null) {
    if (!f || !f.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(f));
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if (!(form.get("photo") as File)?.size) { setError("A photograph is required."); return; }
    if (!String(form.get("title")).trim()) { setError("A title is required."); return; }
    setBusy(true);
    try {
      const { ref } = await api.upload("/complaints", form);
      navigate(`/app/complaints/${ref}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create complaint.");
    } finally {
      setBusy(false);
    }
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

      <Card className="max-w-2xl">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className={label}>Photograph of the damage *</label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); useFile(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 transition ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"}`}
            >
              {preview ? (
                <><img src={preview} alt="Selected" className="mb-3 max-h-56 rounded-lg object-contain" /><span className="text-xs text-slate-500">Click or drop to replace</span></>
              ) : (
                <><ImageIcon size={28} className="mb-2 text-slate-400" />
                <span className="text-sm font-medium text-slate-600">{dragging ? "Drop the photograph here" : "Drag & drop a photograph, or click to select"}</span>
                <span className="mt-1 text-xs text-slate-400">The damage class, severity and priority are derived from this image</span></>
              )}
              <input ref={inputRef} type="file" name="photo" accept="image/*" className="hidden" onChange={(e) => useFile(e.target.files?.[0])} />
            </div>
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
              {busy ? "Analysing image…" : "Analyse & Create Complaint"}
            </button>
            <span className="text-xs text-slate-400">Runs detection → severity → duplicate check</span>
          </div>
        </form>
      </Card>
    </>
  );
}
