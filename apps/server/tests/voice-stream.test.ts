import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

const app = buildApp(
  loadEnvironment({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    ASHVI_LOG_LEVEL: "silent",
    ASHVI_STT_COMMAND: process.execPath,
    ASHVI_STT_ARGS: JSON.stringify(["-e", "process.stdout.write('stream test transcript')", "{input}"]),
    ASHVI_TTS_COMMAND: process.execPath,
    ASHVI_TTS_ARGS: JSON.stringify([
      "-e",
      "require('node:fs').writeFileSync(process.argv[1], 'RIFF-voice-stream-wav')",
      "{output}",
    ]),
  }),
  { withDatabase: false },
);

afterAll(async () => {
  await app.close();
});

describe("Voice Routes and Streaming API", () => {
  it("GET /api/voice/session returns Ashvi voice profile", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/voice/session",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profile).toBeDefined();
    expect(body.profile.name).toBe("ASHVI");
    expect(body.profile.gender).toBe("female");
    expect(body.profile.primaryLanguage).toBe("en");
    expect(body.profile.supportedLanguages).toContain("hi");
  });

  it("POST /api/voice/interrupt aborts active session", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/interrupt",
      payload: { sessionId: "sess-abc-123", reason: "user_spoke" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe("sess-abc-123");
    expect(body.status).toBe("interrupted");
  });

  it("POST /api/voice/conversation handles text turn and synthesizes audio", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/conversation",
      payload: {
        text: "Tell me about Docker and PostgreSQL.",
        language: "en",
        sessionId: "sess-conv-1",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.sessionId).toBe("sess-conv-1");
    expect(body.transcript).toBe("Tell me about Docker and PostgreSQL.");
    expect(body.audioBase64).toBeDefined();
    expect(Buffer.from(body.audioBase64, "base64").toString()).toBe("RIFF-voice-stream-wav");
    expect(body.emotion).toBeDefined();
    expect(body.prosody).toBeDefined();
  });

  it("POST /api/voice/conversation/stream streams low-latency SSE events", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/conversation/stream",
      payload: {
        text: "Ashvi is ready. Let us test real-time speech synthesis.",
        language: "en",
        sessionId: "sess-stream-2",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");

    const payload = response.body;
    const lines = payload.split("\n\n").filter((l) => l.startsWith("data: "));
    const events = lines.map((l) => JSON.parse(l.replace(/^data: /, "")));

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("transcript");
    expect(eventTypes).toContain("state");
    expect(eventTypes).toContain("sentence_audio");
    expect(eventTypes).toContain("done");

    const audioEvent = events.find((e) => e.type === "sentence_audio");
    expect(audioEvent).toBeDefined();
    expect(audioEvent.audioBase64).toBeDefined();
    expect(Buffer.from(audioEvent.audioBase64, "base64").toString()).toBe("RIFF-voice-stream-wav");
  });

  it("returns 400 when neither audio nor text is provided", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/conversation",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INPUT_REQUIRED" } });
  });
});
