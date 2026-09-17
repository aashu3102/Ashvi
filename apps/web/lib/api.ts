export type HealthResponse = {
  status: "ok";
  service: string;
  database: "ready" | "not-configured";
  timestamp: string;
};

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_ASHVI_API_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://127.0.0.1:4000";
    }
  }
  return "";
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/health`, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("The Ashvi backend is unavailable.");
  }
  return response.json() as Promise<HealthResponse>;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("ashvi_token");
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("ashvi_token", token);
  } catch {
    // ignore
  }
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("ashvi_token");
  } catch {
    // ignore
  }
}

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
