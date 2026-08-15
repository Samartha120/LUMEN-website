// Single fetch wrapper for the backend REST API. Same-origin via the Vite
// proxy, so credentials (the auth cookie) flow automatically.

async function handle(res: Response) {
  if (res.status === 401) throw new ApiError("Not authenticated.", 401);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const getHeaders = (isUpload = false) => {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!isUpload) {
    
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

export const api = {
  get: (path: string) =>
    fetch(`/api${path}`, {
      headers: getHeaders(),
    }).then(handle),
  post: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
  patch: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
  upload: (path: string, form: FormData) =>
    fetch(`/api${path}`, {
      method: "POST",
      headers: getHeaders(true),
      body: form,
    }).then(handle),
};
