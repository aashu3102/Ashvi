import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Environment } from "../../../config/env.js";
import { parseCommandArgs, runVoiceCommand, substituteArgs } from "../../command.utils.js";
import { TTSProviderError, type AudioResult, type TTSOptions, type TTSProvider } from "./TTSProvider.js";

export class PiperProvider implements TTSProvider {
  public readonly name = "piper";

  constructor(private readonly environment: Environment) {}

  async synthesize(text: string, options?: TTSOptions): Promise<AudioResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new TTSProviderError("INVALID_INPUT", "Cannot synthesize empty text.");
    }

    const language = options?.language ?? "en";
    const directory = await mkdtemp(join(tmpdir(), "ashvi-tts-"));
    const output = join(directory, "speech.wav");
    const model = language === "hi"
      ? this.environment.ASHVI_TTS_MODEL_HI || this.environment.ASHVI_TTS_MODEL
      : this.environment.ASHVI_TTS_MODEL_EN || this.environment.ASHVI_TTS_MODEL;

    const rate = options?.rate ?? 1.0;
    const lengthScale = (1.0 / Math.max(0.5, Math.min(2.0, rate))).toFixed(2);

    try {
      const defaultArgs = ["--model", "{model}", "--output_file", "{output}"];
      const baseArgs = parseCommandArgs(this.environment.ASHVI_TTS_ARGS, defaultArgs);
      
      // If Piper CLI supports --length_scale and rate != 1.0, we can add it if not already in args
      const finalArgsConfig = [...baseArgs];
      if (rate !== 1.0 && !finalArgsConfig.includes("--length_scale") && !finalArgsConfig.some(a => a.includes("{lengthScale}"))) {
        finalArgsConfig.push("--length_scale", lengthScale);
      }

      const args = substituteArgs(finalArgsConfig, {
        input: "",
        output,
        outputDir: directory,
        model,
        language,
        lengthScale,
      });

      await writeFile(join(directory, "text.txt"), trimmed, "utf8");
      await runVoiceCommand(
        this.environment.ASHVI_TTS_COMMAND,
        args,
        this.environment.ASHVI_VOICE_COMMAND_TIMEOUT_MS,
        `${trimmed}\n`,
      );

      const audio = await readFile(output);
      return {
        audio,
        contentType: "audio/wav",
      };
    } catch (error) {
      if (error instanceof TTSProviderError) throw error;
      const message = error instanceof Error ? error.message : "Unknown TTS error";
      if (message.includes("timed out")) {
        throw new TTSProviderError("TIMEOUT", "Local speech synthesis timed out.", error);
      }
      throw new TTSProviderError("TTS_UNAVAILABLE", `Local voice output is unavailable: ${message}`, error);
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}
