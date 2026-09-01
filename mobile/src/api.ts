import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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

/**
 * Where the session token lives.
 *
 * On a phone: SecureStore, which is the iOS keychain and the Android keystore,
 * so the session survives a restart without sitting in plain text on the
 * device. SecureStore has no web implementation at all — it throws — so the
 * browser falls back to AsyncStorage, which there is localStorage. That is a
 * genuinely weaker place to keep a token, and it is the reason the browser
 * build is for trying the app out rather than for real use.
 */
const secure = Platform.OS !== "web";

export async function saveToken(token: string) {
  if (secure) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await AsyncStorage.setItem(TOKEN_KEY, token);
}
export async function loadToken(): Promise<string | null> {
  try {
    return secure
      ? await SecureStore.getItemAsync(TOKEN_KEY)
      : await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export async function clearToken() {
  try {
    if (secure) await SecureStore.deleteItemAsync(TOKEN_KEY);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
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

/** A local file, shaped the way React Native's FormData expects. */
function asFilePart(uri: string) {
  const name = uri.split("/").pop() || "photo.jpg";
  const ext = (name.split(".").pop() || "jpg").toLowerCase();
  return {
    uri,
    name,
    type: ext === "png" ? "image/png" : "image/jpeg",
  } as unknown as Blob;
}

/**
 * Ask what the detector makes of a photograph, without filing anything.
 *
 * This is the whole point of the app sitting on this platform rather than
 * beside it: the reporter sees what the model sees while they are still
 * standing in front of the damage. A photo that is too dark, too far away or
 * of the wrong thing can be retaken on the spot instead of being rejected
 * hours later. Nothing is written server-side, so checking three angles before
 * choosing one leaves no half-complaints behind.
 */
export async function previewPhoto(uri: string) {
  const form = new FormData();
  form.append("photo", asFilePart(uri));
  const res = await fetch(`${API_URL}/api/complaints/preview`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  return (await parse(res)) as Preview;
}

export async function notifications() {
  const res = await fetch(`${API_URL}/api/notifications`, { headers: await authHeaders() });
  const body = await parse(res);
  return body as { notifications: Notification[]; unread: number };
}

export async function markNotificationsRead(id?: string) {
  await fetch(`${API_URL}/api/notifications/read`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  });
}

export type Preview = {
  looksCivic: boolean;
  message: string | null;
  hint: string | null;
  category: string | null;
  detections: { label: string; confidence: number; polygon?: number[][] | null }[];
  severity: { score: number; priority: string; band: string; instances: number };
  annotated: string;
  modelMode: string;
};

// Mirrors the Prisma model: a notification carries a `type` and a `message`,
// not a title and a body. Reading fields that were not there is what left the
// Updates list rendering empty cards.
export type Notification = {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  complaint?: { ref: string; title: string; status: string } | null;
};

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
  photoUris: string[];
  lat?: number | null;
  lng?: number | null;
}) {
  const form = new FormData();
  form.append("title", opts.title);
  if (opts.lat != null) form.append("lat", String(opts.lat));
  if (opts.lng != null) form.append("lng", String(opts.lng));
  // Several angles are worth sending: the server analyses every one and picks
  // whichever found the most damage to classify and route the complaint, so a
  // wide shot for context plus a close one for the defect beats either alone.
  for (const uri of opts.photoUris) form.append("photos", asFilePart(uri));

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
  lat?: number | null;
  lng?: number | null;
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

// ---------------------------------------------------------------------------
// Staff surface.
//
// Everything below is already served to the web console; the phone simply asks
// for it too. Each endpoint enforces its own role check server-side, so a
// citizen holding a token cannot reach any of it by guessing a URL — the app
// hides these screens as a courtesy, not as the control.
// ---------------------------------------------------------------------------

export type Engineer = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  zone: string | null;
  status: string;
  skills: string;
  resolvedJobs: number;
  complaints?: unknown[];
  department?: { name: string } | null;
};

export type Cluster = {
  key: string;
  zone: string | null;
  category: string | null;
  civicCategory: string | null;
  members: { ref: string; title: string; severityScore: number | null }[];
  lat: number;
  lng: number;
  spreadM: number;
  visitsSaved: number;
  worstSeverity: number;
  worstPriorityScore: number;
  dueHours: number | null;
};

export type Assignment = {
  complaint: { ref: string; title: string; category: string | null; zone: string | null };
  engineer: { id: string; name: string; code: string; zone: string | null };
  cost: number;
  distanceKm: number;
  skillMatch: boolean;
};

export type AuditLog = {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  module: string;
  target: string | null;
  details: string | null;
  createdAt: string;
};

export type AssistantReply = {
  answer: string;
  intent: string;
  confidence: number;
  source: string;
  rows?: { ref?: string; title?: string; [k: string]: unknown }[];
  stats?: Record<string, unknown>;
};

export async function staffComplaints(params?: { status?: string; cat?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.cat) qs.set("cat", params.cat);
  if (params?.q) qs.set("q", params.q);
  const res = await fetch(`${API_URL}/api/complaints?${qs}`, { headers: await authHeaders() });
  return ((await parse(res)).complaints ?? []) as Complaint[];
}

export async function engineers() {
  const res = await fetch(`${API_URL}/api/engineers`, { headers: await authHeaders() });
  return ((await parse(res)).engineers ?? []) as Engineer[];
}

export async function clusters() {
  const res = await fetch(`${API_URL}/api/clusters`, { headers: await authHeaders() });
  const body = await parse(res);
  return body as {
    radiusM: number;
    clusters: Cluster[];
    summary: { openComplaints: number; clusters: number; complaintsInClusters: number; visitsSaved: number };
  };
}

export async function assignmentPlan() {
  const res = await fetch(`${API_URL}/api/assignment`, { headers: await authHeaders() });
  return (await parse(res)) as {
    assignments: Assignment[];
    unassigned: { ref: string; title: string }[];
    totalCost: number;
    totalDistanceKm: number;
    naiveTotalCost: number;
    naiveTotalDistanceKm: number;
    costImprovementPct: number;
  };
}

export async function applyAssignment() {
  const res = await fetch(`${API_URL}/api/assignment/apply`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return (await parse(res)) as { applied?: number; assigned?: number };
}

export async function auditLogs() {
  const res = await fetch(`${API_URL}/api/audit-logs`, { headers: await authHeaders() });
  return ((await parse(res)).logs ?? []) as AuditLog[];
}

/** Move a complaint along the workflow. The server owns which moves are legal. */
export async function transition(ref: string, to: string) {
  const res = await fetch(`${API_URL}/api/complaints/${ref}/transition`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ to }),
  });
  return await parse(res);
}

