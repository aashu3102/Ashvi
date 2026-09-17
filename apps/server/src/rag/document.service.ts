import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  BatchUploadResult,
  DocumentScope,
  DocumentStatus,
  DocumentUploadResult,
  EmbeddingProvider,
  EvidenceContext,
  VectorStore,
} from "./types.js";
import { DocumentValidator } from "./document-validator.js";
import { ParserRegistry } from "./parsers/parser.registry.js";
import { TextNormalizer } from "./normalizer.js";
import { DocumentChunker } from "./chunker.js";
import { PostgreSqlVectorStore } from "./vector-store/postgres.vector-store.js";
import { createEmbeddingProvider } from "./embeddings/embedding.registry.js";
import { Retriever } from "./retriever.js";
import { DefaultReranker } from "./reranker.js";
import { EvidenceBuilder } from "./evidence-builder.js";

export interface DocumentServiceOptions {
  storageDir?: string;
  maxFileSizeMb?: number;
  maxFilesPerBatch?: number;
  maxPages?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingProvider?: EmbeddingProvider;
  vectorStore?: VectorStore;
}

export class DocumentService {
  private prisma: PrismaClient;
  private storageDir: string;
  private validator: DocumentValidator;
  private parserRegistry: ParserRegistry;
  private normalizer: TextNormalizer;
  private chunker: DocumentChunker;
  private embeddingProvider: EmbeddingProvider;
  private vectorStore: VectorStore;
  private retriever: Retriever;
  private reranker: DefaultReranker;
  private evidenceBuilder: EvidenceBuilder;

  constructor(prisma: PrismaClient, options: DocumentServiceOptions = {}) {
    this.prisma = prisma;
    this.storageDir = options.storageDir || join(process.cwd(), "../../data/documents");
    this.validator = new DocumentValidator({
      maxFileSizeMb: options.maxFileSizeMb ?? 50,
      maxFilesPerBatch: options.maxFilesPerBatch ?? 30,
      maxPages: options.maxPages ?? 800,
    });
    this.parserRegistry = new ParserRegistry();
    this.normalizer = new TextNormalizer();
    this.chunker = new DocumentChunker({
      chunkSize: options.chunkSize ?? 350,
      chunkOverlap: options.chunkOverlap ?? 50,
    });
    this.embeddingProvider = options.embeddingProvider || createEmbeddingProvider({ provider: "local" });
    this.vectorStore = options.vectorStore || new PostgreSqlVectorStore(prisma);
    this.retriever = new Retriever(prisma, this.vectorStore, this.embeddingProvider);
    this.reranker = new DefaultReranker();
    this.evidenceBuilder = new EvidenceBuilder();
  }

  async saveAndIndexFile(
    buffer: Buffer,
    rawFilename: string,
    mimeType: string,
    userId: string,
    scope: DocumentScope = "PRIVATE"
  ): Promise<DocumentUploadResult> {
    const filename = this.validator.sanitizeFilename(rawFilename);
    const ext = this.validator.validateExtension(filename);
    this.validator.validateFileSize(buffer.length, filename);
    this.validator.validateMagicBytes(buffer, ext, filename);

    await mkdir(this.storageDir, { recursive: true });
    const storagePath = join(this.storageDir, `${randomUUID()}${ext}`);
    await writeFile(storagePath, buffer);

    let document;
    try {
      document = await this.prisma.document.create({
        data: {
          userId,
          filename,
          mimeType,
          storagePath,
          status: "UPLOADED",
          scope,
        },
      });
    } catch (err) {
      await unlink(storagePath).catch(() => {});
      throw err;
    }

    return this.processDocument(document.id);
  }

