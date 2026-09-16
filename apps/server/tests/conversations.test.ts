import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";
import type { AIProvider } from "../src/ai/provider.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
const app = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }));
const failingProvider: AIProvider = {
  async chat() { throw new Error("provider unavailable"); },
  async *chatStream() { throw new Error("provider unavailable"); },
};
const failingApp = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }), { provider: failingProvider });

beforeAll(async () => {
  await app.ready();
  await failingApp.ready();
});
afterAll(async () => {
  await app.close();
  await failingApp.close();
});

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
    const events = stream.payload.split("\n\n").filter(Boolean).map((event) => JSON.parse(event.replace(/^data:\s*/, "")));
    const chunks = events.filter((event: { type?: string }) => event.type === "chunk");
    const done = events.find((event: { type?: string }) => event.type === "done");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((event: { content?: string }) => Boolean(event.content?.trim()))).toBe(true);
    expect(done?.assistant?.content?.trim()).toBeTruthy();

    const loaded = await app.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages.at(-1).content.trim()).toBe(done.assistant.content.trim());
  }, 30000);

  it("reports provider failure without persisting a false assistant response", async () => {
    const created = await failingApp.inject({ method: "POST", url: "/api/conversations", payload: {} });
    const id = created.json().id as string;
    const stream = await failingApp.inject({ method: "POST", url: `/api/conversations/${id}/messages/stream`, payload: { content: "Hello" } });
    const events = stream.payload.split("\n\n").filter(Boolean).map((event) => JSON.parse(event.replace(/^data:\s*/, "")));
    expect(events.at(-1)).toMatchObject({ type: "error" });

    const loaded = await failingApp.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages.map((message: { role: string }) => message.role)).toEqual(["USER"]);
  });

  it("returns HTTP 400 for invalid request bodies", async () => {
    const response = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: 42 } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
