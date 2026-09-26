import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

const fakeEnv = loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
});

describe("POST /api/images/generate route", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(fakeEnv, { withDatabase: false });
    const res = await app.inject({
      method: "POST",
      url: "/api/images/generate",
      payload: { prompt: "a cute robot" },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 400 on invalid payload", async () => {
    const app = buildApp(fakeEnv, { withDatabase: false });
    // Simulate authenticated user via decorator
    app.addHook("onRequest", async (req) => {
      req.userId = "user-123";
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/images/generate",
      payload: { prompt: "" },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 503 when image service is disabled", async () => {
    const disabledEnv = loadEnvironment({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      ASHVI_LOG_LEVEL: "silent",
      ASHVI_IMAGE_PROVIDER: "disabled",
    });

    const app = buildApp(disabledEnv, { withDatabase: false });
    app.addHook("onRequest", async (req) => {
      req.userId = "user-123";
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/images/generate",
      payload: { prompt: "a sunset over mountains" },
    });

    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.error.code).toBe("IMAGE_PROVIDER_UNAVAILABLE");
  });

  it("returns 200 with generated images when service is available", async () => {
    const app = buildApp(fakeEnv, { withDatabase: false });
    app.addHook("onRequest", async (req) => {
      req.userId = "user-123";
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/images/generate",
      payload: { prompt: "a neon cyberpunk street", aspectRatio: "16:9" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.prompt).toBe("a neon cyberpunk street");
    expect(body.model).toBe("pollinations-flux");
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images.length).toBe(1);
    expect(body.images[0].url).toContain("pollinations.ai");
  });
});
