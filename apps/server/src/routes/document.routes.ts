import type { FastifyInstance, FastifyRequest } from "fastify";
import { DocumentService } from "../rag/document.service.js";

export async function documentRoutes(app: FastifyInstance) {
  const service = new DocumentService(app.prisma);

  app.get("/api/documents", async (request) => {
    return service.listDocuments(request.userId ?? "anonymous", true);
  });

  app.get<{ Params: { id: string } }>("/api/documents/:id/preview", async (req, reply) => {
    const preview = await service.getDocumentPreview(req.params.id, req.userId ?? "anonymous");
    if (!preview) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found." } });
    }
    return preview;
  });

  app.get<{ Params: { id: string } }>("/api/documents/:id/status", async (req, reply) => {
    const doc = await app.prisma.document.findFirst({
      where: {
        id: req.params.id,
        OR: [{ userId: req.userId ?? "anonymous" }, { scope: "SHARED" as const }],
      },
      select: {
        id: true,
        filename: true,
        status: true,
        scope: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!doc) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found." } });
    }

    return doc;
  });

  app.post("/api/documents/upload", async (request: FastifyRequest, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    const isMultipart = request.isMultipart();
    if (!isMultipart) {
      return reply.code(400).send({ error: { code: "BAD_REQUEST", message: "Multipart form data required." } });
    }

    const uploadedFiles: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];

    // Collect files using async iterator for multi-file support (up to 30 files)
    for await (const part of request.files()) {
      const buffer = await part.toBuffer();
      uploadedFiles.push({
        buffer,
        filename: part.filename,
        mimeType: part.mimetype,
      });
    }

    // Fallback to single file part if iterator was empty
    if (uploadedFiles.length === 0) {
      const singlePart = await request.file().catch(() => null);
      if (singlePart) {
        uploadedFiles.push({
          buffer: await singlePart.toBuffer(),
          filename: singlePart.filename,
          mimeType: singlePart.mimetype,
        });
      }
    }

    if (uploadedFiles.length === 0) {
      return reply.code(400).send({ error: { code: "FILE_REQUIRED", message: "Upload at least one document." } });
    }

    if (uploadedFiles.length > 30) {
      return reply.code(400).send({
        error: { code: "BATCH_LIMIT_EXCEEDED", message: "Maximum 30 files allowed per upload batch." },
      });
    }

    if (uploadedFiles.length === 1) {
      const file = uploadedFiles[0];
      try {
        const result = await service.saveAndIndexFile(
          file.buffer,
          file.filename,
          file.mimeType,
          request.userId
        );

        if (result.status === "REJECTED") {
          return reply.code(422).send({
            error: { code: "PAGE_LIMIT_EXCEEDED", message: result.error },
          });
        }

        if (result.status === "FAILED") {
          return reply.code(400).send({
            error: { code: "PROCESSING_FAILED", message: result.error },
          });
        }

        const doc = await app.prisma.document.findUnique({ where: { id: result.id } });
        return reply.code(201).send(doc);
      } catch (err: unknown) {
        const errorRecord = err as { code?: string; message?: string };
        const code = errorRecord?.code || "UPLOAD_ERROR";
        return reply.code(400).send({
          error: { code, message: errorRecord?.message || "Upload failed." },
        });
      }
    }

    // Multi-file batch upload
    const batchResult = await service.processBatch(uploadedFiles, request.userId);
    return reply.code(201).send(batchResult);
  });

  app.post<{ Body: { query: string; documentIds?: string[]; topK?: number; minSimilarity?: number } }>(
    "/api/documents/search",
    async (request, reply) => {
      const userId = request.userId ?? "anonymous";
      const { query, documentIds, topK, minSimilarity } = request.body || {};

      if (!query || !query.trim()) {
        return reply.code(400).send({ error: { code: "QUERY_REQUIRED", message: "Search query is required." } });
      }

      const evidence = await service.retrieveContext(query, userId, {
        documentIds,
        topK,
        minSimilarity,
      });

      return evidence;
    }
  );

  app.post<{ Params: { id: string } }>("/api/documents/:id/reprocess", async (req, reply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    try {
      const result = await service.reprocessDocument(req.params.id, req.userId);
      return result;
    } catch (err: unknown) {
      const errorRecord = err as { message?: string };
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: errorRecord?.message || "Document not found." } });
    }
  });

  app.post<{ Params: { id: string } }>("/api/documents/:id/share", async (req, reply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    const updated = await service.setDocumentScope(req.params.id, req.userId, "SHARED");
    if (!updated) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found or access denied." } });
    }

    return { status: "success", scope: "SHARED" };
  });

  app.post<{ Params: { id: string } }>("/api/documents/:id/unshare", async (req, reply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    const updated = await service.setDocumentScope(req.params.id, req.userId, "PRIVATE");
    if (!updated) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found or access denied." } });
    }

    return { status: "success", scope: "PRIVATE" };
  });

  app.delete<{ Params: { id: string } }>("/api/documents/:id", async (req, reply) => {
    if (!req.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }

    const deleted = await service.deleteDocument(req.params.id, req.userId);
    if (!deleted) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Document not found." } });
    }

    return reply.code(204).send();
  });
}
