import type { MemoryRecord, RankedMemory } from "./types.js";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "could", "from", "have",
  "into", "more", "over", "should", "that", "their", "there", "these", "this",
  "those", "what", "when", "where", "which", "while", "with", "would", "your",
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how",
]);

function extractTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

export class MemoryRanker {
  rank(query: string, candidates: MemoryRecord[], minScore = 0.18): RankedMemory[] {
    const queryTokens = extractTokens(query);
    if (queryTokens.size === 0 && query.trim().length === 0) return [];

    const now = Date.now();

    const ranked: RankedMemory[] = [];

    for (const memory of candidates) {
      const memoryTokens = extractTokens(memory.content);

      // Overlap calculation
      let overlapCount = 0;
      for (const token of queryTokens) {
        if (memoryTokens.has(token)) {
          overlapCount += 1;
        }
      }

      // Exact phrase / entity match check
      const normalizedQuery = query.toLowerCase().trim();
      const normalizedContent = memory.content.toLowerCase();
      let entityMatch = normalizedQuery.length >= 4 && normalizedContent.includes(normalizedQuery);

      for (const token of queryTokens) {
        if (token.length >= 4 && normalizedContent.includes(token)) {
          entityMatch = true;
          break;
        }
      }

      // If no token overlap and no entity match, it is completely irrelevant
      if (overlapCount === 0 && !entityMatch) {
        continue;
      }

      const relevance = queryTokens.size > 0 ? overlapCount / queryTokens.size : 0;
      const importanceScore = memory.importance / 5; // 0.2 to 1.0

      const confidenceScore =
        memory.confidence === "HIGH" ? 1.0 : memory.confidence === "MEDIUM" ? 0.7 : 0.4;

      const ageDays = Math.max(0, (now - new Date(memory.updatedAt).getTime()) / 86_400_000);
      const freshness = 1 / (1 + ageDays / 60);

      const score =
        relevance * 0.50 +
        (entityMatch ? 0.20 : 0) +
        importanceScore * 0.15 +
        confidenceScore * 0.10 +
        freshness * 0.05;

      if (score >= minScore) {
        ranked.push({
          memory,
          score,
          relevance,
          importanceScore,
          freshness,
          confidenceScore,
        });
      }
    }

    return ranked.sort((a, b) => b.score - a.score);
  }
}
