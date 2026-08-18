const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8100";

export type Detection = {
  label: string;
  confidence: number;
  box: [number, number, number, number];
  area_ratio: number;
};
export type Severity = {
  score: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  band: "NONE" | "MINOR" | "MODERATE" | "SIGNIFICANT" | "SEVERE";
  instances: number;
  total_area_ratio: number;
};
export type Routing = {
  category: string | null;
  department: string | null;
  department_name: string | null;
  sla_hours: number | null;
  category_scores?: Record<string, number>;
};

export type Scene = {
  road_fraction: number | null;
  edge_density?: number;
  looks_civic: boolean;
  reason: string;
};

export type DetectResult = {
  model_mode: "TRAINED" | "HEURISTIC" | "FALLBACK";
  image_size: { width: number; height: number };
  detections: (Detection & { category?: string | null })[];
  severity: Severity;
  routing?: Routing;
  scene?: Scene;
  annotated_png_b64: string;
};

export class AiUnavailableError extends Error {
  constructor() {
    super("The AI service is not reachable. Start it: cd backend/ai-service && uvicorn main:app --port 8100");
    this.name = "AiUnavailableError";
  }
}

function fileFromBuffer(buf: Buffer, name: string, type: string): File {
  return new File([new Uint8Array(buf)], name, { type });
}

async function post<T>(path: string, fd: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${AI_URL}${path}`, { method: "POST", body: fd, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new AiUnavailableError();
  }
  if (!res.ok) throw new Error(`AI service ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function aiHealth() {
  try {
    const r = await fetch(`${AI_URL}/health`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    return (await r.json()) as { status: string; model_mode: string; note: string };
  } catch {
    return null;
  }
}

export async function detect(buf: Buffer, name = "photo.jpg", type = "image/jpeg"): Promise<DetectResult> {
  const fd = new FormData();
  fd.append("file", fileFromBuffer(buf, name, type));
  return post<DetectResult>("/detect", fd);
}

export async function embed(buf: Buffer, name = "photo.jpg", type = "image/jpeg"): Promise<number[]> {
  const fd = new FormData();
  fd.append("file", fileFromBuffer(buf, name, type));
  return (await post<{ embedding: number[] }>("/embed", fd)).embedding;
}

