export type HealthResponse = {
  status: "ok";
  service: string;
  database: "ready" | "not-configured";
  timestamp: string;
};

export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const envUrl = process.env.NEXT_PUBLIC_ASHVI_API_URL;
    let port = "4000";
    if (envUrl) {
      try {
        const parsed = new URL(envUrl);
        if (parsed.port) port = parsed.port;
        if (!parsed.hostname.includes("127.0.0.1") && !parsed.hostname.includes("localhost")) {
          return envUrl.replace(/\/+$/, "");
        }
      } catch {
        // fallback
      }
    }
    // Local development on localhost / 127.0.0.1
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `${window.location.protocol}//${window.location.hostname}:${port}`;
    }
    // Remote / Vercel deployment: use configured env URL or relative path for Next.js rewrites
    if (envUrl) {
      return envUrl.replace(/\/+$/, "");
    }
    return "";
  }
  const fallback = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? process.env.ASHVI_API_URL ?? "http://127.0.0.1:4000";
  return fallback.replace(/\/+$/, "");
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/health`, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("The Ashvi backend is unavailable.");
  }
  return response.json() as Promise<HealthResponse>;
}
