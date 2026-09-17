import type { ClassificationResult, TaskComplexity, TaskIntent } from "./types.js";

interface IntentRule {
  intent: TaskIntent;
  patterns: RegExp[];
  keywords: string[];
  weight: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "document_analysis",
    patterns: [
      /\b(?:in|from|summarize|analyze|review|check)\s+(?:the\s+)?(?:uploaded\s+)?(?:document|file|pdf|text|attachment|doc|notes)\b/i,
      /\baccording to (?:the\s+)?(?:document|file|report|attachment)\b/i,
      /\b(?:extract|find)\s+(?:from|in)\s+(?:the\s+)?(?:document|file)\b/i,
    ],
    keywords: [
      "document",
      "uploaded file",
      "attached file",
      "pdf",
      "doc",
      "source file",
      "document evidence",
    ],
    weight: 1.4,
  },
  {
    intent: "coding",
    patterns: [
      /```[\s\S]*?```/,
      /\b(?:write|debug|fix|refactor|create|implement|optimize)\s+(?:a\s+)?(?:function|class|method|component|script|code|algorithm|hook|api|endpoint|regex)\b/i,
      /\b(?:typescript|javascript|python|rust|golang|c\+\+|sql|html|css|json|react|next\.js|fastify|node\.js|prisma)\b/i,
      /\b(?:syntax error|stack trace|null pointer|undefined is not|typeerror|referenceerror|bug in|compiler error)\b/i,
      /\b(?:async|await|promise|interface|type\s+[A-Z]|const\s+[a-zA-Z0-9_]+\s*=|def\s+[a-zA-Z0-9_]+\()/i,
    ],
    keywords: [
      "function",
      "code",
      "typescript",
      "javascript",
      "python",
      "refactor",
      "debug",
      "algorithm",
      "endpoint",
      "component",
      "database query",
      "sql",
      "git commit",
    ],
    weight: 1.3,
  },
  {
    intent: "data_analysis",
    patterns: [
      /\b(?:analyze|examine|inspect)\s+(?:the\s+)?(?:data|dataset|csv|metrics|statistics|table|numbers)\b/i,
      /\b(?:mean|median|standard deviation|variance|correlation|regression|percentile|distribution|quartile)\b/i,
      /\b(?:data visualization|scatter plot|histogram|trend analysis|anomaly detection|data points)\b/i,
    ],
    keywords: [
      "dataset",
      "data analysis",
      "statistics",
      "correlation",
      "regression",
      "csv",
      "standard deviation",
      "metrics",
      "trend",
    ],
    weight: 1.2,
  },
  {
    intent: "system_task",
    patterns: [
      /\b(?:system\s+status|health\s*check|uptime|diagnostics|service\s+status|cpu\s+usage|memory\s+usage)\b/i,
      /\b(?:restart|reboot|shutdown|reload)\s+(?:the\s+)?(?:service|server|system|daemon)\b/i,
      /\b(?:system\s+information|version\s+info|environment\s+variables|system\s+logs)\b/i,
    ],
    keywords: [
      "system status",
      "health check",
      "diagnostics",
      "server health",
      "uptime",
      "system config",
      "service status",
    ],
    weight: 1.2,
  },
  {
    intent: "research",
    patterns: [
      /\b(?:research|investigate|explore|explain\s+the\s+history\s+of|background\s+of|origins\s+of)\b/i,
      /\b(?:literature\s+review|state\s+of\s+the\s+art|academic\s+paper|scholarly|scientific\s+studies)\b/i,
      /\b(?:compare\s+and\s+contrast\s+the\s+theories|comprehensive\s+overview\s+of|what\s+does\s+the\s+research\s+say)\b/i,
    ],
    keywords: [
      "research",
      "investigate",
      "literature review",
      "scientific study",
      "academic research",
      "history of",
      "state of the art",
    ],
    weight: 1.1,
  },
  {
    intent: "creative_writing",
    patterns: [
      /\b(?:write|compose|draft)\s+(?:a\s+)?(?:poem|story|novel|screenplay|script|song|lyrics|haiku|dialogue|fiction)\b/i,
      /\b(?:creative\s+writing|creative\s+story|draft\s+an\s+email|draft\s+a\s+letter|polite\s+email|narrative)\b/i,
      /\b(?:rhyme|metaphor|alliteration|prose|fairy\s+tale)\b/i,
    ],
    keywords: [
      "poem",
      "story",
      "creative writing",
      "draft an email",
      "screenplay",
      "lyrics",
      "narrative",
      "fiction",
    ],
    weight: 1.1,
  },
  {
    intent: "general_conversation",
    patterns: [
      /^(?:hello|hi|hey|greetings|howdy|good\s+(?:morning|afternoon|evening))\b/i,
      /\b(?:how\s+are\s+you|who\s+are\s+you|what\s+is\s+your\s+name|what\s+can\s+you\s+do|tell\s+me\s+about\s+yourself)\b/i,
      /\b(?:thank\s+you|thanks|goodbye|bye|see\s+you|nice\s+to\s+meet\s+you)\b/i,
      /^(?:ok|okay|cool|sure|great|got\s+it|understood)\.?$/i,
    ],
    keywords: [
      "hello",
      "hi",
      "hey",
      "how are you",
      "who are you",
      "thank you",
      "thanks",
      "bye",
    ],
    weight: 1.0,
  },
];

