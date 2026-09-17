import { afterAll, beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";
import { resolve } from "node:path";
import argon2 from "argon2";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";
import type { AIProvider } from "../src/ai/provider.js";
import {
  AshviOrchestrator,
  classifyIntent,
  planTask,
  verifyTaskResponse,
  OrchestratorExecutionError,
} from "../src/orchestrator/index.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

// Mock Providers for deterministic testing
const mockEchoProvider: AIProvider = {
  async chat(messages) {
    const last = messages.at(-1)?.content ?? "";
    return `Echo response to: ${last}`;
  },
  async *chatStream(messages) {
    const last = messages.at(-1)?.content ?? "";
    yield "Echo: ";
    yield last;
  },
};

const mockRiskyProvider: AIProvider = {
  async chat() {
    return "Without checking, I know for sure that this information is guaranteed to be 100% accurate.";
  },
};

const mockFailingProvider: AIProvider = {
  async chat() {
    throw new Error("Local Ollama connection failed: connection refused on port 11434");
  },
  async *chatStream() {
    throw new Error("Local Ollama connection failed: connection refused on port 11434");
  },
};

let app: ReturnType<typeof buildApp>;
let authApp: ReturnType<typeof buildApp>;
const testCode = "test-code-123";
const testPassword = "test-password-123";
const userA = `orchestrator-user-a-${Date.now()}`;
const userB = `orchestrator-user-b-${Date.now()}`;
let userACookie: string;
let userBCookie: string;

beforeAll(async () => {
  // 1. Standard test app without auth
  app = buildApp(
    loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }),
    { provider: mockEchoProvider }
  );
  await app.ready();

  // 2. Auth-enabled test app for auth and isolation testing
  const [codeHash, passwordHash] = await Promise.all([
    argon2.hash(testCode),
    argon2.hash(testPassword),
  ]);

  authApp = buildApp(
    loadEnvironment({
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
    }),
    { withAuth: true, provider: mockEchoProvider }
  );
  await authApp.ready();

  // Authenticate User A
  const loginA = await authApp.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.1.1",
    payload: { username: userA, code: testCode, password: testPassword },
  });
  userACookie = loginA.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";

  // Authenticate User B
  const loginB = await authApp.inject({
    method: "POST",
    url: "/api/auth/login",
    remoteAddress: "10.0.1.2",
    payload: { username: userB, code: testCode, password: testPassword },
  });
  userBCookie = loginB.cookies.find((c) => c.name === "ashvi_session")?.value ?? "";
});

afterAll(async () => {
  if (app) await app.close();
  if (authApp) {
    await authApp.prisma.user.deleteMany({ where: { username: { in: [userA, userB] } } });
    await authApp.close();
  }
});

