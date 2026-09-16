export type HealthResponse = {
  status: "ok";
  service: string;
  database: "ready" | "not-configured";
  timestamp: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_ASHVI_API_URL ?? "http://127.0.0.1:4000";

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error("The Ashvi backend is unavailable.");
  }
  return response.json() as Promise<HealthResponse>;
}
