import type { CandidateMemory, MemoryPolicyDecision } from "./types.js";

const CREDENTIAL_PATTERNS = [
  /password["':\s=]+[^\s,"']+/i,
  /\b(?:bearer\s+[a-zA-Z0-9_\-.]+)\b/i,
  /\bapi[_-]?key["':\s=]+[a-zA-Z0-9_\-.]+/i,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/,
  /\b(?:sk_live|sk_test)_[0-9a-zA-Z]{24,}\b/,
  /\b(?:auth[_-]?code|secret[_-]?code|2fa[_-]?code|pin\s*code)["':\s=]+[0-9a-zA-Z]{4,}\b/i,
  /-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE\s+KEY-----/,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/, // High-entropy tokens/keys
];

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior)\s+instructions\b/i,
  /\byou\s+are\s+now\s+(?:unrestricted|in\s+developer\s+mode|dan)\b/i,
  /\bsystem\s+directive\s*:/i,
  /\boverride\s+(?:all\s+)?(?:system|safety|security)\s+rules\b/i,
  /\breveal\s+(?:all\s+)?(?:system\s+prompts|secrets|environment\s+variables)\b/i,
];

const TRANSIENT_PATTERNS = [
  /\b(?:what\s+is|what's|where\s+is|how\s+do|why\s+is|who\s+is)\b/i,
  /\b(?:eating|having\s+lunch|drinking\s+coffee|going\s+to\s+sleep|weather\s+is|it\s+is\s+raining)\b/i,
  /\b(?:hello|hi|hey|good\s+morning|good\s+night|see\s+you\s+later)\b/i,
  /^(?:yes|no|ok|okay|sure|cool|thanks|thank\s+you)\.?$/i,
];

export class MemoryPolicyError extends Error {
  statusCode: number;
  code: string;

  constructor(reason: string) {
    super(`Memory policy rejection: ${reason}`);
    this.name = "MemoryPolicyError";
    this.statusCode = 400;
    this.code = "POLICY_REJECTION";
  }
}

export class MemoryPolicy {
  evaluateCandidate(candidate: CandidateMemory): MemoryPolicyDecision {
    const content = candidate.content.trim();

    // 1. Length bounds
    if (content.length < 1) {
      return { allowed: false, reason: "CONTENT_TOO_SHORT: Memory cannot be empty." };
    }
    if (content.length > 5000) {
      return { allowed: false, reason: "CONTENT_TOO_LONG: Memory cannot exceed 5000 characters." };
    }

    // 2. Credential and Secret protection
    for (const pattern of CREDENTIAL_PATTERNS) {
      if (pattern.test(content)) {
        return {
          allowed: false,
          reason: "CREDENTIAL_REJECTED: Secrets, passwords, tokens, or credentials cannot be stored as memory.",
        };
      }
    }

    // 3. Prompt injection detection
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return {
          allowed: false,
          reason: "INJECTION_REJECTED: Malicious instruction or prompt injection detected.",
        };
      }
    }

    // 4. If explicit user request (e.g. "Remember this: ...")
    if (candidate.sourceType === "EXPLICIT_USER") {
      return {
        allowed: true,
        reason: "EXPLICIT_USER_ACCEPTED: User explicitly requested to store this information.",
        candidate,
      };
    }

    // 5. Ephemeral / casual chatter filtering for non-explicit memories
    for (const pattern of TRANSIENT_PATTERNS) {
      if (pattern.test(content)) {
        return {
          allowed: false,
          reason: "TRANSIENT_STATEMENT: Casual, ephemeral, or question statements are not stored as long-term memory.",
        };
      }
    }

    // 6. Confidence floor for inferred/derived memories
    if (candidate.confidence === "LOW") {
      return {
        allowed: false,
        reason: "LOW_CONFIDENCE: Inferred memory confidence is too low to persist.",
      };
    }

    return {
      allowed: true,
      reason: "ACCEPTED: Candidate meets all criteria for long-term retention.",
      candidate,
    };
  }

  isExplicitMemoryCommand(text: string): boolean {
    const normalized = text.toLowerCase().trim();
    return (
      /\b(?:remember\s+(?:this|that)|save\s+this|keep\s+this\s+for\s+later|note\s+down|from\s+now\s+on\s+remember)\b/i.test(normalized) ||
      /^remember\s*[:,-]?\s*/i.test(normalized)
    );
  }
}
