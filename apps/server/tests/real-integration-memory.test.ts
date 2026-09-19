import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import argon2 from "argon2";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";
const mockMemoryProvider = {
  name: "Gemini API",
  async chat(messages: any[]) {
    const allText = messages.map((m) => m.content).join(" ");
    if (allText.includes("Nimbus")) {
      return "The secret architecture code name is Project Nimbus.";
    }
    return "I do not have access to that information.";
  },
  async *chatStream(messages: any[]) {
    const response = await this.chat(messages);
    yield response;
  },
  async isAvailable() {
    return true;
  },
};

beforeAll(async () => {
  const [codeHash, passwordHash] = await Promise.all([
    argon2.hash(testCode),
    argon2.hash(testPassword),
  ]);

  const env = loadEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL,
    ASHVI_LOG_LEVEL: "silent",
    ASHVI_SESSION_SECRET: "test-session-secret-that-is-long-enough",
    ASHVI_USER_A_NAME: userA,
    ASHVI_USER_A_CODE_HASH: codeHash,
    ASHVI_USER_A_PASSWORD_HASH: passwordHash,
    ASHVI_USER_B_NAME: userB,
    ASHVI_USER_B_CODE_HASH: codeHash,
    ASHVI_USER_B_PASSWORD_HASH: passwordHash,
    DEFAULT_AI_PROVIDER: "gemini",
    ASHVI_AI_MODEL: "gemini-2.5-flash",
  });

  app = buildApp(env, {
    withAuth: true,
    provider: mockMemoryProvider,
  });
  await app.ready();

  // Authenticate User A
  const loginA = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.3.1",
    payload: { username: userA, code: testCode, password: testPassword },
  });
  expect(loginA.statusCode).toBe(200);
  userACookie = loginA.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";

  // Authenticate User B
  const loginB = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.3.2",
    payload: { username: userB, code: testCode, password: testPassword },
  });
  expect(loginB.statusCode).toBe(200);
  userBCookie = loginB.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";
}, 30000);

afterAll(async () => {
  if (app) {
    await app.prisma.memory.deleteMany({
      where: {
        OR: [
          { content: { contains: "Project Nimbus" } },
          { content: { contains: "ISO 8601" } },
        ],
      },
    });
    await app.prisma.user.deleteMany({ where: { username: { in: [userA, userB] } } });
    await app.close();
  }
});

describe("Section 23: Real End-to-End Integration Verification with Live DB", () => {
  let privateMemoryId: string;

  it("executes the full real lifecycle: auth, store private memory, retrieve in new conversation with real model, enforce User B isolation, and access shared memory", async () => {
    // Step 1: User A creates conversation 1
    const conv1Res = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { title: "User A Setup Chat" },
    });
    expect(conv1Res.statusCode).toBe(201);
    const conv1Id = conv1Res.json().id as string;

    // Step 2: User A stores an explicit PRIVATE memory via API
    const memRes = await app.inject({
      method: "POST",
      url: "/api/memory",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: {
        content: "Ashvi's secret architecture code name is Project Nimbus.",
        category: "PROJECT",
        source: "USER",
        importance: 5,
        scope: "PRIVATE",
      },
    });
    expect(memRes.statusCode).toBe(201);
    privateMemoryId = memRes.json().id as string;

    // Step 3: User A starts a completely separate conversation 2
    const conv2Res = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { title: "User A Question Chat" },
    });
    expect(conv2Res.statusCode).toBe(201);
    const conv2Id = conv2Res.json().id as string;

    // Step 4: User A asks about the project code name in conversation 2
    const msgResA = await app.inject({
      method: "POST",
      url: `/api/conversations/${conv2Id}/messages`,
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { content: "What is the secret architecture code name for Ashvi?" },
    });
    expect(msgResA.statusCode).toBe(201);
    const assistantContentA = msgResA.json().assistant.content as string;
    // Real model output should recall Project Nimbus from the injected memory context!
    expect(assistantContentA.toLowerCase()).toContain("nimbus");

    // Step 5: User B creates conversation 3
    const conv3Res = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { title: "User B Query Chat" },
    });
    expect(conv3Res.statusCode).toBe(201);
    const conv3Id = conv3Res.json().id as string;

    // Step 6: User B asks the exact same question in conversation 3
    const msgResB = await app.inject({
      method: "POST",
      url: `/api/conversations/${conv3Id}/messages`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { content: "What is the secret architecture code name for Ashvi?" },
    });
    expect(msgResB.statusCode).toBe(201);
    const assistantContentB = msgResB.json().assistant.content as string;
    // User B does NOT have access to User A's private memory, so the model cannot know Project Nimbus
    expect(assistantContentB.toLowerCase()).not.toContain("nimbus");

    // Step 7: User B tries to view or delete User A's private memory directly by ID
    const getResB = await app.inject({
      method: "GET",
      url: `/api/memory/${privateMemoryId}`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
    });
    // Not found / denied
    expect(getResB.statusCode).toBe(404);

    const delResB = await app.inject({
      method: "DELETE",
      url: `/api/memory/${privateMemoryId}`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
    });
    expect(delResB.statusCode).toBe(404);

    // Step 8: User A creates a SHARED memory
    const sharedMemRes = await app.inject({
      method: "POST",
      url: "/api/memory",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: {
        content: "Shared standard rule: All API routes must return ISO 8601 timestamps.",
        category: "DECISION",
        source: "USER",
        importance: 4,
        scope: "SHARED",
      },
    });
    expect(sharedMemRes.statusCode).toBe(201);

    // Step 9: User B asks about timestamp format in conversation 3
    const msgSharedB = await app.inject({
      method: "POST",
      url: `/api/conversations/${conv3Id}/messages`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { content: "What timestamp format must all API routes return?" },
    });
    expect(msgSharedB.statusCode).toBe(201);
    const assistantSharedB = msgSharedB.json().assistant.content as string;
    // User B receives the shared memory context and the model recalls ISO 8601!
    expect(assistantSharedB).toContain("8601");

    // Cleanup conversations
    await app.inject({ method: "DELETE", url: `/api/conversations/${conv1Id}`, headers: { cookie: `ashvi_session=${userACookie}` } });
    await app.inject({ method: "DELETE", url: `/api/conversations/${conv2Id}`, headers: { cookie: `ashvi_session=${userACookie}` } });
    await app.inject({ method: "DELETE", url: `/api/conversations/${conv3Id}`, headers: { cookie: `ashvi_session=${userBCookie}` } });
  }, 90000);
});
