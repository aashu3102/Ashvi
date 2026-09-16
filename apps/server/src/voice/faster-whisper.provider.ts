import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Environment } from "../config/env.js";
import { parseCommandArgs, runVoiceCommand, substituteArgs } from "./command.utils.js";
import { SpeechToTextProvider, VoiceProviderError, type VoiceLanguage } from "./provider.js";

function extractTranscript(output: string) {
  const trimmed = output.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { text?: string; segments?: Array<{ text?: string }> };
    if (typeof parsed.text === "string") return parsed.text.trim();
    if (Array.isArray(parsed.segments)) return parsed.segments.map((segment) => segment.text ?? "").join(" ").trim();
  } catch {
    // Most CLI adapters return plain text; JSON is supported when configured.
  }
  return trimmed;
}

export class FasterWhisperProvider implements SpeechToTextProvider {
  constructor(private readonly environment: Environment) {}

  async transcribe(audio: Buffer, filename: string, language: VoiceLanguage) {
    const directory = await mkdtemp(join(tmpdir(), "ashvi-stt-"));
    const input = join(directory, filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "input.audio");
    const output = join(directory, "transcript.txt");

    try {
      await writeFile(input, audio);
      const args = substituteArgs(
        parseCommandArgs(this.environment.ASHVI_STT_ARGS, ["--model", "{model}", "--language", "{language}", "--output", "{output}", "{input}"]),
        { input, output, outputDir: directory, model: this.environment.ASHVI_STT_MODEL, language },
      );
      const result = await runVoiceCommand(this.environment.ASHVI_STT_COMMAND, args, this.environment.ASHVI_VOICE_COMMAND_TIMEOUT_MS);
      let transcript = extractTranscript(result.stdout);
      if (!transcript) transcript = extractTranscript(await readFile(output, "utf8").catch(() => ""));
      if (!transcript) throw new Error("Speech recognition returned no transcript.");
      return transcript;
    } catch {
      throw new VoiceProviderError("STT_UNAVAILABLE", "Local speech recognition is unavailable.");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
