import type {
  MemoryCategory,
  MemoryConfidence,
  MemoryScope,
  MemorySource,
  MemorySourceType,
  MemoryStatus,
} from "@prisma/client";

export type {
  MemoryCategory,
  MemoryConfidence,
  MemoryScope,
  MemorySource,
  MemorySourceType,
  MemoryStatus,
};

export type ImportanceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface MemoryRecord {
  id: string;
  userId: string;
  scope: MemoryScope;
  category: MemoryCategory;
  content: string;
  source: MemorySource;
  sourceType: MemorySourceType;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  confidence: MemoryConfidence;
  importance: number; // 1 to 5
  status: MemoryStatus;
  supersededBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CandidateMemory {
  content: string;
  category: MemoryCategory;
  sourceType: MemorySourceType;
  confidence: MemoryConfidence;
  importance: number; // 1 to 5
  sourceConversationId?: string;
  sourceMessageId?: string;
  scope?: MemoryScope;
}

export interface MemoryQuery {
  userId?: string;
  conversationId?: string;
  query: string;
  limit?: number;
  categories?: MemoryCategory[];
  minConfidence?: MemoryConfidence;
  minScore?: number;
}

export interface RankedMemory {
  memory: MemoryRecord;
  score: number;
  relevance: number;
  importanceScore: number;
  freshness: number;
  confidenceScore: number;
}

export interface MemoryPolicyDecision {
  allowed: boolean;
  reason: string;
  candidate?: CandidateMemory;
}

export interface ConflictDetectionResult {
  hasConflict: boolean;
  conflictingMemory?: MemoryRecord;
  action: "supersede" | "update" | "none";
  reason?: string;
}

export interface MemoryRetrievalResult {
  memories: RankedMemory[];
  formattedContext: string;
}

export interface CreateMemoryInput {
  content: string;
  category?: MemoryCategory;
  source?: MemorySource;
  sourceType?: MemorySourceType;
  confidence?: MemoryConfidence;
  importance?: number | ImportanceLevel;
  scope?: MemoryScope;
  sourceConversationId?: string;
  sourceMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  category?: MemoryCategory;
  importance?: number | ImportanceLevel;
  confidence?: MemoryConfidence;
  scope?: MemoryScope;
  status?: MemoryStatus;
}
