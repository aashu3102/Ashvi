import type { VoiceLanguage } from "./VoiceConfig.js";

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
}

export class PronunciationService {
  private readonly technicalDictionary: Record<string, string> = {
    PostgreSQL: "Post-gres-Q-L",
    postgres: "Postgres",
    Prisma: "Prizma",
    SQL: "sequel",
    MySQL: "My-sequel",
    NoSQL: "No-sequel",
    JSON: "Jason",
    SSE: "S-S-E",
    REST: "rest",
    RESTful: "rest-ful",
    API: "A-P-I",
    APIs: "A-P-Is",
    OAuth: "Oh-Auth",
    LLM: "L-L-M",
    LLMs: "L-L-Ms",
    JWT: "J-W-T",
    URL: "U-R-L",
    URLs: "U-R-Ls",
    URI: "U-R-I",
    UI: "U-I",
    UX: "U-X",
    HTML: "H-T-M-L",
    CSS: "C-S-S",
    CLI: "C-L-I",
    "CI/CD": "C-I C-D",
    Kubernetes: "Koo-ber-net-eez",
    k8s: "K-eight-s",
    K8s: "K-eight-s",
    Docker: "Docker",
    Fastify: "Fastify",
    Ashvi: "Ash-vee",
    GitHub: "Git-Hub",
    npm: "N-P-M",
    npx: "N-P-X",
    async: "ay-sync",
    await: "a-wait",
    regex: "reg-ex",
    UUID: "U-U-I-D",
    SDK: "S-D-K",
    HTTP: "H-T-T-P",
    HTTPS: "H-T-T-P-S",
  };

  private readonly hindiPhonetics: Record<string, string> = {
    namaste: "namaste",
    shukriya: "shukriya",
    dhanyavaad: "dhanyawaad",
    alvida: "alvida",
  };

  private readonly technicalRules: ReplacementRule[] = [];

  constructor() {
    // Compile regex rules with word boundaries
    for (const [term, replacement] of Object.entries(this.technicalDictionary)) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      this.technicalRules.push({
        pattern: new RegExp(`\\b${escaped}\\b`, "g"),
        replacement,
      });
    }
  }

  /**
   * Pre-processes raw AI markdown and applies phonetic pronunciations
   * suitable for speech synthesis without distorting conversational flow.
   */
  prepareForSpeech(text: string, language: VoiceLanguage = "en"): string {
    let clean = text;

    // 1. Remove markdown code blocks completely or turn them into brief spoken pauses
    clean = clean.replace(/```[\s\S]*?```/g, " [code omitted] ");

    // 2. Remove inline code backticks, keeping inner text
    clean = clean.replace(/`([^`]+)`/g, "$1");

    // 3. Convert markdown links [text](url) -> text
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    // 4. Remove bold / italic syntax
    clean = clean.replace(/(\*\*|\*|__|_)(.*?)\1/g, "$2");

    // 5. Convert bullet points / list items into natural sentence pauses
    clean = clean.replace(/^\s*[-*+]\s+/gm, "");
    clean = clean.replace(/^\s*\d+\.\s+/gm, "");

    // 6. Clean headers (# Header) -> Header.
    clean = clean.replace(/^#{1,6}\s+(.+)$/gm, "$1.");

    // 7. Strip emojis and non-speech symbols
    clean = clean.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

    // 8. Replace technical dictionary terms
    for (const rule of this.technicalRules) {
      clean = clean.replace(rule.pattern, rule.replacement);
    }

    // 9. Apply Hindi phonetics if Hindi or Hinglish
    if (language === "hi") {
      for (const [term, replacement] of Object.entries(this.hindiPhonetics)) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        clean = clean.replace(new RegExp(`\\b${escaped}\\b`, "gi"), replacement);
      }
    }

    // 10. Clean up extra spaces, line breaks, and punctuation duplicates
    clean = clean.replace(/\r\n/g, "\n");
    clean = clean.replace(/\n{2,}/g, ". ");
    clean = clean.replace(/\n/g, " ");
    clean = clean.replace(/\s{2,}/g, " ");
    clean = clean.replace(/\.{2,}/g, ".");
    clean = clean.replace(/\s+([.,?!।])/g, "$1");

    return clean.trim();
  }
}