export async function askAssistant(message: string) {
  const res = await fetch(`${API_URL}/api/assistant`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return (await parse(res)) as AssistantReply;
}

/**
 * Which moves this role may make from this status.
 *
 * A copy of the server's state machine, used only to decide which buttons to
 * draw. The server checks again and rejects anything it does not like, so a
 * stale copy here shows a button that fails politely rather than one that
 * quietly does the wrong thing.
 */
export const TRANSITIONS: Record<string, { to: string; label: string; roles: string[] }[]> = {
  SUBMITTED: [
    { to: "ASSIGNED", label: "Assign engineer", roles: ["SUPERVISOR", "ADMINISTRATOR"] },
    { to: "REJECTED", label: "Reject", roles: ["SUPERVISOR", "ADMINISTRATOR"] },
  ],
  ASSIGNED: [
    { to: "IN_PROGRESS", label: "Start work", roles: ["ENGINEER", "SUPERVISOR", "ADMINISTRATOR"] },
  ],
  IN_PROGRESS: [
    { to: "PENDING_REVIEW", label: "Mark complete", roles: ["ENGINEER", "SUPERVISOR", "ADMINISTRATOR"] },
  ],
  PENDING_REVIEW: [
    { to: "CLOSED", label: "Approve closure", roles: ["SUPERVISOR", "ADMINISTRATOR"] },
    { to: "IN_PROGRESS", label: "Send back for rework", roles: ["SUPERVISOR", "ADMINISTRATOR"] },
  ],
  CLOSED: [],
  REJECTED: [],
};

export const STAFF_ROLES = ["SUPERVISOR", "ADMINISTRATOR", "ENGINEER"];
export const isStaff = (role?: string | null) => STAFF_ROLES.includes(String(role ?? "").toUpperCase());

export type PotholeMeasurement = {
  label: string;
  lengthM: number;
  widthM: number;
  depthM: number;
  source: "MEASURED" | "ESTIMATED";
};

export type RoadType = "BITUMINOUS" | "CONCRETE";

/**
 * Record what the engineer measured on site.
 *
 * Submitted as the whole list, because the server replaces wholesale: an edit
 * that removes a row has to remove it there too, and sending a delta would
 * leave a deleted pothole in the material order.
 */
export async function saveMeasurements(
  ref: string,
  roadType: RoadType,
  potholes: PotholeMeasurement[],
) {
  const res = await fetch(`${API_URL}/api/complaints/${ref}/measurements`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ roadType, potholes }),
  });
  return await parse(res);
}

/**
 * What the detector thinks the dimensions are, from the photograph alone.
 *
 * Offered as a starting point for the form, never as the answer: the server
 * marks anything from here as ESTIMATED, and an engineer standing over the
 * hole with a tape measure should overwrite it.
 */
export async function suggestDimensions(ref: string) {
  const res = await fetch(`${API_URL}/api/complaints/${ref}/suggest-dimensions`, {
    headers: await authHeaders(),
  });
  return (await parse(res)) as { potholes: PotholeMeasurement[]; note: string };
}

export async function estimateFor(ref: string) {
  const res = await fetch(`${API_URL}/api/complaints/${ref}/estimate`, {
    headers: await authHeaders(),
  });
  return await parse(res);
}
