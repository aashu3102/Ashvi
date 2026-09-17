import type { MemoryCategory, MemorySource, PrismaClient } from "@prisma/client";
import { MemoryService } from "../memory/memory.service.js";

// Maintain backward-compatible memory service using the new modular engine
const serviceCache = new WeakMap<PrismaClient, MemoryService>();

function getService(db: PrismaClient): MemoryService {
  let service = serviceCache.get(db);
  if (!service) {
    service = new MemoryService(db);
    serviceCache.set(db, service);
  }
  return service;
}

export async function listMemory(db: PrismaClient, authenticatedUserId?: string) {
  const service = getService(db);
  return service.listMemories(authenticatedUserId);
}

export async function createMemory(
  db: PrismaClient,
  data: {
    content: string;
    category?: MemoryCategory;
    source?: MemorySource;
    importance?: number;
  },
  authenticatedUserId?: string
) {
  const service = getService(db);
  return service.createMemory(
    {
      content: data.content,
      category: data.category ?? "OTHER",
      source: data.source ?? "EXPLICIT_MEMORY",
      importance: data.importance ?? 3,
    },
    authenticatedUserId
  );
}

export async function updateMemory(
  db: PrismaClient,
  id: string,
  data: { content?: string; category?: MemoryCategory; importance?: number },
  authenticatedUserId?: string
) {
  const service = getService(db);
  return service.updateMemory(id, data, authenticatedUserId);
}

export async function deleteMemory(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const service = getService(db);
  return service.deleteMemory(id, authenticatedUserId);
}

export async function archiveMemory(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const service = getService(db);
  return service.archiveMemory(id, authenticatedUserId);
}

export async function shareMemory(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const service = getService(db);
  return service.shareMemory(id, authenticatedUserId);
}

export async function unshareMemory(db: PrismaClient, id: string, authenticatedUserId?: string) {
  const service = getService(db);
  return service.unshareMemory(id, authenticatedUserId);
}

export async function retrieveRelevantMemories(
  db: PrismaClient,
  query: string,
  authenticatedUserId?: string,
  limit = 5
): Promise<string> {
  const service = getService(db);
  const result = await service.retrieveContext(query, authenticatedUserId, { limit });
  return result.formattedContext;
}

export function suggestMemory(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length < 12 || normalized.length > 500) return null;

  const preference = /\b(i prefer|i like|i dislike|i hate|please always|please never|my preference is)\b/i.test(normalized);
  const instruction = /\b(remember that|keep in mind|from now on|always|never)\b/i.test(normalized);
  const fact = /\b(my name is|i am|i work|i live|my project is|we are building)\b/i.test(normalized);
  if (!preference && !instruction && !fact) return null;

  return {
    content: normalized,
    category: preference ? ("PREFERENCE" as MemoryCategory) : instruction ? ("INSTRUCTION" as MemoryCategory) : ("FACT" as MemoryCategory),
    source: "USER" as MemorySource,
    importance: preference || instruction ? 4 : 3,
  } as const;
}
