export interface ConfigIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  issues: ConfigIssue[];
  constructor(message: string, status: number, issues: ConfigIssue[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

/** JSON request to /api/admin/*. An expired session sends the browser back to the sign-in page. */
export async function api<T = Record<string, unknown>>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401 && !path.startsWith("login")) {
    window.location.href = "/admin/login";
  }
  if (!res.ok) {
    throw new ApiError(typeof data.error === "string" ? data.error : `Request failed (${res.status})`, res.status, Array.isArray(data.issues) ? (data.issues as ConfigIssue[]) : []);
  }
  return data as T;
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Uploads an image or video for use as a background; resolves to its URL. */
export async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {}
  if (res.status === 401) window.location.href = "/admin/login";
  if (!res.ok || typeof data.url !== "string") {
    // A proxy in front of the panel may refuse large bodies before the app sees them.
    throw new ApiError(typeof data.error === "string" ? data.error : res.status === 413 ? "The file is larger than your server or proxy accepts." : `Upload failed (${res.status})`, res.status);
  }
  return data.url;
}
