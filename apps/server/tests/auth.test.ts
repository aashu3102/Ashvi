import { afterAll, beforeAll, describe, expect, it } from "vitest";
import argon2 from "argon2";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

let app: ReturnType<typeof buildApp>;
const code = "test-code";
const password = "test-password";
const userA = `security-test-a-${Date.now()}`;
const userB = `security-test-b-${Date.now()}`;

beforeAll(async () => {
  const [codeHash, passwordHash] = await Promise.all([argon2.hash(code), argon2.hash(password)]);
  app = buildApp(loadEnvironment({
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
  }), { withAuth: true });
  await app.ready();
});

afterAll(async () => {
  if (!app) return;
  await app.prisma.user.deleteMany({ where: { username: { in: [userA, userB] } } });
  await app.close();
});

describe("private access boundary", () => {
  it("rejects protected API access without a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/conversations" });
    expect(response.statusCode).toBe(401);

    const upload = await app.inject({ method: "POST", url: "/api/documents/upload" });
    expect(upload.statusCode).toBe(401);
  });

  it("locks an identity after three failed attempts", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: userA, code: "wrong", password: "wrong" } });
      expect(response.statusCode).toBe(401);
    }

    const locked = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: userA, code, password } });
    expect(locked.statusCode).toBe(401);
    expect(locked.json().error.message).toBe("Access could not be verified.");
  });

  it("allows a valid independent identity to authenticate", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/login", remoteAddress: "10.0.0.2", payload: { username: userB, code, password } });
    expect(response.statusCode).toBe(200);
    expect(response.cookies.some((cookie) => cookie.name === "ashvi_session" && cookie.httpOnly)).toBe(true);
  });

  it("blocks repeated failures from the same IP signal", async () => {
    const remoteAddress = "10.0.0.44";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await app.inject({ method: "POST", url: "/api/auth/login", remoteAddress, payload: { username: "unknown-user", code: "wrong", password: "wrong" } });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await app.inject({ method: "POST", url: "/api/auth/login", remoteAddress, payload: { username: userB, code, password } });
    expect(blocked.statusCode).toBe(401);
  });

  it("does not allow one identity to open another user's conversation", async () => {
    const login = await app.inject({ method: "POST", url: "/api/auth/login", remoteAddress: "10.0.0.3", payload: { username: userB, code, password } });
    const foreignUser = await app.prisma.user.create({ data: { username: `foreign-${Date.now()}`, name: "Foreign test user" } });
    const foreignConversation = await app.prisma.conversation.create({ data: { userId: foreignUser.id, title: "Private conversation" } });
    const foreignDocument = await app.prisma.document.create({ data: { userId: foreignUser.id, filename: "private.txt", mimeType: "text/plain", storagePath: `private-${Date.now()}.txt`, status: "READY" } });
    await app.prisma.documentChunk.create({ data: { documentId: foreignDocument.id, chunkIndex: 0, content: "private document", tokenCount: 2 } });
    const cookie = login.cookies.find((item) => item.name === "ashvi_session")?.value;
    const response = await app.inject({ method: "GET", url: `/api/conversations/${foreignConversation.id}`, headers: { cookie: `ashvi_session=${cookie}` } });
    const documentResponse = await app.inject({ method: "GET", url: `/api/documents/${foreignDocument.id}/preview`, headers: { cookie: `ashvi_session=${cookie}` } });

    expect(response.statusCode).toBe(404);
    expect(documentResponse.statusCode).toBe(404);
    await app.prisma.user.delete({ where: { id: foreignUser.id } });
  });
});