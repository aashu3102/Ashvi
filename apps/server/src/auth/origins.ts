import type { Environment } from "../config/env.js";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function resolveAllowedOrigins(environment: Environment) {
  const origins = new Set<string>();
  const add = (value?: string) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const origin = normalizeOrigin(part);
      if (origin) origins.add(origin);
    }
  };

  add(environment.ASHVI_FRONTEND_URL);
  add(environment.ASHVI_ALLOWED_ORIGINS);

  if (environment.NODE_ENV !== "production") {
    add("http://localhost:3000,http://127.0.0.1:3000,http://localhost:3005,http://127.0.0.1:3005");
  }

  return origins;
}

export function isAllowedBrowserOrigin(origin: string | undefined, allowedOrigins: Set<string>) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.has(normalized)) return true;
  if (normalized.endsWith(".vercel.app") || /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalized)) return true;
  if (normalized.endsWith(".workers.dev") || /^https:\/\/[a-zA-Z0-9_-]+\.workers\.dev$/.test(normalized)) return true;
  if (normalized.includes("trycloudflare.com")) return true;
  if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) return true;
  return false;
}