  async processDocument(documentId: string): Promise<DocumentUploadResult> {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    try {
      const buffer = await readFile(document.storagePath);
      const parseResult = await this.parserRegistry.parse(buffer, document.filename);

      if (parseResult.pageCount) {
        this.validator.validatePageCount(parseResult.pageCount, document.filename);
      }

      // Normalize sections
      const normalizedSections = this.normalizer.normalizeSections(parseResult.sections);
      if (normalizedSections.length === 0) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED", metadata: { error: "No extractable text content found." } },
        });
        return {
          id: documentId,
          filename: document.filename,
          status: "FAILED",
          chunkCount: 0,
          error: "No extractable text content found.",
        };
      }

      // Chunk document
      const chunks = this.chunker.chunkSections(normalizedSections);
      if (chunks.length === 0) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: "FAILED", metadata: { error: "Chunking produced no valid chunks." } },
        });
        return {
          id: documentId,
          filename: document.filename,
          status: "FAILED",
          chunkCount: 0,
          error: "Chunking produced no valid chunks.",
        };
      }

      // Generate real embeddings for all chunks
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embeddingProvider.embedTexts(texts);

      // Persist in transaction
      await this.prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({ where: { documentId } });

        for (let i = 0; i < chunks.length; i++) {
          const chunkData = chunks[i];
          const embedding = embeddings[i] || [];

          await tx.documentChunk.create({
            data: {
              documentId,
              chunkIndex: chunkData.chunkIndex,
              content: chunkData.content,
              tokenCount: chunkData.tokenCount,
              pageNumber: chunkData.pageNumber,
              sectionHeading: chunkData.sectionHeading,
              slideNumber: chunkData.slideNumber,
              sheetName: chunkData.sheetName,
              lineStart: chunkData.lineStart,
              lineEnd: chunkData.lineEnd,
              embedding,
            },
          });
        }

        const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);
        await tx.document.update({
          where: { id: documentId },
          data: {
            status: "READY",
            metadata: {
              characterCount: totalChars,
              chunkCount: chunks.length,
              pageCount: parseResult.pageCount,
              ...parseResult.metadata,
            },
          },
        });
      });

      return {
        id: documentId,
        filename: document.filename,
        status: "READY",
        chunkCount: chunks.length,
        pageCount: parseResult.pageCount,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRejected = errorMsg.includes("PAGE_LIMIT_EXCEEDED") || errorMsg.includes("exceeding the maximum allowed limit");
      const finalStatus: DocumentStatus = isRejected ? "REJECTED" : "FAILED";

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: finalStatus, metadata: { error: errorMsg } },
      }).catch(() => {});

      return {
        id: documentId,
        filename: document.filename,
        status: finalStatus,
        chunkCount: 0,
        error: errorMsg,
      };
    }
  }

  async processBatch(
    files: Array<{ buffer: Buffer; filename: string; mimeType: string }>,
    userId: string
  ): Promise<BatchUploadResult> {
    this.validator.validateBatchSize(files.length);

    const successful: DocumentUploadResult[] = [];
    const failed: Array<{ filename: string; error: string; code: string }> = [];

    // Controlled sequential processing to avoid RAM spikes on multi-file batches
    for (const file of files) {
      try {
        const result = await this.saveAndIndexFile(
          file.buffer,
          file.filename,
          file.mimeType,
          userId
        );
        if (result.status === "FAILED" || result.status === "REJECTED") {
          failed.push({
            filename: file.filename,
            error: result.error || "Processing failed",
            code: result.status,
          });
        } else {
          successful.push(result);
        }
      } catch (err) {
        const errorRecord = err as { code?: string };
        failed.push({
          filename: file.filename,
          error: err instanceof Error ? err.message : String(err),
          code: errorRecord?.code || "PROCESSING_ERROR",
        });
      }
    }

    return { successful, failed };
  }

  async reprocessDocument(documentId: string, userId?: string): Promise<DocumentUploadResult> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, ...(userId ? { userId } : {}) },
    });
    if (!doc) {
      throw new Error("Document not found or access denied.");
    }
    return this.processDocument(documentId);
  }

  async deleteDocument(documentId: string, userId: string): Promise<boolean> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) return false;

    // 1. Remove physical file
    await unlink(doc.storagePath).catch(() => {});

    // 2. Cascade delete document and chunks from database
    await this.prisma.document.delete({ where: { id: documentId } });
    return true;
  }

  async setDocumentScope(
    documentId: string,
    userId: string,
    scope: DocumentScope
  ): Promise<boolean> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
    });
    if (!doc) return false;

    await this.prisma.document.update({
      where: { id: documentId },
      data: { scope },
    });
    return true;
  }

  async retrieveContext(
    query: string,
    userId: string,
    options: {
      documentIds?: string[];
      topK?: number;
      minSimilarity?: number;
      includeShared?: boolean;
    } = {}
  ): Promise<EvidenceContext> {
    if (!query || !query.trim()) {
      return this.evidenceBuilder.buildEvidenceContext([]);
    }

    const retrieved = await this.retriever.retrieve({
      userId,
      query,
      topK: options.topK ?? 4,
      minSimilarity: options.minSimilarity ?? 0.15,
      documentIds: options.documentIds,
      includeShared: options.includeShared ?? true,
    });

    const reranked = await this.reranker.rerank(query, retrieved);
    return this.evidenceBuilder.buildEvidenceContext(reranked);
  }

  async listDocuments(userId: string, includeShared = true) {
    const filter = includeShared
      ? { OR: [{ userId }, { scope: "SHARED" as const }] }
      : { userId };

    return this.prisma.document.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { chunks: true } } },
    });
  }

  async getDocumentPreview(documentId: string, userId: string) {
    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        OR: [{ userId }, { scope: "SHARED" as const }],
      },
      include: {
        chunks: {
          orderBy: { chunkIndex: "asc" },
          take: 3,
        },
      },
    });

    if (!doc) return null;

    return {
      id: doc.id,
      filename: doc.filename,
      status: doc.status,
      scope: doc.scope,
      preview: doc.chunks.map((c) => c.content).join("\n\n"),
    };
  }
}
