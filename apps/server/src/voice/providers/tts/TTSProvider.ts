import type { VoiceLanguage, VoicePersonaTone, VoiceSpeakingStyle } from "../../VoiceConfig.js";

export interface TTSOptions {
  language?: VoiceLanguage;
  rate?: number;           // Speech speed multiplier (e.g., 1.0 = normal, 0.9 = slower, 1.1 = faster)
  pitch?: number;          // Pitch multiplier (e.g. 1.0 = normal)
  emotion?: VoicePersonaTone;
  style?: VoiceSpeakingStyle;
}

export interface AudioResult {
  audio: Buffer;
  contentType: string;
  durationMs?: number;
}

export interface TTSProvider {
  name: string;
  synthesize(text: string, options?: TTSOptions): Promise<AudioResult>;
}

export class TTSProviderError extends Error {
  constructor(
    public readonly code: "TTS_UNAVAILABLE" | "INVALID_INPUT" | "TIMEOUT" | "UNKNOWN",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TTSProviderError";
  }
}
