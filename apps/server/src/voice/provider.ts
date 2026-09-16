export type VoiceLanguage = "en" | "hi";

export interface SpeechToTextProvider {
  transcribe(audio: Buffer, filename: string, language: VoiceLanguage): Promise<string>;
}

export interface TextToSpeechProvider {
  synthesize(text: string, language: VoiceLanguage): Promise<{ audio: Buffer; contentType: string }>;
}

export class VoiceProviderError extends Error {
  constructor(public readonly code: "STT_UNAVAILABLE" | "TTS_UNAVAILABLE" | "INVALID_AUDIO", message: string) {
    super(message);
    this.name = "VoiceProviderError";
  }
}
