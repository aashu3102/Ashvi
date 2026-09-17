import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment } from "../config/env.js";
import { VoiceService } from "../voice/VoiceService.js";
import { STTProviderError } from "../voice/providers/stt/STTProvider.js";
import { TTSProviderError } from "../voice/providers/tts/TTSProvider.js";
import { VoiceProviderError } from "../voice/provider.js";

const languageSchema = z.enum(["en", "hi"]).default("en");

const synthesisSchema = z.object({
  text: z.string().trim().min(1).max(12000),
  language: languageSchema.optional().default("en"),
  rate: z.number().min(0.5).max(2.0).optional(),
  pitch: z.number().min(0.5).max(2.0).optional(),
  style: z.enum(["technical", "casual", "urgent", "empathetic", "default"]).optional(),
  emotion: z
    .enum(["calm", "happy", "excited", "serious", "concerned", "empathetic", "curious", "confident", "playful", "neutral"])
    .optional(),
});

const interruptSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.enum(["user_spoke", "explicit_cancel", "new_turn"]).optional(),
});

import { OllamaProvider } from "../ai/ollama.provider.js";
import { MemoryService } from "../memory/memory.service.js";
import { DocumentService } from "../rag/document.service.js";
import { AshviOrchestrator } from "../orchestrator/index.js";
import { addAssistantMessage, addUserMessage, getConversation } from "../services/conversation.service.js";
import { retrieveDocumentContext } from "../services/document.service.js";
import { retrieveRelevantMemories } from "../services/memory.service.js";

