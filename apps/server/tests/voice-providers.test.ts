import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../src/config/env.js";
import { WhisperProvider } from "../src/voice/providers/stt/WhisperProvider.js";
import { PiperProvider } from "../src/voice/providers/tts/PiperProvider.js";
import { STTProviderError } from "../src/voice/providers/stt/STTProvider.js";
import { TTSProviderError } from "../src/voice/providers/tts/TTSProvider.js";

const fakeEnvironment = loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_STT_COMMAND: process.execPath,
  ASHVI_STT_ARGS: JSON.stringify(["-e", "process.stdout.write('hello from whisper stt')", "{input}"]),
  ASHVI_TTS_COMMAND: process.execPath,
  ASHVI_TTS_ARGS: JSON.stringify([
    "-e",
    "let text = ''; process.stdin.on('data', (c) => text += c); process.stdin.on('end', () => { require('node:fs').writeFileSync(process.argv[1], 'RIFF-audio-data'); })",
    "{output}",
  ]),
});

const failingSTTEnvironment = loadEnvironment({
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  ASHVI_LOG_LEVEL: "silent",
  ASHVI_STT_COMMAND: "non-existent-stt-command-12345",
  ASHVI_TTS_COMMAND: "non-existent-tts-command-12345",
});

describe("WhisperProvider and PiperProvider", () => {
  it("transcribes audio using WhisperProvider", async () => {
    const provider = new WhisperProvider(fakeEnvironment);
    const result = await provider.transcribe({ buffer: Buffer.from("audio"), filename: "test.webm" }, "en");

    expect(result.text).toBe("hello from whisper stt");
    expect(result.language).toBe("en");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("throws STTProviderError when STT command is unavailable", async () => {
    const provider = new WhisperProvider(failingSTTEnvironment);
    await expect(provider.transcribe({ buffer: Buffer.from("audio") })).rejects.toThrow(STTProviderError);
  });

  it("synthesizes audio using PiperProvider with options", async () => {
    const provider = new PiperProvider(fakeEnvironment);
    const result = await provider.synthesize("Hello world", {
      language: "en",
      rate: 1.1,
      pitch: 1.0,
      emotion: "happy",
    });

    expect(result.contentType).toBe("audio/wav");
    expect(result.audio.toString()).toBe("RIFF-audio-data");
  });

  it("throws TTSProviderError on empty text", async () => {
    const provider = new PiperProvider(fakeEnvironment);
    await expect(provider.synthesize("   ")).rejects.toThrow(TTSProviderError);
  });

  it("throws TTSProviderError when TTS command fails", async () => {
    const provider = new PiperProvider(failingSTTEnvironment);
    await expect(provider.synthesize("Hello world")).rejects.toThrow(TTSProviderError);
  });
});
