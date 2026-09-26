import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { Environment } from "../config/env.js";
import { prismaPlugin } from "../database/prisma.plugin.js";
import { healthRoutes } from "../routes/health.routes.js";
import { conversationRoutes } from "../routes/conversation.routes.js";
import { documentRoutes } from "../routes/document.routes.js";
import { notebookRoutes } from "../routes/notebook.routes.js";
import { imageRoutes } from "../routes/image.routes.js";
import { memoryRoutes } from "../routes/memory.routes.js";
import { settingsRoutes } from "../routes/settings.routes.js";
import { taskRoutes } from "../routes/task.routes.js";
import { authRoutes } from "../routes/auth.routes.js";
import { voiceRoutes } from "../routes/voice.routes.js";
import { authPlugin } from "../plugins/auth.plugin.js";
import { proxyGatePlugin } from "../plugins/proxy-gate.plugin.js";
import { isAllowedBrowserOrigin, resolveAllowedOrigins } from "../auth/origins.js";
import type { AIProvider } from "../ai/provider.js";
import { NVIDIAProvider } from "../ai/nvidia.provider.js";
import { AshviOrchestrator, ProviderRegistry } from "../orchestrator/index.js";
import { WebSearchService } from "../tools/search.tool.js";
import { ImageService } from "../images/image.service.js";
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
    trustProxy: true,
    logger: {
      level: environment.ASHVI_LOG_LEVEL,
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-ashvi-proxy-key",
        "req.body.password",
        "req.body.code",
        "req.body.apiKey",
        "req.body.token",
        "req.query.key",
        "req.query.apiKey",
        "*.apiKey",
        "*.password",
      ],
    },
  });

  const allowedOrigins = resolveAllowedOrigins(environment);

  app.register(cors, {
    origin: (origin, callback) => {
      if (isAllowedBrowserOrigin(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Accept", "X-Requested-With", "X-Ashvi-Proxy-Key"],
  });
  app.register(cookie);
  app.register(proxyGatePlugin, { environment });

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

  // Core AI Provider & Services instantiation
  const nvidiaProvider = options.provider ?? new NVIDIAProvider({
    apiKey: environment.NVIDIA_API_KEY,
    baseURL: environment.NVIDIA_BASE_URL,
    defaultModel: environment.NVIDIA_MODEL,
    temperature: environment.NVIDIA_TEMPERATURE,
    topP: environment.NVIDIA_TOP_P,
    maxTokens: environment.NVIDIA_MAX_TOKENS,
    enableThinking: environment.NVIDIA_ENABLE_THINKING,
  });

  const registry = new ProviderRegistry();
  registry.register(
    {
      id: "nvidia",
      name: "NVIDIA Nemotron",
      provider: nvidiaProvider,
      defaultModel: environment.NVIDIA_MODEL,
      supportsStreaming: true,
      priority: 1,
    },
    true
  );

  const searchService = new WebSearchService({
    enabled: environment.ASHVI_SEARCH_ENABLED,
    tavilyApiKey: environment.TAVILY_API_KEY,
  });

  const imageService = new ImageService({
    enabled: environment.ASHVI_IMAGE_PROVIDER !== "disabled",
    provider:
      environment.ASHVI_IMAGE_PROVIDER === "openai"
        ? "openai"
        : environment.ASHVI_IMAGE_PROVIDER === "disabled"
        ? "disabled"
        : "pollinations",
    openaiApiKey: environment.OPENAI_API_KEY,
  });

  const orchestrator =
    options.orchestrator ??
    new AshviOrchestrator({
      registry,
      defaultProvider: nvidiaProvider,
      defaultModel: environment.NVIDIA_MODEL,
      logger: app.log,
      searchService,
      imageService,
    });

  app.register(healthRoutes, { environment });
  app.register(authRoutes, { environment });
  app.register(imageRoutes, { environment, imageService, provider: nvidiaProvider });
  app.register(notebookRoutes, { orchestrator });
  app.register(voiceRoutes, { environment, voiceService: options.voiceService, orchestrator, provider: nvidiaProvider });
  app.register(conversationRoutes, { environment, provider: nvidiaProvider, orchestrator });
  app.register(memoryRoutes);
  app.register(documentRoutes);
  app.register(settingsRoutes);
  app.register(taskRoutes);
  return app;
}