describe("Ashvi Core Orchestrator", () => {
  // Test 1: Simple Conversation
  it("1. classifies and executes a simple general conversation via the fast path", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockEchoProvider,
      defaultModel: "qwen2.5:3b",
    });

    const prompt = "Hello Ashvi, good morning! How are you today?";
    const task = await orchestrator.execute({
      conversationId: "test-conv-1",
      prompt,
    });

    expect(task.intent).toBe("general_conversation");
    expect(task.classification.confidence).toBeGreaterThanOrEqual(0.5);
    expect(task.classification.complexity).toBe("simple");
    expect(task.plan.type).toBe("direct");
    expect(task.plan.steps).toHaveLength(1);
    expect(task.plan.steps[0].status).toBe("completed");
    expect(task.executionState).toBe("completed");
    expect(task.result?.content).toContain(prompt);

    // Verify all stage timestamps
    expect(task.timestamps.receivedAt).toBeDefined();
    expect(task.timestamps.classifiedAt).toBeDefined();
    expect(task.timestamps.plannedAt).toBeDefined();
    expect(task.timestamps.routedAt).toBeDefined();
    expect(task.timestamps.executedAt).toBeDefined();
    expect(task.timestamps.verifiedAt).toBeDefined();
    expect(task.timestamps.completedAt).toBeDefined();
  });

  // Test 2: Coding Request
  it("2. classifies coding intent and applies code-specific context instructions", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockEchoProvider,
    });

    const prompt = "Write a TypeScript function to debounce an async callback with generics";
    const classification = classifyIntent(prompt);

    expect(classification.intent).toBe("coding");
    expect(classification.confidence).toBeGreaterThanOrEqual(0.6);

    const task = await orchestrator.execute({
      conversationId: "test-conv-2",
      prompt,
    });

    expect(task.intent).toBe("coding");
    const systemTurn = task.context.recentMessages.find((m) => m.role === "system");
    expect(systemTurn?.content).toContain("software engineer");
    expect(systemTurn?.content).toContain("fenced code blocks");
    expect(task.executionState).toBe("completed");
  });

  // Test 3: Research Request
  it("3. classifies research intent and structures research synthesis prompt", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockEchoProvider,
    });

    const prompt = "Research and explain the history of distributed database consensus and literature review";
    const classification = classifyIntent(prompt);

    expect(classification.intent).toBe("research");
    expect(classification.confidence).toBeGreaterThanOrEqual(0.6);

    const task = await orchestrator.execute({
      conversationId: "test-conv-3",
      prompt,
    });

    expect(task.intent).toBe("research");
    const systemTurn = task.context.recentMessages.find((m) => m.role === "system");
    expect(systemTurn?.content).toContain("research assistant");
    expect(systemTurn?.content).toContain("evidence-grounded");
  });

  // Test 4: Document Analysis Request
  it("4. handles document analysis intent and verifies source citations", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: {
        async chat() {
          return "According to quarterly-report.pdf, the Q3 revenue was $5 million consistent with the available evidence.";
        },
      },
    });

    const documentContext = "[Source: quarterly-report.pdf, page 2]\nQ3 revenue reached $5 million.";
    const prompt = "What was the revenue in the uploaded quarterly report?";

    const task = await orchestrator.execute({
      conversationId: "test-conv-4",
      prompt,
      documentContext,
    });

    expect(task.intent).toBe("document_analysis");
    expect(task.verification.state).toBe("verified");
    expect(task.verification.confidence).toBe("high");
    expect(task.verification.sourceFiles).toContain("quarterly-report.pdf");
  });

  // Test 5: Unknown Intent
  it("5. handles unknown or ambiguous input gracefully without crashing", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockEchoProvider,
    });

    const prompt = "---???***@@@!!!";
    const classification = classifyIntent(prompt);

    expect(classification.intent).toBe("unknown");
    expect(classification.confidence).toBeLessThan(0.5);

    const task = await orchestrator.execute({
      conversationId: "test-conv-5",
      prompt,
    });

    expect(task.intent).toBe("unknown");
    expect(task.executionState).toBe("completed");
    expect(task.plan.type).toBe("direct");
  });

  // Test 6: Complex Multi-step Request
  it("6. decomposes complex multi-step prompts into discrete plan steps", async () => {
    const prompt = "Step 1: Inspect the user database schema. Step 2: Implement migration in TypeScript. Step 3: Verify the indexes and write documentation.";
    const classification = classifyIntent(prompt);
    const plan = planTask(prompt, classification.intent, "complex");

    expect(plan.type).toBe("multi_step");
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.steps[0].id).toBe("step_1");
    expect(plan.steps[0].status).toBe("pending");
    expect(plan.steps[1].id).toBe("step_2");
    expect(plan.steps[2].id).toBe("step_3");

    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockEchoProvider,
    });

    const task = await orchestrator.execute({
      conversationId: "test-conv-6",
      prompt,
    });

    expect(task.plan.type).toBe("multi_step");
    expect(task.plan.steps.every((s) => s.status === "completed")).toBe(true);
  });

  // Test 7: Provider Failure
  it("7. catches provider failure, records failed state, and never fabricates fake output", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockFailingProvider,
    });

    let caughtError: OrchestratorExecutionError | null = null;
    try {
      await orchestrator.execute({
        conversationId: "test-conv-7",
        prompt: "Hello",
      });
    } catch (err) {
      caughtError = err as OrchestratorExecutionError;
    }

    expect(caughtError).toBeInstanceOf(OrchestratorExecutionError);
    expect(caughtError?.stage).toBe("executing");
    expect(caughtError?.task.executionState).toBe("failed");
    expect(caughtError?.task.errors?.length).toBeGreaterThan(0);
    expect(caughtError?.task.errors?.[0].code).toBe("PROVIDER_FAILURE");
    expect(caughtError?.task.result).toBeUndefined();

    // Verify through HTTP endpoint that database does NOT persist a fake assistant message
    const created = await app.inject({
      method: "POST",
      url: "/api/conversations",
      payload: { title: "Failure Conv" },
    });
    const convId = created.json().id as string;

    // Use failing app
    const failingApp = buildApp(
      loadEnvironment({ ...process.env, NODE_ENV: "test", ASHVI_LOG_LEVEL: "silent" }),
      { provider: mockFailingProvider }
    );
    await failingApp.ready();

    const response = await failingApp.inject({
      method: "POST",
      url: `/api/conversations/${convId}/messages`,
      payload: { content: "Fail this request" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("AI_UNAVAILABLE");

    const loaded = await app.inject({ method: "GET", url: `/api/conversations/${convId}` });
    const messages = loaded.json().messages;
    expect(messages.some((m: { role: string }) => m.role === "ASSISTANT")).toBe(false);

    await failingApp.close();
    await app.inject({ method: "DELETE", url: `/api/conversations/${convId}` });
  });

  // Test 8: Verification Failure
  it("8. detects risky unverified claims and marks verification state as failed", async () => {
    const orchestrator = new AshviOrchestrator({
      defaultProvider: mockRiskyProvider,
    });

    const task = await orchestrator.execute({
      conversationId: "test-conv-8",
      prompt: "Is this fact verified?",
    });

    expect(task.verification.state).toBe("failed");
    expect(task.verification.confidence).toBe("low");
    expect(task.verification.reasons.length).toBeGreaterThan(0);
    expect(task.verification.reasons[0]).toContain("Risky or unverified claim detected");

    // Also test requires_evidence state when doc context is supplied but not cited
    const uncited = verifyTaskResponse(
      "The server port is 4000.",
      "[Source: config.env]\nASHVI_SERVER_PORT=4000"
    );
    expect(uncited.state).toBe("requires_evidence");
    expect(uncited.confidence).toBe("medium");
  });

  // Test 9: Unauthorized Request
  it("9. rejects messages on conversations without authorization when auth is enabled", async () => {
    // Attempting to post message without session cookie
    const response = await authApp.inject({
      method: "POST",
      url: "/api/conversations/non-existent-id/messages",
      payload: { content: "Unauthorized message attempt" },
    });

    expect(response.statusCode).toBe(401);
  });

  // Test 10: User Isolation
  it("10. enforces strict user isolation preventing User B from accessing User A's conversation", async () => {
    // User A creates a conversation
    const createRes = await authApp.inject({
      method: "POST",
      url: "/api/conversations",
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { title: "User A Secret Chat" },
    });
    expect(createRes.statusCode).toBe(201);
    const convIdA = createRes.json().id as string;

    // User A posts a message successfully
    const msgResA = await authApp.inject({
      method: "POST",
      url: `/api/conversations/${convIdA}/messages`,
      headers: { cookie: `ashvi_session=${userACookie}` },
      payload: { content: "Confidential message from User A" },
    });
    expect(msgResA.statusCode).toBe(201);

    // User B attempts to access User A's conversation
    const getResB = await authApp.inject({
      method: "GET",
      url: `/api/conversations/${convIdA}`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
    });
    expect(getResB.statusCode).toBe(404);

    // User B attempts to send a message to User A's conversation
    const msgResB = await authApp.inject({
      method: "POST",
      url: `/api/conversations/${convIdA}/messages`,
      headers: { cookie: `ashvi_session=${userBCookie}` },
      payload: { content: "Intrusion attempt from User B" },
    });
    expect(msgResB.statusCode).toBe(404);

    // Cleanup conversation A
    await authApp.inject({
      method: "DELETE",
      url: `/api/conversations/${convIdA}`,
      headers: { cookie: `ashvi_session=${userACookie}` },
    });
  });
});
