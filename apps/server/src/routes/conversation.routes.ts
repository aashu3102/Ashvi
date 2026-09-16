import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { Environment } from "../config/env.js";
import { OllamaProvider } from "../ai/ollama.provider.js";
import { createConversationSchema, createMessageSchema, updateConversationSchema } from "@ashvi/shared/schemas";
import { addAssistantMessage, addUserMessage, createConversation, deleteConversation, getConversation, listConversations, renameConversation } from "../services/conversation.service.js";
import { verifyAnswer } from "../services/verification.service.js";
import { retrieveDocumentContext } from "../services/document.service.js";
import { retrieveRelevantMemories, suggestMemory } from "../services/memory.service.js";
import { buildChatTurns } from "../services/context.service.js";

export async function conversationRoutes(app: FastifyInstance, options: { environment: Environment }) {
  const provider = new OllamaProvider(options.environment.OLLAMA_BASE_URL, options.environment.ASHVI_AI_MODEL);
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
      const content = await provider.chat(buildChatTurns(conversation!.messages, documentContext, memoryContext));
      const verification = verifyAnswer(content, documentContext);
      return reply.code(201).send({
        user: message,
        assistant: await addAssistantMessage(app.prisma, request.params.id, content, {
          verification,
        }),
      });
    } catch (error) {
      request.log.error({ err: error }, "AI response failed");
      return reply.code(503).send({ error: { code: "AI_UNAVAILABLE", message: "Ashvi could not reach the local AI provider." } });
    }
  });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/messages/stream', async (request, reply) => {
    const body = createMessageSchema.parse(request.body);
    const message = await addUserMessage(app.prisma, request.params.id, body.content, request.userId ?? undefined);
    if (!message) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Conversation not found." } });

    const conversation = await getConversation(app.prisma, request.params.id, request.userId ?? undefined);
    if (!conversation || !provider.chatStream) {
      return reply.code(501).send({ error: { code: "AI_STREAM_UNAVAILABLE", message: "Streaming is not available for this provider." } });
    }

    const stream = Readable.from((async function* () {
      try {
        let fullContent = "";
        const documentContext = await retrieveDocumentContext(app.prisma, body.content, request.userId ?? undefined);
        const memoryContext = await retrieveRelevantMemories(app.prisma, body.content, request.userId ?? undefined);
        const suggestion = suggestMemory(body.content);
        if (suggestion) yield `data: ${JSON.stringify({ type: "memory_suggestion", suggestion })}\n\n`;
        for await (const chunk of provider.chatStream(buildChatTurns(conversation.messages, documentContext, memoryContext))) {
          fullContent += chunk;
          yield `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`;
        }

        const verification = verifyAnswer(fullContent, documentContext);
        const assistant = await addAssistantMessage(app.prisma, request.params.id, fullContent, { verification });
        yield `data: ${JSON.stringify({ type: "done", assistant })}\n\n`;
      } catch (error) {
        request.log.error({ err: error }, "AI streaming response failed");
        yield `data: ${JSON.stringify({ type: "error", error: "Ashvi could not reach the local AI provider." })}\n\n`;
      }
    })());

    return reply.type("text/event-stream").send(stream);
  });
}
