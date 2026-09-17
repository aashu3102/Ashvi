import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { Environment } from "../config/env.js";
import { prismaPlugin } from "../database/prisma.plugin.js";
import { healthRoutes } from "../routes/health.routes.js";
import { conversationRoutes } from "../routes/conversation.routes.js";
import { documentRoutes } from "../routes/document.routes.js";
import { memoryRoutes } from "../routes/memory.routes.js";
import { settingsRoutes } from "../routes/settings.routes.js";
import { authRoutes } from "../routes/auth.routes.js";
import { voiceRoutes } from "../routes/voice.routes.js";
import { authPlugin } from "../plugins/auth.plugin.js";
import type { AIProvider } from "../ai/provider.js";
import type { AshviOrchestrator } from "../orchestrator/index.js";
import type { VoiceService } from "../voice/index.js";

export function buildApp(
  environment: Environment,
  options: {
    withDatabase?: boolean;
    withAuth?: boolean;
    provider?: AIProvider;
    orchestrator?: AshviOrchestrator;
    voiceService?: VoiceService;
  } = {},
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: environment.ASHVI_LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password", "req.body.code", "req.body.apiKey"],
    },
  });

  const allowedOrigins = new Set([
    environment.ASHVI_FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3005",
    "http://127.0.0.1:3005",
  ]);

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || origin.endsWith(".vercel.app") || /^https:\/\/[a-zA-Z0-9-]+-.*\.vercel\.app$/.test(origin) || origin.includes("trycloudflare.com")) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Accept", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
  });
  app.register(cookie);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "Request failed");

    if (error.validation) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid request." } });
    }

    if (error.name === "ZodError") {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid request." } });
    }

    return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  if (options.withDatabase ?? true) {
    app.register(prismaPlugin, { environment });
  }

  app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });
  if ((options.withDatabase ?? true) && (environment.NODE_ENV !== "test" || options.withAuth)) app.register(authPlugin, { environment });
  app.register(healthRoutes);
  app.register(authRoutes, { environment });
  app.register(voiceRoutes, { environment, voiceService: options.voiceService, orchestrator: options.orchestrator });
  app.register(conversationRoutes, { environment, provider: options.provider, orchestrator: options.orchestrator });
  app.register(memoryRoutes);
  app.register(documentRoutes);
  app.register(settingsRoutes);
  return app;
}
