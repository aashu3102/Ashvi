import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app/build-app.js";
import { loadEnvironment } from "../src/config/env.js";

const app = buildApp(loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_STT_COMMAND: process.execPath,
  ASHVI_STT_ARGS: JSON.stringify(["-e", "process.stdout.write('route transcript')", "{input}"]),
  ASHVI_TTS_COMMAND: process.execPath,
  ASHVI_TTS_ARGS: JSON.stringify(["-e", "require('node:fs').writeFileSync(process.argv[1], 'RIFF-route-wav')", "{output}"]),
}), { withDatabase: false });

afterAll(async () => {
  await app.close();
});

describe("voice routes", () => {
  it("returns local synthesized audio without exposing provider configuration", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/synthesize",
      payload: { text: "Hello Ashvi", language: "en" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/wav");
    expect(response.rawPayload.toString()).toBe("RIFF-route-wav");
    expect(response.headers["x-ashvi-model"]).toBeUndefined();
  });

  it("returns a useful error when no recording is submitted", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/voice/transcribe?language=hi",
      headers: { "content-type": "multipart/form-data; boundary=ashvi-test" },
      payload: "--ashvi-test--\r\n",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "AUDIO_REQUIRED" } });
  });
});
