function readConfiguredApiUrl(): string {
  const candidates = [
    import.meta.env.VITE_API_URL,
    import.meta.env.VITE_API_BASE_URL,
  ];

  return candidates.find(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  )?.trim() ?? "";
}

function normalizeApiBaseUrl(value: string): string {
  const withoutTrailingSlashes = value.replace(/\/+$/, "");

  // The generated client owns the `/api/...` path. Accepting an API URL
  // ending in `/api` avoids producing `/api/api/motors` when the Vercel
  // environment variable contains the backend path instead of only its
  // origin.
  return withoutTrailingSlashes.replace(/\/api$/i, "");
}

const apiBaseUrl = normalizeApiBaseUrl(readConfiguredApiUrl());

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

export function apiFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  if (typeof input !== "string") return fetch(input, init);
  return fetch(apiUrl(input), init);
}