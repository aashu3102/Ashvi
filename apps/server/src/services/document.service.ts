import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { PrismaClient } from "@prisma/client";

const localUser = { email: "local@ashvi.local", name: "Local user" };
const chunkWordLimit = 220;
const chunkOverlap = 35;
const stopWords = new Set([
  "about", "after", "again", "also", "because", "before", "could", "from", "have", "into",
  "more", "over", "should", "that", "their", "there", "these", "this", "those", "what",
  "when", "where", "which", "while", "with", "would", "your",
]);

function terms(value: string) {
  return new Set(
    value.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term)),
  );
}

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

async function extractText(storagePath: string, filename: string) {
  const buffer = await readFile(storagePath);
  const extension = extname(filename).toLowerCase();

  if (extension === ".pdf") {
    const { default: pdfParse } = await import("pdf-parse");
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (extension === ".docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf8");
}

async function ownerId(db: PrismaClient, authenticatedUserId?: string) {
  if (authenticatedUserId) return authenticatedUserId;
  const user = await db.user.upsert({ where: { email: localUser.email }, update: {}, create: localUser });
  return user.id;
}

export async function processDocument(db: PrismaClient, documentId: string) {
  const document = await db.document.findUnique({ where: { id: documentId } });
  if (!document) return;

  await db.document.update({ where: { id: documentId }, data: { status: "PROCESSING" } });

  try {
    const text = (await extractText(document.storagePath, document.filename)).replace(/\s+/g, " ").trim();
    const chunks = createChunks(text);

    await db.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({ where: { documentId } });
      if (chunks.length > 0) {
        await transaction.documentChunk.createMany({
          data: chunks.map((content, chunkIndex) => ({
            documentId,
            chunkIndex,
            content,
            tokenCount: content.split(/\s+/).length,
          })),
        });
      }
      await transaction.document.update({
        where: { id: documentId },
        data: {
          status: "READY",
          metadata: { characterCount: text.length, chunkCount: chunks.length },
        },
      });
    });
  } catch (error) {
    await db.document.update({
      where: { id: documentId },
      data: { status: "FAILED", metadata: { error: error instanceof Error ? error.message : "Document processing failed." } },
    });
  }
}

export async function listDocuments(db: PrismaClient, authenticatedUserId?: string) {
  return db.document.findMany({
    where: { userId: await ownerId(db, authenticatedUserId) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });
}

export async function retrieveDocumentContext(db: PrismaClient, query: string, authenticatedUserId?: string, limit = 4) {
  const queryTerms = terms(query);
  if (queryTerms.size === 0) return "";

  const chunks = await db.documentChunk.findMany({
    where: { document: { userId: await ownerId(db, authenticatedUserId), status: "READY" } },
    orderBy: [{ document: { updatedAt: "desc" } }, { chunkIndex: "asc" }],
    include: { document: { select: { filename: true } } },
  });

  const ranked = chunks
    .map((chunk) => {
      const chunkTerms = terms(chunk.content);
      const overlap = [...queryTerms].filter((term) => chunkTerms.has(term)).length;
      return { chunk, score: overlap / Math.max(queryTerms.size, 1) };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  if (ranked.length === 0) return "";

  return ranked
    .map(({ chunk }) => `[Source: ${chunk.document.filename}, section ${chunk.chunkIndex + 1}]\n${chunk.content}`)
    .join("\n\n");
}
