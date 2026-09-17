export type HealthResponse = {
  status: "ok";
  service: string;
  database: "ready" | "not-configured";
  timestamp: string;
};

export function getApiBaseUrl(): string {
  return "";
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/health`, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("The Ashvi backend is unavailable.");
  }
  return response.json() as Promise<HealthResponse>;
}

export function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...extra };
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("ashvi_token");
  } catch {
    // ignore leftover client tokens from previous deployments
  }
}
