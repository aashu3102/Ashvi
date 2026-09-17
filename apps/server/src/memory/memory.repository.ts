import type { PrismaClient } from "@prisma/client";
import type {
  CreateMemoryInput,
  ImportanceLevel,
  MemoryCategory,
  MemoryRecord,
  MemoryScope,
  MemoryStatus,
  UpdateMemoryInput,
} from "./types.js";

const DEFAULT_LOCAL_USER = { email: "local@ashvi.local", name: "Local user" };

export function normalizeImportance(importance?: number | ImportanceLevel): number {
  if (typeof importance === "number") {
    return Math.min(5, Math.max(1, Math.round(importance)));
  }
  if (importance === "HIGH") return 5;
  if (importance === "MEDIUM") return 3;
  if (importance === "LOW") return 1;
  return 3;
}

export class MemoryRepository {
  constructor(private prisma: PrismaClient) {}

  async resolveOwnerId(userId?: string): Promise<string> {
    if (userId) return userId;
    const user = await this.prisma.user.upsert({
      where: { email: DEFAULT_LOCAL_USER.email },
      update: {},
      create: DEFAULT_LOCAL_USER,
    });
    return user.id;
  }

  async findActiveAccessibleMemories(
    userId?: string,
    categories?: MemoryCategory[]
  ): Promise<MemoryRecord[]> {
    const effectiveUserId = await this.resolveOwnerId(userId);

    const records = await this.prisma.memory.findMany({
      where: {
        status: "ACTIVE",
        ...(categories && categories.length > 0 ? { category: { in: categories } } : {}),
        OR: [
          { userId: effectiveUserId },
          { scope: "SHARED" },
        ],
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return records as MemoryRecord[];
  }

  async listUserMemories(
    userId?: string,
    filters: { status?: MemoryStatus; category?: MemoryCategory } = {}
  ): Promise<MemoryRecord[]> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const targetStatus = filters.status ?? "ACTIVE";

    const records = await this.prisma.memory.findMany({
      where: {
        status: targetStatus,
        ...(filters.category ? { category: filters.category } : {}),
        OR: [
          { userId: effectiveUserId },
          { scope: "SHARED" },
        ],
      },
      orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    });

    return records as MemoryRecord[];
  }

  async findById(id: string, userId?: string): Promise<MemoryRecord | null> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const record = await this.prisma.memory.findFirst({
      where: {
        id,
        OR: [
          { userId: effectiveUserId },
          { scope: "SHARED" },
        ],
      },
    });

    return record as MemoryRecord | null;
  }

  async create(data: CreateMemoryInput, userId?: string): Promise<MemoryRecord> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const importance = normalizeImportance(data.importance);

    const record = await this.prisma.memory.create({
      data: {
        userId: effectiveUserId,
        content: data.content.trim(),
        category: data.category ?? "OTHER",
        source: data.source ?? "EXPLICIT_MEMORY",
        sourceType: data.sourceType ?? "EXPLICIT_USER",
        sourceConversationId: data.sourceConversationId,
        sourceMessageId: data.sourceMessageId,
        confidence: data.confidence ?? "HIGH",
        importance,
        scope: data.scope ?? "PRIVATE",
        status: "ACTIVE",
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });

    return record as MemoryRecord;
  }

  async update(id: string, data: UpdateMemoryInput, userId?: string): Promise<MemoryRecord | null> {
    const effectiveUserId = await this.resolveOwnerId(userId);

    const updateData: Record<string, unknown> = {};
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.category !== undefined) updateData.category = data.category;
    if (data.confidence !== undefined) updateData.confidence = data.confidence;
    if (data.importance !== undefined) updateData.importance = normalizeImportance(data.importance);
    if (data.scope !== undefined) updateData.scope = data.scope;
    if (data.status !== undefined) updateData.status = data.status;

    // Enforce ownership: only the owner can update their memory
    const result = await this.prisma.memory.updateMany({
      where: { id, userId: effectiveUserId },
      data: updateData,
    });

    if (result.count === 0) return null;
    return this.findById(id, effectiveUserId);
  }

  async markSuperseded(oldId: string, newId: string, userId?: string): Promise<boolean> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const result = await this.prisma.memory.updateMany({
      where: { id: oldId, userId: effectiveUserId },
      data: {
        status: "SUPERSEDED",
        supersededBy: newId,
      },
    });
    return result.count > 0;
  }

  async archive(id: string, userId?: string): Promise<boolean> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const result = await this.prisma.memory.updateMany({
      where: { id, userId: effectiveUserId },
      data: { status: "ARCHIVED" },
    });
    return result.count > 0;
  }

  async delete(id: string, userId?: string): Promise<boolean> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const result = await this.prisma.memory.deleteMany({
      where: { id, userId: effectiveUserId },
    });
    return result.count > 0;
  }

  async setScope(id: string, scope: MemoryScope, userId?: string): Promise<MemoryRecord | null> {
    const effectiveUserId = await this.resolveOwnerId(userId);
    const result = await this.prisma.memory.updateMany({
      where: { id, userId: effectiveUserId },
      data: { scope },
    });
    if (result.count === 0) return null;
    return this.findById(id, effectiveUserId);
  }

  async findActiveByCategory(userId: string, category: MemoryCategory): Promise<MemoryRecord[]> {
    const records = await this.prisma.memory.findMany({
      where: {
        userId,
        category,
        status: "ACTIVE",
      },
    });
    return records as MemoryRecord[];
  }
}
