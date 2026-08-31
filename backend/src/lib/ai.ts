const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8100";

export type Detection = {
  label: string;
  confidence: number;
  box: [number, number, number, number];
  area_ratio: number;
  // Present only for the classes the service outlines — manholes, open and
  // closed. Everything else is reported as a box. See POLYGON_CLASSES in
  // ai-service/model.py.
  polygon?: [number, number][] | null;
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
  interior_scene?: string;
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

  // The three states an upload can be in. `valid_image` false means the photo
  // is not of a civic scene at all — distinct from a valid road that simply
  // has no damage, which is `valid_image` true with `count` 0. The service
  // decides this with a scene classifier, not with the damage model, so an
  // empty detection list never has to stand in for "wrong kind of photo".
  // `message` carries the wording to show; it is the single source of that
  // text so the API and the UI cannot drift apart.
  valid_image?: boolean;
  image_type?: "road" | "unrelated";
  potholes_detected?: boolean;
  count?: number;
  message?: string | null;
  hint?: string | null;
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

