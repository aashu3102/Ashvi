import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

const app = buildApp(loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
}), { withDatabase: false });

afterEach(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("reports service health", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "ashvi-server", database: "not-configured" });
  });
});
