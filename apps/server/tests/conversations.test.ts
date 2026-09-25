import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";
import type { AIProvider } from "../src/ai/provider.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

// Test with default NoopAIProvider (no AI configured)
const app = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }));

// Test with a working mock provider
const mockProvider: AIProvider = {
  id: "mock",
  name: "Mock Provider",
  async isAvailable() { return true; },
  async chat(_messages: any[]) {
    return { content: "Mock response", modelUsed: "mock-model" };
  },
  async *chatStream(_messages: any[]) {
    yield { content: "Mock ", sources: undefined, searchUsed: false };
    yield { content: "response", sources: undefined, searchUsed: false, done: true };
  },
};
const mockApp = buildApp(loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }), { provider: mockProvider });

beforeAll(async () => {
  await app.ready();
  await mockApp.ready();
});
afterAll(async () => {
  await app.close();
  await mockApp.close();
});

describe("conversation API", () => {
  it("creates, reads, renames, and deletes a conversation", async () => {
    const created = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: "Test conversation" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    expect((await app.inject({ method: "PATCH", url: `/api/conversations/${id}`, payload: { title: "Renamed" } })).json().title).toBe("Renamed");
    expect((await app.inject({ method: "DELETE", url: `/api/conversations/${id}` })).statusCode).toBe(204);
  });

  it("returns AI_PROVIDER_NOT_CONFIGURED when sending message without AI provider", async () => {
    const created = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: "Test conversation" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const response = await app.inject({ method: "POST", url: `/api/conversations/${id}/messages`, payload: { content: "Hello Ashvi" } });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "AI_PROVIDER_NOT_CONFIGURED" } });

    // Verify no assistant message was persisted
    const loaded = await app.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages).toHaveLength(1);
    expect(loaded.json().messages[0].role).toBe("USER");
  });

  it("streams AI_PROVIDER_NOT_CONFIGURED error over SSE when no AI provider", async () => {
    const created = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: "Streaming conversation" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const stream = await app.inject({ method: "POST", url: `/api/conversations/${id}/messages/stream`, payload: { content: "Give me a short answer." } });

    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    const events = stream.payload.split("\n\n").filter(Boolean).map((event) => JSON.parse(event.replace(/^data:\s*/, "")));
    const errorEvent = events.find((event: { type?: string; code?: string }) => event.type === "error" && event.code === "AI_PROVIDER_NOT_CONFIGURED");
    expect(errorEvent).toBeDefined();
  });

  it("streams private messages via ephemeral-stream returns AI_PROVIDER_NOT_CONFIGURED", async () => {
    const stream = await app.inject({
      method: "POST",
      url: "/api/conversations/ephemeral-stream",
      payload: {
        messages: [{ role: "user", content: "Barbie and Shambhavi ephemeral test" }],
        language: "en",
      },
    });

    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    const events = stream.payload.split("\n\n").filter(Boolean).map((event) => JSON.parse(event.replace(/^data:\s*/, "")));
    const errorEvent = events.find((event: { type?: string; code?: string }) => event.type === "error" && event.code === "AI_PROVIDER_NOT_CONFIGURED");
    expect(errorEvent).toBeDefined();
  });

  it("works with a custom AI provider when configured", async () => {
    const created = await mockApp.inject({ method: "POST", url: "/api/conversations", payload: { title: "Test with mock provider" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const response = await mockApp.inject({ method: "POST", url: `/api/conversations/${id}/messages`, payload: { content: "Hello" } });
    expect(response.statusCode).toBe(201);
    expect(response.json().assistant.content).toBe("Mock response");

    const loaded = await mockApp.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages).toHaveLength(2);
    expect(loaded.json().messages[1].role).toBe("ASSISTANT");
    expect(loaded.json().messages[1].content).toBe("Mock response");
  }, 20000);

  it("streams messages over SSE with a custom AI provider", async () => {
    const created = await mockApp.inject({ method: "POST", url: "/api/conversations", payload: { title: "Streaming with mock provider" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const stream = await mockApp.inject({ method: "POST", url: `/api/conversations/${id}/messages/stream`, payload: { content: "Give me a short answer." } });

    expect(stream.statusCode).toBe(200);
    expect(stream.headers["content-type"]).toContain("text/event-stream");
    const events = stream.payload.split("\n\n").filter(Boolean).map((event) => JSON.parse(event.replace(/^data:\s*/, "")));
    const chunks = events.filter((event: { type?: string }) => event.type === "chunk");
    const done = events.find((event: { type?: string }) => event.type === "done");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((event: { content?: string }) => Boolean(event.content?.trim()))).toBe(true);
    expect(done?.assistant?.content?.trim()).toBe("Mock response");

    const loaded = await mockApp.inject({ method: "GET", url: `/api/conversations/${id}` });
    expect(loaded.json().messages.at(-1).content.trim()).toBe(done.assistant.content.trim());
  }, 30000);

  it("returns HTTP 400 for invalid request bodies", async () => {
    const response = await app.inject({ method: "POST", url: "/api/conversations", payload: { title: 42 } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
