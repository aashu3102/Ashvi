import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Environment } from "../config/env.js";
import { parseCommandArgs, runVoiceCommand, substituteArgs } from "./command.utils.js";
import { TextToSpeechProvider, VoiceProviderError, type VoiceLanguage } from "./provider.js";

export class PiperProvider implements TextToSpeechProvider {
  constructor(private readonly environment: Environment) {}

  async synthesize(text: string, language: VoiceLanguage) {
    const directory = await mkdtemp(join(tmpdir(), "ashvi-tts-"));
    const output = join(directory, "speech.wav");
    const model = language === "hi"
      ? this.environment.ASHVI_TTS_MODEL_HI || this.environment.ASHVI_TTS_MODEL
      : this.environment.ASHVI_TTS_MODEL_EN || this.environment.ASHVI_TTS_MODEL;

    try {
      const args = substituteArgs(
        parseCommandArgs(this.environment.ASHVI_TTS_ARGS, ["--model", "{model}", "--output_file", "{output}"]),
        { input: "", output, outputDir: directory, model, language },
      );
      await writeFile(join(directory, "text.txt"), text, "utf8");
      await runVoiceCommand(this.environment.ASHVI_TTS_COMMAND, args, this.environment.ASHVI_VOICE_COMMAND_TIMEOUT_MS);
      const audio = await readFile(output);
      return { audio, contentType: "audio/wav" };
    } catch {
      throw new VoiceProviderError("TTS_UNAVAILABLE", "Local voice output is unavailable.");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
