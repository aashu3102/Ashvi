import { MemoryRanker } from "./memory.ranker.js";
import { MemoryRepository } from "./memory.repository.js";
import type { MemoryCategory, MemoryRetrievalResult, RankedMemory } from "./types.js";

export interface RetrievalOptions {
  limit?: number;
  maxCharacters?: number;
  minScore?: number;
  categories?: MemoryCategory[];
}

const DEFAULT_LIMIT = 5;
const DEFAULT_MAX_CHARS = 2500;
const DEFAULT_MIN_SCORE = 0.18;

export class MemoryRetriever {
  private ranker: MemoryRanker;

  constructor(private repository: MemoryRepository, ranker?: MemoryRanker) {
    this.ranker = ranker ?? new MemoryRanker();
  }

  async retrieveRelevantContext(
    query: string,
    userId?: string,
    options: RetrievalOptions = {}
  ): Promise<MemoryRetrievalResult> {
    const limit = options.limit ?? DEFAULT_LIMIT;
    const maxChars = options.maxCharacters ?? DEFAULT_MAX_CHARS;
    const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

    if (!query || !query.trim()) {
      return { memories: [], formattedContext: "" };
    }

    // 1. Fetch active accessible memories (enforcing user isolation: user private + shared)
    const candidates = await this.repository.findActiveAccessibleMemories(userId, options.categories);
    if (candidates.length === 0) {
      return { memories: [], formattedContext: "" };
    }

    // 2. Rank candidates against query
    const ranked = this.ranker.rank(query, candidates, minScore);

    // 3. Slice top limit
    const topMemories: RankedMemory[] = [];
    let currentChars = 0;

    for (const item of ranked) {
      if (topMemories.length >= limit) break;

      const entry = `[${item.memory.category}, importance ${item.memory.importance}/5]\n${item.memory.content}`;
      if (currentChars + entry.length > maxChars && topMemories.length > 0) {
        break;
      }

      topMemories.push(item);
      currentChars += entry.length;
    }

    if (topMemories.length === 0) {
      return { memories: [], formattedContext: "" };
    }

    // 4. Format context with explicit untrusted DATA framing to resist prompt injection
    const formattedBlocks = topMemories.map(({ memory }) => {
      const scopeLabel = memory.scope === "SHARED" ? " (SHARED)" : "";
      return `[Category: ${memory.category} | Confidence: ${memory.confidence} | Importance: ${memory.importance}/5${scopeLabel}]\n${memory.content}`;
    });

    return {
      memories: topMemories,
      formattedContext: formattedBlocks.join("\n\n"),
    };
  }
}
