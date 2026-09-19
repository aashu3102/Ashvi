/**
 * ASHVI SERVER PRIVACY CLASSIFIER
 *
 * Evaluates messages against configurable personal keywords to determine
 * if a conversation or message is classified as PRIVATE.
 */

export const DEFAULT_PRIVATE_KEYWORDS: readonly string[] = [
  "barbie",
  "shambhavi",
  "gf",
  "bandi",
];

export function normalizePrivacyText(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function containsPrivateKeyword(
  text: string,
  keywords: readonly string[] = DEFAULT_PRIVATE_KEYWORDS
): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizePrivacyText(text);
  if (!normalized) return false;

  for (const rawKw of keywords) {
    const kw = normalizePrivacyText(rawKw);
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

export const PRIVATE_KEYWORDS = DEFAULT_PRIVATE_KEYWORDS;

export function isConversationPrivate(
  messages: Array<{ content?: string | null }>,
  keywords: readonly string[] = DEFAULT_PRIVATE_KEYWORDS
): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some((m) => m && m.content && containsPrivateKeyword(m.content, keywords));
}
