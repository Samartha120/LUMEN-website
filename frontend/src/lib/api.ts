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

export const api = {
  get: (path: string) => fetch(`/api${path}`, { credentials: "include" }).then(handle),
  post: (path: string, body?: unknown) =>
    fetch(`/api${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(handle),
  upload: (path: string, form: FormData) =>
    fetch(`/api${path}`, { method: "POST", credentials: "include", body: form }).then(handle),
};
