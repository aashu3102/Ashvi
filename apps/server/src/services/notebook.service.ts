import type { PrismaClient } from "@prisma/client";
import type { DocumentService } from "../rag/document.service.js";
import type { AshviOrchestrator } from "../orchestrator/orchestrator.js";

export interface NotebookNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export class NotebookService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentService?: DocumentService,
    private readonly orchestrator?: AshviOrchestrator
  ) {}

  async listNotebooks(userId: string) {
    const items = await this.prisma.notebook.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return items.map((nb) => ({
      id: nb.id,
      title: nb.title,
      description: nb.description,
      documentCount: nb.documentIds.length,
      noteCount: Array.isArray(nb.notes) ? (nb.notes as unknown[]).length : 0,
      createdAt: nb.createdAt.toISOString(),
      updatedAt: nb.updatedAt.toISOString(),
    }));
  }

  async getNotebook(id: string, userId: string) {
    const nb = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!nb) return null;

    // Fetch details of attached documents ensuring strict privacy
    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: nb.documentIds },
        OR: [{ userId }, { scope: "SHARED" }],
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        status: true,
        scope: true,
        createdAt: true,
      },
    });

    return {
      id: nb.id,
      title: nb.title,
      description: nb.description,
      documentIds: nb.documentIds,
      documents,
      notes: (nb.notes ?? []) as unknown as NotebookNote[],
      createdAt: nb.createdAt.toISOString(),
      updatedAt: nb.updatedAt.toISOString(),
    };
  }

  async createNotebook(title: string, description: string | undefined, documentIds: string[] = [], userId: string) {
    // Verify document ownership
    if (documentIds.length > 0) {
      const validDocs = await this.prisma.document.findMany({
        where: {
          id: { in: documentIds },
          OR: [{ userId }, { scope: "SHARED" }],
        },
        select: { id: true },
      });
      const validIds = new Set(validDocs.map((d) => d.id));
      documentIds = documentIds.filter((id) => validIds.has(id));
    }

    const nb = await this.prisma.notebook.create({
      data: {
        userId,
        title: title.trim() || "Untitled Notebook",
        description: description?.trim(),
        documentIds,
        notes: [],
      },
    });

    return {
      id: nb.id,
      title: nb.title,
      description: nb.description,
      documentIds: nb.documentIds,
      createdAt: nb.createdAt.toISOString(),
      updatedAt: nb.updatedAt.toISOString(),
    };
  }

  async updateNotebook(
    id: string,
    data: { title?: string; description?: string; notes?: NotebookNote[] },
    userId: string
  ) {
    const existing = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!existing) return null;

    const updated = await this.prisma.notebook.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() || "Untitled Notebook" } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() } : {}),
        ...(data.notes !== undefined ? { notes: data.notes as unknown as object } : {}),
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      documentIds: updated.documentIds,
      notes: updated.notes,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteNotebook(id: string, userId: string): Promise<boolean> {
    const existing = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!existing) return false;

    await this.prisma.notebook.delete({ where: { id } });
    return true;
  }

  async attachDocuments(id: string, newDocumentIds: string[], userId: string) {
    const nb = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!nb) return null;

    // Validate ownership of documents to attach
    const validDocs = await this.prisma.document.findMany({
      where: {
        id: { in: newDocumentIds },
        OR: [{ userId }, { scope: "SHARED" }],
      },
      select: { id: true },
    });

    const validIdSet = new Set(validDocs.map((d) => d.id));
    const combined = Array.from(new Set([...nb.documentIds, ...validIdSet]));

    const updated = await this.prisma.notebook.update({
      where: { id },
      data: { documentIds: combined },
    });

    return updated.documentIds;
  }

  async detachDocument(id: string, documentId: string, userId: string) {
    const nb = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!nb) return null;

    const filtered = nb.documentIds.filter((dId) => dId !== documentId);
    const updated = await this.prisma.notebook.update({
      where: { id },
      data: { documentIds: filtered },
    });

    return updated.documentIds;
  }

  async addNote(id: string, noteData: { title: string; content: string }, userId: string) {
    const nb = await this.prisma.notebook.findFirst({
      where: { id, userId },
    });
    if (!nb) return null;

    const existingNotes = (Array.isArray(nb.notes) ? nb.notes : []) as unknown as NotebookNote[];
    const now = new Date().toISOString();
    const newNote: NotebookNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: noteData.title.trim() || "Untitled Note",
      content: noteData.content.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const updatedNotes = [newNote, ...existingNotes];
    await this.prisma.notebook.update({
      where: { id },
      data: { notes: updatedNotes as unknown as object },
    });

    return newNote;
  }

  async queryNotebook(id: string, prompt: string, userId: string) {
    const nb = await this.getNotebook(id, userId);
    if (!nb) {
      throw new Error("Notebook not found or access unauthorized.");
    }

    if (!this.documentService || !this.orchestrator) {
      throw new Error("Document analysis and orchestration services are not available.");
    }

    // Retrieve RAG context scoped strictly to this notebook's documents
    const docResult = await this.documentService.retrieveContext(prompt, userId, {
      documentIds: nb.documentIds,
    });

    const task = await this.orchestrator.execute({
      userId,
      conversationId: `notebook-${id}`,
      prompt,
      documentContext: docResult.formattedEvidence,
      documentIds: nb.documentIds,
      notebookId: id,
    });

    return {
      answer: task.result?.content ?? "",
      verification: task.verification,
      citations: docResult.citations,
      chunksUsed: docResult.chunksUsed,
      notebookId: id,
      sources: task.sources,
    };
  }
}
