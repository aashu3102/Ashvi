import type { FastifyInstance, FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { listDocuments, processDocument } from "../services/document.service.js";

const allowed = new Set([".pdf", ".docx", ".txt", ".md"]);
const root = join(process.cwd(), "../../data/documents");

export async function documentRoutes(app: FastifyInstance) {
  app.get("/api/documents", async (request) => listDocuments(app.prisma, request.userId ?? undefined));

  app.get<{ Params: { id: string } }>("/api/documents/:id/preview", async (req, reply) => {
    const document = await app.prisma.document.findUnique({
      where: { id: req.params.id, userId: req.userId ?? undefined },
      include: { chunks: { orderBy: { chunkIndex: "asc" }, take: 3 } },
    });
    if (!document) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found." } });

    return {
      id: document.id,
      filename: document.filename,
      status: document.status,
      preview: document.chunks.map((chunk) => chunk.content).join("\n\n"),
    };
  });

  app.post("/api/documents/upload", async (request: FastifyRequest, reply) => {
    if (!request.userId) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    const part = await request.file();
    if (!part) return reply.code(400).send({ error: { code: "FILE_REQUIRED", message: "Upload a document." } });

    const ext = extname(basename(part.filename)).toLowerCase();
    if (!allowed.has(ext)) {
      return reply.code(400).send({ error: { code: "UNSUPPORTED_FILE", message: "Only PDF, DOCX, TXT, and Markdown files are supported." } });
    }

    await mkdir(root, { recursive: true });
    const storagePath = join(root, `${randomUUID()}${ext}`);

    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(storagePath);
      part.file.pipe(out).on("finish", resolve).on("error", reject);
    });

    const firstBytes = (await readFile(storagePath)).subarray(0, 8);
    const invalidPdf = ext === ".pdf" && firstBytes.toString("ascii", 0, 4) !== "%PDF";
    const invalidDocx = ext === ".docx" && (firstBytes.length < 2 || firstBytes[0] !== 0x50 || firstBytes[1] !== 0x4b);
    if (invalidPdf || invalidDocx) {
      await unlink(storagePath).catch(() => {});
      return reply.code(400).send({ error: { code: "INVALID_FILE", message: "The uploaded file content does not match its type." } });
    }

    const document = await app.prisma.document.create({
        data: {
          userId: request.userId,
          filename: basename(part.filename),
          mimeType: part.mimetype,
          storagePath,
          status: "PENDING",
        },
      });

    void processDocument(app.prisma, document.id);
    return reply.code(201).send(document);
  });

  app.delete<{ Params: { id: string } }>("/api/documents/:id", async (req, reply) => {
    const doc = await app.prisma.document.findFirst({ where: { id: req.params.id, userId: req.userId ?? undefined } });
    if (!doc) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found." } });

    await unlink(doc.storagePath).catch(() => {});
    await app.prisma.document.delete({ where: { id: doc.id } });
    return reply.code(204).send();
  });
}

