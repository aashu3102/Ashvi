import type { PrismaClient } from "@prisma/client";
import { DocumentService } from "../rag/document.service.js";

const localUser = { email: "local@ashvi.local", name: "Local user" };
const chunkWordLimit = 220;
const chunkOverlap = 35;

export function createChunks(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkWordLimit, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = end - chunkOverlap;
  }

  return chunks;
}

async function ownerId(db: PrismaClient, authenticatedUserId?: string) {
  if (authenticatedUserId) return authenticatedUserId;
  const user = await db.user.upsert({ where: { email: localUser.email }, update: {}, create: localUser });
  return user.id;
}

export async function processDocument(db: PrismaClient, documentId: string) {
  const service = new DocumentService(db);
  return service.processDocument(documentId);
}

export async function listDocuments(db: PrismaClient, authenticatedUserId?: string) {
  const userId = await ownerId(db, authenticatedUserId);
  const service = new DocumentService(db);
  return service.listDocuments(userId, true);
}

export async function retrieveDocumentContext(
  db: PrismaClient,
  query: string,
  authenticatedUserId?: string,
  limit = 4
) {
  const userId = await ownerId(db, authenticatedUserId);
  const service = new DocumentService(db);
  const context = await service.retrieveContext(query, userId, { topK: limit });
  return context.formattedEvidence;
}
