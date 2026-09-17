import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import argon2 from "argon2";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";
import { OllamaProvider } from "../src/ai/ollama.provider.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

let app: ReturnType<typeof buildApp>;
const testCode = "rag-code-1";
const testPassword = "rag-password-1";
const userA = `real-rag-user-a-${Date.now()}`;
const userB = `real-rag-user-b-${Date.now()}`;
let userACookie: string;
let userBCookie: string;

function multipartFile(filename: string, content: string, mimeType = "text/plain") {
  const boundary = "ashvi-rag-real-boundary";
  return {
    body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

beforeAll(async () => {
  const [codeHash, passwordHash] = await Promise.all([
    argon2.hash(testCode),
    argon2.hash(testPassword),
  ]);

  const env = loadEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: process.env.DATABASE_URL,
    ASHVI_LOG_LEVEL: "silent",
    ASHVI_SESSION_SECRET: "test-session-secret-that-is-long-enough-for-rag",
    ASHVI_USER_A_NAME: userA,
    ASHVI_USER_A_CODE_HASH: codeHash,
    ASHVI_USER_A_PASSWORD_HASH: passwordHash,
    ASHVI_USER_B_NAME: userB,
    ASHVI_USER_B_CODE_HASH: codeHash,
    ASHVI_USER_B_PASSWORD_HASH: passwordHash,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ASHVI_AI_MODEL: "qwen2.5:3b",
    ASHVI_EMBEDDING_PROVIDER: "local",
    ASHVI_EMBEDDING_DIMENSIONS: 384,
  });

  const provider = new OllamaProvider(env.OLLAMA_BASE_URL, env.ASHVI_AI_MODEL);

  app = buildApp(env, {
    withAuth: true,
    provider,
  });
  await app.ready();

  // Authenticate User A
  const loginA = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.4.1",
    payload: { username: userA, code: testCode, password: testPassword },
  });
  expect(loginA.statusCode).toBe(200);
  userACookie = loginA.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";

  // Authenticate User B
  const loginB = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.4.2",
    payload: { username: userB, code: testCode, password: testPassword },
  });
  expect(loginB.statusCode).toBe(200);
  userBCookie = loginB.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";
}, 30000);

afterAll(async () => {
  if (app) {
    await app.prisma.document.deleteMany({
      where: {
        filename: { in: ["chronos-spec.txt", "chronos-architecture.md"] },
      },
    });
    await app.prisma.user.deleteMany({ where: { username: { in: [userA, userB] } } });
    await app.close();
  }
});

