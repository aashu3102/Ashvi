import type { FastifyReply, FastifyRequest } from "fastify";
import type { Environment } from "../config/env.js";
import { OllamaProvider } from "../ai/ollama.provider.js";
import { GeminiProvider } from "../ai/gemini.provider.js";

export async function getHealth(_request: FastifyRequest, reply: FastifyReply) {
  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: _request.server.hasDecorator("prisma") ? "ready" : "not-configured",
    timestamp: new Date().toISOString(),
  });
}

export async function getProviderHealth(
  request: FastifyRequest,
  reply: FastifyReply,
  environment: Environment
) {
  let dbHealthy = false;
  if (request.server.hasDecorator("prisma") && request.server.prisma) {
    try {
      await request.server.prisma.$queryRaw`SELECT 1`;
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }
  }

  const qwen = new OllamaProvider(environment.OLLAMA_BASE_URL, environment.ASHVI_AI_MODEL);
  const qwenAvailable = await qwen.isAvailable().catch(() => false);

  const gemini = new GeminiProvider({
    apiKey: environment.GEMINI_API_KEY,
  });
  const geminiConfigured = Boolean(environment.GEMINI_API_KEY);
  const geminiAvailable = geminiConfigured ? await gemini.isAvailable().catch(() => false) : false;

  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: dbHealthy ? "ready" : "unhealthy",
    providers: {
      qwen: {
        configured: environment.LOCAL_QWEN_ENABLED,
        available: qwenAvailable,
      },
      gemini: {
        configured: geminiConfigured,
        available: geminiAvailable,
      },
      search: {
        configured: geminiConfigured && environment.GOOGLE_SEARCH_ENABLED,
        available: geminiAvailable && environment.GOOGLE_SEARCH_ENABLED,
      },
      imageGeneration: {
        configured: geminiConfigured,
        available: geminiAvailable,
      },
    },
    timestamp: new Date().toISOString(),
  });
}
