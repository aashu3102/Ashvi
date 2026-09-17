import type { Prisma, PrismaClient } from "@prisma/client";
import type { EmbeddingProvider, RankedEvidence, VectorStore } from "./types.js";

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "could", "from", "have", "into",
  "more", "over", "should", "that", "their", "there", "these", "this", "those", "what",
  "when", "where", "which", "while", "with", "would", "your", "the", "and", "for", "are",
]);

function extractTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
  );
}

export interface RetrieverOptions {
  userId: string;
  query: string;
  topK?: number;
  minSimilarity?: number;
  documentIds?: string[];
  includeShared?: boolean;
}

export class Retriever {
  private prisma: PrismaClient;
  private vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;

  constructor(
    prisma: PrismaClient,
    vectorStore: VectorStore,
    embeddingProvider: EmbeddingProvider
  ) {
    this.prisma = prisma;
    this.vectorStore = vectorStore;
    this.embeddingProvider = embeddingProvider;
  }

  async retrieve(options: RetrieverOptions): Promise<RankedEvidence[]> {
    const { userId, query, topK = 4, minSimilarity = 0.15, documentIds, includeShared = true } = options;
    const queryTerms = extractTerms(query);

    // 1. Generate query embedding
    let queryVector: number[] = [];
    try {
      queryVector = await this.embeddingProvider.embedText(query);
    } catch {
      // If embedding generation fails, fall back to empty vector (lexical retrieval will still function)
      queryVector = [];
    }

    // 2. Vector search via VectorStore (if vector is available)
    const vectorResults = queryVector.length > 0
      ? await this.vectorStore.similaritySearch(queryVector, {
          userId,
          topK: topK * 2,
          minSimilarity,
          documentIds,
          includeShared,
        })
      : [];

    const vectorScoresByChunkId = new Map<string, number>();
    for (const res of vectorResults) {
      vectorScoresByChunkId.set(res.chunkId, res.similarity);
    }

    // 3. Fetch candidate chunks from database under strict ownership authorization
    const scopeFilter = includeShared
      ? { OR: [{ userId }, { scope: "SHARED" as const }] }
      : { userId };

    const documentFilter: Prisma.DocumentWhereInput = {
      ...scopeFilter,
      status: { in: ["READY", "INDEXED"] },
    };

    if (documentIds && documentIds.length > 0) {
      documentFilter.id = { in: documentIds };
    }

    // Fetch chunks that either matched vector search OR match active documents for hybrid ranking
    const chunkIdsToFetch = Array.from(vectorScoresByChunkId.keys());

    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        document: documentFilter,
        ...(chunkIdsToFetch.length > 0
          ? {
              OR: [
                { id: { in: chunkIdsToFetch } },
                // Allow fetching recent chunks from scoped documents if few vector hits
                ...(documentIds && documentIds.length > 0 ? [{ documentId: { in: documentIds } }] : []),
              ],
            }
          : {}),
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            userId: true,
            scope: true,
          },
        },
      },
      take: 50,
    });

    // 4. Hybrid Scoring: Dense Vector Similarity (70%) + Lexical Keyword Overlap (30%)
    const rankedCandidates: RankedEvidence[] = [];

    for (const chunk of chunks) {
      const vectorSim = vectorScoresByChunkId.get(chunk.id) ?? 0;
      const chunkTerms = extractTerms(chunk.content);

      let lexicalMatches = 0;
      for (const term of queryTerms) {
        if (chunkTerms.has(term)) lexicalMatches++;
      }

      const lexicalScore = queryTerms.size > 0
        ? Number((lexicalMatches / queryTerms.size).toFixed(4))
        : 0;

      // Substring bonus if query or key phrases exist verbatim in chunk
      const verbatimBonus = query.length > 3 && chunk.content.toLowerCase().includes(query.toLowerCase())
        ? 0.15
        : 0;

      // Combined score
      const combinedScore = Number((vectorSim * 0.65 + lexicalScore * 0.35 + verbatimBonus).toFixed(4));

      if (combinedScore >= minSimilarity || vectorSim >= minSimilarity || lexicalScore >= 0.3) {
        rankedCandidates.push({
          chunkId: chunk.id,
          documentId: chunk.document.id,
          filename: chunk.document.filename,
          content: chunk.content,
          score: combinedScore,
          vectorSimilarity: vectorSim,
          lexicalScore,
          pageNumber: chunk.pageNumber ?? undefined,
          sectionHeading: chunk.sectionHeading ?? undefined,
          slideNumber: chunk.slideNumber ?? undefined,
          sheetName: chunk.sheetName ?? undefined,
          lineStart: chunk.lineStart ?? undefined,
          lineEnd: chunk.lineEnd ?? undefined,
        });
      }
    }

    // Sort descending by score
    rankedCandidates.sort((a, b) => b.score - a.score);
    return rankedCandidates.slice(0, topK);
  }
}