export async function voiceRoutes(
  app: FastifyInstance,
  options: {
    environment: Environment;
    voiceService?: VoiceService;
    orchestrator?: AshviOrchestrator;
  },
) {
  let orchestrator = options.orchestrator;
  if (!orchestrator && options.environment.NODE_ENV !== "test") {
    const provider = new OllamaProvider(options.environment.OLLAMA_BASE_URL, options.environment.ASHVI_AI_MODEL);
    const memoryService = app.prisma ? new MemoryService(app.prisma) : undefined;
    const documentService = app.prisma ? new DocumentService(app.prisma) : undefined;
    orchestrator = new AshviOrchestrator({
      defaultProvider: provider,
      defaultModel: options.environment.ASHVI_AI_MODEL,
      logger: app.log,
      memoryService,
      documentService,
    });
  }

  const voiceService =
    options.voiceService ??
    new VoiceService({
      environment: options.environment,
      orchestrator,
    });
  if (orchestrator) {
    voiceService.setOrchestrator(orchestrator);
  }

  // 1. Audio transcription
  app.post<{ Querystring: { language?: string } }>("/api/voice/transcribe", async (request, reply) => {
    const language = languageSchema.safeParse(request.query.language ?? "en");
    if (!language.success) {
      return reply.code(400).send({ error: { code: "INVALID_LANGUAGE", message: "Choose English or Hindi." } });
    }

    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ error: { code: "AUDIO_REQUIRED", message: "Record audio before transcribing." } });
    }

    try {
      const buffer = await file.toBuffer();
      const result = await voiceService.transcribe(buffer, file.filename || "recording.webm", language.data);
      return { transcript: result.text, language: language.data, durationMs: result.durationMs };
    } catch (error) {
      if (error instanceof STTProviderError) {
        return reply.code(503).send({ error: { code: error.code, message: error.message } });
      }
      if (error instanceof VoiceProviderError) {
        return reply.code(503).send({ error: { code: error.code, message: error.message } });
      }
      request.log.error({ err: error }, "Speech recognition failed");
      return reply.code(503).send({ error: { code: "STT_UNAVAILABLE", message: "Local speech recognition is unavailable." } });
    }
  });

  // 2. Audio synthesis
  app.post("/api/voice/synthesize", async (request, reply) => {
    const body = synthesisSchema.parse(request.body);
    try {
      const result = await voiceService.synthesize(body.text, {
        language: body.language,
        rate: body.rate,
        pitch: body.pitch,
        style: body.style,
        emotion: body.emotion,
      });
      return reply.type(result.contentType).header("cache-control", "no-store").send(result.audio);
    } catch (error) {
      if (error instanceof TTSProviderError) {
        return reply.code(503).send({ error: { code: error.code, message: error.message } });
      }
      if (error instanceof VoiceProviderError) {
        return reply.code(503).send({ error: { code: error.code, message: error.message } });
      }
      request.log.error({ err: error }, "Speech synthesis failed");
      return reply.code(503).send({ error: { code: "TTS_UNAVAILABLE", message: "Local voice output is unavailable." } });
    }
  });

  // 3. Complete single-turn voice conversation
  app.post("/api/voice/conversation", async (request, reply) => {
    let audioBuffer: Buffer | undefined;
    let filename: string | undefined;
    let text: string | undefined;
    let language: "en" | "hi" = "en";
    let conversationId: string | undefined;
    let sessionId: string = `session-${Date.now()}`;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "audio") {
          audioBuffer = await part.toBuffer();
          filename = part.filename;
        } else if (part.type === "field") {
          if (part.fieldname === "text") text = String(part.value);
          else if (part.fieldname === "language" && (part.value === "en" || part.value === "hi")) language = part.value;
          else if (part.fieldname === "conversationId") conversationId = String(part.value);
          else if (part.fieldname === "sessionId") sessionId = String(part.value);
        }
      }
    } else if (request.body && typeof request.body === "object") {
      const b = request.body as Record<string, unknown>;
      if (typeof b.text === "string") text = b.text;
      if (b.language === "en" || b.language === "hi") language = b.language;
      if (typeof b.conversationId === "string") conversationId = b.conversationId;
      if (typeof b.sessionId === "string") sessionId = b.sessionId;
    }

    if (!audioBuffer && !text) {
      return reply.code(400).send({ error: { code: "INPUT_REQUIRED", message: "Provide audio or text for voice conversation." } });
    }

    try {
      let history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
      if (conversationId && app.prisma) {
        try {
          const conv = await getConversation(app.prisma, conversationId, request.userId ?? undefined);
          if (conv?.messages) {
            history = conv.messages.map((m) => ({
              role: m.role.toLowerCase() as "user" | "assistant",
              content: m.content,
            }));
          }
        } catch {
          // ignore
        }
      }

      const turnResult = await voiceService.processVoiceTurn({
        sessionId,
        userId: request.userId ?? undefined,
        conversationId,
        audio: audioBuffer,
        filename,
        text,
        language,
        messages: history,
        onTranscript: async (tr) => {
          if (conversationId && app.prisma) {
            try {
              await addUserMessage(app.prisma, conversationId, tr, request.userId ?? undefined);
            } catch (err) {
              request.log.warn({ err }, "Could not save user voice message");
            }
          }
        },
        contextLoader: async (tr) => {
          if (!app.prisma) return {};
          try {
            const documentContext = await retrieveDocumentContext(app.prisma, tr, request.userId ?? undefined);
            const memoryContext = await retrieveRelevantMemories(app.prisma, tr, request.userId ?? undefined);
            return { documentContext, memoryContext };
          } catch {
            return {};
          }
        },
      });

      if (conversationId && app.prisma) {
        try {
          await addAssistantMessage(app.prisma, conversationId, turnResult.responseText);
        } catch (err) {
          request.log.warn({ err }, "Could not save assistant voice response");
        }
      }

      return {
        sessionId: turnResult.sessionId,
        transcript: turnResult.transcript,
        responseText: turnResult.responseText,
        audioBase64: turnResult.audio.toString("base64"),
        contentType: turnResult.contentType,
        emotion: turnResult.emotion,
        prosody: turnResult.prosody,
        durationMs: turnResult.durationMs,
      };
    } catch (error) {
      request.log.error({ err: error }, "Voice conversation failed");
      const message = error instanceof Error ? error.message : "Voice conversation failed.";
      return reply.code(500).send({ error: { code: "VOICE_TURN_FAILED", message } });
    }
  });

  // 4. Low-latency sentence-aware SSE voice conversation stream
  app.post("/api/voice/conversation/stream", async (request, reply) => {
    let audioBuffer: Buffer | undefined;
    let filename: string | undefined;
    let text: string | undefined;
    let language: "en" | "hi" = "en";
    let conversationId: string | undefined;
    let sessionId: string = `stream-session-${Date.now()}`;

    if (request.isMultipart()) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "audio") {
          audioBuffer = await part.toBuffer();
          filename = part.filename;
        } else if (part.type === "field") {
          if (part.fieldname === "text") text = String(part.value);
          else if (part.fieldname === "language" && (part.value === "en" || part.value === "hi")) language = part.value;
          else if (part.fieldname === "conversationId") conversationId = String(part.value);
          else if (part.fieldname === "sessionId") sessionId = String(part.value);
        }
      }
    } else if (request.body && typeof request.body === "object") {
      const b = request.body as Record<string, unknown>;
      if (typeof b.text === "string") text = b.text;
      if (b.language === "en" || b.language === "hi") language = b.language;
      if (typeof b.conversationId === "string") conversationId = b.conversationId;
      if (typeof b.sessionId === "string") sessionId = b.sessionId;
    }

    if (!audioBuffer && !text) {
      return reply.code(400).send({ error: { code: "INPUT_REQUIRED", message: "Provide audio or text for voice conversation." } });
    }

    // Set SSE headers
    const origin = request.headers.origin;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Allow-Credentials": "true",
    });

    const sendEvent = (eventData: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    // Handle client abrupt disconnect
    request.raw.on("close", () => {
      voiceService.interrupt(sessionId);
    });

    try {
      let history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
      if (conversationId && app.prisma) {
        try {
          const conv = await getConversation(app.prisma, conversationId, request.userId ?? undefined);
          if (conv?.messages) {
            history = conv.messages.map((m) => ({
              role: m.role.toLowerCase() as "user" | "assistant",
              content: m.content,
            }));
          }
        } catch {
          // ignore
        }
      }

      const generator = voiceService.streamVoiceTurn({
        sessionId,
        userId: request.userId ?? undefined,
        conversationId,
        audio: audioBuffer,
        filename,
        text,
        language,
        messages: history,
        onTranscript: async (tr) => {
          if (conversationId && app.prisma) {
            try {
              await addUserMessage(app.prisma, conversationId, tr, request.userId ?? undefined);
            } catch (err) {
              request.log.warn({ err }, "Could not save user voice message");
            }
          }
        },
        contextLoader: async (tr) => {
          if (!app.prisma) return {};
          try {
            const documentContext = await retrieveDocumentContext(app.prisma, tr, request.userId ?? undefined);
            const memoryContext = await retrieveRelevantMemories(app.prisma, tr, request.userId ?? undefined);
            return { documentContext, memoryContext };
          } catch {
            return {};
          }
        },
      });

      for await (const event of generator) {
        sendEvent(event);
        if (event.type === "done" && conversationId && app.prisma) {
          try {
            await addAssistantMessage(app.prisma, conversationId, event.fullText);
          } catch (err) {
            request.log.warn({ err }, "Could not save assistant voice response");
          }
        }
        if (event.type === "interrupted" || event.type === "error") {
          break;
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Stream error";
      sendEvent({ type: "error", message: msg, sessionId });
    } finally {
      reply.raw.end();
    }
  });

  // 5. Barge-in / Interruption endpoint
  app.post("/api/voice/interrupt", async (request) => {
    const body = interruptSchema.parse(request.body);
    voiceService.interrupt(body.sessionId);
    return {
      success: true,
      sessionId: body.sessionId,
      status: "interrupted",
    };
  });

  // 6. Inspect voice session & Ashvi profile
  app.get<{ Querystring: { sessionId?: string } }>("/api/voice/session", async (request) => {
    const sessionId = request.query.sessionId;
    const session = sessionId ? voiceService.getSession(sessionId) ?? null : null;
    return {
      profile: voiceService.getVoiceProfile(),
      session,
    };
  });
}
