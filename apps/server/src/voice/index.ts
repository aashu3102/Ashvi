export * from "./VoiceConfig.js";
export * from "./providers/stt/STTProvider.js";
export * from "./providers/stt/WhisperProvider.js";
export * from "./providers/tts/TTSProvider.js";
export * from "./providers/tts/PiperProvider.js";
export * from "./PronunciationService.js";
export * from "./VoiceEmotionService.js";
export * from "./ProsodyService.js";
export * from "./VoiceStreamService.js";
export * from "./BargeInService.js";
export * from "./VoiceSessionService.js";
export * from "./VoiceService.js";

// Legacy exports for backwards compatibility
export { SpeechToTextProvider, TextToSpeechProvider, VoiceProviderError } from "./provider.js";
