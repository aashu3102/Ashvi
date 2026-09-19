/**
 * ASHVI PRIVACY CLASSIFIER
 *
 * Evaluates messages against configurable personal keywords to determine
 * if a conversation must be classified as PRIVATE / LOCAL.
 *
 * Requirements:
 * - Case-insensitive
 * - Unicode-safe (NFKC normalization)
 * - Whitespace & punctuation tolerant
 * - Extensible keyword dictionary
 */

export const DEFAULT_PRIVATE_KEYWORDS: readonly string[] = [
  "barbie",
  "shambhavi",
  "gf",
  "bandi",
];

/**
 * Normalizes text for robust privacy keyword matching:
 * - NFKC unicode normalization
 * - Lowercasing
 * - Collapses extra whitespace
 */
export function normalizePrivacyText(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a string contains any of the private keywords.
 *
 * For single short words (e.g. "gf"), matches word boundaries so words like
 * "dogfood" or "backgfront" don't falsely match, while "meri gf", "my gf!",
 * "gf", "GF" match perfectly.
 *
 * For longer distinct names like "shambhavi" or "barbie", matches everywhere.
 */
export function containsPrivateKeyword(
  text: string,
  keywords: readonly string[] = DEFAULT_PRIVATE_KEYWORDS
): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizePrivacyText(text);
  if (!normalized) return false;

  for (const rawKw of keywords) {
    const kw = normalizePrivacyText(rawKw);
    if (!kw) continue;

    // Allow optional whitespace, dashes, or dots between individual characters
    const spacedPattern = kw
      .split("")
      .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("[\\s_\\-\\.]*");

    // For short words (e.g. "gf", "bandi"), enforce non-word boundaries
    if (kw.length <= 5) {
      const boundaryRegex = new RegExp(`(^|[^a-z0-9])${spacedPattern}([^a-z0-9]|$)`, "i");
      if (boundaryRegex.test(normalized)) {
        return true;
      }
    } else {
      const regex = new RegExp(spacedPattern, "i");
      if (regex.test(normalized)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates an entire message thread to determine if ANY message
 * qualifies the conversation as permanently PRIVATE.
 */
export function isConversationPrivate(
  messages: Array<{ content?: string | null }>,
  keywords: readonly string[] = DEFAULT_PRIVATE_KEYWORDS
): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => m && m.content && containsPrivateKeyword(m.content, keywords));
}
