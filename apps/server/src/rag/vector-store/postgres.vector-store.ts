import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  VectorSearchOptions,
  VectorSearchResult,
  VectorStore,
  VectorStoreRecord,
} from "../types.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class PostgreSqlVectorStore implements VectorStore {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async upsert(records: VectorStoreRecord[]): Promise<void> {
    if (records.length === 0) return;

    // Persist vectors directly into DocumentChunk records in PostgreSQL
    await this.prisma.$transaction(
      records.map((record) =>
        this.prisma.documentChunk.update({
          where: { id: record.chunkId },
          data: {
            embedding: record.vector,
            metadata: (record.metadata ?? undefined) as Prisma.InputJsonValue,
          },
        })
      )
    );
  }

  async similaritySearch(
    queryVector: number[],
    options: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    const topK = options.topK ?? 4;
    const minSimilarity = options.minSimilarity ?? 0.15;
    const includeShared = options.includeShared ?? true;

    // Security Gate: strictly query only documents within user's authorization boundary
    const scopeFilter = includeShared
      ? {
          OR: [
            { userId: options.userId },
            { scope: "SHARED" as const },
          ],
        }
      : { userId: options.userId };

    const documentFilter: Prisma.DocumentWhereInput = {
      ...scopeFilter,
      status: { in: ["READY", "INDEXED"] },
    };

    if (options.documentIds && options.documentIds.length > 0) {
      documentFilter.id = { in: options.documentIds };
    }

    const chunks = await this.prisma.documentChunk.findMany({
      where: {
        document: documentFilter,
      },
      select: {
        id: true,
        documentId: true,
        embedding: true,
      },
    });

    const results: VectorSearchResult[] = [];

    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length === 0) continue;

      const similarity = cosineSimilarity(queryVector, chunk.embedding);
      if (similarity >= minSimilarity) {
        results.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          similarity: Number(similarity.toFixed(4)),
        });
      }
    }

    // Sort descending by similarity score and return topK
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  async deleteByDocument(documentId: string): Promise<void> {
    await this.prisma.documentChunk.updateMany({
      where: { documentId },
      data: { embedding: [] },
    });
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.prisma.documentChunk.updateMany({
      where: { document: { userId } },
      data: { embedding: [] },
    });
  }

  async delete(chunkIds: string[]): Promise<void> {
    if (chunkIds.length === 0) return;
    await this.prisma.documentChunk.updateMany({
      where: { id: { in: chunkIds } },
      data: { embedding: [] },
    });
  }
}
