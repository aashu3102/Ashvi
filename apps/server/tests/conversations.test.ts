import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const app = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }));

beforeAll(async () => app.ready());
afterAll(async () => app.close());

describe("conversation API", () => {
  it("creates, reads, renames, messages, and deletes a conversation", async () => {
    // Local Ollama responses take longer than the default Vitest timeout on a small CPU-only setup.
    const created = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: "Test conversation" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    expect((await app.inject({ method: "POST", url: `/api/conversations/${id}/messages`, payload: { content: "Hello Ashvi" } })).statusCode).toBe(201);
    const loaded = await app.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages).toHaveLength(2);
    expect(loaded.json().messages.some((message: { role: string; content: string }) => message.role === "USER")).toBe(true);
    expect(loaded.json().messages.some((message: { role: string; content: string }) => message.role === "ASSISTANT")).toBe(true);
    expect((await app.inject({ method: "PATCH", url: `/api/conversations/${id}`, payload: { title: "Renamed" } })).json().title).toBe("Renamed");
    expect((await app.inject({ method: "DELETE", url: `/api/conversations/${id}` })).statusCode).toBe(204);
  }, 20000);

  it("streams messages over SSE for the active chat client", async () => {
    const created = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: "Streaming conversation" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const stream = await app.inject({ method: "POST", url: `/api/conversations/${id}/messages/stream`, payload: { content: "Give me a short answer." } });

    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    expect(stream.payload).toContain("data:");
  }, 30000);
});
