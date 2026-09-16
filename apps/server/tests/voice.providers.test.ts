import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { FasterWhisperProvider } from "../src/voice/faster-whisper.provider.js";
import { PiperProvider } from "../src/voice/piper.provider.js";

const fakeEnvironment = loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_STT_COMMAND: process.execPath,
  ASHVI_STT_ARGS: JSON.stringify(["-e", "process.stdout.write('hello from local stt')", "{input}"]),
  ASHVI_TTS_COMMAND: process.execPath,
  ASHVI_TTS_ARGS: JSON.stringify(["-e", "require('node:fs').writeFileSync(process.argv[1], 'RIFF-fake-wav')", "{output}"]),
});

describe("local voice providers", () => {
  it("transcribes temporary audio through the configured local command", async () => {
    const provider = new FasterWhisperProvider(fakeEnvironment);
    await expect(provider.transcribe(Buffer.from("audio"), "recording.webm", "en")).resolves.toBe("hello from local stt");
  });

  it("synthesizes temporary wav audio through the configured local command", async () => {
    const provider = new PiperProvider(fakeEnvironment);
    const result = await provider.synthesize("hello", "hi");
    expect(result.contentType).toBe("audio/wav");
    expect(result.audio.toString()).toBe("RIFF-fake-wav");
  });
});
