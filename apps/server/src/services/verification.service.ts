export type VerificationResult = {
  needsVerification: boolean;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  sourceFiles?: string[];
};

const riskyPhrases = [
  "without checking",
  "i know for sure",
  "definitely",
  "exactly",
  "guaranteed",
  "I am completely sure",
  "this file says",
  "I verified",
  "I reviewed the file",
];

export function verifyAnswer(answer: string, documentContext = ""): VerificationResult {
  const normalized = answer.toLowerCase();
  const reasons = riskyPhrases.filter((phrase) => normalized.includes(phrase));
  const sourceFiles = [...documentContext.matchAll(/\[Source:\s*([^,\]]+)/gi)].map((match) => match[1].trim());
  const citesRetrievedSource = sourceFiles.some((filename) => normalized.includes(filename.toLowerCase()));

  if (reasons.length > 0) {
    return {
      needsVerification: true,
      confidence: "low",
      reasons,
      sourceFiles,
    };
  }

  if (sourceFiles.length > 0 && !citesRetrievedSource && !normalized.includes("does not answer") && !normalized.includes("not enough information")) {
    return {
      needsVerification: true,
      confidence: "medium",
      reasons: ["The answer used retrieved document evidence without citing its source filename."],
      sourceFiles,
    };
  }

  if (normalized.includes("available evidence") || normalized.includes("consistent with the available evidence")) {
    return {
      needsVerification: false,
      confidence: "high",
      reasons: ["The answer is appropriately cautious and grounded in available evidence."],
      sourceFiles,
    };
  }

  if (normalized.includes("appears") || normalized.includes("seems") || normalized.includes("likely")) {
    return {
      needsVerification: false,
      confidence: "medium",
      reasons: ["The answer is cautious but not fully certain."],
      sourceFiles,
    };
  }

  return {
    needsVerification: false,
    confidence: "high",
    reasons: ["The answer is appropriately cautious and aligned with available evidence."],
    sourceFiles,
  };
}
