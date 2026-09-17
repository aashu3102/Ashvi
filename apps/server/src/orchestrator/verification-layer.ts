import type { OrchestratorVerification } from "./types.js";

const RISKY_PHRASES = [
  "without checking",
  "i know for sure",
  "definitely",
  "exactly",
  "guaranteed",
  "i am completely sure",
  "this file says",
  "i verified",
  "i reviewed the file",
];

export function verifyTaskResponse(
  content: string,
  documentContext = ""
): OrchestratorVerification {
  const normalized = content.toLowerCase();
  const matchedRisky = RISKY_PHRASES.filter((phrase) => normalized.includes(phrase));
  const sourceFiles = Array.from(
    new Set([
      ...[...documentContext.matchAll(/\[Source:\s*([^,\]]+)/gi)].map((m) => m[1].trim()),
      ...[...documentContext.matchAll(/Document:\s*([^\r\n]+)/gi)].map((m) => m[1].trim()),
    ])
  );
  const citesRetrievedSource = sourceFiles.some((filename) => normalized.includes(filename.toLowerCase()));
  const statesAnswerNotFound =
    normalized.includes("not contain") ||
    normalized.includes("does not contain") ||
    normalized.includes("not found in") ||
    normalized.includes("no information") ||
    normalized.includes("does not mention") ||
    normalized.includes("not mentioned") ||
    normalized.includes("not enough information") ||
    normalized.includes("does not answer");

  // 1. Risky ungrounded assertions -> "failed"
  if (matchedRisky.length > 0) {
    return {
      state: "failed",
      confidence: "low",
      reasons: matchedRisky.map((phrase) => `Risky or unverified claim detected: "${phrase}"`),
      sourceFiles,
    };
  }

  // 2. Document evidence present, but model claimed facts without citing source -> "requires_evidence"
  if (
    sourceFiles.length > 0 &&
    !citesRetrievedSource &&
    !statesAnswerNotFound
  ) {
    return {
      state: "requires_evidence",
      confidence: "medium",
      reasons: ["The answer referenced retrieved document evidence without citing its source filename."],
      sourceFiles,
    };
  }

  // 3. Explicitly cited retrieved source, faithful answer-not-found, or grounded in available evidence -> "verified"
  if (
    citesRetrievedSource ||
    statesAnswerNotFound ||
    normalized.includes("available evidence") ||
    normalized.includes("consistent with the available evidence")
  ) {
    return {
      state: "verified",
      confidence: "high",
      reasons: ["The answer is appropriately cautious and grounded in available evidence."],
      sourceFiles,
    };
  }

  // 4. Soft cautious language without hard external evidence -> "unverified"
  if (normalized.includes("appears") || normalized.includes("seems") || normalized.includes("likely")) {
    return {
      state: "unverified",
      confidence: "medium",
      reasons: ["The answer is cautious but not fully verified against external evidence."],
      sourceFiles,
    };
  }

  // 5. Default state
  // If documents were requested/present but no citation was made, unverified
  if (sourceFiles.length > 0) {
    return {
      state: "unverified",
      confidence: "medium",
      reasons: ["Document evidence present but no direct verifiable citation made."],
      sourceFiles,
    };
  }

  return {
    state: "unverified",
    confidence: "high",
    reasons: ["General response without external document grounding required."],
    sourceFiles: [],
  };
}
