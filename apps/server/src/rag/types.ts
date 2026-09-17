export type DocumentScope = "PRIVATE" | "SHARED";

export type DocumentStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "FAILED"
  | "UPLOADED"
  | "INDEXED"
  | "PARTIAL"
  | "REJECTED";

export interface ParsedSection {
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  slideNumber?: number;
  sheetName?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface ParseResult {
  sections: ParsedSection[];
  metadata: Record<string, unknown>;
  pageCount?: number;
}

export interface DocumentChunkData {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  pageNumber?: number;
  sectionHeading?: string;
  slideNumber?: number;
  sheetName?: string;
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

export interface VectorStoreRecord {
  chunkId: string;
  documentId: string;
  userId: string;
  scope: DocumentScope;
  vector: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  userId: string;
  topK?: number;
  minSimilarity?: number;
  documentIds?: string[];
  includeShared?: boolean;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  similarity: number;
}

export interface VectorStore {
  upsert(records: VectorStoreRecord[]): Promise<void>;
  similaritySearch(queryVector: number[], options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  deleteByDocument(documentId: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
  delete(chunkIds: string[]): Promise<void>;
}

export interface RankedEvidence {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  score: number;
  vectorSimilarity: number;
  lexicalScore: number;
  pageNumber?: number;
  sectionHeading?: string;
  slideNumber?: number;
  sheetName?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface Reranker {
  rerank(query: string, candidates: RankedEvidence[]): Promise<RankedEvidence[]>;
}

export interface SourceCitation {
  documentId: string;
  filename: string;
  pageNumber?: number;
  sectionHeading?: string;
  slideNumber?: number;
  sheetName?: string;
  lineRange?: string;
  confidence: "DIRECTLY SUPPORTED" | "INFERRED" | "NOT FOUND IN DOCUMENTS";
  excerpt: string;
}

export interface EvidenceContext {
  formattedEvidence: string;
  citations: SourceCitation[];
  totalEvidenceTokens: number;
  chunksUsed: number;
}

export interface DocumentUploadResult {
  id: string;
  filename: string;
  status: DocumentStatus;
  chunkCount: number;
  pageCount?: number;
  error?: string;
}

export interface BatchUploadResult {
  successful: DocumentUploadResult[];
  failed: Array<{ filename: string; error: string; code: string }>;
}
