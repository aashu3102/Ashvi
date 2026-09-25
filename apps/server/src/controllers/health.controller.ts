import type { FastifyReply, FastifyRequest } from "fastify";
import type { Environment } from "../config/env.js";
import { NVIDIAProvider } from "../ai/nvidia.provider.js";

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

  const nvidiaProvider = new NVIDIAProvider({
    apiKey: environment.NVIDIA_API_KEY,
    baseURL: environment.NVIDIA_BASE_URL,
    defaultModel: environment.NVIDIA_MODEL,
  });
  const nvidiaConfigured = Boolean(environment.NVIDIA_API_KEY);
  const nvidiaAvailable = nvidiaConfigured ? await nvidiaProvider.isAvailable().catch(() => false) : false;

  return reply.code(200).send({
    status: "ok",
    service: "ashvi-server",
    database: dbHealthy ? "ready" : "unhealthy",
    providers: {
      ai: {
        configured: nvidiaConfigured,
        available: nvidiaAvailable,
        provider: "NVIDIA Nemotron",
        model: environment.NVIDIA_MODEL,
        message: nvidiaConfigured ? "NVIDIA Nemotron configured" : "No AI provider configured",
      },
    },
    timestamp: new Date().toISOString(),
  });
}
