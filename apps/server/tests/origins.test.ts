import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { isAllowedBrowserOrigin, resolveAllowedOrigins } from "../src/auth/origins.js";

describe("CORS origin allowlist", () => {
  it("allows only the configured frontend origin in production", () => {
    const environment = loadEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      ASHVI_FRONTEND_URL: "https://ashvi.vercel.app",
      ASHVI_ALLOWED_ORIGINS: "https://ashvi.example",
    });
    const allowed = resolveAllowedOrigins(environment);

    expect(isAllowedBrowserOrigin("https://ashvi.vercel.app", allowed)).toBe(true);
    expect(isAllowedBrowserOrigin("https://ashvi.example", allowed)).toBe(true);
    expect(isAllowedBrowserOrigin("http://localhost:3000", allowed)).toBe(false);
    expect(isAllowedBrowserOrigin("https://random.vercel.app", allowed)).toBe(false);
    expect(isAllowedBrowserOrigin("https://preview.trycloudflare.com", allowed)).toBe(false);
    expect(isAllowedBrowserOrigin(undefined, allowed)).toBe(true);
  });
});
