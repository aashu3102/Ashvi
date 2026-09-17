import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import type { Environment } from "../config/env.js";
import { OllamaProvider } from "../ai/ollama.provider.js";
import { GeminiProvider } from "../ai/gemini.provider.js";
import { createConversationSchema, createMessageSchema, updateConversationSchema } from "@ashvi/shared/schemas";
import { addAssistantMessage, addUserMessage, createConversation, deleteConversation, getConversation, listConversations, renameConversation } from "../services/conversation.service.js";
import { retrieveDocumentContext } from "../services/document.service.js";
import { retrieveRelevantMemories, suggestMemory } from "../services/memory.service.js";
import type { AIProvider } from "../ai/provider.js";
import { AshviOrchestrator, ProviderRegistry, type OrchestratorTask } from "../orchestrator/index.js";

import { MemoryService } from "../memory/memory.service.js";
import { DocumentService } from "../rag/document.service.js";

export async function conversationRoutes(app: FastifyInstance, options: { environment: Environment; provider?: AIProvider; orchestrator?: AshviOrchestrator }) {
  const qwenProvider = options.provider ?? new OllamaProvider(options.environment.OLLAMA_BASE_URL, options.environment.ASHVI_AI_MODEL);
  const geminiProvider = new GeminiProvider({
    apiKey: options.environment.GEMINI_API_KEY,
    defaultModel: options.environment.GEMINI_MODEL,
    defaultImageModel: options.environment.GEMINI_IMAGE_MODEL,
  });

  const registry = new ProviderRegistry();
  // Primary local intelligence
  registry.register(
    {
      id: "qwen",
      name: "Local Qwen (Ollama)",
      provider: qwenProvider,
      defaultModel: options.environment.ASHVI_AI_MODEL,
      supportsStreaming: typeof qwenProvider.chatStream === "function",
      priority: 10,
    },
    options.environment.DEFAULT_AI_PROVIDER !== "gemini"
  );

  // Cloud Gemini intelligence if configured
  if (options.environment.GEMINI_API_KEY) {
    registry.register(
      {
        id: "gemini",
        name: "Gemini API",
        provider: geminiProvider,
        defaultModel: options.environment.GEMINI_MODEL,
        supportsStreaming: true,
        priority: 5,
      },
      options.environment.DEFAULT_AI_PROVIDER === "gemini"
    );
  }

  const memoryService = app.prisma ? new MemoryService(app.prisma) : undefined;
  const documentService = app.prisma ? new DocumentService(app.prisma) : undefined;
  const orchestrator = options.orchestrator ?? new AshviOrchestrator({
    registry,
    defaultProvider: qwenProvider,
    defaultModel: options.environment.ASHVI_AI_MODEL,
    logger: app.log,
    memoryService,
    documentService,
  });

  app.get("/api/conversations", async (request) => listConversations(app.prisma, request.userId ?? undefined));
  app.post("/api/conversations", async (request, reply) => {
    const body = createConversationSchema.parse(request.body);
    return reply.code(201).send(await createConversation(app.prisma, body.title, request.userId ?? undefined));
  });
  app.get<{ Params: { id: string } }>("/api/conversations/:id", async (request, reply) => {
    const item = await getConversation(app.prisma, request.params.id, request.userId ?? undefined);
    return item ?? reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
  });
  app.patch<{ Params: { id: string } }>("/api/conversations/:id", async (request, reply) => {
    const body = updateConversationSchema.parse(request.body);
    const item = await renameConversation(app.prisma, request.params.id, body.title, request.userId ?? undefined);
    return item ?? reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
  });
  app.delete<{ Params: { id: string } }>("/api/conversations/:id", async (request, reply) => {
    return (await deleteConversation(app.prisma, request.params.id, request.userId ?? undefined)) ? reply.code(204).send() : reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
  });
  app.post<{ Params: { id: string } }>("/api/conversations/:id/messages", async (request, reply) => {
    const body = createMessageSchema.parse(request.body);
    const message = await addUserMessage(app.prisma, request.params.id, body.content, request.userId ?? undefined);
    if (!message) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
    const conversation = await getConversation(app.prisma, request.params.id, request.userId ?? undefined);
    try {
      const documentContext = await retrieveDocumentContext(app.prisma, body.content, request.userId ?? undefined);
      const memoryContext = await retrieveRelevantMemories(app.prisma, body.content, request.userId ?? undefined);
      const task = await orchestrator.execute({
        requestId: request.id,
        userId: request.userId ?? undefined,
        conversationId: request.params.id,
        prompt: body.content,
        messages: conversation!.messages,
        documentContext,
        memoryContext,
      });

      const assistant = await addAssistantMessage(app.prisma, request.params.id, task.result!.content, {
        verification: task.verification,
        sources: task.sources,
        searchUsed: task.searchUsed,
        images: task.images,
        orchestrator: {
          requestId: task.requestId,
          intent: task.intent,
          classification: task.classification,
          plan: task.plan,
          model: task.model,
          provider: task.selectedProvider,
          timestamps: task.timestamps,
        },
      } as unknown as Prisma.InputJsonValue);

      return reply.code(201).send({
        user: message,
        assistant,
      });
    } catch (error) {
      request.log.error({ err: error }, "AI response failed");
      return reply.code(503).send({ error: { code: "AI_UNAVAILABLE", message: "Ashvi could not reach the local AI provider." } });
    }
  });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/messages/stream', async (request, reply) => {
    const rawBody = (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>;
    const body = createMessageSchema.parse(request.body);
    const language: "en" | "hi" = rawBody.language === "hi" ? "hi" : "en";
    const enableSearch = Boolean(rawBody.enableSearch);
    const message = await addUserMessage(app.prisma, request.params.id, body.content, request.userId ?? undefined);
    if (!message) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });

    const conversation = await getConversation(app.prisma, request.params.id, request.userId ?? undefined);
    if (!conversation) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });
    }

    const stream = Readable.from((async function* () {
      try {
        const documentContext = await retrieveDocumentContext(app.prisma, body.content, request.userId ?? undefined);
        const memoryContext = await retrieveRelevantMemories(app.prisma, body.content, request.userId ?? undefined);
        const suggestion = suggestMemory(body.content);
        if (suggestion) yield `data: ${JSON.stringify({ type: "memory_suggestion", suggestion })}\n\n`;

        let completedTask: OrchestratorTask | null = null;
        for await (const event of orchestrator.executeStream({
          requestId: request.id,
          userId: request.userId ?? undefined,
          conversationId: request.params.id,
          prompt: body.content,
          messages: conversation.messages,
          documentContext,
          memoryContext,
          language,
          enableSearch,
        })) {
          if (event.type === "chunk") {
            yield `data: ${JSON.stringify({ type: "chunk", content: event.content })}\n\n`;
          } else if (event.type === "sources") {
            yield `data: ${JSON.stringify({ type: "sources", sources: event.sources })}\n\n`;
          } else if (event.type === "image") {
            yield `data: ${JSON.stringify({ type: "image", image: event.image })}\n\n`;
          } else if (event.type === "done") {
            completedTask = event.task;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }

        if (!completedTask?.result?.content?.trim()) {
          throw new Error("AI provider returned an empty response.");
        }

        const assistant = await addAssistantMessage(app.prisma, request.params.id, completedTask.result.content, {
          verification: completedTask.verification,
          sources: completedTask.sources,
          searchUsed: completedTask.searchUsed,
          images: completedTask.images,
          orchestrator: {
            requestId: completedTask.requestId,
            intent: completedTask.intent,
            classification: completedTask.classification,
            plan: completedTask.plan,
            model: completedTask.model,
            provider: completedTask.selectedProvider,
            timestamps: completedTask.timestamps,
          },
        } as unknown as Prisma.InputJsonValue);

        yield `data: ${JSON.stringify({ type: "done", assistant, task: completedTask })}\n\n`;
      } catch (error) {
        request.log.error({ err: error }, "AI streaming response failed");
        yield `data: ${JSON.stringify({ type: "error", error: "Ashvi could not reach the local AI provider." })}\n\n`;
      }
    })());

    return reply.type("text/event-stream").send(stream);
  });
}
