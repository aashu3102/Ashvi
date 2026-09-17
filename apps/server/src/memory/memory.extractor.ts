import type {
  CandidateMemory,
  MemoryCategory,
  MemoryConfidence,
  MemorySourceType,
} from "./types.js";

interface ExtractionRule {
  category: MemoryCategory;
  patterns: RegExp[];
  cleaner?: (matched: string) => string;
  defaultImportance: number;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    category: "PREFERENCE",
    patterns: [
      /\b(?:i\s+prefer|my\s+preference\s+is|i\s+like|i\s+dislike|please\s+always|please\s+never)\s+([^.!?\n]+)/i,
      /\bfrom\s+now\s+on\s+(?:please\s+)?(?:always|never)\s+([^.!?\n]+)/i,
    ],
    defaultImportance: 4,
  },
  {
    category: "DECISION",
    patterns: [
      /\b(?:we\s+decided\s+to|i\s+decided\s+to|the\s+decision\s+is\s+to|we\s+chose|we\s+will\s+use)\s+([^.!?\n]+)/i,
      /\b(?:decision\s*:\s*)([^.!?\n]+)/i,
    ],
    defaultImportance: 4,
  },
  {
    category: "PROJECT",
    patterns: [
      /\b(?:my\s+project\s+is|the\s+project\s+is|we\s+are\s+building|i\s+am\s+building)\s+([^.!?\n]+)/i,
      /\b(?:ashvi\s+is\s+(?:the\s+)?(?:user's\s+)?(?:my\s+)?personal\s+ai\s+assistant|ashvi\s+is\s+built\s+with)\b/i,
    ],
    defaultImportance: 4,
  },
  {
    category: "ROUTINE",
    patterns: [
      /\b(?:i\s+study\s+regularly|i\s+regularly|i\s+usually|every\s+(?:day|morning|evening|night|weekend))\s+([^.!?\n]+)/i,
      /\b(?:my\s+daily\s+routine\s+is|i\s+work\s+out\s+every)\s+([^.!?\n]+)/i,
    ],
    defaultImportance: 3,
  },
  {
    category: "CONTEXT",
    patterns: [
      /\b(?:i\s+am\s+currently\s+working\s+on|currently\s+focused\s+on|for\s+this\s+session\s+we\s+are)\s+([^.!?\n]+)/i,
    ],
    defaultImportance: 3,
  },
  {
    category: "FACT",
    patterns: [
      /\b(?:my\s+name\s+is|i\s+am\s+(?:a|an)\s+[a-zA-Z\s]+|i\s+live\s+in|i\s+work\s+as|i\s+work\s+at)\s+([^.!?\n]+)/i,
    ],
    defaultImportance: 3,
  },
];

export class MemoryExtractor {
  extractCandidates(
    userInput: string,
    conversationId?: string,
    messageId?: string
  ): CandidateMemory[] {
    const candidates: CandidateMemory[] = [];
    const normalizedInput = userInput.trim();

    // 1. Explicit remember command (e.g. "Remember this: ...", "Remember that ...")
    const explicitMatch = normalizedInput.match(
      /^(?:remember\s+(?:this\s*[:,-]?\s*|that\s+)?|save\s+this\s*[:,-]?\s*|keep\s+in\s+mind\s+(?:that\s+)?|note\s+down\s*[:,-]?\s*)(.+)/i
    );

    if (explicitMatch) {
      const explicitContent = explicitMatch[1].trim();
      const detectedCategory = this.detectCategory(explicitContent);

      candidates.push({
        content: explicitContent,
        category: detectedCategory,
        sourceType: "EXPLICIT_USER" as MemorySourceType,
        confidence: "HIGH" as MemoryConfidence,
        importance: 5,
        sourceConversationId: conversationId,
        sourceMessageId: messageId,
      });

      return candidates;
    }

    // 2. Scan input for category statements
    for (const rule of EXTRACTION_RULES) {
      for (const pattern of rule.patterns) {
        const match = normalizedInput.match(pattern);
        if (match) {
          candidates.push({
            content: normalizedInput,
            category: rule.category,
            sourceType: "EXPLICIT_USER" as MemorySourceType,
            confidence: "HIGH" as MemoryConfidence,
            importance: rule.defaultImportance,
            sourceConversationId: conversationId,
            sourceMessageId: messageId,
          });
          break; // Avoid duplicate category matches for the same input
        }
      }
    }

    return candidates;
  }

  detectCategory(content: string): MemoryCategory {
    const normalized = content.toLowerCase();
    if (/\b(?:prefer|preference|like|dislike|always\s+use|never\s+use)\b/.test(normalized)) {
      return "PREFERENCE";
    }
    if (/\b(?:decided|decision|chose|selected|agreed)\b/.test(normalized)) {
      return "DECISION";
    }
    if (/\b(?:project|building|app|application|ashvi)\b/.test(normalized)) {
      return "PROJECT";
    }
    if (/\b(?:regularly|routine|every\s+day|usually|habit|schedule|studying|studies|preparing|prepares)\b/.test(normalized)) {
      return "ROUTINE";
    }
    if (/\b(?:currently|now|at\s+the\s+moment|this\s+week)\b/.test(normalized)) {
      return "CONTEXT";
    }
    if (/\b(?:name\s+is|i\s+am|live\s+in|work\s+at)\b/.test(normalized)) {
      return "FACT";
    }
    return "FACT";
  }
}
