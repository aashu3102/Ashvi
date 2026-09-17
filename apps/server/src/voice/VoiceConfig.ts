export type VoiceLanguage = "en" | "hi";

export type VoicePersonaTone =
  | "calm"
  | "happy"
  | "excited"
  | "serious"
  | "concerned"
  | "empathetic"
  | "curious"
  | "confident"
  | "playful"
  | "neutral";

export type VoiceSpeakingStyle = "technical" | "casual" | "urgent" | "empathetic" | "default";

export interface VoiceProfile {
  name: string;
  gender: "female";
  ageGroup: "young-adult";
  personality: string;
  tone: string;
  primaryLanguage: VoiceLanguage;
  supportedLanguages: VoiceLanguage[];
  accent: string;
  defaultSpeakingRate: number; // 1.0 = normal
  defaultPitch: number;        // 1.0 = normal
}

export const ASHVI_VOICE_PROFILE: VoiceProfile = {
  name: "ASHVI",
  gender: "female",
  ageGroup: "young-adult",
  personality: "calm, intelligent, warm, confident, patient",
  tone: "natural, engaging, clear",
  primaryLanguage: "en",
  supportedLanguages: ["en", "hi"],
  accent: "neutral Indian English with clear articulation and fluent Hindi",
  defaultSpeakingRate: 1.0,
  defaultPitch: 1.0,
};

export interface AudioFormatConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  contentType: string;
}

export const ASHVI_AUDIO_CONFIG: AudioFormatConfig = {
  sampleRate: 22050,
  channels: 1,
  bitDepth: 16,
  contentType: "audio/wav",
};

export const VOICE_DELIMITERS = /(?<=[.?!।;\n])\s+/;
export const SENTENCE_END_REGEX = /[.?!।]\s*$/;
export const MIN_SENTENCE_LENGTH = 15;
export const MAX_SENTENCE_LENGTH = 280;
