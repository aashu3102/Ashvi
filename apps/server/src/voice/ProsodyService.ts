import {
  ASHVI_VOICE_PROFILE,
  type VoicePersonaTone,
  type VoiceSpeakingStyle,
} from "./VoiceConfig.js";
import type { EmotionAnalysisResult } from "./VoiceEmotionService.js";

export interface ProsodyParameters {
  rate: number;
  pitch: number;
  style: VoiceSpeakingStyle;
  emotion: VoicePersonaTone;
}

export class ProsodyService {
  private readonly stylePresets: Record<VoiceSpeakingStyle, { rate: number; pitch: number }> = {
    technical: { rate: 0.98, pitch: 1.0 },   // Clear, deliberate, structured
    casual: { rate: 1.04, pitch: 1.02 },     // Relaxed, conversational
    urgent: { rate: 1.15, pitch: 1.04 },     // Prompt, alert, concise
    empathetic: { rate: 0.92, pitch: 0.99 }, // Patient, warm, gentle
    default: { rate: 1.0, pitch: 1.0 },
  };

  /**
   * Calculates final TTS prosody parameters by combining baseline profile,
   * speaking style, and detected emotion.
   */
  calculateProsody(
    emotionResult: EmotionAnalysisResult,
    requestedStyle?: VoiceSpeakingStyle,
  ): ProsodyParameters {
    const style = requestedStyle ?? this.inferStyleFromEmotion(emotionResult.emotion);
    const stylePreset = this.stylePresets[style] ?? this.stylePresets.default;

    // Multiply baseline * style scale * emotion scale
    const baseRate = ASHVI_VOICE_PROFILE.defaultSpeakingRate;
    const basePitch = ASHVI_VOICE_PROFILE.defaultPitch;

    const rawRate = baseRate * stylePreset.rate * emotionResult.speedScale;
    const rawPitch = basePitch * stylePreset.pitch * emotionResult.pitchScale;

    // Constrain safely within human conversational bounds
    const rate = Math.round(Math.max(0.75, Math.min(1.35, rawRate)) * 100) / 100;
    const pitch = Math.round(Math.max(0.85, Math.min(1.25, rawPitch)) * 100) / 100;

    return {
      rate,
      pitch,
      style,
      emotion: emotionResult.emotion,
    };
  }

  private inferStyleFromEmotion(emotion: VoicePersonaTone): VoiceSpeakingStyle {
    switch (emotion) {
      case "serious":
      case "concerned":
        return "technical";
      case "empathetic":
        return "empathetic";
      case "excited":
        return "urgent";
      case "playful":
      case "happy":
        return "casual";
      default:
        return "default";
    }
  }
}