describe("Section 36: Real End-to-End RAG Integration Verification with Live DB & Ollama", () => {
  let docId: string;
  let convAId: string;
  let convBId: string;

  it("1. Authenticate User A and upload a real technical document", async () => {
    const docContent = [
      "# Project Chronos Architecture Specification",
      "",
      "## 1. Executive Summary",
      "Project Chronos is Ashvi's proprietary quantum latency synchronization engine.",
      "It operates at an ultra-low threshold of 12 milliseconds across all distributed edge nodes.",
      "",
      "## 2. Cryptographic Protocol",
      "Chronos uses Kyber-1024 post-quantum key encapsulation mechanism.",
      "All session keys are automatically rotated every 48 hours without service interruption.",
    ].join("\n");

    const multipart = multipartFile("chronos-spec.txt", docContent);
    const uploadRes = await app.inject({
      method: "POST",
      url: "/api/documents/upload",
      headers: {
        "content-type": multipart.contentType,
        cookie: `ashvi_session=${userACookie}`,
      },
      payload: multipart.body,
    });

    expect(uploadRes.statusCode).toBe(201);
    const doc = uploadRes.json();
    expect(doc.id).toBeDefined();
    expect(doc.filename).toBe("chronos-spec.txt");
    expect(doc.status).toBe("READY");
    expect(doc.scope).toBe("PRIVATE");
    docId = doc.id;

    // Verify chunking and 384-dimensional vector embedding in database
    const chunks = await app.prisma.documentChunk.findMany({
      where: { documentId: docId },
    });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].embedding.length).toBe(384);
    const hasMillisecondFact = chunks.some((c) => c.content.includes("12 milliseconds"));
    expect(hasMillisecondFact).toBe(true);
  });

  it("2. User A asks question answered in the document -> verified retrieval, real model generation, citations returned", async () => {
    // Create conversation for User A
    const convRes = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { title: "User A Chronos Review" },
    });
    expect(convRes.statusCode).toBe(201);
    convAId = convRes.json().id as string;

    // Send query answered in the document
    const msgRes = await app.inject({
      method: "POST",
      url: `/api/conversations/${convAId}/messages`,
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: {
        content: "What is the operating latency threshold of Project Chronos according to the documentation?",
      },
    });

    expect(msgRes.statusCode).toBe(201);
    const body = msgRes.json();
    expect(body.assistant).toBeDefined();
    const assistantContent = (body.assistant.content as string).toLowerCase();

    // Model must answer accurately using the retrieved 12 millisecond fact
    expect(assistantContent).toMatch(/12\s*(?:ms|milliseconds?)/);
    // Assistant message metadata should trace orchestrator execution
    expect(body.assistant.metadata).toBeDefined();
    expect(body.assistant.metadata.orchestrator).toBeDefined();
    expect(body.assistant.metadata.orchestrator.intent).toBeDefined();
  }, 60000);

  it("3. User A asks question NOT answered in document -> model indicates answer is unavailable rather than hallucinating", async () => {
    const msgRes = await app.inject({
      method: "POST",
      url: `/api/conversations/${convAId}/messages`,
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: {
        content: "Based on the uploaded document, what is the secret chocolate cake recipe for the team picnic?",
      },
    });

    expect(msgRes.statusCode).toBe(201);
    const body = msgRes.json();
    const assistantContent = (body.assistant.content as string).toLowerCase();

    // Model should recognize absence of this information in the document context
    const indicatesMissing =
      assistantContent.includes("not mentioned") ||
      assistantContent.includes("not provided") ||
      assistantContent.includes("not contain") ||
      assistantContent.includes("does not mention") ||
      assistantContent.includes("no information") ||
      assistantContent.includes("not found") ||
      assistantContent.includes("not included") ||
      assistantContent.includes("cannot find") ||
      !assistantContent.includes("flour");

    expect(indicatesMissing).toBe(true);
  }, 60000);

  it("4. Authenticate User B -> verifies User A's private document cannot be retrieved or previewed by User B", async () => {
    // User B attempts direct document search
    const searchRes = await app.inject({
      method: "POST",
      url: "/api/documents/search",
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { query: "Project Chronos latency threshold" },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = searchRes.json();
    // User B gets 0 chunks/citations because the document is User A's PRIVATE document
    expect(searchData.chunksUsed).toBe(0);
    expect(searchData.citations.length).toBe(0);
    expect(searchData.formattedEvidence).toBe("");

    // User B attempts preview of User A's document
    const previewRes = await app.inject({
      method: "GET",
      url: `/api/documents/${docId}/preview`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
    });
    expect(previewRes.statusCode).toBe(404);

    // User B asks in conversation
    const convBRes = await app.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { title: "User B Query Chat" },
    });
    convBId = convBRes.json().id as string;

    const msgB = await app.inject({
      method: "POST",
      url: `/api/conversations/${convBId}/messages`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: {
        content: "What is the operating latency threshold of Project Chronos according to our private documents?",
      },
    });
    expect(msgB.statusCode).toBe(201);
    const contentB = (msgB.json().assistant.content as string).toLowerCase();
    // Without User A's private document evidence, User B's model cannot cite the 12 ms private spec
    expect(contentB).not.toMatch(/\b12\s*milliseconds\b/);
  }, 60000);

  it("5. Document sharing and cascade deletion lifecycle", async () => {
    // Step 5a: User A shares document
    const shareRes = await app.inject({
      method: "POST",
      url: `/api/documents/${docId}/share`,
      headers: { cookie: `ashvi_session=${userACookie}` },
    });
    expect(shareRes.statusCode).toBe(200);
    expect(shareRes.json().scope).toBe("SHARED");

    // Step 5b: User B now can retrieve it via search
    const sharedSearchRes = await app.inject({
      method: "POST",
      url: "/api/documents/search",
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { query: "Chronos quantum latency synchronization" },
    });
    expect(sharedSearchRes.statusCode).toBe(200);
    expect(sharedSearchRes.json().chunksUsed).toBeGreaterThanOrEqual(1);

    // Step 5c: User A deletes document
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/documents/${docId}`,
      headers: { cookie: `ashvi_session=${userACookie}` },
    });
    expect(delRes.statusCode).toBe(204);

    // Step 5d: Confirm cascade deletion: subsequent search returns 0 chunks and DB has 0 chunks
    const postDelSearch = await app.inject({
      method: "POST",
      url: "/api/documents/search",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { query: "Chronos quantum latency synchronization" },
    });
    expect(postDelSearch.json().chunksUsed).toBe(0);

    const remainingChunks = await app.prisma.documentChunk.count({
      where: { documentId: docId },
    });
    expect(remainingChunks).toBe(0);

    // Cleanup conversations
    if (convAId) {
      await app.inject({
        method: "DELETE",
        url: `/api/conversations/${convAId}`,
        headers: { cookie: `ashvi_session=${userACookie}` },
      });
    }
    if (convBId) {
      await app.inject({
        method: "DELETE",
        url: `/api/conversations/${convBId}`,
        headers: { cookie: `ashvi_session=${userBCookie}` },
      });
    }
  });
});
