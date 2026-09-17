import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

const proxySecret = "production-proxy-secret-value-32ch";
const app = buildApp(loadEnvironment({
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_FRONTEND_URL: "https://ashvi.vercel.app",
  ASHVI_PROXY_SECRET: proxySecret,
}), { withDatabase: false });

afterAll(async () => {
  await app.close();
});

describe("production proxy gate", () => {
  it("keeps health public and rejects protected routes without the proxy secret", async () => {
    await app.ready();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);

    const blocked = await app.inject({ method: "GET", url: "/api/conversations" });
    expect(blocked.statusCode).toBe(403);

    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "x", code: "y", password: "z" } });
    expect(login.statusCode).toBe(403);
  });

  it("forwards authorized proxy traffic past the gate", async () => {
    await app.ready();
    const proxied = await app.inject({
      method: "GET",
      url: "/api/conversations",
      headers: { "x-ashvi-proxy-key": proxySecret },
    });
    expect(proxied.statusCode).not.toBe(403);
  });
});
