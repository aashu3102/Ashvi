import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { NotebookService } from "../services/notebook.service.js";
import { DocumentService } from "../rag/document.service.js";
import type { AshviOrchestrator } from "../orchestrator/orchestrator.js";

const createNotebookSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  documentIds: z.array(z.string()).optional(),
});

const updateNotebookSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});

const addNoteSchema = z.object({
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(50000),
});

const attachDocumentsSchema = z.object({
  documentIds: z.array(z.string()).min(1),
});

const queryNotebookSchema = z.object({
  prompt: z.string().min(1).max(10000),
});

export async function notebookRoutes(app: FastifyInstance, options: { orchestrator?: AshviOrchestrator } = {}) {
  const documentService = app.prisma ? new DocumentService(app.prisma) : undefined;
  const service = new NotebookService(app.prisma, documentService, options.orchestrator);

  app.get("/api/notebooks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    return service.listNotebooks(request.userId);
  });

  app.post("/api/notebooks", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const body = createNotebookSchema.parse(request.body);
    const created = await service.createNotebook(body.title, body.description, body.documentIds, request.userId);
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>("/api/notebooks/:id", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const nb = await service.getNotebook(request.params.id, request.userId);
    if (!nb) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
    }
    return nb;
  });

  app.patch<{ Params: { id: string } }>("/api/notebooks/:id", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const body = updateNotebookSchema.parse(request.body);
    const updated = await service.updateNotebook(request.params.id, body, request.userId);
    if (!updated) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
    }
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api/notebooks/:id", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const deleted = await service.deleteNotebook(request.params.id, request.userId);
    if (!deleted) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
    }
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/notebooks/:id/documents", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const body = attachDocumentsSchema.parse(request.body);
    const docIds = await service.attachDocuments(request.params.id, body.documentIds, request.userId);
    if (!docIds) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
    }
    return reply.code(200).send({ documentIds: docIds });
  });

  app.delete<{ Params: { id: string; documentId: string } }>(
    "/api/notebooks/:id/documents/:documentId",
    async (request, reply) => {
      if (!request.userId) {
        return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
      }
      const docIds = await service.detachDocument(request.params.id, request.params.documentId, request.userId);
      if (!docIds) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
      }
      return reply.code(200).send({ documentIds: docIds });
    }
  );

  app.post<{ Params: { id: string } }>("/api/notebooks/:id/notes", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const body = addNoteSchema.parse(request.body);
    const note = await service.addNote(request.params.id, body, request.userId);
    if (!note) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notebook not found." } });
    }
    return reply.code(201).send(note);
  });

  app.post<{ Params: { id: string } }>("/api/notebooks/:id/query", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Authentication required." } });
    }
    const body = queryNotebookSchema.parse(request.body);
    try {
      const result = await service.queryNotebook(request.params.id, body.prompt, request.userId);
      return reply.code(200).send(result);
    } catch (err: unknown) {
      request.log.error({ err }, "Notebook query failed");
      const message = err instanceof Error ? err.message : "Notebook query failed.";
      return reply.code(500).send({ error: { code: "NOTEBOOK_QUERY_FAILED", message } });
    }
  });
}
