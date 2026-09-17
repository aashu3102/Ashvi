import type { PrismaClient } from "@prisma/client";
import { MemoryExtractor } from "./memory.extractor.js";
import { MemoryPolicy, MemoryPolicyError } from "./memory.policy.js";
import { MemoryRanker } from "./memory.ranker.js";
import { MemoryRepository, normalizeImportance } from "./memory.repository.js";
import { MemoryRetriever, type RetrievalOptions } from "./memory.retriever.js";
import type {
  CandidateMemory,
  ConflictDetectionResult,
  CreateMemoryInput,
  MemoryCategory,
  MemoryRecord,
  MemoryRetrievalResult,
  MemoryStatus,
  UpdateMemoryInput,
} from "./types.js";

export interface MemoryServiceOptions {
  repository?: MemoryRepository;
  policy?: MemoryPolicy;
  extractor?: MemoryExtractor;
  ranker?: MemoryRanker;
  retriever?: MemoryRetriever;
}

export class MemoryService {
  public repository: MemoryRepository;
  public policy: MemoryPolicy;
  public extractor: MemoryExtractor;
  public ranker: MemoryRanker;
  public retriever: MemoryRetriever;

  constructor(prisma: PrismaClient, options: MemoryServiceOptions = {}) {
    this.repository = options.repository ?? new MemoryRepository(prisma);
    this.policy = options.policy ?? new MemoryPolicy();
    this.extractor = options.extractor ?? new MemoryExtractor();
    this.ranker = options.ranker ?? new MemoryRanker();
    this.retriever = options.retriever ?? new MemoryRetriever(this.repository, this.ranker);
  }

  async retrieveContext(
    query: string,
    userId?: string,
    options?: RetrievalOptions
  ): Promise<MemoryRetrievalResult> {
    return this.retriever.retrieveRelevantContext(query, userId, options);
  }

  async listMemories(
    userId?: string,
    filters: { status?: MemoryStatus; category?: MemoryCategory } = {}
  ): Promise<MemoryRecord[]> {
    return this.repository.listUserMemories(userId, filters);
  }

  async getMemory(id: string, userId?: string): Promise<MemoryRecord | null> {
    return this.repository.findById(id, userId);
  }

  async createMemory(input: CreateMemoryInput, userId?: string): Promise<MemoryRecord> {
    const candidate: CandidateMemory = {
      content: input.content,
      category: input.category ?? "OTHER",
      sourceType: input.sourceType ?? "EXPLICIT_USER",
      confidence: input.confidence ?? "HIGH",
      importance: normalizeImportance(input.importance),
      scope: input.scope ?? "PRIVATE",
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId,
    };

    // 1. Evaluate through policy
    const decision = this.policy.evaluateCandidate(candidate);
    if (!decision.allowed) {
      throw new MemoryPolicyError(decision.reason);
    }

    // 2. Conflict detection & supersession
    const conflict = await this.detectConflict(candidate, userId);
    const created = await this.repository.create(input, userId);

    if (conflict.hasConflict && conflict.conflictingMemory && conflict.action === "supersede") {
      await this.repository.markSuperseded(conflict.conflictingMemory.id, created.id, userId);
    }

    return created;
  }

  async updateMemory(id: string, input: UpdateMemoryInput, userId?: string): Promise<MemoryRecord | null> {
    if (input.content) {
      const candidate: CandidateMemory = {
        content: input.content,
        category: input.category ?? "OTHER",
        sourceType: "EXPLICIT_USER",
        confidence: input.confidence ?? "HIGH",
        importance: normalizeImportance(input.importance),
      };

      const decision = this.policy.evaluateCandidate(candidate);
      if (!decision.allowed) {
        throw new MemoryPolicyError(decision.reason);
      }
    }

    return this.repository.update(id, input, userId);
  }

  async deleteMemory(id: string, userId?: string): Promise<boolean> {
    return this.repository.delete(id, userId);
  }

  async archiveMemory(id: string, userId?: string): Promise<boolean> {
    return this.repository.archive(id, userId);
  }

  async shareMemory(id: string, userId?: string): Promise<MemoryRecord | null> {
    return this.repository.setScope(id, "SHARED", userId);
  }

  async unshareMemory(id: string, userId?: string): Promise<MemoryRecord | null> {
    return this.repository.setScope(id, "PRIVATE", userId);
  }

  async evaluateAndStore(
    userInput: string,
    conversationId?: string,
    messageId?: string,
    userId?: string
  ): Promise<MemoryRecord[]> {
    const candidates = this.extractor.extractCandidates(userInput, conversationId, messageId);
    if (candidates.length === 0) return [];

    const saved: MemoryRecord[] = [];

    for (const candidate of candidates) {
      const decision = this.policy.evaluateCandidate(candidate);
      if (decision.allowed) {
        const conflict = await this.detectConflict(candidate, userId);
        const record = await this.repository.create(
          {
            content: candidate.content,
            category: candidate.category,
            source: "USER",
            sourceType: candidate.sourceType,
            confidence: candidate.confidence,
            importance: candidate.importance,
            scope: candidate.scope ?? "PRIVATE",
            sourceConversationId: candidate.sourceConversationId,
            sourceMessageId: candidate.sourceMessageId,
          },
          userId
        );

        if (conflict.hasConflict && conflict.conflictingMemory && conflict.action === "supersede") {
          await this.repository.markSuperseded(conflict.conflictingMemory.id, record.id, userId);
        }

        saved.push(record);
      }
    }

    return saved;
  }

  async detectConflict(candidate: CandidateMemory, userId?: string): Promise<ConflictDetectionResult> {
    const ownerId = await this.repository.resolveOwnerId(userId);
    const existingActive = await this.repository.findActiveByCategory(ownerId, candidate.category);

    if (existingActive.length === 0) {
      return { hasConflict: false, action: "none" };
    }

    const newContent = candidate.content.toLowerCase();

    // Check for topic/subject conflict
    for (const existing of existingActive) {
      const existingContent = existing.content.toLowerCase();

      // If identical content already exists, skip duplicate
      if (newContent === existingContent) {
        return { hasConflict: false, action: "none" };
      }

      // Check conflict on key subjects:
      // 1. Backend / Server / Database stack
      const isTechStackTopic =
        (/\b(?:backend|server|framework|api|database|orm)\b/.test(existingContent) &&
          /\b(?:backend|server|framework|api|database|orm)\b/.test(newContent));

      // 2. Preferences on the same subject (e.g. "dark mode" vs "light mode", "typescript" vs "python")
      const isPreferenceTopic =
        candidate.category === "PREFERENCE" &&
        existing.category === "PREFERENCE" &&
        extractSubject(existingContent) === extractSubject(newContent);

      // 3. Project description for same named project
      const isProjectTopic =
        candidate.category === "PROJECT" &&
        existing.category === "PROJECT" &&
        extractSubject(existingContent) === extractSubject(newContent);

      // 4. Contradiction between technologies/settings for same topic
      if (isTechStackTopic || isPreferenceTopic || isProjectTopic) {
        return {
          hasConflict: true,
          conflictingMemory: existing,
          action: "supersede",
          reason: `Contradicting statement detected on topic "${extractSubject(newContent)}".`,
        };
      }
    }

    return { hasConflict: false, action: "none" };
  }
}

function extractSubject(content: string): string {
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Return primary subject noun if present
  const knownSubjects = ["backend", "frontend", "database", "theme", "language", "ashvi", "mode", "editor"];
  for (const s of knownSubjects) {
    if (words.includes(s)) return s;
  }
  return words.slice(0, 2).join("_");
}
