import type { VoicePersonaTone } from "./VoiceConfig.js";

export interface EmotionAnalysisResult {
  emotion: VoicePersonaTone;
  confidence: number;
  speedScale: number;
  pitchScale: number;
}

export class VoiceEmotionService {
  private readonly emotionPatterns: Array<{
    emotion: VoicePersonaTone;
    pattern: RegExp;
    weight: number;
  }> = [
    {
      emotion: "concerned",
      pattern: /\b(error|failed|issue|crash|warning|trouble|problem|broken|danger|bug|exception)\b/i,
      weight: 1.2,
    },
    {
      emotion: "empathetic",
      pattern: /\b(understand|sorry|apologize|comfort|patience|here for you|take your time|help you through)\b/i,
      weight: 1.1,
    },
    {
      emotion: "excited",
      pattern: /\b(great job|fantastic|wonderful|awesome|congratulations|amazing|brilliant|success|hooray|yay)\b/i,
      weight: 1.3,
    },
    {
      emotion: "happy",
      pattern: /\b(glad|pleased|delighted|happy to help|welcome|enjoy|cheers)\b/i,
      weight: 1.0,
    },
    {
      emotion: "curious",
      pattern: /\b(interesting|curious|wonder|tell me more|shall we check|what do you think|how about)\b/i,
      weight: 1.0,
    },
    {
      emotion: "confident",
      pattern: /\b(definitely|certainly|resolved|verified|ready|completed|absolutely|surely|guaranteed)\b/i,
      weight: 1.0,
    },
    {
      emotion: "serious",
      pattern: /\b(critical|security|important|crucial|essential|authentication|confidential|strict|fatal)\b/i,
      weight: 1.1,
    },
    {
      emotion: "playful",
      pattern: /\b(fun|aha|cool|neat|trick|tada|voila)\b/i,
      weight: 0.9,
    },
  ];

  private readonly prosodyScales: Record<VoicePersonaTone, { speedScale: number; pitchScale: number }> = {
    calm: { speedScale: 1.0, pitchScale: 1.0 },
    happy: { speedScale: 1.05, pitchScale: 1.03 },
    excited: { speedScale: 1.12, pitchScale: 1.06 },
    serious: { speedScale: 0.95, pitchScale: 0.98 },
    concerned: { speedScale: 0.92, pitchScale: 0.97 },
    empathetic: { speedScale: 0.90, pitchScale: 0.99 },
    curious: { speedScale: 1.02, pitchScale: 1.04 },
    confident: { speedScale: 1.03, pitchScale: 1.01 },
    playful: { speedScale: 1.08, pitchScale: 1.05 },
    neutral: { speedScale: 1.0, pitchScale: 1.0 },
  };

  detectEmotion(text: string, context?: { intent?: string; userPrompt?: string }): EmotionAnalysisResult {
    const scores: Record<VoicePersonaTone, number> = {
      calm: 0.5, // Baseline
      happy: 0,
      excited: 0,
      serious: 0,
      concerned: 0,
      empathetic: 0,
      curious: 0,
      confident: 0,
      playful: 0,
      neutral: 0.1,
    };

    // Analyze intent if present
    if (context?.intent) {
      if (context.intent === "coding" || context.intent === "technical") {
        scores.calm += 0.4;
        scores.confident += 0.3;
      } else if (context.intent === "troubleshooting") {
        scores.concerned += 0.4;
        scores.serious += 0.3;
      }
    }

    // Analyze question marks / enthusiasm
    if (text.includes("?")) scores.curious += 0.4;
    if (text.includes("!")) {
      scores.excited += 0.5;
      scores.happy += 0.3;
    }

    for (const rule of this.emotionPatterns) {
      const matches = text.match(rule.pattern);
      if (matches) {
        scores[rule.emotion] += matches.length * rule.weight;
      }
    }

    let topEmotion: VoicePersonaTone = "calm";
    let maxScore = scores.calm;

    for (const [emotion, score] of Object.entries(scores) as Array<[VoicePersonaTone, number]>) {
      if (score > maxScore) {
        maxScore = score;
        topEmotion = emotion;
      }
    }

    const { speedScale, pitchScale } = this.prosodyScales[topEmotion];
    const confidence = Math.min(1.0, maxScore / 2.5);

    return {
      emotion: topEmotion,
      confidence,
      speedScale,
      pitchScale,
    };
  }
}
