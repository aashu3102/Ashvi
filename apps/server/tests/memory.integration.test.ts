import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const app = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }));

beforeAll(async () => app.ready());
afterAll(async () => {
  await app.prisma.memory.deleteMany({ where: { content: { startsWith: "integration memory" } } });
  await app.close();
});

describe("memory CRUD API", () => {
  it("creates, reads, updates, and deletes a memory", async () => {
    const created = await app.inject({ method: "POST", url: "/api/memory", payload: { content: "integration memory", category: "FACT", source: "USER", importance: 4 } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    expect((await app.inject({ method: "GET", url: "/api/memory" })).json().some((item: { id: string }) => item.id === id)).toBe(true);
    const updated = await app.inject({ method: "PATCH", url: `/api/memory/${id}`, payload: { content: "integration memory updated", importance: 5 } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ content: "integration memory updated", importance: 5 });
    expect((await app.inject({ method: "DELETE", url: `/api/memory/${id}` })).statusCode).toBe(204);
    expect((await app.inject({ method: "PATCH", url: `/api/memory/${id}`, payload: { content: "gone" } })).statusCode).toBe(404);
  });
});