const COMPLEXITY_PATTERNS = [
  /\bfirst(?:ly)?\b[\s\S]*\bthen\b[\s\S]*\bfinally\b/i,
  /\bstep\s*1\b[\s\S]*\bstep\s*2\b/i,
  /\b1\.\s+[\s\S]*\b2\.\s+/i,
  /\b(?:after\s+that|subsequently|furthermore)\b/i,
];

export function classifyIntent(prompt: string, documentContext = ""): ClassificationResult {
  const normalized = prompt.trim().toLowerCase();

  // If input is completely empty or just arbitrary non-word characters without alphanumerics
  if (!normalized || /^[^a-zA-Z0-9]+$/.test(normalized)) {
    return {
      intent: "unknown",
      confidence: 0.1,
      reasons: ["Input is empty or contains no alphanumeric characters."],
      complexity: "simple",
    };
  }

  // If document evidence is explicitly present and query references it
  if (documentContext && documentContext.trim().length > 0) {
    const docQueryMatches = INTENT_RULES[0].patterns.some((p) => p.test(prompt)) ||
      INTENT_RULES[0].keywords.some((k) => normalized.includes(k)) ||
      /what|summarize|explain|tell|who|where|when|why|how/.test(normalized);

    if (docQueryMatches) {
      return {
        intent: "document_analysis",
        confidence: 0.95,
        reasons: ["Document evidence provided and prompt references or queries document contents."],
        complexity: determineComplexity(prompt),
      };
    }
  }

  let bestIntent: TaskIntent = "unknown";
  let maxScore = 0;
  let matchedReasons: string[] = [];

  for (const rule of INTENT_RULES) {
    let score = 0;
    const reasons: string[] = [];

    for (const pattern of rule.patterns) {
      if (pattern.test(prompt)) {
        score += 3 * rule.weight;
        reasons.push(`Matched pattern: ${pattern.source}`);
      }
    }

    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        score += 1.5 * rule.weight;
        reasons.push(`Matched keyword: "${keyword}"`);
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIntent = rule.intent;
      matchedReasons = reasons;
    }
  }

  // Threshold: if score is too low, classify as unknown or general_conversation
  if (maxScore < 1.5) {
    // If it looks like a standard sentence or basic query without domain keywords
    if (/^[a-z0-9\s,'"-?!.]{3,100}$/i.test(normalized) && normalized.split(/\s+/).length >= 2) {
      return {
        intent: "general_conversation",
        confidence: 0.5,
        reasons: ["Conversational query without specific domain keywords."],
        complexity: "simple",
      };
    }

    return {
      intent: "unknown",
      confidence: 0.2,
      reasons: ["No recognized domain patterns or keywords matched."],
      complexity: "simple",
    };
  }

  const confidence = Math.min(0.99, Number((maxScore / (maxScore + 3)).toFixed(2)));
  const complexity = determineComplexity(prompt);

  return {
    intent: bestIntent,
    confidence,
    reasons: matchedReasons.slice(0, 3),
    complexity,
  };
}

function determineComplexity(prompt: string): TaskComplexity {
  if (prompt.length > 500) return "complex";
  for (const pattern of COMPLEXITY_PATTERNS) {
    if (pattern.test(prompt)) return "complex";
  }
  return "simple";
}
