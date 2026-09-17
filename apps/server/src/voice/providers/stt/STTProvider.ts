import type { VoiceLanguage } from "../../VoiceConfig.js";

export interface AudioInput {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
}

export interface STTResult {
  text: string;
  language: VoiceLanguage;
  durationMs?: number;
  confidence?: number;
}

export interface STTProvider {
  name: string;
  transcribe(input: AudioInput, language?: VoiceLanguage): Promise<STTResult>;
}

export class STTProviderError extends Error {
  constructor(
    public readonly code: "STT_UNAVAILABLE" | "INVALID_AUDIO" | "TIMEOUT" | "UNKNOWN",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "STTProviderError";
  }
}
