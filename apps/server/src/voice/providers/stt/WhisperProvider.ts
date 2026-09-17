import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Environment } from "../../../config/env.js";
import { parseCommandArgs, runVoiceCommand, substituteArgs } from "../../command.utils.js";
import type { VoiceLanguage } from "../../VoiceConfig.js";
import { STTProviderError, type AudioInput, type STTProvider, type STTResult } from "./STTProvider.js";

function extractTranscript(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { text?: string; segments?: Array<{ text?: string }> };
    if (typeof parsed.text === "string") return parsed.text.trim();
    if (Array.isArray(parsed.segments)) return parsed.segments.map((segment) => segment.text ?? "").join(" ").trim();
  } catch {
    // Plain text from CLI
  }
  return trimmed;
}

export class WhisperProvider implements STTProvider {
  public readonly name = "whisper";

  constructor(private readonly environment: Environment) {}

  async transcribe(input: AudioInput, language: VoiceLanguage = "en"): Promise<STTResult> {
    const startTime = Date.now();
    const directory = await mkdtemp(join(tmpdir(), "ashvi-stt-"));
    const filename = input.filename ? input.filename.replace(/[^a-zA-Z0-9._-]/g, "_") : "recording.webm";
    const inputPath = join(directory, filename || "input.audio");
    const outputPath = join(directory, "transcript.txt");

    try {
      await writeFile(inputPath, input.buffer);
      const args = substituteArgs(
        parseCommandArgs(this.environment.ASHVI_STT_ARGS, [
          "--model", "{model}",
          "--language", "{language}",
          "--output", "{output}",
          "{input}"
        ]),
        {
          input: inputPath,
          output: outputPath,
          outputDir: directory,
          model: this.environment.ASHVI_STT_MODEL,
          language,
        },
      );

      const result = await runVoiceCommand(
        this.environment.ASHVI_STT_COMMAND,
        args,
        this.environment.ASHVI_VOICE_COMMAND_TIMEOUT_MS,
      );

      let transcript = extractTranscript(result.stdout);
      if (!transcript) {
        transcript = extractTranscript(await readFile(outputPath, "utf8").catch(() => ""));
      }

      if (!transcript) {
        throw new STTProviderError("STT_UNAVAILABLE", "Speech recognition returned no transcript.");
      }

      return {
        text: transcript,
        language,
        durationMs: Date.now() - startTime,
        confidence: 0.95,
      };
    } catch (error) {
      if (error instanceof STTProviderError) throw error;
      const message = error instanceof Error ? error.message : "Unknown STT error";
      if (message.includes("timed out")) {
        throw new STTProviderError("TIMEOUT", "Local speech recognition timed out.", error);
      }
      throw new STTProviderError("STT_UNAVAILABLE", `Local speech recognition is unavailable: ${message}`, error);
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}
