import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * Where the backend lives.
 *
 * The phone is not the machine running the server, so "localhost" means the
 * phone itself and will always fail. During development set EXPO_PUBLIC_API_URL
 * to the laptop's address on the same wifi (Expo prints it when it starts,
 * e.g. http://192.168.1.7:4000); in a build, set it to the deployed URL.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

const TOKEN_KEY = "lumen_token";

// SecureStore is backed by the iOS keychain and Android keystore, so the
// session survives a restart without sitting in plain text on the device.
export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export type ApiError = { status: number; message: string };

async function parse(res: Response) {
  const text = await res.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: body.error ?? `Request failed (${res.status})`,
    };
    throw err;
  }
  return body;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await loadToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // `client: "mobile"` is what makes the server hand back the token as well
    // as setting its cookie. A native app has no cookie jar to put it in.
    body: JSON.stringify({ email, password, client: "mobile" }),
  });
  const body = await parse(res);
  if (body.token) await saveToken(body.token);
  return body.user;
}

export async function register(name: string, email: string, password: string) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, client: "mobile" }),
  });
  const body = await parse(res);
  if (body.token) await saveToken(body.token);
  return body.user;
}

export async function me() {
  const res = await fetch(`${API_URL}/api/auth/me`, { headers: await authHeaders() });
  const body = await parse(res);
  return body.user ?? body;
}

export async function myComplaints() {
  const res = await fetch(`${API_URL}/api/complaints`, { headers: await authHeaders() });
  const body = await parse(res);
  return (body.complaints ?? []) as Complaint[];
}

export async function complaint(ref: string) {
  const res = await fetch(`${API_URL}/api/complaints/${ref}`, { headers: await authHeaders() });
  const body = await parse(res);
  return body.complaint as ComplaintDetail;
}

/**
 * File a report.
 *
 * Sent as multipart/form-data under the field name `photos`, which is the same
 * request the web app makes — the server has one create endpoint and does not
 * know or care which client called it. Do not set Content-Type by hand here:
 * fetch has to add its own multipart boundary.
 */
export async function submitReport(opts: {
  title: string;
  photoUri: string;
  lat?: number | null;
  lng?: number | null;
}) {
  const form = new FormData();
  form.append("title", opts.title);
  if (opts.lat != null) form.append("lat", String(opts.lat));
  if (opts.lng != null) form.append("lng", String(opts.lng));
  const name = opts.photoUri.split("/").pop() || "photo.jpg";
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  form.append("photos", {
    uri: opts.photoUri,
    name,
    type: ext === "png" ? "image/png" : "image/jpeg",
  } as unknown as Blob);

  const res = await fetch(`${API_URL}/api/complaints`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return (await parse(res)) as {
    ref: string;
    duplicate: null | { of: string; score: number; distanceM: number };
  };
}

/** Uploaded photos are served from the backend, not bundled with the app. */
export function mediaUrl(path?: string | null) {
  if (!path) return undefined;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}

export type Detection = {
  label: string;
  confidence: number;
  box: number[];
  polygon?: number[][] | null;
};

export type Complaint = {
  id: string;
  ref: string;
  title: string;
  status: string;
  category: string | null;
  civicCategory: string | null;
  severityScore: number | null;
  priority: string | null;
  address: string | null;
  zone: string | null;
  createdAt: string;
  department?: { name: string } | null;
};

export type ComplaintDetail = Complaint & {
  images: {
    id: string;
    path: string;
    annotated: string | null;
    detections: string | null;
  }[];
  events: { id: string; type: string; message: string; createdAt: string }[];
};
